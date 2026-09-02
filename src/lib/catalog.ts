import type { GithubSnapshot, Library } from "@/lib/catalog-model";

export type { GithubMetric, GithubSnapshot } from "@/lib/catalog-model";

export type CatalogSort = "featured" | "recently-updated" | "most-starred";

export interface CatalogFilters {
  access: string[];
  delivery: string[];
  pricing: string[];
  query: string;
  source: string[];
  useCases: string[];
}

const includesAny = (values: readonly string[], selected: readonly string[]) =>
  selected.length === 0 || selected.some((value) => values.includes(value));

export function filterLibraries(
  items: readonly Library[],
  filters: CatalogFilters
) {
  const query = filters.query.trim().toLowerCase();

  return items.filter((library) => {
    const searchable = [
      library.name,
      library.description,
      ...library.tags,
      ...library.delivery,
      ...library.useCases,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      includesAny([library.source], filters.source) &&
      includesAny([library.pricing], filters.pricing) &&
      includesAny([library.access], filters.access) &&
      includesAny(library.delivery, filters.delivery) &&
      includesAny(library.useCases, filters.useCases)
    );
  });
}

export function sortLibraries(
  items: readonly Library[],
  sort: CatalogSort,
  metrics: GithubSnapshot
) {
  return [...items].sort((left, right) => {
    if (sort === "most-starred") {
      const delta =
        (metrics.repositories[right.slug]?.stars ?? -1) -
        (metrics.repositories[left.slug]?.stars ?? -1);
      return delta || left.name.localeCompare(right.name);
    }

    if (sort === "recently-updated") {
      const leftDate =
        metrics.repositories[left.slug]?.latestCommitAt ?? left.addedAt;
      const rightDate =
        metrics.repositories[right.slug]?.latestCommitAt ?? right.addedAt;
      return (
        rightDate.localeCompare(leftDate) || left.name.localeCompare(right.name)
      );
    }

    const leftRank = left.featuredRank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.featuredRank ?? Number.POSITIVE_INFINITY;
    return (
      leftRank - rightRank ||
      right.addedAt.localeCompare(left.addedAt) ||
      left.name.localeCompare(right.name)
    );
  });
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatCommitDate(value: string, now = new Date()) {
  const date = new Date(value);
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (days < 1) {
    return "today";
  }
  if (days <= 7) {
    return `${days}d ago`;
  }

  const exact = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  return days > 30 ? `${exact} · possibly outdated` : exact;
}
