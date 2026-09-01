import { describe, expect, test } from "bun:test";
import {
  accessModels,
  deliveryTypes,
  libraries,
  pricingModels,
  sourceModels,
  useCases,
} from "../data/libraries";
import {
  type CatalogFilters,
  filterLibraries,
  formatCommitDate,
  type GithubSnapshot,
  sortLibraries,
} from "./catalog";

const emptyFilters: CatalogFilters = {
  access: [],
  delivery: [],
  pricing: [],
  query: "",
  source: [],
  useCases: [],
};

const emptyMetrics: GithubSnapshot = { repositories: {}, syncedAt: null };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("catalog filtering", () => {
  test("uses OR within a dimension and AND across dimensions", () => {
    const result = filterLibraries(libraries, {
      ...emptyFilters,
      delivery: ["components"],
      pricing: ["free", "paid"],
      source: ["open-source"],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (item) =>
          item.delivery.includes("components") &&
          ["free", "paid"].includes(item.pricing) &&
          item.source === "open-source"
      )
    ).toBe(true);
  });

  test("searches names, descriptions, and tags", () => {
    expect(
      filterLibraries(libraries, {
        ...emptyFilters,
        query: "authentication",
      }).map((item) => item.slug)
    ).toContain("efferd");
  });
});

describe("catalog sorting", () => {
  test("keeps featured entries ahead of the remaining catalog", () => {
    const result = sortLibraries(libraries, "featured", emptyMetrics);
    expect(result.slice(0, 5).map((item) => item.featuredRank)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  test("sorts missing GitHub metrics after known star counts", () => {
    const metrics: GithubSnapshot = {
      repositories: {
        "magic-ui": {
          latestCommitAt: null,
          stars: 10,
          syncedAt: "2026-09-01T00:00:00.000Z",
        },
      },
      syncedAt: "2026-09-01T00:00:00.000Z",
    };
    const result = sortLibraries(libraries, "most-starred", metrics);
    expect(result[0]?.slug).toBe("magic-ui");
  });
});

describe("data and dates", () => {
  test("catalog entries have unique, valid core fields", () => {
    expect(new Set(libraries.map((item) => item.slug)).size).toBe(
      libraries.length
    );
    for (const item of libraries) {
      expect(item.slug).toMatch(SLUG_PATTERN);
      expect(() => new URL(item.website)).not.toThrow();
      if (item.github) {
        expect(() => new URL(item.github as string)).not.toThrow();
      }
      expect(sourceModels).toContain(item.source);
      expect(pricingModels).toContain(item.pricing);
      expect(accessModels).toContain(item.access);
      expect(
        item.delivery.every((value) => deliveryTypes.includes(value))
      ).toBe(true);
      expect(item.useCases.every((value) => useCases.includes(value))).toBe(
        true
      );
    }
  });

  test("marks snapshots older than 30 days as potentially outdated", () => {
    expect(
      formatCommitDate("2026-07-01T00:00:00.000Z", new Date("2026-09-01"))
    ).toContain("possibly outdated");
  });
});
