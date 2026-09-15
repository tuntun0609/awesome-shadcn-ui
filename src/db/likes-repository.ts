import { and, count, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { getDatabase } from "@/db/client";
import { libraries, libraryLikes } from "@/db/schema";

/** 读取每个组件库的点赞数，以 slug 为键。 */
export async function getLikeCounts(
  providedDatabase?: Database
): Promise<Record<string, number>> {
  const db = providedDatabase ?? (await getDatabase());
  const rows = await db
    .select({
      slug: libraries.slug,
      total: count(libraryLikes.libraryId),
    })
    .from(libraryLikes)
    .innerJoin(libraries, eq(libraryLikes.libraryId, libraries.id))
    .groupBy(libraries.slug);

  return Object.fromEntries(rows.map((row) => [row.slug, row.total]));
}

/** 读取访客已点赞的组件库 slug 列表。 */
export async function getLikedSlugs(
  visitorId: string,
  providedDatabase?: Database
): Promise<string[]> {
  const db = providedDatabase ?? (await getDatabase());
  const rows = await db
    .select({ slug: libraries.slug })
    .from(libraryLikes)
    .innerJoin(libraries, eq(libraryLikes.libraryId, libraries.id))
    .where(eq(libraryLikes.visitorId, visitorId));

  return rows.map((row) => row.slug);
}

/**
 * 写入或移除一条点赞。返回最终点赞状态与最新计数；slug 不存在时返回 null。
 * 幂等：重复点赞或重复取消均安全。
 */
export async function setLike(
  visitorId: string,
  slug: string,
  liked: boolean,
  providedDatabase?: Database
): Promise<{ count: number; liked: boolean } | null> {
  const db = providedDatabase ?? (await getDatabase());
  const [library] = await db
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.slug, slug));

  if (!library) {
    return null;
  }

  if (liked) {
    await db
      .insert(libraryLikes)
      .values({ libraryId: library.id, visitorId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(libraryLikes)
      .where(
        and(
          eq(libraryLikes.visitorId, visitorId),
          eq(libraryLikes.libraryId, library.id)
        )
      );
  }

  const [counter] = await db
    .select({ total: count() })
    .from(libraryLikes)
    .where(eq(libraryLikes.libraryId, library.id));

  return { count: counter?.total ?? 0, liked };
}
