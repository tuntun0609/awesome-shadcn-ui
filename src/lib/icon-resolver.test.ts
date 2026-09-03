import { describe, expect, test } from "bun:test";
import {
  extractPageIconLinks,
  type IconSourceTarget,
  isSupportedIcon,
  resolveIcon,
} from "./icon-resolver";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const ICO = Uint8Array.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);

function responseMap(entries: [string, Response][]) {
  const responses = new Map(entries);
  return ((input: string | URL | Request) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      ({ url } = input);
    }
    return Promise.resolve(
      responses.get(url) ?? new Response("", { status: 404 })
    );
  }) as typeof fetch;
}

const target: IconSourceTarget = {
  logo: "/logos/library.png",
  website: "https://example.com/docs",
};

describe("icon resolver", () => {
  test("prioritizes a generic declared icon over color-scheme variants", () => {
    const links = extractPageIconLinks(
      `
        <link rel="icon" href="/dark.ico" media="(prefers-color-scheme: light)">
        <link rel="icon" href="/icon.png?size=64&amp;v=1" sizes="64x64">
        <link rel="apple-touch-icon" href="/apple.png" sizes="180x180">
        <link rel="manifest" href="/manifest.webmanifest">
      `,
      "https://example.com/docs"
    );

    expect(links.icons).toEqual([
      "https://example.com/icon.png?size=64&v=1",
      "https://example.com/dark.ico",
      "https://example.com/apple.png",
    ]);
    expect(links.manifests).toEqual([
      "https://example.com/manifest.webmanifest",
    ]);
  });

  test("downloads a non-standard icon declared by the page", async () => {
    const fetcher = responseMap([
      [
        target.website,
        new Response('<link rel="icon" href="/brand/icon.png">'),
      ],
      [
        "https://example.com/brand/icon.png",
        new Response(PNG, { headers: { "Content-Type": "image/png" } }),
      ],
    ]);
    const resolution = await resolveIcon(target, fetcher);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.asset.sourceUrl).toBe(
        "https://example.com/brand/icon.png"
      );
      expect(resolution.asset.bytes).toEqual(PNG);
    }
  });

  test("prefers a source whose extension matches the local destination", async () => {
    const icoTarget = { ...target, logo: "/logos/library.ico" };
    const fetcher = responseMap([
      [
        target.website,
        new Response('<link rel="icon" href="/favicon-32x32.png">'),
      ],
      [
        "https://example.com/favicon-32x32.png",
        new Response(PNG, { headers: { "Content-Type": "image/png" } }),
      ],
      [
        "https://example.com/favicon.ico",
        new Response(ICO, { headers: { "Content-Type": "image/x-icon" } }),
      ],
    ]);
    const resolution = await resolveIcon(icoTarget, fetcher);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.asset.sourceUrl).toBe(
        "https://example.com/favicon.ico"
      );
    }
  });

  test("uses the largest icon from a web manifest", async () => {
    const fetcher = responseMap([
      [
        target.website,
        new Response('<link rel="manifest" href="/site.webmanifest">'),
      ],
      [
        "https://example.com/site.webmanifest",
        Response.json({
          icons: [
            { sizes: "32x32", src: "/small.png" },
            { sizes: "192x192", src: "/large.png" },
          ],
        }),
      ],
      [
        "https://example.com/large.png",
        new Response(PNG, { headers: { "Content-Type": "image/png" } }),
      ],
    ]);
    const resolution = await resolveIcon(target, fetcher);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.asset.sourceUrl).toBe("https://example.com/large.png");
    }
  });

  test("falls back to an official GitHub repository icon", async () => {
    const githubTarget: IconSourceTarget = {
      ...target,
      github: "https://github.com/example/library",
    };
    const fetcher = responseMap([
      [target.website, new Response("unavailable", { status: 526 })],
      [
        "https://example.com/favicon.ico",
        new Response("missing", { status: 404 }),
      ],
      [
        "https://api.github.com/repos/example/library",
        Response.json({ default_branch: "main" }),
      ],
      [
        "https://api.github.com/repos/example/library/git/trees/main?recursive=1",
        Response.json({
          tree: [{ path: "docs/app/icon.png", type: "blob" }],
        }),
      ],
      [
        "https://api.github.com/repos/example/library/contents/docs/app/icon.png?ref=main",
        new Response(PNG, { headers: { "Content-Type": "image/png" } }),
      ],
    ]);
    const resolution = await resolveIcon(githubTarget, fetcher);

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.asset.sourceUrl).toContain(
        "/contents/docs/app/icon.png?ref=main"
      );
    }
  });

  test("rejects HTML masquerading as an icon and reports the failures", async () => {
    const fetcher = responseMap([
      [target.website, new Response('<link rel="icon" href="/not-an-icon">')],
      ["https://example.com/not-an-icon", new Response("<html>error</html>")],
      [
        "https://example.com/favicon.ico",
        new Response("missing", { status: 404 }),
      ],
    ]);
    const resolution = await resolveIcon(target, fetcher);

    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.failures).toEqual([
        "https://example.com/not-an-icon: unsupported icon format",
        "https://example.com/favicon.ico: HTTP 404",
      ]);
    }
  });

  test("rejects active content in SVG files", () => {
    expect(
      isSupportedIcon(
        new TextEncoder().encode('<svg><script>alert("x")</script></svg>')
      )
    ).toBe(false);
    expect(
      isSupportedIcon(
        new TextEncoder().encode(
          '<svg><image href="https://example.com/tracker.png" /></svg>'
        )
      )
    ).toBe(false);
  });
});
