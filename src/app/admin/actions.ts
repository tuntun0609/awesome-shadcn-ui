"use server";

import { eq } from "drizzle-orm";
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
import {
  type LibraryFormValues,
  libraryFormSchema,
  slugSchema,
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

export async function deleteLibraryAction(
  id: number
): Promise<LibraryActionState> {
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
