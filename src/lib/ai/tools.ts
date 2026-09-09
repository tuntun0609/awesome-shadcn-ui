import { tool } from "ai";
import { z } from "zod";
import { fillFieldsInputSchema } from "@/lib/ai/autofill-schema";

/** 单个采集工具的超时（ADR 0003 决策 #15）。 */
const TOOL_TIMEOUT_MS = 15_000;
/** 返回给 LLM 的正文长度上限，避免撑爆上下文。 */
const MAX_CONTENT_CHARS = 20_000;

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
  if (cause instanceof Error) {
    const inner = cause.cause;
    return inner instanceof Error
      ? `${cause.message}: ${inner.message}`
      : cause.message;
  }
  return "unknown error";
}

/**
 * 降级直连时的极简 HTML 转文本：去掉 script/style/注释，把链接保留为
 * 'text (href)'，其余标签全部丢弃（ADR 0003 决策 #16：不引入 cheerio）。
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href: string, text: string) => `${text} (${href})`
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 经 Jina Reader 抓取任意网页为 markdown；Reader 不可达时降级直连抓 HTML。 */
export const fetchPageTool = tool({
  description:
    "Fetch a web page and return its content as clean markdown (rendered JS included). Use for the library website and any subpage such as /pricing or /docs. If the markdown reader proxy is unreachable, falls back to fetching the raw HTML directly; in that case markdown is plain text extracted from the HTML with links kept as 'text (url)' and fallback is true.",
  execute: async ({ url }) => {
    // 第一优先：Jina Reader（可拿到 JS 渲染结果）。
    let readerError: string | null = null;
    try {
      const headers: Record<string, string> = {};
      if (process.env.JINA_API_KEY) {
        headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
      }
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers,
        signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
      });
      if (response.ok) {
        const text = (await response.text()).trim();
        if (text !== "") {
          return {
            markdown: text.slice(0, MAX_CONTENT_CHARS),
            ok: true,
            truncated: text.length > MAX_CONTENT_CHARS,
          };
        }
        readerError = "page returned empty content";
      } else {
        readerError = `request returned ${response.status}`;
      }
    } catch (cause) {
      readerError = errorOf(cause);
    }

    // 降级：直连目标站点抓原始 HTML。
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "awesome-shadcn-ui" },
        signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          error: `reader: ${readerError}; direct: request returned ${response.status}`,
          ok: false,
        };
      }
      const text = htmlToText(await response.text());
      if (text === "") {
        return {
          error: `reader: ${readerError}; direct: page returned empty content`,
          ok: false,
        };
      }
      return {
        fallback: true,
        markdown: text.slice(0, MAX_CONTENT_CHARS),
        ok: true,
        truncated: text.length > MAX_CONTENT_CHARS,
      };
    } catch (cause) {
      return {
        error: `reader: ${readerError}; direct: ${errorOf(cause)}`,
        ok: false,
      };
    }
  },
  inputSchema: z.object({ url: z.string().url() }),
});

/**
 * 仓库 404 时用 GitHub Search 纠正 owner/name。连字符在 GitHub 搜索
 * 语法中是排除操作符，且精确短语匹配不到无连字符变体
 * （"eldora-ui" 匹配不到 eldoraui），故做两轮查询；合并候选后
 * 按 star 数取最高（精确匹配可能命中零星的同名 fork）。
 */
async function searchGithubRepo(repo: string): Promise<string | null> {
  const alnum = repo.replace(/[^a-z0-9]/gi, "");
  const queries = [`"${repo}" in:name`];
  if (alnum !== "" && alnum.toLowerCase() !== repo.toLowerCase()) {
    queries.push(`${alnum} in:name`);
  }
  const candidates = new Map<string, number>();
  for (const query of queries) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: 两轮查询按优先级短路，并发会浪费搜索限流配额。
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5`,
        {
          headers: githubHeaders(),
          signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
        }
      );
      if (!response.ok) {
        continue;
      }
      const data = (await response.json()) as {
        items?: { full_name: string; stargazers_count: number }[];
      };
      for (const item of data.items ?? []) {
        if (!candidates.has(item.full_name)) {
          candidates.set(item.full_name, item.stargazers_count);
        }
      }
    } catch {
      // 单轮搜索失败则继续下一轮，全部失败由调用方按 404 返回。
    }
  }
  const best = [...candidates.entries()].sort(([, a], [, b]) => b - a)[0]?.[0];
  return best ?? null;
}

/** 一次拿全 GitHub 仓库的元数据与 README；404 时自动搜索纠正仓库名。 */
export const fetchGithubRepoTool = tool({
  description:
    "Fetch a GitHub repository's metadata (description, license, topics, homepage) and its README content. Provide the owner and repo name; if the exact owner is unknown, give your best guess — on 404 the tool searches GitHub for the repo name, retries with the best match, and reports the resolved full name as resolvedRepo.",
  execute: async ({ owner, repo }) => {
    try {
      let fullName = `${owner}/${repo}`;
      let resolvedRepo: string | null = null;

      let repoResponse = await fetch(
        `https://api.github.com/repos/${fullName}`,
        {
          headers: githubHeaders(),
          signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
        }
      );
      if (repoResponse.status === 404) {
        const match = await searchGithubRepo(repo);
        if (match) {
          fullName = match;
          resolvedRepo = match;
          repoResponse = await fetch(
            `https://api.github.com/repos/${fullName}`,
            {
              headers: githubHeaders(),
              signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
            }
          );
        }
      }
      if (!repoResponse.ok) {
        return {
          error:
            repoResponse.status === 404
              ? "repo request returned 404 (repo not found and GitHub search returned no match)"
              : `repo request returned ${repoResponse.status}`,
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
        `https://api.github.com/repos/${fullName}/readme`,
        {
          headers: githubHeaders(true),
          signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
        }
      );
      const readme = readmeResponse.ok
        ? (await readmeResponse.text()).slice(0, MAX_CONTENT_CHARS)
        : "";

      return {
        description: metadata.description,
        homepage: metadata.homepage,
        license: metadata.license?.spdx_id ?? null,
        ok: true,
        readme,
        resolvedRepo,
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

/**
 * 客户端工具：把多个字段批量写入表单（无 execute，由浏览器端
 * useChat 的 onToolCall 执行并回传结果）。
 */
const fillFieldsTool = tool({
  description:
    "Fill multiple catalog fields in ONE call after gathering material. Each entry includes field, value, source and confidence (0-1). The client validates each field independently and protects manual edits. Only retry invalid fields; never retry protected fields.",
  inputSchema: fillFieldsInputSchema,
});

/** 构造 agent 工具集（ADR 0003 决策 #4：精简两件套 + 客户端 fill_fields）。 */
export function createAutofillTools() {
  return {
    fetch_github_repo: fetchGithubRepoTool,
    fetch_page: fetchPageTool,
    fill_fields: fillFieldsTool,
  };
}
