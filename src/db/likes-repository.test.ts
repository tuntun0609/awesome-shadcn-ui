import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { seedCatalog } from "../../scripts/db-seed";
import { createDatabase } from "./client";
import { getLikeCounts, getLikedSlugs, setLike } from "./likes-repository";

describe("likes repository", () => {
  test("toggles likes per visitor and aggregates counts", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "awesome-shadcn-ui-")
    );
    const { client, db } = await createDatabase({
      url: `file:${join(temporaryDirectory, "likes.db")}`,
    });

    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      await seedCatalog(db);

      const like = async (visitorId: string, liked: boolean) =>
        setLike(visitorId, "magic-ui", liked, db);

      expect(await like("visitor-1", true)).toEqual({ count: 1, liked: true });
      expect(await like("visitor-1", true)).toEqual({ count: 1, liked: true });
      expect(await like("visitor-2", true)).toEqual({ count: 2, liked: true });
      expect(await like("visitor-1", false)).toEqual({
        count: 1,
        liked: false,
      });
      expect(await like("visitor-1", false)).toEqual({
        count: 1,
        liked: false,
      });

      expect(await getLikeCounts(db)).toEqual({ "magic-ui": 1 });
      expect(await getLikedSlugs("visitor-1", db)).toEqual([]);
      expect(await getLikedSlugs("visitor-2", db)).toEqual(["magic-ui"]);

      expect(await setLike("visitor-1", "no-such-slug", true, db)).toBeNull();
    } finally {
      client.close();
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
