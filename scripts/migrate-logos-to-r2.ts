import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { libraries } from "../src/db/schema";
import { isSupportedIcon } from "../src/lib/icon-resolver";
import { detectIconFormat, iconContentType } from "../src/lib/icon-validation";
import { LOGO_KEY_PREFIX, uploadR2Object } from "../src/lib/r2";

const MIGRATED_PREFIX = "awesome-shadcn-ui/icons/";
const LOGO_LEADING_SLASHES = /^\/+/;

async function run() {
  const cleanup = process.argv.includes("--cleanup");
  const remote = process.argv.includes("--remote");
  const url = remote
    ? process.env.TURSO_DATABASE_URL
    : (process.env.LOCAL_DATABASE_URL ?? "file:local.db");
  if (!url) {
    throw new Error("--remote 需要 TURSO_DATABASE_URL");
  }
  const { db } = await createDatabase({
    authToken: remote ? process.env.TURSO_AUTH_TOKEN : undefined,
    url,
  });
  console.log(`Migrating logos for ${url}`);
  const rows = await db
    .select({ id: libraries.id, logo: libraries.logo, slug: libraries.slug })
    .from(libraries);

  const targets = rows.flatMap((row) => {
    if (!row.logo || row.logo.startsWith(MIGRATED_PREFIX)) {
      return [];
    }
    return [{ id: row.id, logo: row.logo, slug: row.slug }];
  });
  if (targets.length === 0) {
    console.log("No legacy logo paths to migrate.");
    return;
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const localPath = resolve(
          fileURLToPath(new URL("../public/", import.meta.url)),
          target.logo.replace(LOGO_LEADING_SLASHES, "")
        );
        const bytes = new Uint8Array(await readFile(localPath));
        if (!isSupportedIcon(bytes)) {
          throw new Error(`unsupported or unsafe icon file: ${localPath}`);
        }

        const format = detectIconFormat(bytes);
        if (!format) {
          throw new Error(`cannot detect icon format: ${localPath}`);
        }

        const key = `${LOGO_KEY_PREFIX}${target.slug}.${format}`;
        await uploadR2Object(key, bytes, iconContentType(format));

        await db
          .update(libraries)
          .set({ logo: key })
          .where(eq(libraries.id, target.id));

        return { failure: null as string | null, localPath, slug: target.slug };
      } catch (error) {
        return {
          failure: `${target.slug}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
          localPath: null as string | null,
          slug: target.slug,
        };
      }
    })
  );

  const failures = results.flatMap((result) =>
    result.failure ? [result.failure] : []
  );
  const migrated = results.filter((result) => !result.failure);

  for (const result of migrated) {
    console.log(`Migrated ${result.slug} to R2.`);
  }
  for (const failure of failures) {
    console.warn(`Failed: ${failure}`);
  }
  console.log(`Migrated ${migrated.length}/${targets.length} logos.`);

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (cleanup) {
    await Promise.all(
      migrated.map((result) =>
        result.localPath ? unlink(result.localPath) : Promise.resolve()
      )
    );
    console.log(`Removed ${migrated.length} local files from public/logos.`);
  } else {
    console.log("Local files kept. Re-run with --cleanup to remove them.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run();
}
