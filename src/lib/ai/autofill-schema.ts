import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);

/** 每个字段附带来源与置信度（ADR 0003 决策 #7：字段级 provenance 标注）。 */
function fieldSchema<T extends z.ZodType>(value: T) {
  return z.object({
    confidence: confidenceSchema,
    source: z.string().min(1),
    value,
  });
}

/** agent 的最终结构化输出 schema：与 LibraryForm 的可采集字段一一对应。 */
export const autofillOutputSchema = z.object({
  access: fieldSchema(
    z.enum(["direct", "login-required", "purchase-required", "undisclosed"])
  ),
  deliveries: fieldSchema(
    z.array(z.enum(["components", "blocks", "templates"]))
  ),
  description: fieldSchema(z.string().min(1)),
  github: fieldSchema(z.string()),
  name: fieldSchema(z.string().min(1)),
  pricing: fieldSchema(z.enum(["free", "freemium", "paid", "undisclosed"])),
  slug: fieldSchema(
    z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be kebab-case")
  ),
  source: fieldSchema(
    z.enum(["open-source", "source-available", "proprietary", "undisclosed"])
  ),
  tags: fieldSchema(z.array(z.string().min(1)).max(20)),
  useCases: fieldSchema(
    z.array(
      z.enum([
        "marketing",
        "dashboard",
        "commerce",
        "content",
        "data-display",
        "ai",
      ])
    )
  ),
  website: fieldSchema(z.string().url()),
});

export type AutofillOutput = z.output<typeof autofillOutputSchema>;
export type AutofillPartialOutput = {
  [K in keyof AutofillOutput]?: Partial<AutofillOutput[K]>;
};

/** AI 填充的字段名（对应 LibraryFormInput 的键）。 */
export type AutofillFieldKey = keyof AutofillOutput;
