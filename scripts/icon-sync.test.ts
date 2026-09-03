import { describe, expect, test } from "bun:test";
import { type IconSyncTarget, syncIcons } from "./icon-sync";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

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

const target: IconSyncTarget = {
  logo: "/logos/library.png",
  slug: "library",
  website: "https://example.com",
};

describe("icon sync", () => {
  test("writes the resolved icon via the injected writer", async () => {
    const fetcher = responseMap([
      [
        "https://example.com",
        new Response('<link rel="icon" href="/icon.png">'),
      ],
      [
        "https://example.com/icon.png",
        new Response(PNG, { headers: { "Content-Type": "image/png" } }),
      ],
    ]);
    let written: Uint8Array | null = null;
    const result = await syncIcons([target], fetcher, (_, bytes) => {
      written = bytes;
      return Promise.resolve();
    });

    expect(result.failures).toEqual([]);
    expect(result.synced).toEqual([
      { slug: "library", sourceUrl: "https://example.com/icon.png" },
    ]);
    expect(written).toEqual(PNG);
  });

  test("keeps the existing icon and reports reasons when nothing resolves", async () => {
    const fetcher = responseMap([
      ["https://example.com", new Response("", { status: 500 })],
      ["https://example.com/favicon.ico", new Response("", { status: 404 })],
    ]);
    let writes = 0;
    const result = await syncIcons([target], fetcher, () => {
      writes += 1;
      return Promise.resolve();
    });

    expect(result.synced).toEqual([]);
    expect(result.failures.length).toBe(1);
    expect(result.failures[0]).toContain("library: no valid icon found");
    expect(writes).toBe(0);
  });
});
