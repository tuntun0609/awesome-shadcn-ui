import { describe, expect, test } from "bun:test";
import { type MetricsSnapshot, syncRepositories } from "./github-sync";

const empty: MetricsSnapshot = { repositories: {}, syncedAt: null };

describe("GitHub metric sync", () => {
  test("stores stars and the default branch commit date", async () => {
    const responses = [
      Response.json({ default_branch: "main", stargazers_count: 42 }),
      Response.json({
        commit: { committer: { date: "2026-08-31T12:00:00Z" } },
      }),
    ];
    const fetcher = (async () => responses.shift() as Response) as typeof fetch;
    const result = await syncRepositories(
      [{ github: "https://github.com/example/library", slug: "library" }],
      empty,
      fetcher,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(result.failures).toEqual([]);
    expect(result.snapshot.repositories.library.stars).toBe(42);
    expect(result.snapshot.repositories.library.latestCommitAt).toBe(
      "2026-08-31T12:00:00Z"
    );
  });

  test("keeps the previous snapshot when GitHub is unavailable", async () => {
    const previous: MetricsSnapshot = {
      repositories: {
        library: {
          latestCommitAt: "2026-08-01T00:00:00Z",
          stars: 12,
          syncedAt: "2026-08-02T00:00:00Z",
        },
      },
      syncedAt: "2026-08-02T00:00:00Z",
    };
    const fetcher = (async () =>
      new Response("", { status: 500 })) as typeof fetch;
    const result = await syncRepositories(
      [{ github: "https://github.com/example/library", slug: "library" }],
      previous,
      fetcher
    );
    expect(result.failures).toHaveLength(1);
    expect(result.snapshot.repositories.library).toEqual(
      previous.repositories.library
    );
  });

  test("omits a failed repository when no fallback exists", async () => {
    const fetcher = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    const result = await syncRepositories(
      [{ github: "https://github.com/example/missing", slug: "missing" }],
      empty,
      fetcher
    );
    expect(result.snapshot.repositories.missing).toBeUndefined();
  });
});
