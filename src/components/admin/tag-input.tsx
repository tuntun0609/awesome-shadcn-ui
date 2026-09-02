/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  disabled?: boolean;
  id?: string;
  onChange: (tags: string[]) => void;
  value: string[];
}

export function TagInput({ disabled, id, onChange, value }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft("");
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-input px-2 py-1.5">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
          <button
            aria-label={`移除标签 ${tag}`}
            className="-mr-1 ml-1 rounded-sm p-0.5 hover:bg-muted-foreground/20"
            disabled={disabled}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        disabled={disabled}
        id={id}
        onBlur={addDraft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addDraft();
          } else if (
            event.key === "Backspace" &&
            draft === "" &&
            value.length > 0
          ) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={value.length === 0 ? "输入后按回车添加标签…" : ""}
        value={draft}
      />
    </div>
  );
}
