import type {
  AutofillFieldMeta,
  AutofillFieldName,
  FillFieldStatus,
  FillFieldsInput,
  FillFieldsOutput,
} from "@/lib/ai/autofill-schema";
import { libraryFormSchema } from "@/lib/library-form-schema";

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

export const FIELD_LABELS: Record<AutofillFieldName, string> = {
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

export function formatValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join("、");
  }
  if (typeof value === "string") {
    return value === "" ? "（空）" : value;
  }
  return JSON.stringify(value);
}

/** 每个字段独立校验，保留部分成功，防止同批重复字段反复写入。 */
export function applyAutofillBatch(
  input: FillFieldsInput,
  apply: (
    field: AutofillFieldName,
    value: string | string[],
    meta: AutofillFieldMeta
  ) => Exclude<FillFieldStatus, "invalid">
): FillFieldsOutput {
  const seen = new Set<AutofillFieldName>();
  const results = input.fields.map((entry) => {
    const { field, confidence, source } = entry;
    if (seen.has(field)) {
      return { error: "同一批次字段重复", field, status: "invalid" as const };
    }
    seen.add(field);
    const check = libraryFormSchema.shape[field].safeParse(
      coerceArrayInput(field, entry.value)
    );
    if (!check.success) {
      return {
        error: check.error.issues[0]?.message ?? "字段值无效",
        field,
        status: "invalid" as const,
      };
    }
    return { field, status: apply(field, check.data, { confidence, source }) };
  });
  return {
    ok: results.every((result) => result.status !== "invalid"),
    results,
  };
}
