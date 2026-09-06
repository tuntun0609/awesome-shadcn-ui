import { auth } from "@clerk/nextjs/server";
import type { ToolSet } from "ai";
import {
  isStepCount,
  parsePartialJson,
  type TextStreamPart,
  ToolLoopAgent,
} from "ai";
import { z } from "zod";
import { isAdminSession } from "@/lib/admin-auth";
import type { AutofillSseEvent } from "@/lib/ai/autofill-events";
import type { AutofillPartialOutput } from "@/lib/ai/autofill-schema";
import { autofillOutputSchema } from "@/lib/ai/autofill-schema";
import {
  AUTOFILL_INSTRUCTIONS,
  buildAutofillPrompt,
} from "@/lib/ai/instructions";
import { getAutofillModel } from "@/lib/ai/provider";
import { createAutofillTools } from "@/lib/ai/tools";

/** 整体软超时（ADR 0003 决策 #15）：兜底 Netlify 同步函数 60s 硬顶。 */
const TOTAL_TIMEOUT_MS = 55_000;
/** 工具循环步数上限：约 5 次工具调用 + 3 次推理/作答。 */
const MAX_STEPS = 8;

const inputSchema = z.object({ url: z.string().url() });

const encoder = new TextEncoder();

/** SSE 帧：Safari 会缓冲 1024 字节，首帧用注释垫满以实现立即渲染。 */
const PADDING = `: ${" ".repeat(2048)}\n\n`;

function encodeEvent(event: AutofillSseEvent) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function stepLabel(toolName: string, input: unknown) {
  if (toolName === "fetch_page") {
    const url = (input as { url?: string } | null)?.url ?? "";
    return `抓取网页 ${url}`;
  }
  if (toolName === "fetch_github_repo") {
    const { owner, repo } =
      (input as { owner?: string; repo?: string } | null) ?? {};
    return `抓取 GitHub 仓库 ${owner ?? ""}/${repo ?? ""}`;
  }
  return `调用工具 ${toolName}`;
}

/** 从模型回复文本中截取 JSON 候选片段（首个 { 到最后一个 }）。 */
function extractJsonText(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) {
    return undefined;
  }
  const end = text.lastIndexOf("}");
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

/** 宽容解析文本中的（可能不完整的）JSON，按顶层字段 diff 后映射为 field 事件。 */
async function pushFields(
  text: string,
  previous: Map<string, string>,
  push: (event: AutofillSseEvent) => void
) {
  const candidate = extractJsonText(text);
  if (!candidate) {
    return;
  }
  const { value } = await parsePartialJson(candidate);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const record = value as AutofillPartialOutput;
  for (const [field, snapshot] of Object.entries(record)) {
    const serialized = JSON.stringify(snapshot ?? null);
    if (previous.get(field) === serialized) {
      continue;
    }
    previous.set(field, serialized);
    const meta = snapshot as
      | { confidence?: number; source?: string; value?: unknown }
      | undefined;
    push({
      confidence: meta?.confidence,
      field,
      source: meta?.source,
      type: "field",
      value: meta?.value,
    });
  }
}

/**
 * 消费 fullStream：工具调用映射为 step 事件；文本增量解析为 field 事件。
 * 返回累计文本与是否已推送 error（error/abort 后不再补发 done）。
 */
async function pumpSteps<T extends ToolSet>(
  fullStream: AsyncIterable<TextStreamPart<T>>,
  push: (event: AutofillSseEvent) => void,
  onStepStart: () => void
): Promise<{ errored: boolean; previous: Map<string, string>; text: string }> {
  const running = new Map<string, string>();
  const previous = new Map<string, string>();
  let text = "";
  for await (const part of fullStream) {
    switch (part.type) {
      case "text-delta": {
        onStepStart();
        text += part.text;
        if (text.includes("}")) {
          await pushFields(text, previous, push);
        }
        break;
      }
      case "tool-call": {
        onStepStart();
        const id = part.toolCallId;
        const label = stepLabel(part.toolName, part.input);
        running.set(id, label);
        push({ id, label, status: "running", type: "step" });
        break;
      }
      case "tool-result": {
        const id = part.toolCallId;
        const label = running.get(id) ?? `调用工具 ${part.toolName}`;
        const output = part.output as { error?: string; ok?: boolean } | null;
        if (output && output.ok === false) {
          push({
            detail: output.error,
            id,
            label,
            status: "error",
            type: "step",
          });
        } else {
          push({ id, label, status: "done", type: "step" });
        }
        break;
      }
      case "abort": {
        push({
          message: "AI 填充超时，已保存部分结果，可重试或手动补全",
          type: "error",
        });
        return { errored: true, previous, text };
      }
      case "error": {
        push({
          message: `AI 填充出错：${part.error instanceof Error ? part.error.message : "未知错误"}`,
          type: "error",
        });
        return { errored: true, previous, text };
      }
      default:
        break;
    }
  }
  return { errored: false, previous, text };
}

export async function POST(request: Request) {
  // ADR 0003 决策 #14：鉴权沿用 ADR 0002 语义，非 admin 一律 404。
  const { sessionClaims, userId } = await auth();
  if (!(userId && isAdminSession(sessionClaims))) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "URL 无效" },
      { status: 400 }
    );
  }

  let model: ReturnType<typeof getAutofillModel>;
  try {
    model = getAutofillModel();
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "AI 配置缺失" },
      { status: 500 }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (event: AutofillSseEvent) => {
        if (!closed) {
          controller.enqueue(encodeEvent(event));
        }
      };
      controller.enqueue(encoder.encode(PADDING));

      const agent = new ToolLoopAgent({
        instructions: AUTOFILL_INSTRUCTIONS,
        model,
        stopWhen: isStepCount(MAX_STEPS),
        tools: createAutofillTools((material) => {
          push({ type: "material", ...material });
        }),
      });

      let fieldStarted = false;
      try {
        const result = await agent.stream({
          abortSignal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
          prompt: buildAutofillPrompt(parsed.data.url),
        });
        const { errored, previous, text } = await pumpSteps(
          result.fullStream,
          push,
          () => {
            if (!fieldStarted) {
              fieldStarted = true;
              push({
                id: "extract",
                label: "提取字段中",
                status: "running",
                type: "step",
              });
            }
          }
        );
        if (fieldStarted) {
          push({
            id: "extract",
            label: "提取字段中",
            status: "done",
            type: "step",
          });
        }
        if (errored) {
          return;
        }
        const candidate = extractJsonText(text);
        let finalOutput: unknown;
        try {
          finalOutput = candidate ? JSON.parse(candidate) : undefined;
        } catch {
          finalOutput = undefined;
        }
        if (autofillOutputSchema.safeParse(finalOutput).success) {
          // 用完整结果再 diff 一轮，确保最后一个字段也已推送
          await pushFields(text, previous, push);
          push({ type: "done" });
        } else {
          push({
            message: "AI 填充失败：返回内容无法解析为预期的字段结构",
            type: "error",
          });
        }
      } catch (cause) {
        push({
          message: `AI 填充失败：${cause instanceof Error ? cause.message : "未知错误"}`,
          type: "error",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
