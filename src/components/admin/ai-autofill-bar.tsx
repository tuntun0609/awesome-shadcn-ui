/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import {
  ChevronDownIcon,
  GlobeIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AutofillFieldMeta,
  AutofillSseEvent,
  AutofillStepStatus,
} from "@/lib/ai/autofill-events";
import { parseAutofillSseChunk } from "@/lib/ai/autofill-events";
import { cn } from "@/lib/utils";

interface StepState {
  detail?: string;
  id: string;
  label: string;
  status: AutofillStepStatus;
}

interface MaterialState {
  content: string;
  id: string;
  title: string;
  url: string;
}

interface AiAutofillBarProps {
  /** 字段级回调：值与 provenance 元数据流式回填进表单。 */
  onField: (field: string, value: unknown, meta: AutofillFieldMeta) => void;
  /** 流结束回调（无论成败），用于触发后续动作（如 Logo 采集）。 */
  onFinish: () => void;
}

const STEP_STATUS_CLASS: Record<AutofillStepStatus, string> = {
  done: "text-emerald-600",
  error: "text-destructive",
  running: "text-muted-foreground animate-pulse",
};

function stepGlyph(status: AutofillStepStatus) {
  if (status === "done") {
    return "✓";
  }
  if (status === "error") {
    return "✗";
  }
  return "…";
}

/** 逐帧解析 SSE 流并回调；返回流是否以 done/error 事件收尾。 */
async function consumeAutofillStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AutofillSseEvent) => void
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let streamDone = false;
  while (!streamDone) {
    // biome-ignore lint/performance/noAwaitInLoops: 流式读取必须逐帧 await，否则无法实时渲染
    const chunk = await reader.read();
    streamDone = chunk.done;
    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const event of parseAutofillSseChunk(frame)) {
          onEvent(event);
          if (event.type === "done" || event.type === "error") {
            finished = true;
          }
        }
      }
    }
  }
  return finished;
}

export function AiAutofillBar({ onField, onFinish }: AiAutofillBarProps) {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [materials, setMaterials] = useState<MaterialState[]>([]);
  const [openMaterial, setOpenMaterial] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleEvent(event: AutofillSseEvent) {
    switch (event.type) {
      case "step":
        setSteps((prev) => [
          ...prev.filter((step) => step.id !== event.id),
          {
            detail: event.detail,
            id: event.id,
            label: event.label,
            status: event.status,
          },
        ]);
        break;
      case "material":
        setMaterials((prev) => [
          ...prev,
          {
            content: event.content,
            id: event.id,
            title: event.title,
            url: event.url,
          },
        ]);
        break;
      case "field":
        onField(event.field, event.value, {
          confidence: event.confidence,
          source: event.source,
        });
        break;
      case "error":
        toast.error(event.message);
        break;
      case "done":
        toast.success("AI 填充完成，请逐字段审核后提交");
        break;
      default:
        break;
    }
  }

  async function startAutofill() {
    const trimmed = url.trim();
    if (trimmed === "" || running) {
      return;
    }
    setRunning(true);
    setSteps([]);
    setMaterials([]);
    setOpenMaterial(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/ai/autofill", {
        body: JSON.stringify({ url: trimmed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      if (!(response.ok && response.body)) {
        toast.error(`AI 填充请求失败（${response.status}）`);
        return;
      }
      const finished = await consumeAutofillStream(response.body, handleEvent);
      if (!finished) {
        toast.info("连接中断，已保存部分结果");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        toast.error("AI 填充失败，请稍后重试");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      onFinish();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="组件库官网地址"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="粘贴组件库官网地址，如 https://magicui.design/"
          type="url"
          value={url}
        />
        {running ? (
          <Button
            onClick={() => abortRef.current?.abort()}
            type="button"
            variant="outline"
          >
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
            停止
          </Button>
        ) : (
          <Button
            disabled={url.trim() === ""}
            onClick={startAutofill}
            type="button"
          >
            <SparklesIcon data-icon="inline-start" />
            AI 填充
          </Button>
        )}
      </div>

      {steps.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {steps.map((step) => (
            <li className="flex items-center gap-2 text-sm" key={step.id}>
              <span
                aria-hidden="true"
                className={cn("font-mono", STEP_STATUS_CLASS[step.status])}
              >
                {stepGlyph(step.status)}
              </span>
              <span
                className={cn(
                  "max-w-full truncate",
                  step.status === "running" && "text-muted-foreground"
                )}
                title={step.detail ?? step.label}
              >
                {step.label}
                {step.detail ? `（${step.detail}）` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {materials.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            本次采集的原始材料（仅本次会话可见，供审核参考）
          </p>
          {materials.map((material) => (
            <div className="rounded-lg border" key={material.id}>
              <button
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm"
                onClick={() => {
                  setOpenMaterial(
                    openMaterial === material.id ? null : material.id
                  );
                }}
                type="button"
              >
                <GlobeIcon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {material.title}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 transition-transform",
                    openMaterial === material.id && "rotate-180"
                  )}
                />
              </button>
              {openMaterial === material.id ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t px-3 py-2 font-mono text-xs">
                  {material.content}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
