/** biome-ignore-all lint/performance/noJsxPropsBind: 聊天交互组件，内联事件处理器依赖闭包状态。 */
"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import {
  CheckIcon,
  GlobeIcon,
  LoaderCircleIcon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  AutofillChatMessage,
  AutofillFieldMeta,
  AutofillFieldName,
} from "@/lib/ai/autofill-schema";
import { fillFieldInputSchema } from "@/lib/ai/autofill-schema";
import { libraryFormSchema } from "@/lib/library-form-schema";
import { cn } from "@/lib/utils";

interface AiAutofillChatProps {
  /** 字段级回调：fill_field 客户端工具执行时回填表单。 */
  onField: (
    field: AutofillFieldName,
    value: unknown,
    meta: AutofillFieldMeta
  ) => void;
  /** 每轮对话结束回调（正常结束才触发），用于触发 Logo 采集等后续动作。 */
  onRoundFinish: () => void;
}

/** 材料查看弹窗的内容。 */
interface MaterialState {
  content: string;
  title: string;
  url: string;
}

/** 表单中值为字符串数组的字段。 */
const ARRAY_FIELDS = new Set<AutofillFieldName>([
  "deliveries",
  "tags",
  "useCases",
]);

/** 数组字段接受逗号 / 中文顿号分隔的字符串。 */
const SEPARATOR_PATTERN = /[,，、]/;

/** 值为字符串但字段要求数组时的宽容转换：JSON 数组文本或分隔符字符串。 */
function coerceArrayInput(field: AutofillFieldName, value: unknown) {
  if (
    !ARRAY_FIELDS.has(field) ||
    Array.isArray(value) ||
    typeof value !== "string"
  ) {
    return value;
  }
  const text = value.trim();
  if (text.startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }
  if (text === "") {
    return [];
  }
  return text
    .split(SEPARATOR_PATTERN)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

type ToolPart = Extract<
  AutofillChatMessage["parts"][number],
  { type: `tool-${string}` }
>;

const FIELD_LABELS: Record<AutofillFieldName, string> = {
  access: "访问方式",
  deliveries: "交付类型",
  description: "简介",
  github: "GitHub 仓库",
  name: "名称",
  pricing: "收费模式",
  slug: "Slug",
  source: "源码开放程度",
  tags: "标签",
  useCases: "使用场景",
  website: "官网地址",
};

function formatValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join("、");
  }
  if (typeof value === "string") {
    return value === "" ? "（空）" : value;
  }
  return JSON.stringify(value);
}

/** 工具卡片的运行状态图标。 */
function ToolStatusIcon({ ok, state }: { ok: boolean; state: string }) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
    );
  }
  if (state === "output-error" || ok === false) {
    return <XIcon className="size-3.5 text-destructive" />;
  }
  return (
    <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
  );
}

/** fill_field 工具卡片：字段名、值与 provenance。 */
function FillFieldCard({
  part,
}: {
  part: Extract<ToolPart, { type: "tool-fill_field" }>;
}) {
  const input = part.state === "input-streaming" ? undefined : part.input;
  const ok = part.state === "output-available" && part.output?.ok !== false;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
      <ToolStatusIcon ok={ok} state={part.state} />
      {input ? (
        <>
          <span className="font-medium">{FIELD_LABELS[input.field]}</span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {formatValue(input.value)}
          </span>
          <span className="text-muted-foreground text-xs">
            {input.source} · {Math.round(input.confidence * 100)}%
          </span>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <span className="text-destructive text-xs">{part.errorText}</span>
      ) : null}
      {part.state === "output-available" && part.output?.ok === false ? (
        <span className="text-destructive text-xs">{part.output.error}</span>
      ) : null}
    </div>
  );
}

