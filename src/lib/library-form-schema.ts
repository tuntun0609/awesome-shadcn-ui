import { z } from "zod";

export const LIBRARY_SOURCE_OPTIONS = [
  { label: "开源", value: "open-source" },
  { label: "源码可见", value: "source-available" },
  { label: "闭源", value: "proprietary" },
  { label: "未披露", value: "undisclosed" },
] as const;

export const LIBRARY_PRICING_OPTIONS = [
  { label: "免费", value: "free" },
  { label: "免费增值", value: "freemium" },
  { label: "付费", value: "paid" },
  { label: "未披露", value: "undisclosed" },
] as const;

export const LIBRARY_ACCESS_OPTIONS = [
  { label: "直接访问", value: "direct" },
  { label: "需登录", value: "login-required" },
  { label: "需购买", value: "purchase-required" },
  { label: "未披露", value: "undisclosed" },
] as const;

export const LIBRARY_DELIVERY_OPTIONS = [
  { label: "组件", value: "components" },
  { label: "区块", value: "blocks" },
  { label: "模板", value: "templates" },
] as const;

export const LIBRARY_USE_CASE_OPTIONS = [
  { label: "营销页", value: "marketing" },
  { label: "仪表盘", value: "dashboard" },
  { label: "电商", value: "commerce" },
  { label: "内容", value: "content" },
  { label: "数据展示", value: "data-display" },
  { label: "AI", value: "ai" },
] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1, "请填写 slug")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "slug 只能包含小写字母、数字和中划线，且不能以中划线开头或结尾"
  );

export { slugSchema };

const urlSchema = z
  .string()
  .trim()
  .url("请填写合法的 URL（包含 https://）")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    {
      message: "URL 需以 http:// 或 https:// 开头",
    }
  );

const optionalUrlSchema = z.union([urlSchema, z.literal("")]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOGO_KEY_PATTERN =
  /^awesome-shadcn-ui\/icons\/[a-z0-9]+(-[a-z0-9]+)*\.(ico|png|svg|webp)$/;
const FEATURED_RANK_PATTERN = /^\d+$/;

export const libraryFormSchema = z.object({
  access: z.enum([
    "direct",
    "login-required",
    "purchase-required",
    "undisclosed",
  ]),
  addedAt: z
    .string()
    .regex(DATE_PATTERN, "请填写 YYYY-MM-DD 格式的日期")
    .refine(
      (value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        );
      },
      { message: "请填写有效的日期" }
    ),
  deliveries: z.array(z.enum(["components", "blocks", "templates"])),
  description: z.string().trim().min(1, "请填写简介"),
  featuredRank: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        return;
      }
      if (!FEATURED_RANK_PATTERN.test(value)) {
        ctx.addIssue({ code: "custom", message: "精选位次必须是正整数" });
        return;
      }
      if (Number.parseInt(value, 10) <= 0) {
        ctx.addIssue({ code: "custom", message: "精选位次必须大于 0" });
      }
    }),
  github: optionalUrlSchema,
  logo: z
    .string()
    .trim()
    .refine((value) => value === "" || LOGO_KEY_PATTERN.test(value), {
      message:
        "Logo 需为 awesome-shadcn-ui/icons/<slug>.<ext> 形式的 R2 对象 key",
    }),
  name: z.string().trim().min(1, "请填写名称"),
  pricing: z.enum(["free", "freemium", "paid", "undisclosed"]),
  slug: slugSchema,
  source: z.enum([
    "open-source",
    "source-available",
    "proprietary",
    "undisclosed",
  ]),
  tags: z
    .array(z.string().trim().min(1, "标签不能为空"))
    .max(20, "标签最多 20 个")
    .refine((tags) => new Set(tags).size === tags.length, {
      message: "标签不能重复",
    }),
  useCases: z.array(
    z.enum([
      "marketing",
      "dashboard",
      "commerce",
      "content",
      "data-display",
      "ai",
    ])
  ),
  website: urlSchema,
});

export type LibraryFormInput = z.input<typeof libraryFormSchema>;
export type LibraryFormValues = z.output<typeof libraryFormSchema>;
