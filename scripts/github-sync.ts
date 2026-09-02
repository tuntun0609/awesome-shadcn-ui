import { fileURLToPath } from "node:url";
import { readCatalog, writeGithubSnapshot } from "../src/db/catalog-repository";
import type { GithubMetric, GithubSnapshot } from "../src/lib/catalog-model";

export type RepositoryMetric = GithubMetric;
export type MetricsSnapshot = GithubSnapshot;

interface SyncTarget {
  github: string;
  slug: string;
}

type Fetcher = typeof fetch;

const LEADING_SLASH = /^\//;
const TRAILING_SLASH = /\/$/;

function repositoryPath(url: string) {
  return new URL(url).pathname
    .replace(LEADING_SLASH, "")
    .replace(TRAILING_SLASH, "");
}

export async function syncRepositories(
  targets: SyncTarget[],
  previous: MetricsSnapshot,
  fetcher: Fetcher = fetch,
  now = new Date()
) {
  const syncedAt = now.toISOString();
  const repositories: Record<string, RepositoryMetric> = {};
  const failures: string[] = [];
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: process.env.GITHUB_TOKEN
      ? `Bearer ${process.env.GITHUB_TOKEN}`
      : "",
    "User-Agent": "awesome-shadcn-ui",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  await Promise.all(
    targets.map(async (target) => {
      try {
        const path = repositoryPath(target.github);
        const repoResponse = await fetcher(
          `https://api.github.com/repos/${path}`,
          { headers }
        );
        if (!repoResponse.ok) {
          throw new Error(`repository request returned ${repoResponse.status}`);
        }
        const repo = (await repoResponse.json()) as {
          default_branch: string;
          stargazers_count: number;
        };
        const commitResponse = await fetcher(
          `https://api.github.com/repos/${path}/commits/${repo.default_branch}`,
          { headers }
        );
        if (!commitResponse.ok) {
          throw new Error(`commit request returned ${commitResponse.status}`);
        }
        const commit = (await commitResponse.json()) as {
          commit: { committer: { date: string | null } };
        };
        repositories[target.slug] = {
          latestCommitAt: commit.commit.committer.date,
          stars: repo.stargazers_count,
          syncedAt,
        };
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
