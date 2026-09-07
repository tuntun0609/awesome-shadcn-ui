import type { UIMessage } from "ai";
import { z } from "zod";

/** AI 填充可写入的表单字段（addedAt / logo / featuredRank 不属于 AI 职责）。 */
export const AUTOFILL_FIELD_NAMES = [
  "access",
  "deliveries",
  "description",
  "github",
  "name",
  "pricing",
  "slug",
  "source",
  "tags",
  "useCases",
  "website",
] as const;

export type AutofillFieldName = (typeof AUTOFILL_FIELD_NAMES)[number];

/** AI 填充字段的 provenance 元数据（ADR 0003 决策 #7）。 */
export interface AutofillFieldMeta {
  confidence?: number;
  source?: string;
}

/** 批量回填中的单个字段，值在客户端独立校验。 */
export const fillFieldInputSchema = z.object({
  confidence: z.number().min(0).max(1),
  field: z.enum(AUTOFILL_FIELD_NAMES),
  source: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
});

export type FillFieldInput = z.output<typeof fillFieldInputSchema>;

export const fillFieldsInputSchema = z.object({
  fields: z.array(fillFieldInputSchema).min(1).max(AUTOFILL_FIELD_NAMES.length),
});

export type FillFieldsInput = z.output<typeof fillFieldsInputSchema>;
export type FillFieldStatus = "filled" | "review" | "protected" | "invalid";

export interface FillFieldResult {
  error?: string;
  field: AutofillFieldName;
  status: FillFieldStatus;
}

export interface FillFieldsOutput {
  ok: boolean;
  results: FillFieldResult[];
}

export function needsAutofillReview(meta: AutofillFieldMeta) {
  const source = meta.source?.trim().toLowerCase();
  return !source || source === "n/a" || (meta.confidence ?? 0) < 0.7;
}

/** fetch_page 的输出（与 tools.ts 中工具的返回结构一致）。 */
export interface FetchPageOutput {
  error?: string;
  markdown?: string;
  ok: boolean;
  truncated?: boolean;
}

/** fetch_github_repo 的输出。 */
export interface FetchGithubRepoOutput {
  description?: string | null;
  error?: string;
  homepage?: string | null;
  license?: string | null;
  ok: boolean;
  readme?: string;
  topics?: string[];
}

/** autofill 聊天的 UIMessage 类型：约束三个工具 part 的输入/输出。 */
export type AutofillChatMessage = UIMessage<
  never,
  never,
  {
    fetch_github_repo: {
      input: { owner: string; repo: string };
      output: FetchGithubRepoOutput;
    };
    fetch_page: {
      input: { url: string };
      output: FetchPageOutput;
    };
    fill_fields: {
      input: FillFieldsInput;
      output: FillFieldsOutput;
    };
  }
>;
