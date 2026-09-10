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

/**
 * 计算与当前组件库最相似的其他组件库。
 * 相似度由交付类型、使用场景与标签的重叠数量加权得出，
 * 同分时优先展示星标更多、名称更靠前的库。
 */
export function relatedLibraries(
  current: Library,
  items: readonly Library[],
  metrics: GithubSnapshot,
  limit = 4
): Library[] {
  const overlap = (left: readonly string[], right: readonly string[]) =>
    left.filter((value) => right.includes(value)).length;

  return items
    .filter((item) => item.slug !== current.slug)
    .map((item) => ({
      item,
      score:
        overlap(item.useCases, current.useCases) * 2 +
        overlap(item.delivery, current.delivery) +
        overlap(item.tags, current.tags),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      const leftStars = metrics.repositories[left.item.slug]?.stars ?? -1;
      const rightStars = metrics.repositories[right.item.slug]?.stars ?? -1;
      return (
        rightStars - leftStars || left.item.name.localeCompare(right.item.name)
      );
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

export function formatCompactNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatCommitDate(
  value: string,
  locale: string,
  outdatedLabel: string,
  now = new Date()
) {
  const date = new Date(value);
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (days <= 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -days,
      "day"
    );
  }

  const exact = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  return days > 30 ? `${exact} · ${outdatedLabel}` : exact;
}
