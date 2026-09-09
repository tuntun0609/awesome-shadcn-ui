/**
 * CLI 版 AI 采集：研究组件库官网并填充目录条目，人工审核（--yes 跳过）后写入数据库。
 * 复用网页版 autofill 的模型、采集工具与字段校验，fill_fields 改为写入内存草稿。
 */

import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  type GenerateTextStepEndEvent,
  generateText,
  isStepCount,
  tool,
} from "ai";
import { eq } from "drizzle-orm";
import { getDatabase } from "../src/db/client";
import {
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "../src/db/schema";
import {
  applyAutofillBatch,
  coerceArrayInput,
  FIELD_LABELS,
  formatValue,
} from "../src/lib/ai/autofill-client";
import {
  type AutofillFieldMeta,
  type AutofillFieldName,
  fillFieldsInputSchema,
  needsAutofillReview,
} from "../src/lib/ai/autofill-schema";
import { AUTOFILL_INSTRUCTIONS } from "../src/lib/ai/instructions";
import { getAutofillModel } from "../src/lib/ai/provider";
import { fetchGithubRepoTool, fetchPageTool } from "../src/lib/ai/tools";
import { libraryFormSchema } from "../src/lib/library-form-schema";

/** 工具循环步数上限：与网页版 autofill 保持一致。 */
const MAX_STEPS = 8;
/** 表格值的展示长度上限。 */
const VALUE_PREVIEW_CHARS = 60;
/** 官网 URL 的最低格式要求。 */
const URL_PATTERN = /^https?:\/\//;

/** agent 未提供时允许缺省的字段及默认值。 */
const DEFAULTED_FIELDS: Partial<Record<AutofillFieldName, string | string[]>> =
  {
    deliveries: [],
    github: "",
    tags: [],
    useCases: [],
  };

/** 必须由 agent 采集的字段：缺失即失败退出。 */
const REQUIRED_FIELDS: AutofillFieldName[] = [
  "access",
  "description",
  "name",
  "pricing",
  "slug",
  "source",
  "website",
];

/** 审核表格的展示顺序。 */
const DISPLAY_ORDER: AutofillFieldName[] = [
  "name",
  "slug",
  "description",
  "website",
  "github",
  "source",
  "pricing",
  "access",
  "deliveries",
  "useCases",
  "tags",
];

interface DraftEntry {
  meta: AutofillFieldMeta;
  value: string | string[];
}

type Draft = Map<AutofillFieldName, DraftEntry>;

function buildTools(draft: Draft) {
  return {
    fetch_github_repo: fetchGithubRepoTool,
    fetch_page: fetchPageTool,
    fill_fields: tool({
      description:
        "Fill multiple catalog fields in ONE call after gathering material. Each entry includes field, value, source and confidence (0-1). Values are validated independently and invalid fields are reported back for correction.",
      execute: async (input) =>
        applyAutofillBatch(input, (field, value, meta) => {
          draft.set(field, { meta, value });
          return needsAutofillReview(meta) ? "review" : "filled";
        }),
      inputSchema: fillFieldsInputSchema,
    }),
  };
}

function describeToolInput(toolName: string, input: unknown) {
  if (!input || typeof input !== "object") {
    return "";
  }
  if (toolName === "fetch_page") {
    return String((input as { url?: unknown }).url ?? "");
  }
  if (toolName === "fetch_github_repo") {
    const { owner, repo } = input as { owner?: unknown; repo?: unknown };
    return `${String(owner ?? "?")}/${String(repo ?? "?")}`;
  }
  if (toolName === "fill_fields") {
    const { fields } = input as { fields?: unknown[] };
    return `${fields?.length ?? 0} 个字段`;
  }
  return "";
}

function logStepEnd(step: GenerateTextStepEndEvent) {
  for (const call of step.toolCalls) {
    const detail = describeToolInput(call.toolName, call.input);
    console.log(`├─→ ${call.toolName}${detail ? ` ${detail}` : ""}`);
  }
}

function printDraft(draft: Draft) {
  console.log("\n│ 采集结果（⚠ = 置信度不足 0.7 或来源不明，建议人工复核）");
  for (const field of DISPLAY_ORDER) {
    const entry = draft.get(field);
    const value = entry?.value ?? DEFAULTED_FIELDS[field] ?? "";
    const flag = !entry || needsAutofillReview(entry.meta) ? "⚠" : " ";
    const confidence = entry?.meta.confidence?.toFixed(2) ?? "-";
    const source = entry?.meta.source?.trim() || "—";
    const preview =
      formatValue(value).length > VALUE_PREVIEW_CHARS
        ? `${formatValue(value).slice(0, VALUE_PREVIEW_CHARS)}…`
        : formatValue(value);
    console.log(
      `  ${flag} ${field}（${FIELD_LABELS[field]}）\t${preview}  [${confidence} · ${source}]`
    );
  }
}

/** 逐字段编辑：输入序号选择字段，重新校验后写入草稿（置信度记为人工）。 */
async function editField(draft: Draft, rl: Interface) {
  console.log("  可编辑字段：");
  for (const [position, name] of DISPLAY_ORDER.entries()) {
    console.log(`   ${position + 1}. ${name}（${FIELD_LABELS[name]}）`);
  }
  const pick = (await rl.question("  字段序号：")).trim();
  const index = Number.parseInt(pick, 10) - 1;
  if (
    !(Number.isInteger(index) && index >= 0 && index < DISPLAY_ORDER.length)
  ) {
    console.log("  ✗ 序号无效");
    return;
  }
  const field = DISPLAY_ORDER[index];
  const raw = await rl.question(
    `  新的 ${FIELD_LABELS[field]}（数组字段用逗号分隔，github 留空表示无仓库）：`
  );
  const check = libraryFormSchema.shape[field].safeParse(
    coerceArrayInput(field, raw.trim())
  );
  if (!check.success) {
    console.log(`  ✗ ${check.error.issues[0]?.message ?? "字段值无效"}`);
    return;
  }
  draft.set(field, {
    meta: { confidence: 1, source: "manual" },
    value: check.data as string | string[],
  });
  console.log(`  ✓ 已更新 ${field}（${FIELD_LABELS[field]}）`);
}

/** 审核循环：返回是否确认入库。 */
async function reviewDraft(draft: Draft, rl: Interface) {
  for (;;) {
    printDraft(draft);
    // biome-ignore lint/performance/noAwaitInLoops: 交互式问答必须按顺序等待用户输入。
    const answer = await rl.question(
      "\n  [y] 全部接受并入库  [e] 逐字段编辑  [n] 放弃\n> "
    );
    const action = answer.trim().toLowerCase();
    if (action === "y") {
      return true;
    }
    if (action === "n") {
      return false;
    }
    if (action === "e") {
      await editField(draft, rl);
      continue;
    }
    console.log("  请输入 y / e / n");
  }
}

function draftValue(draft: Draft, field: AutofillFieldName) {
  return draft.get(field)?.value ?? DEFAULTED_FIELDS[field] ?? "";
}

function draftList(draft: Draft, field: AutofillFieldName) {
  const value = draftValue(draft, field);
  return Array.isArray(value) ? value : [];
}

async function persist(draft: Draft, today: string) {
  const db = await getDatabase();
  const slug = String(draftValue(draft, "slug"));
  const existing = await db
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`slug "${slug}" 已存在，更新已有条目请使用管理后台编辑页`);
  }

  const github = String(draftValue(draft, "github"));
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(libraries)
      .values({
        access: String(draftValue(draft, "access")),
        addedAt: today,
        description: String(draftValue(draft, "description")),
        github: github === "" ? null : github,
        name: String(draftValue(draft, "name")),
        pricing: String(draftValue(draft, "pricing")),
        slug,
        source: String(draftValue(draft, "source")),
        website: String(draftValue(draft, "website")),
      })
      .returning({ id: libraries.id });
    const libraryId = inserted[0]?.id;
    if (libraryId === undefined) {
      throw new Error("写入 libraries 失败");
    }

    const deliveries = draftList(draft, "deliveries");
    if (deliveries.length > 0) {
      await tx
        .insert(libraryDeliveries)
        .values(
          deliveries.map((value, position) => ({ libraryId, position, value }))
        );
    }
    const useCases = draftList(draft, "useCases");
    if (useCases.length > 0) {
      await tx
        .insert(libraryUseCases)
        .values(
          useCases.map((value, position) => ({ libraryId, position, value }))
        );
    }
    const tags = draftList(draft, "tags");
    if (tags.length > 0) {
      await tx
        .insert(libraryTags)
        .values(
          tags.map((value, position) => ({ libraryId, position, value }))
        );
    }
  });
}

