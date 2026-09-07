"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatValue } from "@/lib/ai/autofill-client";
import {
  type AutofillFieldMeta,
  type AutofillFieldName,
  needsAutofillReview,
} from "@/lib/ai/autofill-schema";
import { cn } from "@/lib/utils";

export interface AutofillCandidate {
  meta: AutofillFieldMeta;
  value: string | string[];
}

interface FormFieldShellProps {
  candidate?: AutofillCandidate;
  children: React.ReactNode;
  className?: string;
  currentValue?: unknown;
  error?: string;
  fieldName?: AutofillFieldName;
  htmlFor?: string;
  label: string;
  meta?: AutofillFieldMeta;
  onKeepCurrent?: (field: AutofillFieldName) => void;
  onUseCandidate?: (field: AutofillFieldName) => void;
}

function Provenance({ meta }: { meta: AutofillFieldMeta }) {
  const missingSource =
    !meta.source?.trim() || meta.source.trim().toLowerCase() === "n/a";
  const lowConfidence = (meta.confidence ?? 0) < 0.7;
  return (
    <div className="space-y-3 break-words text-sm">
      {missingSource || lowConfidence ? (
        <p className="text-amber-700 dark:text-amber-400">
          待核对原因：
          {[
            missingSource ? "缺少来源" : "",
            lowConfidence ? "AI 自评置信度低于 70%" : "",
          ]
            .filter(Boolean)
            .join("、")}
        </p>
      ) : null}
      <p>来源：{missingSource ? "未提供" : meta.source}</p>
      {meta.source?.startsWith("https://") ||
      meta.source?.startsWith("http://") ? (
        <a
          className="text-primary underline"
          href={meta.source}
          rel="noreferrer"
          target="_blank"
        >
          打开来源
        </a>
      ) : null}
      <p>
        AI 自评置信度：
        {meta.confidence === undefined
          ? "未提供"
          : `${Math.round(meta.confidence * 100)}%`}
        。高分不代表已验证，请结合原始材料判断。
      </p>
    </div>
  );
}

export function FormFieldShell({
  candidate,
  children,
  className,
  currentValue,
  error,
  fieldName,
  htmlFor,
  label,
  meta,
  onKeepCurrent,
  onUseCandidate,
}: FormFieldShellProps) {
  const handleKeep = useCallback(() => {
    if (fieldName) {
      onKeepCurrent?.(fieldName);
    }
  }, [fieldName, onKeepCurrent]);
  const handleUse = useCallback(() => {
    if (fieldName) {
      onUseCandidate?.(fieldName);
    }
  }, [fieldName, onUseCandidate]);
  return (
    <div
      className={cn("flex min-w-0 scroll-mt-8 flex-col gap-2", className)}
      id={fieldName ? `ai-field-${fieldName}` : undefined}
      tabIndex={-1}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <label className="font-medium text-sm leading-snug" htmlFor={htmlFor}>
          {label}
        </label>
        {meta ? (
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  className={cn(
                    "h-6 shrink-0 px-2 text-xs",
                    needsAutofillReview(meta) &&
                      "border-amber-500/50 text-amber-700 dark:text-amber-400"
                  )}
                  size="sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              {needsAutofillReview(meta) ? "待核对" : "AI"}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{label} · AI 填充信息</DialogTitle>
                <DialogDescription>核对来源与当前字段内容。</DialogDescription>
              </DialogHeader>
              <Provenance meta={meta} />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {children}
      {candidate ? (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">已保留人工修改</p>
          <p className="break-words">当前值：{formatValue(currentValue)}</p>
          <p className="break-words">AI 候选：{formatValue(candidate.value)}</p>
          <details>
            <summary className="cursor-pointer text-xs">
              查看候选来源与置信度
            </summary>
            <div className="mt-2">
              <Provenance meta={candidate.meta} />
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleKeep}
              size="sm"
              type="button"
              variant="outline"
            >
              保留当前值
            </Button>
            <Button onClick={handleUse} size="sm" type="button">
              使用 AI 值
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
