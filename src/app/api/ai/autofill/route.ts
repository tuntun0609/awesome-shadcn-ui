import { auth } from "@clerk/nextjs/server";
import { createAgentUIStreamResponse, isStepCount, ToolLoopAgent } from "ai";
import { z } from "zod";
import { isAdminSession } from "@/lib/admin-auth";
import type { AutofillChatMessage } from "@/lib/ai/autofill-schema";
import { AUTOFILL_INSTRUCTIONS } from "@/lib/ai/instructions";
import { getAutofillModel } from "@/lib/ai/provider";
import { createAutofillTools } from "@/lib/ai/tools";

/** 单轮请求软超时（ADR 0003 决策 #15）：兜底 Netlify 同步函数 60s 硬顶。 */
const TOTAL_TIMEOUT_MS = 55_000;
/** 工具循环步数上限：约 5 次工具调用 + 2 次推理 + 1 次客户端工具往返。 */
const MAX_STEPS = 8;
/** 回传历史中工具结果的截断长度：最新一轮完整保留，更早轮次裁剪省 token。 */
const TRUNCATED_TOOL_OUTPUT_CHARS = 2000;

const bodySchema = z.object({
  messages: z.array(z.custom<AutofillChatMessage>()),
});

/** 截断单段文本；不足阈值时原样返回。 */
function truncateText(text: string) {
  return text.length <= TRUNCATED_TOOL_OUTPUT_CHARS
    ? text
    : `${text.slice(0, TRUNCATED_TOOL_OUTPUT_CHARS)}…[truncated]`;
}

/**
 * 历史裁剪：最后一次用户消息之前的轮次中，把抓取工具的长文本输出
 * 截断为摘要，避免多轮对话 token 膨胀（最新一轮不裁剪）。
 */
function truncateHistory(messages: AutofillChatMessage[]) {
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user"
  );
  return messages.map((message, index) => {
    if (index >= lastUserIndex) {
      return message;
    }
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (
          part.type === "tool-fetch_page" &&
          part.state === "output-available" &&
          typeof part.output?.markdown === "string"
        ) {
          return {
            ...part,
            output: {
              ...part.output,
              markdown: truncateText(part.output.markdown),
            },
          };
        }
        if (
          part.type === "tool-fetch_github_repo" &&
          part.state === "output-available" &&
          typeof part.output?.readme === "string"
        ) {
          return {
            ...part,
            output: {
              ...part.output,
              readme: truncateText(part.output.readme),
            },
          };
        }
        return part;
      }),
    };
  });
}

export async function POST(request: Request) {
  // ADR 0003 决策 #14：鉴权沿用 ADR 0002 语义，非 admin 一律 404。
  const { sessionClaims, userId } = await auth();
  if (!(userId && isAdminSession(sessionClaims))) {
    return new Response(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || parsed.data.messages.length === 0) {
    return Response.json({ message: "请求体无效" }, { status: 400 });
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

  const agent = new ToolLoopAgent({
    instructions: AUTOFILL_INSTRUCTIONS,
    model,
    stopWhen: isStepCount(MAX_STEPS),
    tools: createAutofillTools(),
  });

  return createAgentUIStreamResponse({
    abortSignal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
    agent,
    uiMessages: truncateHistory(parsed.data.messages),
  });
}
