import { describe, expect, test } from "bun:test";
import { fetchGithubMetrics } from "./github-metrics-fetcher";

describe("fetchGithubMetrics", () => {
  test("returns stars and the default branch commit date", async () => {
    const responses = [
      Response.json({ default_branch: "main", stargazers_count: 42 }),
      Response.json({
        commit: { committer: { date: "2026-08-31T12:00:00Z" } },
      }),
    ];
    const fetcher = (async () => responses.shift() as Response) as typeof fetch;
    const metric = await fetchGithubMetrics(
      "https://github.com/example/library",
      fetcher,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(metric).toEqual({
      latestCommitAt: "2026-08-31T12:00:00Z",
      stars: 42,
      syncedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  test("throws when the repository is unavailable", async () => {
    const fetcher = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    await expect(
      fetchGithubMetrics("https://github.com/example/missing", fetcher)
    ).rejects.toThrow("404");
  });
});
