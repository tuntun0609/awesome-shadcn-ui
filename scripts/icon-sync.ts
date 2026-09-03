import { fileURLToPath } from "node:url";
import { readCatalog } from "../src/db/catalog-repository";
import {
  type Fetcher,
  type IconSourceTarget,
  LEADING_SLASHES,
  resolveIcon,
} from "../src/lib/icon-resolver";
import {
  detectIconFormat,
  type IconFormat,
  iconContentType,
} from "../src/lib/icon-validation";
import { uploadR2Object } from "../src/lib/r2";

export interface IconSyncTarget extends IconSourceTarget {
  logo: string;
  slug: string;
}

export interface IconSyncResult {
  failures: string[];
  synced: { slug: string; sourceUrl: string }[];
}

type IconWriter = (
  target: IconSyncTarget,
  bytes: Uint8Array<ArrayBuffer>
) => Promise<void>;

function iconFormatForUpload(bytes: Uint8Array<ArrayBuffer>): IconFormat {
  const format = detectIconFormat(bytes);
  if (!format) {
    throw new Error("icon bytes are not a supported format");
  }
  return format;
}

async function writeIcon(
  target: IconSyncTarget,
  bytes: Uint8Array<ArrayBuffer>
) {
  const format = iconFormatForUpload(bytes);
  const key = target.logo.replace(LEADING_SLASHES, "");
  await uploadR2Object(key, bytes, iconContentType(format));
}

export async function syncIcons(
  targets: IconSyncTarget[],
  fetcher: Fetcher = fetch,
  writer: IconWriter = writeIcon
): Promise<IconSyncResult> {
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const resolution = await resolveIcon(target, fetcher);
        if (!resolution.ok) {
          return {
            failure: `${target.slug}: no valid icon found (${resolution.failures.join("; ")})`,
            synced: null,
          };
        }
        await writer(target, resolution.asset.bytes);
        return {
          failure: null,
          synced: { slug: target.slug, sourceUrl: resolution.asset.sourceUrl },
        };
      } catch (error) {
        return {
          failure: `${target.slug}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
          synced: null,
        };
      }
    })
  );

  return {
    failures: results.flatMap((result) =>
      result.failure ? [result.failure] : []
    ),
    synced: results.flatMap((result) => (result.synced ? [result.synced] : [])),
  };
}

async function run() {
  const { libraries } = await readCatalog();
  const targets = libraries.flatMap((library) =>
    library.logo
      ? [
          {
            github: library.github,
            logo: library.logo,
            slug: library.slug,
            website: library.website,
          },
        ]
      : []
  );
  const result = await syncIcons(targets);

  for (const synced of result.synced) {
    console.log(`Synced ${synced.slug} from ${synced.sourceUrl}`);
  }
  for (const failure of result.failures) {
    console.warn(`Kept existing icon for ${failure}`);
  }
  console.log(`Synced ${result.synced.length}/${targets.length} icons.`);

  if (result.failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run();
}