/** fetch_page 工具卡片：抓取的网页与查看原文入口。 */
function FetchPageCard({
  onOpenMaterial,
  part,
}: {
  onOpenMaterial: (material: MaterialState) => void;
  part: Extract<ToolPart, { type: "tool-fetch_page" }>;
}) {
  const input = part.state === "input-streaming" ? undefined : part.input;
  const output = part.state === "output-available" ? part.output : undefined;
  const markdown = output?.ok === true ? output.markdown : undefined;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <GlobeIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">抓取网页</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {input?.url ?? ""}
        </span>
        <ToolStatusIcon ok={output?.ok === true} state={part.state} />
      </div>
      {output?.ok === false ? (
        <span className="text-destructive text-xs">{output.error}</span>
      ) : null}
      {markdown && input ? (
        <button
          className="self-start text-primary text-xs hover:underline"
          onClick={() =>
            onOpenMaterial({
              content: markdown,
              title: input.url,
              url: input.url,
            })
          }
          type="button"
        >
          查看原文
        </button>
      ) : null}
    </div>
  );
}

/** fetch_github_repo 工具卡片：仓库元数据与查看 README 入口。 */
function FetchGithubRepoCard({
  onOpenMaterial,
  part,
}: {
  onOpenMaterial: (material: MaterialState) => void;
  part: Extract<ToolPart, { type: "tool-fetch_github_repo" }>;
}) {
  const input = part.state === "input-streaming" ? undefined : part.input;
  const output = part.state === "output-available" ? part.output : undefined;
  const readme = output?.ok === true ? output.readme : undefined;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <ToolStatusIcon ok={output?.ok === true} state={part.state} />
        <span className="font-medium">抓取 GitHub 仓库</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {input ? `${input.owner}/${input.repo}` : ""}
        </span>
      </div>
      {output?.ok === false ? (
        <span className="text-destructive text-xs">{output.error}</span>
      ) : null}
      {output?.ok === true ? (
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          {output.license ? <span>License：{output.license}</span> : null}
          {output.homepage ? <span>主页：{output.homepage}</span> : null}
          {readme && input ? (
            <button
              className="text-primary hover:underline"
              onClick={() =>
                onOpenMaterial({
                  content: readme,
                  title: `${input.owner}/${input.repo} README`,
                  url: `https://github.com/${input.owner}/${input.repo}`,
                })
              }
              type="button"
            >
              查看 README
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 渲染单个工具调用卡片（抓取网页 / 抓取仓库 / 填充字段）。 */
function ToolPartView({
  onOpenMaterial,
  part,
}: {
  onOpenMaterial: (material: MaterialState) => void;
  part: ToolPart;
}) {
  if (part.type === "tool-fill_field") {
    return <FillFieldCard part={part} />;
  }
  if (part.type === "tool-fetch_page") {
    return <FetchPageCard onOpenMaterial={onOpenMaterial} part={part} />;
  }
  if (part.type === "tool-fetch_github_repo") {
    return <FetchGithubRepoCard onOpenMaterial={onOpenMaterial} part={part} />;
  }
  return null;
}

/** 渲染一条消息：用户右对齐气泡；助手按 part 顺序渲染文本与工具卡片。 */
function MessageView({
  message,
  onOpenMaterial,
}: {
  message: AutofillChatMessage;
  onOpenMaterial: (material: MaterialState) => void;
}) {
  if (message.role === "user") {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n");
    if (text === "") {
      return null;
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-primary-foreground text-sm">
          {text}
        </div>
      </div>
    );
  }

  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  const toolParts = message.parts.filter((part): part is ToolPart =>
    part.type.startsWith("tool-")
  );
  if (text === "" && toolParts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {text === "" ? null : (
        <div className="max-w-[95%] whitespace-pre-wrap rounded-2xl bg-muted px-3 py-2 text-sm">
          {text}
        </div>
      )}
      {toolParts.map((part) => (
        <ToolPartView
          key={part.toolCallId}
          onOpenMaterial={onOpenMaterial}
          part={part}
        />
      ))}
    </div>
  );
}

export function AiAutofillChat({
  onField,
  onRoundFinish,
}: AiAutofillChatProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const [material, setMaterial] = useState<MaterialState | null>(null);
  /** 滚动容器经 state 挂载：消息更新时自动滚动到底部。 */
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  /** useChat 的回调在 Chat 实例创建时固化，用 ref 转发最新闭包。 */
  const onFieldRef = useRef(onField);
  const onRoundFinishRef = useRef(onRoundFinish);

  useEffect(() => {
    onFieldRef.current = onField;
    onRoundFinishRef.current = onRoundFinish;
  }, [onField, onRoundFinish]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AutofillChatMessage>({
        api: "/api/ai/autofill",
      }),
    []
  );

  const { addToolOutput, error, messages, sendMessage, status, stop } =
    useChat<AutofillChatMessage>({
      onError: (cause) => {
        toast.error(`AI 填充出错：${cause.message}`);
      },
      onFinish: ({ isAbort, isError }) => {
        if (!(isAbort || isError)) {
          onRoundFinishRef.current();
        }
      },
      onToolCall: ({ toolCall }) => {
        if (toolCall.toolName !== "fill_field") {
          return;
        }
        const parsed = fillFieldInputSchema.safeParse(toolCall.input);
        if (!parsed.success) {
          addToolOutput({
            errorText: parsed.error.issues[0]?.message ?? "invalid input",
            state: "output-error",
            tool: "fill_field",
            toolCallId: toolCall.toolCallId,
          });
          return;
        }
        const { confidence, field, source } = parsed.data;
        const coerced = coerceArrayInput(field, parsed.data.value);
        const check = libraryFormSchema.shape[field].safeParse(coerced);
        if (!check.success) {
          addToolOutput({
            errorText:
              check.error.issues[0]?.message ??
              `值不符合字段要求，${field} 需为字符串数组`,
            state: "output-error",
            tool: "fill_field",
            toolCallId: toolCall.toolCallId,
          });
          return;
        }
        onFieldRef.current(field, check.data, { confidence, source });
        addToolOutput({
          output: { ok: true },
          tool: "fill_field",
          toolCallId: toolCall.toolCallId,
        });
      },
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      transport,
    });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight });
  }, [messages, scrollEl]);

  function handleSend() {
    const text = input.trim();
    if (text === "" || status !== "ready") {
      return;
    }
    sendMessage({ text });
    setInput("");
  }

  if (!open) {
    return (
      <div className="xl:order-2">
        <Button onClick={() => setOpen(true)} variant="outline">
          <SparklesIcon />
          AI 对话填充
        </Button>
      </div>
    );
  }

  return (
    <>
      <aside className="flex h-[28rem] w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm xl:sticky xl:top-6 xl:order-2 xl:h-[calc(100svh-9rem)] xl:w-96">
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-heading font-medium text-base">
              AI 对话填充
            </span>
            <span className="text-muted-foreground text-xs">
              粘贴官网地址开始研究，也可对话修正已填字段。
            </span>
          </div>
          <Button
            aria-label="收起对话面板"
            onClick={() => {
              setMaterial(null);
              setOpen(false);
            }}
            size="icon-sm"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          ref={setScrollEl}
        >
          {messages.length === 0 ? (
            <div className="m-auto max-w-64 text-center text-muted-foreground text-sm">
              <SparklesIcon className="mx-auto mb-2 size-6" />
              发送组件库官网地址（如 https://magicui.design/）， AI
              会自动抓取材料并逐字段填充表单。
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageView
              key={message.id}
              message={message}
              onOpenMaterial={setMaterial}
            />
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              {status === "submitted" ? "正在请求…" : "思考中…"}
            </div>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm">出错了：{error.message}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex items-end gap-2 border-t p-3",
            busy && "opacity-80"
          )}
        >
          <Textarea
            className="field-sizing-content max-h-32 min-h-9 resize-none"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="粘贴官网地址，或描述要修正的字段"
            rows={1}
            value={input}
          />
          {busy ? (
            <Button
              aria-label="停止生成"
              onClick={stop}
              size="icon"
              variant="outline"
            >
              <SquareIcon />
            </Button>
          ) : (
            <Button
              aria-label="发送"
              disabled={input.trim() === "" || status !== "ready"}
              onClick={handleSend}
              size="icon"
            >
              <SendIcon />
            </Button>
          )}
        </div>
      </aside>
      <Dialog
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setMaterial(null);
          }
        }}
        open={material !== null}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{material?.title}</DialogTitle>
            <DialogDescription className="truncate">
              {material?.url}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-mono text-xs">
            {material?.content}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
