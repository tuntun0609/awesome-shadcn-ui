import { tool } from "ai";
import { z } from "zod";

/** 单个采集工具的超时（ADR 0003 决策 #15）。 */
const TOOL_TIMEOUT_MS = 15_000;
/** 返回给 LLM 的正文长度上限，避免撑爆上下文。 */
const MAX_CONTENT_CHARS = 20_000;

/** 抓取到的原始材料（ADR 0003 决策 #12：仅会话内保留，供审核面板查看）。 */
export interface RawMaterial {
  content: string;
  id: string;
  title: string;
  url: string;
}

export type MaterialSink = (material: RawMaterial) => void;

function githubHeaders(raw = false) {
  return {
    Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    Authorization: process.env.GITHUB_TOKEN
      ? `Bearer ${process.env.GITHUB_TOKEN}`
      : "",
    "User-Agent": "awesome-shadcn-ui",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function errorOf(cause: unknown) {
  return cause instanceof Error ? cause.message : "unknown error";
}

/** 经 Jina Reader 抓取任意网页为 markdown。 */
function createFetchPageTool(sink: MaterialSink) {
  return tool({
    description:
      "Fetch a web page and return its content as clean markdown (rendered JS included). Use for the library website and any subpage such as /pricing or /docs.",
    execute: async ({ url }) => {
      try {
        const headers: Record<string, string> = {};
        if (process.env.JINA_API_KEY) {
          headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
        }
        const response = await fetch(`https://r.jina.ai/${url}`, {
          headers,
          signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
        });
        if (!response.ok) {
          return { error: `request returned ${response.status}`, ok: false };
        }
        const text = (await response.text()).trim();
        if (text === "") {
          return { error: "page returned empty content", ok: false };
        }
        const truncated = text.slice(0, MAX_CONTENT_CHARS);
        sink({
          content: truncated,
          id: crypto.randomUUID(),
          title: url,
          url,
        });
        return {
          markdown: truncated,
          ok: true,
          truncated: text.length > MAX_CONTENT_CHARS,
        };
      } catch (cause) {
        return { error: errorOf(cause), ok: false };
      }
    },
    inputSchema: z.object({ url: z.string().url() }),
  });
}

/** 一次拿全 GitHub 仓库的元数据与 README。 */
function createFetchGithubRepoTool(sink: MaterialSink) {
  return tool({
    description:
      "Fetch a GitHub repository's metadata (description, license, topics, homepage) and its README content. Provide the owner and repo name.",
    execute: async ({ owner, repo }) => {
      try {
        const repoResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: githubHeaders(),
            signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
          }
        );
        if (!repoResponse.ok) {
          return {
            error: `repo request returned ${repoResponse.status}`,
            ok: false,
          };
        }
        const metadata = (await repoResponse.json()) as {
          description: string | null;
          homepage: string | null;
          license: { spdx_id: string } | null;
          topics: string[];
        };

        const readmeResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/readme`,
          {
            headers: githubHeaders(true),
            signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
          }
        );
        const readme = readmeResponse.ok
          ? (await readmeResponse.text()).slice(0, MAX_CONTENT_CHARS)
          : "";

        const url = `https://github.com/${owner}/${repo}`;
        sink({
          content: readme || metadata.description || "",
          id: crypto.randomUUID(),
          title: url,
          url,
        });
        return {
          description: metadata.description,
          homepage: metadata.homepage,
          license: metadata.license?.spdx_id ?? null,
          ok: true,
          readme,
          topics: metadata.topics,
        };
      } catch (cause) {
        return { error: errorOf(cause), ok: false };
      }
    },
    inputSchema: z.object({
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
  });
}

/** 构造 agent 工具集（ADR 0003 决策 #4：精简两件套）。 */
export function createAutofillTools(sink: MaterialSink) {
  return {
    fetch_github_repo: createFetchGithubRepoTool(sink),
    fetch_page: createFetchPageTool(sink),
  };
}
