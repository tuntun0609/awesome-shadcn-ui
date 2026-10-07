import { describe, expect, test } from "bun:test";
import { fetchRepositoryMetrics } from "./repository-metrics-fetcher";

function urlOf(input: string | URL | Request) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

describe("fetchRepositoryMetrics", () => {
  test("returns GitHub stars and the default branch commit date", async () => {
    const responses = [
      Response.json({ default_branch: "main", stargazers_count: 42 }),
      Response.json({
        commit: { committer: { date: "2026-08-31T12:00:00Z" } },
      }),
    ];
    const fetcher = (async () => responses.shift() as Response) as typeof fetch;
    const metric = await fetchRepositoryMetrics(
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

  test("returns GitLab stars and the default branch commit date", async () => {
    const requests: string[] = [];
    const fetcher = ((input: string | URL | Request) => {
      const url = urlOf(input);
      requests.push(url);
      if (url.includes("/repository/commits")) {
        // GitLab 的 committed_date 可能带时区偏移，应规范化为 UTC。
        return Promise.resolve(
          Response.json([{ committed_date: "2026-08-30T10:00:00.000+02:00" }])
        );
      }
      if (url.startsWith("https://gitlab.com/api/v4/projects/")) {
        return Promise.resolve(
          Response.json({
            default_branch: "main",
            id: 123,
            star_count: 7,
          })
        );
      }
      return Promise.resolve(new Response("", { status: 404 }));
    }) as typeof fetch;
    const metric = await fetchRepositoryMetrics(
      "https://gitlab.com/example/library",
      fetcher,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(metric).toEqual({
      latestCommitAt: "2026-08-30T08:00:00.000Z",
      stars: 7,
      syncedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(requests[0]).toBe(
      "https://gitlab.com/api/v4/projects/example%2Flibrary"
    );
  });

  test("reports an unknown latest commit for an empty GitLab repository", async () => {
    const fetcher = ((input: string | URL | Request) => {
      const url = urlOf(input);
      if (url.startsWith("https://gitlab.com/api/v4/projects/")) {
        return Promise.resolve(
          Response.json({
            default_branch: null,
            id: 123,
            star_count: 0,
          })
        );
      }
      return Promise.resolve(Response.json([]));
    }) as typeof fetch;
    const metric = await fetchRepositoryMetrics(
      "https://gitlab.com/example/empty",
      fetcher,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(metric).toEqual({
      latestCommitAt: null,
      stars: 0,
      syncedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  test("throws when the repository is unavailable", async () => {
    const fetcher = (async () =>
      new Response("", { status: 404 })) as typeof fetch;
    await expect(
      fetchRepositoryMetrics("https://github.com/example/missing", fetcher)
    ).rejects.toThrow("404");
  });

  test("throws for repositories on unsupported hosts", async () => {
    await expect(
      fetchRepositoryMetrics("https://example.com/owner/repo", fetch)
    ).rejects.toThrow("unsupported repository URL");
  });
});
