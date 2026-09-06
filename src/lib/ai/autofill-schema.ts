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

/** 客户端工具 fill_field 的输入（ADR 0003 决策 #7：字段级 provenance 标注）。 */
export const fillFieldInputSchema = z.object({
  confidence: z.number().min(0).max(1),
  field: z.enum(AUTOFILL_FIELD_NAMES),
  source: z.string().min(1),
  value: z.unknown(),
});

export type FillFieldInput = z.output<typeof fillFieldInputSchema>;

/** fill_field 的执行结果：校验失败时返回错误供 agent 自愈。 */
export interface FillFieldOutput {
  error?: string;
  ok: boolean;
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
    fill_field: {
      input: FillFieldInput;
      output: FillFieldOutput;
    };
  }
>;
