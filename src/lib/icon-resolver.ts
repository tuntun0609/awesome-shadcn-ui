import { extname } from "node:path";
import {
  detectIconFormat,
  type IconFormat,
  isSafeSvgText,
} from "@/lib/icon-validation";

export interface IconAsset {
  bytes: Uint8Array<ArrayBuffer>;
  sourceUrl: string;
}

/** 图标采集目标：官网必填；GitHub 仓库与期望的本地扩展名可选。 */
export interface IconSourceTarget {
  github?: string;
  /** 期望保存的对象 key（如 awesome-shadcn-ui/icons/foo.svg），用于优先选择同扩展名的来源。 */
  logo?: string;
  website: string;
}

/** 图标接受条件：字节上限与允许的格式（缺省表示接受全部可识别格式）。 */
export interface IconAcceptance {
  formats?: ReadonlySet<IconFormat>;
  maxBytes: number;
}

export type IconResolution =
  | { asset: IconAsset; ok: true }
  | { failures: string[]; ok: false };

export type Fetcher = typeof fetch;

interface IconCandidate {
  headers?: Record<string, string>;
  url: string;
}

interface PageIconLinks {
  icons: string[];
  manifests: string[];
}

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

/** 同步脚本默认接受条件：2MB 以内的全部可识别格式。 */
export const DEFAULT_ICON_ACCEPTANCE: IconAcceptance = {
  maxBytes: 2 * 1024 * 1024,
};

/** 与 R2 Logo 上传限制保持一致（见 src/lib/r2.ts 的 validateLibraryLogoUpload）。 */
export const LOGO_UPLOAD_ACCEPTANCE: IconAcceptance = {
  formats: new Set(["ico", "png", "svg", "webp"]),
  maxBytes: 512 * 1024,
};

const ATTRIBUTE_PATTERN =
  /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const DECIMAL_ENTITY_PATTERN = /&#(\d+);/g;
const DOCUMENTATION_PATH_PATTERN = /^(?:docs?|website)\//;
const GIT_SUFFIX_PATTERN = /\.git$/i;
const GITHUB_APP_ICON_PATTERN = /(?:^|\/)app\/icon\./;
const GITHUB_ICON_FILENAME_PATTERN =
  /^(?:icon|favicon)\.(?:ico|jpe?g|png|svg|webp)$/;
const GITHUB_IGNORED_PATH_PATTERN =
  /(?:^|\/)(?:examples?|fixtures?|node_modules|tests?)(?:\/|$)/;
const GITHUB_LOGO_PATTERN = /logo/;
const GITHUB_PUBLIC_PATH_PATTERN = /(?:^|\/)public\//;
const GITHUB_TOUCH_ICON_PATTERN = /^(?:apple-)?touch-icon\./;
const HTML_AMPERSAND_PATTERN = /&amp;/gi;
const HEX_ENTITY_PATTERN = /&#x([\da-f]+);/gi;
export const LEADING_SLASHES = /^\/+/;
const LINK_PATTERN = /<link\b[^>]*>/gi;
const SIZE_PATTERN = /^(\d+)x(\d+)$/i;
const SUPPORTED_EXTENSION = /\.(?:ico|jpe?g|png|svg|webp)$/i;
const WHITESPACE_PATTERN = /\s+/;

