import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { seedCatalog } from "../../scripts/db-seed";
import { readCatalog } from "./catalog-repository";
import { createDatabase } from "./client";
import { libraryTags } from "./schema";

describe("catalog database", () => {
  test("migrates and idempotently seeds the complete catalog", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "awesome-shadcn-ui-")
    );
    const { client, db } = await createDatabase({
      url: `file:${join(temporaryDirectory, "catalog.db")}`,
    });

    try {
      await migrate(db, { migrationsFolder: "./drizzle" });
      await seedCatalog(db);
      await seedCatalog(db);

      const catalog = await readCatalog(db);
      expect(catalog.libraries).toHaveLength(12);
      expect(catalog.libraries[0]).toMatchObject({
        delivery: ["components", "blocks", "templates"],
        slug: "magic-ui",
        tags: ["animation", "motion", "landing pages"],
      });
      expect(Object.keys(catalog.metrics.repositories)).toHaveLength(9);
      expect(catalog.metrics.repositories["aceternity-ui"]).toBeUndefined();
      expect(catalog.metrics.repositories["magic-ui"].stars).toBe(22_124);

      await expect(
        db
          .insert(libraryTags)
          .values({
            libraryId: 99_999,
            position: 0,
            value: "orphan",
          })
          .run()
      ).rejects.toThrow();
    } finally {
      client.close();
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
