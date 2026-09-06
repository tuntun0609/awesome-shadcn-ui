import type { AutofillFieldMeta } from "@/lib/ai/autofill-schema";
import { cn } from "@/lib/utils";

interface FormFieldShellProps {
  children: React.ReactNode;
  className?: string;
  error?: string;
  htmlFor?: string;
  label: string;
  /** AI 填充字段的来源与置信度角标（低置信度以警示色显示）。 */
  meta?: AutofillFieldMeta;
}

function confidencePercent(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function FormFieldShell({
  children,
  className,
  error,
  htmlFor,
  label,
  meta,
}: FormFieldShellProps) {
  const lowConfidence = meta?.confidence !== undefined && meta.confidence < 0.7;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="font-medium text-sm leading-none" htmlFor={htmlFor}>
          {label}
        </label>
        {meta ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-normal text-muted-foreground text-xs",
              lowConfidence
                ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted"
            )}
            title={`AI 填充${meta.source ? `，来源：${meta.source}` : ""}${
              meta.confidence === undefined
                ? ""
                : `，置信度 ${confidencePercent(meta.confidence)}`
            }`}
          >
            AI{meta.source ? ` · ${meta.source}` : ""}
            {meta.confidence === undefined
              ? ""
              : ` · ${confidencePercent(meta.confidence)}`}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
