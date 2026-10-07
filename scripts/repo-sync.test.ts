import { describe, expect, test } from "bun:test";
import { type RepositorySnapshot, syncRepositories } from "./repo-sync";

const empty: RepositorySnapshot = { repositories: {}, syncedAt: null };

function urlOf(input: string | URL | Request) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

describe("repository metric sync", () => {
  test("stores stars and the default branch commit date", async () => {
    const responses = [
      Response.json({ default_branch: "main", stargazers_count: 42 }),
      Response.json({
        commit: { committer: { date: "2026-08-31T12:00:00Z" } },
      }),
    ];
    const fetcher = (async () => responses.shift() as Response) as typeof fetch;
    const result = await syncRepositories(
      [
        {
          repositoryUrl: "https://github.com/example/library",
          slug: "library",
        },
      ],
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

  test("syncs GitLab repositories alongside GitHub ones", async () => {
    const fetcher = ((input: string | URL | Request) => {
      const url = urlOf(input);
      if (url === "https://gitlab.com/api/v4/projects/group%2Fproject") {
        return Promise.resolve(
          Response.json({
            default_branch: "main",
            id: 42,
            star_count: 5,
          })
        );
      }
      if (url.includes("/repository/commits")) {
        return Promise.resolve(
          Response.json([{ committed_date: "2026-08-29T02:00:00.000+02:00" }])
        );
      }
      return Promise.resolve(new Response("", { status: 404 }));
    }) as typeof fetch;
    const result = await syncRepositories(
      [
        {
          repositoryUrl: "https://gitlab.com/group/project",
          slug: "gitlab-lib",
        },
      ],
      empty,
      fetcher,
      new Date("2026-09-01T00:00:00Z")
    );
    expect(result.failures).toEqual([]);
    expect(result.snapshot.repositories["gitlab-lib"]).toEqual({
      latestCommitAt: "2026-08-29T00:00:00.000Z",
      stars: 5,
      syncedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  test("keeps the previous snapshot when the provider is unavailable", async () => {
    const previous: RepositorySnapshot = {
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
      [
        {
          repositoryUrl: "https://github.com/example/library",
          slug: "library",
        },
      ],
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
      [
        {
          repositoryUrl: "https://github.com/example/missing",
          slug: "missing",
        },
      ],
      empty,
      fetcher
    );
    expect(result.snapshot.repositories.missing).toBeUndefined();
  });
});