function decodeHtmlAttribute(value: string) {
  return value
    .replace(HTML_AMPERSAND_PATTERN, "&")
    .replace(DECIMAL_ENTITY_PATTERN, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(HEX_ENTITY_PATTERN, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function parseAttributes(tag: string) {
  const attributes: Partial<Record<string, string>> = {};

  for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    if (name === "link") {
      continue;
    }
    attributes[name] = decodeHtmlAttribute(
      match[2] ?? match[3] ?? match[4] ?? ""
    );
  }

  return attributes;
}

function resolveHttpUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function sizeScore(sizes: string | undefined) {
  if (!sizes) {
    return 0;
  }
  if (sizes.trim().toLowerCase() === "any") {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(
    0,
    ...sizes.split(WHITESPACE_PATTERN).map((size) => {
      const match = SIZE_PATTERN.exec(size);
      return match ? Number(match[1]) * Number(match[2]) : 0;
    })
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function extractPageIconLinks(
  html: string,
  pageUrl: string
): PageIconLinks {
  const icons: {
    hasMedia: boolean;
    priority: number;
    size: number;
    url: string;
  }[] = [];
  const manifests: string[] = [];

  for (const tag of html.match(LINK_PATTERN) ?? []) {
    const attributes = parseAttributes(tag);
    const relations = (attributes.rel ?? "")
      .toLowerCase()
      .split(WHITESPACE_PATTERN)
      .filter(Boolean);
    const url = attributes.href
      ? resolveHttpUrl(attributes.href, pageUrl)
      : null;
    if (!url) {
      continue;
    }

    if (relations.includes("manifest")) {
      manifests.push(url);
    }
    const isAppleTouchIcon = relations.includes("apple-touch-icon");
    if (relations.includes("icon") || isAppleTouchIcon) {
      icons.push({
        hasMedia: Boolean(attributes.media),
        priority: isAppleTouchIcon ? 1 : 0,
        size: sizeScore(attributes.sizes),
        url,
      });
    }
  }

  icons.sort(
    (left, right) =>
      left.priority - right.priority ||
      Number(left.hasMedia) - Number(right.hasMedia) ||
      right.size - left.size
  );

  return {
    icons: unique(icons.map((icon) => icon.url)),
    manifests: unique(manifests),
  };
}

function requestHeaders(accept: string) {
  return {
    Accept: accept,
    "User-Agent": "awesome-shadcn-ui",
  };
}

function githubHeaders(accept = "application/vnd.github+json") {
  const headers: Record<string, string> = {
    ...requestHeaders(accept),
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function requestFailure(error: unknown) {
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "timeout";
  }
  return "request failed";
}

async function request(
  fetcher: Fetcher,
  candidate: IconCandidate,
  attempts = 2
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Network retries must run sequentially.
      return await fetcher(candidate.url, {
        headers:
          candidate.headers ??
          requestHeaders(
            "image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.8"
          ),
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`request failed for ${candidate.url}`);
}

async function readTextResponse(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PAGE_BYTES) {
    throw new Error("response is too large");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_PAGE_BYTES) {
    throw new Error("response is too large");
  }
  return text;
}

export function isSupportedIcon(
  bytes: Uint8Array,
  acceptance: IconAcceptance = DEFAULT_ICON_ACCEPTANCE
) {
  if (bytes.byteLength < 8 || bytes.byteLength > acceptance.maxBytes) {
    return false;
  }

  const format = detectIconFormat(bytes);
  if (!format) {
    return false;
  }
  if (acceptance.formats && !acceptance.formats.has(format)) {
    return false;
  }
  return format === "svg"
    ? isSafeSvgText(new TextDecoder().decode(bytes))
    : true;
}

type DownloadOutcome = { asset: IconAsset } | { failures: string[] };

async function downloadFirstIcon(
  candidates: IconCandidate[],
  fetcher: Fetcher,
  logoPath: string | undefined,
  acceptance: IconAcceptance
): Promise<DownloadOutcome> {
  const destinationExtension = logoPath
    ? extname(logoPath).toLowerCase()
    : null;
  const prioritizedCandidates = candidates
    .map((candidate, index) => {
      let sourceExtension = "";
      try {
        sourceExtension = extname(
          new URL(candidate.url).pathname
        ).toLowerCase();
      } catch {
        // Keep invalid candidates at their original priority; request will reject them.
      }
      return {
        candidate,
        index,
        matchesDestination:
          destinationExtension !== null &&
          sourceExtension === destinationExtension,
      };
    })
    .sort(
      (left, right) =>
        Number(right.matchesDestination) - Number(left.matchesDestination) ||
        left.index - right.index
    );

  const failures: string[] = [];
  for (const { candidate } of prioritizedCandidates) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Candidate priority requires sequential fallbacks.
      const response = await request(fetcher, candidate);
      if (!response.ok) {
        failures.push(`${candidate.url}: HTTP ${response.status}`);
        continue;
      }
      const declaredLength = Number(
        response.headers.get("content-length") ?? 0
      );
      if (declaredLength > acceptance.maxBytes) {
        failures.push(`${candidate.url}: response too large`);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isSupportedIcon(bytes, acceptance)) {
        failures.push(`${candidate.url}: unsupported icon format`);
        continue;
      }
      return { asset: { bytes, sourceUrl: candidate.url } };
    } catch (error) {
      failures.push(`${candidate.url}: ${requestFailure(error)}`);
    }
  }

  return { failures };
}

async function manifestIconCandidates(
  manifestUrls: string[],
  fetcher: Fetcher
) {
  const groups = await Promise.all(
    manifestUrls.map(async (manifestUrl) => {
      const candidates: { size: number; url: string }[] = [];
      try {
        const response = await request(
          fetcher,
          {
            headers: requestHeaders(
              "application/manifest+json,application/json"
            ),
            url: manifestUrl,
          },
          1
        );
        if (!response.ok) {
          return candidates;
        }
        const manifest = JSON.parse(await readTextResponse(response)) as {
          icons?: { sizes?: string; src?: string }[];
        };
        for (const icon of manifest.icons ?? []) {
          const url = icon.src ? resolveHttpUrl(icon.src, manifestUrl) : null;
          if (url) {
            candidates.push({ size: sizeScore(icon.sizes), url });
          }
        }
      } catch {
        // A malformed manifest should not stop the other fallbacks.
      }
      return candidates;
    })
  );

  return groups
    .flat()
    .sort((left, right) => right.size - left.size)
    .map((candidate) => ({ url: candidate.url }));
}

function repositoryPath(githubUrl: string) {
  try {
    const url = new URL(githubUrl);
    if (url.hostname !== "github.com") {
      return null;
    }
    const [owner, repository] = url.pathname
      .replace(LEADING_SLASHES, "")
      .split("/");
    return owner && repository
      ? `${owner}/${repository.replace(GIT_SUFFIX_PATTERN, "")}`
      : null;
  } catch {
    return null;
  }
}

function githubIconScore(path: string) {
  const lowerPath = path.toLowerCase();
  if (
    !SUPPORTED_EXTENSION.test(lowerPath) ||
    GITHUB_IGNORED_PATH_PATTERN.test(lowerPath)
  ) {
    return -1;
  }

  const filename = lowerPath.split("/").at(-1) ?? "";
  let score = 0;
  if (GITHUB_ICON_FILENAME_PATTERN.test(filename)) {
    score += 100;
  } else if (GITHUB_TOUCH_ICON_PATTERN.test(filename)) {
    score += 90;
  } else if (GITHUB_LOGO_PATTERN.test(filename)) {
    score += 50;
  } else {
    return -1;
  }
  if (GITHUB_APP_ICON_PATTERN.test(lowerPath)) {
    score += 50;
  }
  if (GITHUB_PUBLIC_PATH_PATTERN.test(lowerPath)) {
    score += 30;
  }
  if (DOCUMENTATION_PATH_PATTERN.test(lowerPath)) {
    score += 10;
  }

  return score - lowerPath.split("/").length;
}

type GithubOutcome = { candidate: IconCandidate } | { failure: string };

async function githubIconCandidate(
  githubUrl: string | undefined,
  fetcher: Fetcher
): Promise<GithubOutcome | null> {
  if (!githubUrl) {
    return null;
  }
  const repository = repositoryPath(githubUrl);
  if (!repository) {
    return { failure: "github: invalid repository URL" };
  }

  try {
    const metadataResponse = await request(
      fetcher,
      {
        headers: githubHeaders(),
        url: `https://api.github.com/repos/${repository}`,
      },
      1
    );
    if (!metadataResponse.ok) {
      return {
        failure: `github: repository lookup failed (HTTP ${metadataResponse.status})`,
      };
    }
    const metadata = (await metadataResponse.json()) as {
      default_branch: string;
    };
    const treeResponse = await request(
      fetcher,
      {
        headers: githubHeaders(),
        url: `https://api.github.com/repos/${repository}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`,
      },
      1
    );
    if (!treeResponse.ok) {
      return {
        failure: `github: repository tree lookup failed (HTTP ${treeResponse.status})`,
      };
    }
    const tree = (await treeResponse.json()) as {
      tree?: { path?: string; type?: string }[];
    };
    const path = (tree.tree ?? [])
      .filter(
        (item): item is { path: string; type?: string } =>
          item.type === "blob" && Boolean(item.path)
      )
      .map((item) => ({ path: item.path, score: githubIconScore(item.path) }))
      .filter((item) => item.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.path.localeCompare(right.path)
      )[0]?.path;
    if (!path) {
      return { failure: "github: no icon found in repository" };
    }

    return {
      candidate: {
        headers: githubHeaders("application/vnd.github.raw+json"),
        url: `https://api.github.com/repos/${repository}/contents/${path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(metadata.default_branch)}`,
      },
    };
  } catch {
    return { failure: "github: request failed" };
  }
}

/**
 * 采集单个目标的图标：解析官网 HTML 声明 → Web App Manifest → /favicon.ico，
 * 全部失败时回退到 GitHub 仓库内的图标文件。
 */
export async function resolveIcon(
  target: IconSourceTarget,
  fetcher: Fetcher = fetch,
  acceptance: IconAcceptance = DEFAULT_ICON_ACCEPTANCE
): Promise<IconResolution> {
  const failures: string[] = [];
  let pageLinks: PageIconLinks = { icons: [], manifests: [] };
  let pageUrl = target.website;

  try {
    const response = await request(fetcher, {
      headers: requestHeaders("text/html,application/xhtml+xml"),
      url: target.website,
    });
    if (response.ok) {
      pageUrl = response.url || target.website;
      pageLinks = extractPageIconLinks(
        await readTextResponse(response),
        pageUrl
      );
    } else {
      failures.push(`${target.website}: HTTP ${response.status}`);
    }
  } catch (error) {
    // The conventional path and repository fallbacks may still succeed.
    failures.push(`${target.website}: ${requestFailure(error)}`);
  }

  const directCandidates = pageLinks.icons.map((url) => ({ url }));
  const manifestCandidates = await manifestIconCandidates(
    pageLinks.manifests,
    fetcher
  );
  const conventionalCandidate = {
    url: new URL("/favicon.ico", pageUrl).href,
  };
  const websiteOutcome = await downloadFirstIcon(
    [...directCandidates, ...manifestCandidates, conventionalCandidate],
    fetcher,
    target.logo,
    acceptance
  );
  if ("asset" in websiteOutcome) {
    return { asset: websiteOutcome.asset, ok: true };
  }
  failures.push(...websiteOutcome.failures);

  const repositoryOutcome = await githubIconCandidate(target.github, fetcher);
  if (repositoryOutcome === null || "failure" in repositoryOutcome) {
    if (repositoryOutcome) {
      failures.push(repositoryOutcome.failure);
    }
    return { failures, ok: false };
  }

  const repositoryOutcomeAssets = await downloadFirstIcon(
    [repositoryOutcome.candidate],
    fetcher,
    target.logo,
    acceptance
  );
  if ("asset" in repositoryOutcomeAssets) {
    return { asset: repositoryOutcomeAssets.asset, ok: true };
  }
  failures.push(...repositoryOutcomeAssets.failures);
  return { failures, ok: false };
}
