import type { RepositoryMetric } from "@/lib/catalog-model";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";
const GITLAB_HOST = "gitlab.com";
const LEADING_SLASH = /^\//;
const TRAILING_SLASH = /\/$/;

/** 受支持的代码托管平台（决定指标采集走哪套 API）。 */
export type RepositoryProvider = "github" | "gitlab";

export function parseRepositoryUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname
      .replace(LEADING_SLASH, "")
      .replace(TRAILING_SLASH, "");
    if (host === "github.com" && path.split("/").length === 2) {
      return { host, path, provider: "github" as const };
    }
    // GitLab 支持多级命名空间（group/subgroup/project）。
    if (host === GITLAB_HOST && path.split("/").length >= 2) {
      return { host, path, provider: "gitlab" as const };
    }
    return null;
  } catch {
    return null;
  }
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

function gitlabHeaders() {
  const headers: Record<string, string> = {
    "User-Agent": "awesome-shadcn-ui",
  };
  if (process.env.GITLAB_TOKEN) {
    headers["PRIVATE-TOKEN"] = process.env.GITLAB_TOKEN;
  }
  return headers;
}

/** 从 GitHub API 采集单个仓库的指标（Stars 与默认分支最近提交时间）。 */
async function fetchGithubMetric(
  path: string,
  fetcher: typeof fetch,
  now: Date
): Promise<RepositoryMetric> {
  const headers = githubHeaders();

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

/** 从 GitLab API 采集单个项目的指标（Stars 与默认分支最近提交时间）。 */
async function fetchGitlabMetric(
  path: string,
  fetcher: typeof fetch,
  now: Date
): Promise<RepositoryMetric> {
  const headers = gitlabHeaders();
  // 命名空间路径需要整体编码（namespace%2Fproject）。
  const projectResponse = await fetcher(
    `${GITLAB_API_BASE}/projects/${encodeURIComponent(path)}`,
    { headers }
  );
  if (!projectResponse.ok) {
    throw new Error(`project request returned ${projectResponse.status}`);
  }
  const project = (await projectResponse.json()) as {
    default_branch: string | null;
    id: number;
    star_count: number;
  };

  // 空仓库没有默认分支，最近提交时间记为未知。
  let latestCommitAt: string | null = null;
  if (project.default_branch) {
    const commitResponse = await fetcher(
      `${GITLAB_API_BASE}/projects/${project.id}/repository/commits?ref_name=${encodeURIComponent(project.default_branch)}&per_page=1`,
      { headers }
    );
    if (!commitResponse.ok) {
      throw new Error(`commit request returned ${commitResponse.status}`);
    }
    const commits = (await commitResponse.json()) as {
      committed_date: string | null;
    }[];
    // GitLab 可能返回带时区偏移的日期（+01:00），统一规范化为 UTC
    // ISO 格式，保证入库校验与字符串排序和 GitHub 快照一致。
    const commitDate = commits[0]?.committed_date;
    latestCommitAt = commitDate ? new Date(commitDate).toISOString() : null;
  }

  return {
    latestCommitAt,
    stars: project.star_count,
    syncedAt: now.toISOString(),
  };
}

/**
 * 从对应的代码托管平台 API 采集单个仓库的指标（Stars 与最近提交时间）。
 * 依据 URL 的 host 分发：github.com 走 GitHub API，gitlab.com 走 GitLab API。
 */
export function fetchRepositoryMetrics(
  repositoryUrl: string,
  fetcher: typeof fetch = fetch,
  now = new Date()
): Promise<RepositoryMetric> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  if (!parsed) {
    return Promise.reject(new Error("unsupported repository URL"));
  }
  return parsed.provider === "gitlab"
    ? fetchGitlabMetric(parsed.path, fetcher, now)
    : fetchGithubMetric(parsed.path, fetcher, now);
}
