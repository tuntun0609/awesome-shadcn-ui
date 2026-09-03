import { fileURLToPath } from "node:url";
import { readCatalog, writeGithubSnapshot } from "../src/db/catalog-repository";
import type { GithubMetric, GithubSnapshot } from "../src/lib/catalog-model";
import { fetchGithubMetrics } from "../src/lib/github-metrics-fetcher";

export type RepositoryMetric = GithubMetric;
export type MetricsSnapshot = GithubSnapshot;

interface SyncTarget {
  github: string;
  slug: string;
}

type Fetcher = typeof fetch;

export async function syncRepositories(
  targets: SyncTarget[],
  previous: MetricsSnapshot,
  fetcher: Fetcher = fetch,
  now = new Date()
) {
  const syncedAt = now.toISOString();
  const repositories: Record<string, RepositoryMetric> = {};
  const failures: string[] = [];

  await Promise.all(
    targets.map(async (target) => {
      try {
        repositories[target.slug] = await fetchGithubMetrics(
          target.github,
          fetcher,
          now
        );
      } catch (error) {
        failures.push(
          `${target.slug}: ${error instanceof Error ? error.message : "unknown error"}`
        );
        const fallback = previous.repositories[target.slug];
        if (fallback) {
          repositories[target.slug] = fallback;
        }
      }
    })
  );

  return { failures, snapshot: { repositories, syncedAt } };
}

async function run() {
  const catalog = await readCatalog();
  const targets = catalog.libraries.flatMap((library) =>
    library.github ? [{ github: library.github, slug: library.slug }] : []
  );
  const result = await syncRepositories(targets, catalog.metrics);
  await writeGithubSnapshot(result.snapshot);

  console.log(
    `Synced ${Object.keys(result.snapshot.repositories).length}/${targets.length} repositories.`
  );
  for (const failure of result.failures) {
    console.warn(`Kept fallback or omitted ${failure}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run();
}
