/** 自定 SSE 协议（ADR 0003 决策 #8）：step / material / field / done / error 五类事件。 */
export type AutofillStepStatus = "running" | "done" | "error";

/** AI 填充字段的 provenance 元数据（ADR 0003 决策 #7）。 */
export interface AutofillFieldMeta {
  confidence?: number;
  source?: string;
}

export type AutofillSseEvent =
  | {
      confidence?: number;
      field: string;
      source?: string;
      type: "field";
      value?: unknown;
    }
  | { type: "done" }
  | { message: string; type: "error" }
  | {
      content: string;
      id: string;
      title: string;
      type: "material";
      url: string;
    }
  | {
      detail?: string;
      id: string;
      label: string;
      status: AutofillStepStatus;
      type: "step";
    };

export function parseAutofillSseChunk(chunk: string): AutofillSseEvent[] {
  const events: AutofillSseEvent[] = [];
  for (const frame of chunk.split("\n\n")) {
    for (const line of frame.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          events.push(JSON.parse(line.slice(6)) as AutofillSseEvent);
        } catch {
          // 忽略无法解析的帧
        }
      }
    }
  }
  return events;
}
