"use server";

import { eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { type Database, getDatabase } from "@/db/client";
import {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchGithubMetrics } from "@/lib/github-metrics-fetcher";
import {
  type IconSourceTarget,
  LOGO_UPLOAD_ACCEPTANCE,
  resolveIcon,
} from "@/lib/icon-resolver";
import { detectIconFormat, iconContentType } from "@/lib/icon-validation";
import {
  type LibraryFormValues,
  libraryFormSchema,
  slugSchema,
  urlSchema,
} from "@/lib/library-form-schema";
import { uploadLibraryLogo } from "@/lib/r2";

export interface LibraryActionState {
  fieldErrors?: Partial<Record<string, string>>;
  message?: string;
}

type ParsedFormValues =
  | { ok: false; state: LibraryActionState }
  | { ok: true; values: LibraryFormValues };

function parseFormValues(raw: unknown): ParsedFormValues {
  const result = libraryFormSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const [key] = issue.path;
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, state: { fieldErrors } };
  }
  return { ok: true, values: result.data };
}

// 表单提交的是原始字符串（空串表示未填写），入库前统一转换为可空值。
function toLibraryRecordValues(values: LibraryFormValues) {
  return {
    access: values.access,
    addedAt: values.addedAt,
    description: values.description,
    featuredRank:
      values.featuredRank === ""
        ? null
        : Number.parseInt(values.featuredRank, 10),
    github: values.github === "" ? null : values.github,
    logo: values.logo === "" ? null : values.logo,
    name: values.name,
    pricing: values.pricing,
    slug: values.slug,
    source: values.source,
    website: values.website,
  };
}

function translateConstraintError(
  error: unknown
): LibraryActionState | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  // libsql/Drizzle 把约束错误放在 cause 中，message 只有失败 SQL。
  const detail = `${error.message} ${String(error.cause ?? "")}`;
  if (detail.includes("UNIQUE")) {
    if (detail.includes("libraries.slug")) {
      return { fieldErrors: { slug: "该 slug 已被占用" } };
    }
    if (detail.includes("featured_rank")) {
      return { fieldErrors: { featuredRank: "该精选位次已被占用" } };
    }
  }
  const reason =
    error.cause instanceof Error ? error.cause.message : error.message;
  return { message: `保存失败：${reason}` };
}

async function replaceLibraryChildren(
  db: Database,
  libraryId: number,
  values: LibraryFormValues
) {
  await db.transaction(async (transaction) => {
    await transaction
      .delete(libraryDeliveries)
      .where(eq(libraryDeliveries.libraryId, libraryId));
    await transaction
      .delete(libraryUseCases)
      .where(eq(libraryUseCases.libraryId, libraryId));
    await transaction
      .delete(libraryTags)
      .where(eq(libraryTags.libraryId, libraryId));

    if (values.deliveries.length > 0) {
      await transaction.insert(libraryDeliveries).values(
        values.deliveries.map((value, position) => ({
          libraryId,
          position,
          value,
        }))
      );
    }
    if (values.useCases.length > 0) {
      await transaction.insert(libraryUseCases).values(
        values.useCases.map((value, position) => ({
          libraryId,
          position,
          value,
        }))
      );
    }
    if (values.tags.length > 0) {
      await transaction.insert(libraryTags).values(
        values.tags.map((value, position) => ({
          libraryId,
          position,
          value,
        }))
      );
    }
  });
}

function refreshAdminData() {
  updateTag("catalog");
  revalidatePath("/admin");
}

export async function createLibraryAction(
  raw: unknown
): Promise<LibraryActionState & { id?: number }> {
  await requireAdmin();
  const parsed = parseFormValues(raw);
  if (!parsed.ok) {
    return parsed.state;
  }
  const { values } = parsed;

  const db = await getDatabase();
  try {
    const inserted = await db
      .insert(libraries)
      .values(toLibraryRecordValues(values))
      .returning({ id: libraries.id });

    const libraryId = inserted[0].id;
    await replaceLibraryChildren(db, libraryId, values);
    refreshAdminData();
    return { id: libraryId };
  } catch (error) {
    return (
      translateConstraintError(error) ?? { message: "保存失败，请稍后重试" }
    );
  }
}

