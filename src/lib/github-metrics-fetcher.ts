import type { GithubMetric } from "@/lib/catalog-model";

const LEADING_SLASH = /^\//;
const TRAILING_SLASH = /\/$/;

export function repositoryPath(url: string) {
  return new URL(url).pathname
    .replace(LEADING_SLASH, "")
    .replace(TRAILING_SLASH, "");
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: process.env.GITHUB_TOKEN
      ? `Bearer ${process.env.GITHUB_TOKEN}`
      : "",
    "User-Agent": "awesome-shadcn-ui",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** 从 GitHub API 采集单个仓库的指标（Stars 与默认分支最近提交时间）。 */
export async function fetchGithubMetrics(
  github: string,
  fetcher: typeof fetch = fetch,
  now = new Date()
): Promise<GithubMetric> {
  const headers = githubHeaders();
  const path = repositoryPath(github);

  const repoResponse = await fetcher(`https://api.github.com/repos/${path}`, {
    headers,
  });
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

  return {
    latestCommitAt: commit.commit.committer.date,
    stars: repo.stargazers_count,
    syncedAt: now.toISOString(),
  };
}
