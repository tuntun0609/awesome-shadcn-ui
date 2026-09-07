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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { applyAutofillBatch, FIELD_LABELS } from "@/lib/ai/autofill-client";
import type {
  AutofillChatMessage,
  AutofillFieldMeta,
  AutofillFieldName,
  FillFieldStatus,
} from "@/lib/ai/autofill-schema";
import { fillFieldsInputSchema } from "@/lib/ai/autofill-schema";
import { cn } from "@/lib/utils";

const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getWideSnapshot() {
  return window.matchMedia(WIDE_QUERY).matches;
}
function getServerWideSnapshot() {
  return false;
}

interface AiAutofillChatProps {
  /** 字段级回调：fill_fields 客户端工具执行时回填表单。 */
  onField: (
    field: AutofillFieldName,
    value: string | string[],
    meta: AutofillFieldMeta
  ) => Exclude<FillFieldStatus, "invalid">;
  /** 每轮对话结束回调（正常结束才触发），用于触发 Logo 采集等后续动作。 */
  onRoundFinish: () => void;
}

/** 材料查看弹窗的内容。 */
interface MaterialState {
  content: string;
  title: string;
  url: string;
}

type ToolPart = Extract<
  AutofillChatMessage["parts"][number],
  { type: `tool-${string}` }
>;

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

/** 每批只展示一个摘要，展开后按字段定位核对。 */
function FillFieldsCard({
  part,
  onLocateField,
}: {
  part: Extract<ToolPart, { type: "tool-fill_fields" }>;
  onLocateField: (field: AutofillFieldName) => void;
}) {
  const output = part.state === "output-available" ? part.output : undefined;
  const results = output?.results ?? [];
  const labels: Record<FillFieldStatus, string> = {
    filled: "已填入",
    invalid: "校验失败",
    protected: "保留人工修改",
    review: "待核对",
  };
  return (
    <details className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">
      <summary className="cursor-pointer">
        批量回填{output ? ` · ${results.length} 个字段` : "…"}
        {output ? (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
            已填入{" "}
            {
              results.filter(
                (item) => item.status === "filled" || item.status === "review"
              ).length
            }
            <span>
              待核对 {results.filter((item) => item.status === "review").length}
            </span>
            <span>
              保留人工修改{" "}
              {results.filter((item) => item.status === "protected").length}
            </span>
            <span>
              校验失败{" "}
              {results.filter((item) => item.status === "invalid").length}
            </span>
          </span>
        ) : null}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {results
          .filter(
            (result, index) =>
              results.findIndex((item) => item.field === result.field) === index
          )
          .map((result) => (
            <button
              className="text-left text-xs hover:underline"
              key={result.field}
              onClick={() => onLocateField(result.field)}
              type="button"
            >
              {FIELD_LABELS[result.field]} · {labels[result.status]}
              {result.error ? `：${result.error}` : ""}
            </button>
          ))}
        {part.state === "output-error" ? (
          <p className="text-destructive text-xs">{part.errorText}</p>
        ) : null}
      </div>
    </details>
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
  onLocateField,
  onOpenMaterial,
  part,
}: {
  onOpenMaterial: (material: MaterialState) => void;
  onLocateField: (field: AutofillFieldName) => void;
  part: ToolPart;
}) {
  if (part.type === "tool-fill_fields") {
    return <FillFieldsCard onLocateField={onLocateField} part={part} />;
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
  onLocateField,
  message,
  onOpenMaterial,
}: {
  onLocateField: (field: AutofillFieldName) => void;
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
          onLocateField={onLocateField}
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
  const wide = useSyncExternalStore(
    subscribeWide,
    getWideSnapshot,
    getServerWideSnapshot
  );
  const [wideOpen, setWideOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const locatedField = useRef<HTMLElement | null>(null);
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
        if (toolCall.toolName !== "fill_fields") {
          return;
        }
        const parsed = fillFieldsInputSchema.safeParse(toolCall.input);
        if (!parsed.success) {
          addToolOutput({
            errorText: parsed.error.issues[0]?.message ?? "invalid input",
            state: "output-error",
            tool: "fill_fields",
            toolCallId: toolCall.toolCallId,
          });
          return;
        }
        const output = applyAutofillBatch(parsed.data, onFieldRef.current);
        addToolOutput({
          output,
          tool: "fill_fields",
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
    if (text === "" || (status !== "ready" && status !== "error")) {
      return;
    }
    sendMessage({ text });
    setInput("");
  }

  function handleLocateField(field: AutofillFieldName) {
    const target = document.getElementById(`ai-field-${field}`);
    locatedField.current = target;
    if (!wide) {
      setDrawerOpen(false);
    }
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }

  const panel = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
            if (wide) {
              setWideOpen(false);
            } else {
              setDrawerOpen(false);
            }
          }}
          size="icon-sm"
          type="button"
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
            会收集材料后批量填充表单，保留你的手工修改。
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageView
            key={message.id}
            message={message}
            onLocateField={handleLocateField}
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
          aria-label="发送给 AI 的消息"
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
            type="button"
            variant="outline"
          >
            <SquareIcon />
          </Button>
        ) : (
          <Button
            aria-label="发送"
            disabled={
              input.trim() === "" || (status !== "ready" && status !== "error")
            }
            onClick={handleSend}
            size="icon"
            type="button"
          >
            <SendIcon />
          </Button>
        )}
      </div>
    </div>
  );

  const desktopPanel = wideOpen ? (
    <aside
      aria-label="AI 对话填充"
      className="fixed inset-y-0 right-0 z-30 h-dvh w-(--ai-sidebar-width) border-l bg-card"
      data-ai-sidebar="open"
    >
      {panel}
    </aside>
  ) : (
    <Button
      className="fixed top-3 right-4 z-30 bg-background"
      onClick={() => setWideOpen(true)}
      type="button"
      variant="outline"
    >
      <SparklesIcon />
      AI 对话填充{busy ? " · 处理中" : ""}
    </Button>
  );

  return (
    <>
      {wide ? (
        desktopPanel
      ) : (
        <Sheet onOpenChange={setDrawerOpen} open={drawerOpen}>
          <SheetTrigger
            onClick={() => {
              locatedField.current = null;
            }}
            render={
              <Button className="self-start" type="button" variant="outline" />
            }
          >
            <SparklesIcon />
            AI 对话填充{busy ? " · 处理中" : ""}
          </SheetTrigger>
          <SheetContent
            className="data-[side=right]:w-[min(100%,26rem)] data-[side=right]:sm:max-w-none"
            finalFocus={() => locatedField.current ?? true}
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">AI 对话填充</SheetTitle>
            <SheetDescription className="sr-only">
              发送官网地址，收集材料并批量回填表单。
            </SheetDescription>
            {panel}
          </SheetContent>
        </Sheet>
      )}
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