export async function updateLibraryAction(
  id: number,
  raw: unknown
): Promise<LibraryActionState> {
  await requireAdmin();
  const parsed = parseFormValues(raw);
  if (!parsed.ok) {
    return parsed.state;
  }
  const { values } = parsed;

  const db = await getDatabase();
  try {
    const updated = await db
      .update(libraries)
      .set({
        ...toLibraryRecordValues(values),
        updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      })
      .where(eq(libraries.id, id))
      .returning({ id: libraries.id });

    if (updated.length === 0) {
      return { message: "记录不存在，可能已被删除" };
    }

    await replaceLibraryChildren(db, id, values);
    refreshAdminData();
    return {};
  } catch (error) {
    return (
      translateConstraintError(error) ?? { message: "保存失败，请稍后重试" }
    );
  }
}

const deleteInputSchema = z.coerce.number().int().positive();

const logoUploadInputSchema = z.object({
  file: z.instanceof(File),
  slug: slugSchema,
});

export async function uploadLibraryLogoAction(
  slug: string,
  file: File
): Promise<LibraryActionState & { key?: string }> {
  await requireAdmin();
  const parsed = logoUploadInputSchema.safeParse({ file, slug });
  if (!parsed.success) {
    return { fieldErrors: { logo: "无效的 Logo 上传请求" } };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const key = await uploadLibraryLogo(parsed.data.slug, bytes);
    return { key };
  } catch (error) {
    return {
      fieldErrors: {
        logo: error instanceof Error ? error.message : "Logo 上传失败",
      },
    };
  }
}

export interface LogoFetchState {
  base64?: string;
  contentType?: string;
  filename?: string;
  message?: string;
  sourceUrl?: string;
}

const logoFetchInputSchema = z.object({
  github: z.union([urlSchema, z.literal("")]),
  website: urlSchema,
});

/** 从组件库官网（或其 GitHub 仓库）自动采集 Logo 字节，供后台预览确认后随表单一起上传。 */
export async function fetchLibraryLogoAction(
  website: string,
  github: string
): Promise<LogoFetchState> {
  await requireAdmin();
  const parsed = logoFetchInputSchema.safeParse({ github, website });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "官网地址无效" };
  }

  try {
    const target: IconSourceTarget = {
      github: parsed.data.github === "" ? undefined : parsed.data.github,
      website: parsed.data.website,
    };
    const resolution = await resolveIcon(target, fetch, LOGO_UPLOAD_ACCEPTANCE);
    if (!resolution.ok) {
      return {
        message: `未采集到可用的 Logo：${resolution.failures.join("；")}`,
      };
    }

    const { bytes, sourceUrl } = resolution.asset;
    const format = detectIconFormat(bytes);
    if (!format) {
      return { message: "采集到的图标格式无法识别" };
    }
    return {
      base64: Buffer.from(bytes).toString("base64"),
      contentType: iconContentType(format),
      filename: `logo.${format}`,
      sourceUrl,
    };
  } catch (error) {
    return {
      message: `Logo 采集失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

export interface LibraryLogoSyncState {
  failures?: string[];
  message?: string;
  succeeded?: number;
  total?: number;
}

/** 一键为没有 Logo 的组件库自动采集 Logo（官网 → GitHub 仓库），上传 R2 后回填数据库；失败的项目保持原状。 */
export async function syncAllLibraryLogosAction(): Promise<LibraryLogoSyncState> {
  await requireAdmin();

  const db = await getDatabase();
  const targets = await db
    .select({
      github: libraries.github,
      id: libraries.id,
      name: libraries.name,
      slug: libraries.slug,
      website: libraries.website,
    })
    .from(libraries)
    .where(isNull(libraries.logo));

  const failures: string[] = [];
  const updates: { id: number; key: string }[] = [];

  await Promise.all(
    targets.map(async (target) => {
      try {
        const resolution = await resolveIcon(
          { github: target.github ?? undefined, website: target.website },
          fetch,
          LOGO_UPLOAD_ACCEPTANCE
        );
        if (!resolution.ok) {
          failures.push(`${target.name}: ${resolution.failures.join("；")}`);
          return;
        }
        const key = await uploadLibraryLogo(
          target.slug,
          resolution.asset.bytes
        );
        updates.push({ id: target.id, key });
      } catch (error) {
        failures.push(
          `${target.name}: ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    })
  );

  if (updates.length > 0) {
    const updatedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
    try {
      await Promise.all(
        updates.map((update) =>
          db
            .update(libraries)
            .set({ logo: update.key, updatedAt })
            .where(eq(libraries.id, update.id))
        )
      );
      refreshAdminData();
    } catch (error) {
      return (
        translateConstraintError(error) ?? { message: "保存失败，请稍后重试" }
      );
    }
  }

  return {
    failures,
    succeeded: updates.length,
    total: targets.length,
  };
}

export interface GithubMetricsFetchState {
  latestCommitAt?: string | null;
  message?: string;
  stars?: number;
  syncedAt?: string;
}

