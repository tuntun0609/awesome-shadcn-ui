import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { libraries } from "../src/data/libraries";

export interface IconSyncTarget {
  github?: string;
  logo: string;
  slug: string;
  website: string;
}

export interface IconAsset {
  bytes: Uint8Array;
  sourceUrl: string;
}

export interface IconSyncResult {
  failures: string[];
  synced: { slug: string; sourceUrl: string }[];
}

interface IconCandidate {
  headers?: Record<string, string>;
  url: string;
}

interface PageIconLinks {
  icons: string[];
  manifests: string[];
}

type Fetcher = typeof fetch;
type IconWriter = (target: IconSyncTarget, bytes: Uint8Array) => Promise<void>;

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
const LEADING_SLASHES = /^\/+/;
const LINK_PATTERN = /<link\b[^>]*>/gi;
const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const SIZE_PATTERN = /^(\d+)x(\d+)$/i;
const SUPPORTED_EXTENSION = /\.(?:ico|jpe?g|png|svg|webp)$/i;
const SVG_BOM_PATTERN = /^\uFEFF/;
const SVG_HREF_PATTERN =
  /(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const SVG_ROOT_PATTERN = /^(?:<\?xml[^>]*>\s*)?<svg\b/i;
const UNSAFE_SVG_PATTERN = /<script\b|<foreignObject\b|\bon\w+\s*=/i;
const WHITESPACE_PATTERN = /\s+/;
const PUBLIC_ROOT = resolve(
  fileURLToPath(new URL("../public/", import.meta.url))
);

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

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export function isSupportedIcon(bytes: Uint8Array) {
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_ICON_BYTES) {
    return false;
  }

  const isPng = hasBytes(
    bytes,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );
  const isIco = hasBytes(bytes, [0x00, 0x00, 0x01, 0x00]);
  const isWebp =
    hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  const isJpeg = hasBytes(bytes, [0xff, 0xd8, 0xff]);
  if (isPng || isIco || isWebp || isJpeg) {
    return true;
  }

  const svg = new TextDecoder()
    .decode(bytes)
    .replace(SVG_BOM_PATTERN, "")
    .trimStart();
  if (!SVG_ROOT_PATTERN.test(svg) || UNSAFE_SVG_PATTERN.test(svg)) {
    return false;
  }
  return [...svg.matchAll(SVG_HREF_PATTERN)].every((match) =>
    (match[1] ?? match[2] ?? match[3] ?? "").startsWith("#")
  );
}

async function downloadFirstIcon(
  candidates: IconCandidate[],
  fetcher: Fetcher,
  logoPath: string
) {
  const destinationExtension = extname(logoPath).toLowerCase();
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
        matchesDestination: sourceExtension === destinationExtension,
      };
    })
    .sort(
      (left, right) =>
        Number(right.matchesDestination) - Number(left.matchesDestination) ||
        left.index - right.index
    );

  for (const { candidate } of prioritizedCandidates) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: Candidate priority requires sequential fallbacks.
      const response = await request(fetcher, candidate);
      if (!response.ok) {
        continue;
      }
      const declaredLength = Number(
        response.headers.get("content-length") ?? 0
      );
      if (declaredLength > MAX_ICON_BYTES) {
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (isSupportedIcon(bytes)) {
        return { bytes, sourceUrl: candidate.url } satisfies IconAsset;
      }
    } catch {
      // Try the next declared or fallback icon.
    }
  }

  return null;
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

async function githubIconCandidate(
  githubUrl: string | undefined,
  fetcher: Fetcher
): Promise<IconCandidate | null> {
  if (!githubUrl) {
    return null;
  }
  const repository = repositoryPath(githubUrl);
  if (!repository) {
    return null;
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
      return null;
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
      return null;
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
      return null;
    }

    return {
      headers: githubHeaders("application/vnd.github.raw+json"),
      url: `https://api.github.com/repos/${repository}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(metadata.default_branch)}`,
    };
  } catch {
    return null;
  }
}

export async function resolveIcon(
  target: IconSyncTarget,
  fetcher: Fetcher = fetch
) {
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
    }
  } catch {
    // The conventional path and repository fallbacks may still succeed.
  }

  const directCandidates = pageLinks.icons.map((url) => ({ url }));
  const manifestCandidates = await manifestIconCandidates(
    pageLinks.manifests,
    fetcher
  );
  const conventionalCandidate = {
    url: new URL("/favicon.ico", pageUrl).href,
  };
  const websiteAsset = await downloadFirstIcon(
    [...directCandidates, ...manifestCandidates, conventionalCandidate],
    fetcher,
    target.logo
  );
  if (websiteAsset) {
    return websiteAsset;
  }

  const repositoryCandidate = await githubIconCandidate(target.github, fetcher);
  return repositoryCandidate
    ? downloadFirstIcon([repositoryCandidate], fetcher, target.logo)
    : null;
}

async function writeIcon(target: IconSyncTarget, bytes: Uint8Array) {
  const relativePath = target.logo.replace(LEADING_SLASHES, "");
  const outputPath = resolve(PUBLIC_ROOT, relativePath);
  if (!outputPath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
    throw new Error(`logo path escapes public: ${target.logo}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function syncIcons(
  targets: IconSyncTarget[],
  fetcher: Fetcher = fetch,
  writer: IconWriter = writeIcon
): Promise<IconSyncResult> {
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const asset = await resolveIcon(target, fetcher);
        if (!asset) {
          return {
            failure: `${target.slug}: no valid icon found`,
            synced: null,
          };
        }
        await writer(target, asset.bytes);
        return {
          failure: null,
          synced: { slug: target.slug, sourceUrl: asset.sourceUrl },
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