function printUsage() {
  console.log("用法：bun run autofill <组件库官网 URL> [--yes]");
  console.log("  --yes  跳过人工审核，采集结果直接入库");
}

async function run() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const url = args.find((arg) => !arg.startsWith("--"))?.trim();

  if (!url) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!URL_PATTERN.test(url)) {
    console.error("✗ URL 需以 http:// 或 https:// 开头");
    process.exitCode = 1;
    return;
  }

  const draft: Draft = new Map();
  console.log(`│ 采集 ${url} …`);
  const result = await generateText({
    instructions: AUTOFILL_INSTRUCTIONS,
    model: getAutofillModel(),
    onStepEnd: logStepEnd,
    prompt: url,
    stopWhen: isStepCount(MAX_STEPS),
    tools: buildTools(draft),
  });
  const summary = result.text.trim();
  if (summary !== "") {
    console.log(`│ ${summary.replaceAll("\n", "\n│ ")}`);
  }

  const missing = REQUIRED_FIELDS.filter((field) => !draft.has(field));
  if (missing.length > 0) {
    console.error(
      `✗ 缺少必要字段：${missing.map((field) => FIELD_LABELS[field]).join("、")}，请重试或改用管理后台`
    );
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const confirmed = yes ? true : await reviewDraft(draft, rl);
    if (!confirmed) {
      console.log("│ 已放弃，未写入数据库");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    await persist(draft, today);
    const name = String(draftValue(draft, "name"));
    console.log(`✓ 已入库：${name}（${String(draftValue(draft, "slug"))}）`);
    console.log("│ 提示：运行 bun run sync:github 同步 GitHub 指标");
  } finally {
    rl.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run().catch((cause) => {
    console.error(
      `✗ ${cause instanceof Error ? cause.message : String(cause)}`
    );
    process.exitCode = 1;
  });
}