const githubMetricsFetchInputSchema = z.object({
  github: urlSchema,
});

/** 从 GitHub API 自动采集单个仓库的指标（Stars / 最近提交），供后台预览确认后入库。 */
export async function fetchGithubMetricsAction(
  github: string
): Promise<GithubMetricsFetchState> {
  await requireAdmin();
  const parsed = githubMetricsFetchInputSchema.safeParse({ github });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "GitHub 地址无效" };
  }

  try {
    return await fetchGithubMetrics(parsed.data.github);
  } catch (error) {
    return {
      message: `GitHub 指标采集失败：${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

export interface GithubMetricsSyncState {
  failures?: string[];
  message?: string;
  succeeded?: number;
  total?: number;
}

/** 一键采集所有已关联 GitHub 仓库的指标并批量 upsert 入库；采集失败的仓库保留原有数据。 */
export async function syncAllGithubMetricsAction(): Promise<GithubMetricsSyncState> {
  await requireAdmin();

  const db = await getDatabase();
  const targets = await db
    .select({
      github: libraries.github,
      id: libraries.id,
      name: libraries.name,
    })
    .from(libraries)
    .where(isNotNull(libraries.github));

  const failures: string[] = [];
  const metrics: {
    latestCommitAt: string | null;
    libraryId: number;
    stars: number;
    syncedAt: string;
  }[] = [];

  await Promise.all(
    targets.map(async (target) => {
      try {
        const metric = await fetchGithubMetrics(target.github as string);
        metrics.push({ libraryId: target.id, ...metric });
      } catch (error) {
        failures.push(
          `${target.name}: ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    })
  );

  if (metrics.length > 0) {
    try {
      await db
        .insert(githubMetrics)
        .values(metrics)
        .onConflictDoUpdate({
          set: {
            latestCommitAt: sql`excluded.latest_commit_at`,
            stars: sql`excluded.stars`,
            syncedAt: sql`excluded.synced_at`,
          },
          target: githubMetrics.libraryId,
        });
      refreshAdminData();
    } catch (error) {
      return (
        translateConstraintError(error) ?? { message: "保存失败，请稍后重试" }
      );
    }
  }

  return {
    failures,
    succeeded: metrics.length,
    total: targets.length,
  };
}

const githubMetricsSaveInputSchema = z.object({
  latestCommitAt: z.union([z.iso.datetime(), z.null()]),
  libraryId: z.number().int().positive(),
  stars: z.number().int().nonnegative(),
  syncedAt: z.iso.datetime(),
});

/** 将后台确认后的 GitHub 指标以单条 upsert 方式写入（不影响其他组件库的快照）。 */
export async function saveGithubMetricsAction(
  libraryId: number,
  metric: { latestCommitAt: string | null; stars: number; syncedAt: string }
): Promise<LibraryActionState> {
  await requireAdmin();
  const parsed = githubMetricsSaveInputSchema.safeParse({
    ...metric,
    libraryId,
  });
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "无效的 GitHub 指标数据",
    };
  }

  const db = await getDatabase();
  try {
    const { latestCommitAt, stars, syncedAt } = parsed.data;
    await db
      .insert(githubMetrics)
      .values({ latestCommitAt, libraryId, stars, syncedAt })
      .onConflictDoUpdate({
        set: { latestCommitAt, stars, syncedAt },
        target: githubMetrics.libraryId,
      });
    refreshAdminData();
    return {};
  } catch (error) {
    return (
      translateConstraintError(error) ?? { message: "保存失败，请稍后重试" }
    );
  }
}

export async function deleteLibraryAction(
  id: number
): Promise<LibraryActionState> {
  await requireAdmin();
  const parsedId = deleteInputSchema.safeParse(id);
  if (!parsedId.success) {
    return { message: "无效的记录 ID" };
  }

  const db = await getDatabase();
  try {
    await db.transaction(async (transaction) => {
      await transaction
        .delete(githubMetrics)
        .where(eq(githubMetrics.libraryId, parsedId.data));
      await transaction
        .delete(libraryDeliveries)
        .where(eq(libraryDeliveries.libraryId, parsedId.data));
      await transaction
        .delete(libraryUseCases)
        .where(eq(libraryUseCases.libraryId, parsedId.data));
      await transaction
        .delete(libraryTags)
        .where(eq(libraryTags.libraryId, parsedId.data));
      await transaction
        .delete(libraries)
        .where(eq(libraries.id, parsedId.data));
    });
    refreshAdminData();
    return {};
  } catch (error) {
    return (
      translateConstraintError(error) ?? { message: "删除失败，请稍后重试" }
    );
  }
}
