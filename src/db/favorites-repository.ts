import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { libraries, libraryFavorites } from "@/db/schema";

/** 读取用户收藏的全部组件库 slug，按收藏时间倒序。 */
export async function getFavoriteSlugs(userId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db
    .select({ slug: libraries.slug })
    .from(libraryFavorites)
    .innerJoin(libraries, eq(libraryFavorites.libraryId, libraries.id))
    .where(eq(libraryFavorites.userId, userId))
    .orderBy(libraryFavorites.createdAt, libraries.id);

  return rows.map((row) => row.slug);
}

/** 判断用户是否已收藏某个组件库。 */
export async function isFavorite(
  userId: string,
  slug: string
): Promise<boolean> {
  const db = await getDatabase();
  const [row] = await db
    .select({ libraryId: libraryFavorites.libraryId })
    .from(libraryFavorites)
    .innerJoin(libraries, eq(libraryFavorites.libraryId, libraries.id))
    .where(and(eq(libraryFavorites.userId, userId), eq(libraries.slug, slug)));

  return row !== undefined;
}

/**
 * 写入或移除一条收藏。返回最终收藏状态；slug 不存在时返回 null。
 * 幂等：重复收藏或重复取消均安全。
 */
export async function setFavorite(
  userId: string,
  slug: string,
  favorited: boolean
): Promise<boolean | null> {
  const db = await getDatabase();
  const [library] = await db
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.slug, slug));

  if (!library) {
    return null;
  }

  if (favorited) {
    await db
      .insert(libraryFavorites)
      .values({ libraryId: library.id, userId })
      .onConflictDoNothing();
    return true;
  }

  await db
    .delete(libraryFavorites)
    .where(
      and(
        eq(libraryFavorites.userId, userId),
        eq(libraryFavorites.libraryId, library.id)
      )
    );
  return false;
}
