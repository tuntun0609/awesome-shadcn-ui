/** biome-ignore-all lint/performance/noJsxPropsBind: local event handlers keep the filter controls readable. */
"use client";

import {
  ArrowUpRight,
  CalendarClock,
  Filter,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { Library } from "@/data/libraries";
import {
  accessModels,
  deliveryTypes,
  pricingModels,
  sourceModels,
  useCases,
} from "@/data/libraries";
import {
  type CatalogFilters,
  type CatalogSort,
  filterLibraries,
  formatCommitDate,
  formatCompactNumber,
  type GithubSnapshot,
  sortLibraries,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface LibraryDirectoryProps {
  libraries: Library[];
  metrics: GithubSnapshot;
}

const labels: Record<string, string> = {
  ai: "AI",
  blocks: "Blocks",
  commerce: "Commerce",
  components: "Components",
  content: "Content",
  dashboard: "Dashboard",
  "data-display": "Data display",
  direct: "Direct access",
  free: "Free",
  freemium: "Freemium",
  "login-required": "Login required",
  marketing: "Marketing",
  "open-source": "Open source",
  paid: "Paid",
  proprietary: "Proprietary",
  "purchase-required": "Purchase required",
  "source-available": "Source available",
  templates: "Templates",
  undisclosed: "Undisclosed",
};

const readList = (params: URLSearchParams, key: string) =>
  params.get(key)?.split(",").filter(Boolean) ?? [];

function Initials({ name }: { name: string }) {
  return (
    <span aria-hidden="true">
      {name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
}

function FilterGroup({
  active,
  label,
  onToggle,
  options,
}: {
  active: string[];
  label: string;
  onToggle: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            aria-pressed={active.includes(option)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 font-medium text-xs transition-colors",
              active.includes(option)
                ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
            key={option}
            onClick={() => onToggle(option)}
            type="button"
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function FilterGroups({
  filters,
  onToggle,
}: {
  filters: CatalogFilters;
  onToggle: (key: string, value: string) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <FilterGroup
        active={filters.source}
        label="Source"
        onToggle={(value) => onToggle("source", value)}
        options={sourceModels}
      />
      <FilterGroup
        active={filters.pricing}
        label="Pricing"
        onToggle={(value) => onToggle("pricing", value)}
        options={pricingModels}
      />
      <FilterGroup
        active={filters.delivery}
        label="Delivery"
        onToggle={(value) => onToggle("delivery", value)}
        options={deliveryTypes}
      />
      <FilterGroup
        active={filters.access}
        label="Access"
        onToggle={(value) => onToggle("access", value)}
        options={accessModels}
      />
      <FilterGroup
        active={filters.useCases}
        label="Use case"
        onToggle={(value) => onToggle("use", value)}
        options={useCases}
      />
    </div>
  );
}

function Metric({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function LibraryDirectory({
  libraries,
  metrics,
}: LibraryDirectoryProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters: CatalogFilters = {
    access: readList(searchParams, "access"),
    delivery: readList(searchParams, "delivery"),
    pricing: readList(searchParams, "pricing"),
    query: searchParams.get("q") ?? "",
    source: readList(searchParams, "source"),
    useCases: readList(searchParams, "use"),
  };
  const requestedSort = searchParams.get("sort");
  const sort: CatalogSort =
    requestedSort === "recently-updated" || requestedSort === "most-starred"
      ? requestedSort
      : "featured";

  const visibleLibraries = sortLibraries(
    filterLibraries(libraries, filters),
    sort,
    metrics
  );
  const selectedCount =
    filters.source.length +
    filters.pricing.length +
    filters.delivery.length +
    filters.access.length +
    filters.useCases.length;

  const replaceParams = (params: URLSearchParams) => {
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname
    );
  };

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    replaceParams(params);
  };

  const toggleParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const selected = readList(params, key);
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    if (next.length) {
      params.set(key, next.join(","));
    } else {
      params.delete(key);
    }
    replaceParams(params);
  };

  const clearFilters = () => replaceParams(new URLSearchParams());

  return (
    <section aria-labelledby="directory-title" className="pb-24">
      <div className="border-border border-b pb-5">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              Browse the directory
            </p>
            <h2 className="mt-2 font-medium text-xl" id="directory-title">
              Libraries that ship through the shadcn CLI
            </h2>
          </div>
          <p
            aria-live="polite"
            className="shrink-0 font-mono text-muted-foreground text-xs"
          >
            {visibleLibraries.length} / {libraries.length}
          </p>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="group relative block">
            <span className="sr-only">Search libraries</span>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400"
            />
            <input
              className="h-11 w-full rounded-lg border bg-background pr-4 pl-11 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              onChange={(event) => setParam("q", event.target.value)}
              placeholder="Search names, descriptions, or tags…"
              type="search"
              value={filters.query}
            />
          </label>

          <select
            aria-label="Sort libraries"
            className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            onChange={(event) => setParam("sort", event.target.value)}
            value={sort}
          >
            <option value="featured">Featured first</option>
            <option value="recently-updated">Recently updated</option>
            <option value="most-starred">Most starred</option>
          </select>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm md:hidden"
            onClick={() => setMobileFiltersOpen(true)}
            type="button"
          >
            <Filter aria-hidden="true" className="size-4" />
            Filters{selectedCount ? ` (${selectedCount})` : ""}
          </button>
        </div>

        <div className="mt-5 hidden rounded-xl border bg-muted/25 p-5 md:block">
          <FilterGroups filters={filters} onToggle={toggleParam} />
          {selectedCount ? (
            <button
              className="mt-5 text-blue-600 text-xs underline underline-offset-4 dark:text-blue-400"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border border-border border-b">
        {visibleLibraries.map((library) => {
          const metric = metrics.repositories[library.slug];
          return (
            <article
              className="group grid gap-4 py-6 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
              key={library.slug}
            >
              <div className="relative flex size-11 items-center justify-center overflow-hidden rounded-xl border bg-card font-semibold text-sm shadow-sm">
                {library.logo ? (
                  <Image
                    alt=""
                    className="size-7 object-contain"
                    height={28}
                    src={library.logo}
                    unoptimized
                    width={28}
                  />
                ) : (
                  <Initials name={library.name} />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    className="font-semibold text-[15px] underline-offset-4 hover:underline"
                    href={`/libraries/${library.slug}`}
                  >
                    {library.name}
                  </Link>
                  {library.featuredRank ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-[10px] text-blue-700 uppercase tracking-wide dark:text-blue-300">
                      <Sparkles aria-hidden="true" className="size-2.5" />
                      Featured
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 max-w-2xl text-muted-foreground text-sm leading-6">
                  {library.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="tag">{labels[library.source]}</span>
                  <span className="tag">{labels[library.pricing]}</span>
                  {library.delivery.slice(0, 2).map((delivery) => (
                    <span className="tag" key={delivery}>
                      {labels[delivery]}
                    </span>
                  ))}
                  {metric ? (
                    <>
                      <Metric>
                        <Star aria-hidden="true" className="size-3" />
                        {formatCompactNumber(metric.stars)}
                      </Metric>
                      {metric.latestCommitAt ? (
                        <Metric>
                          <CalendarClock
                            aria-hidden="true"
                            className="size-3"
                          />
                          {formatCommitDate(metric.latestCommitAt)}
                        </Metric>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <a
                aria-label={`Visit ${library.name}`}
                className="inline-flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-[color,border-color,transform] hover:-translate-y-0.5 hover:border-blue-500/50 hover:text-blue-600 sm:justify-self-end dark:hover:text-blue-400"
                href={library.website}
                rel="noreferrer"
                target="_blank"
              >
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </article>
          );
        })}
      </div>

      {visibleLibraries.length === 0 ? (
        <div className="border-border border-b py-20 text-center">
          <p className="font-medium">No libraries match those filters.</p>
          <button
            className="mt-3 text-blue-600 text-sm underline underline-offset-4 dark:text-blue-400"
            onClick={clearFilters}
            type="button"
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      {mobileFiltersOpen ? (
        <div
          aria-label="Library filters"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end bg-black/45 md:hidden"
          role="dialog"
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-background p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-medium text-lg">Filters</h3>
              <button
                aria-label="Close filters"
                className="inline-flex size-9 items-center justify-center rounded-lg border"
                onClick={() => setMobileFiltersOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <FilterGroups filters={filters} onToggle={toggleParam} />
            <div className="sticky bottom-0 mt-7 grid grid-cols-2 gap-2 bg-background pt-3">
              <button
                className="h-11 rounded-lg border text-sm"
                onClick={clearFilters}
                type="button"
              >
                Clear
              </button>
              <button
                className="h-11 rounded-lg bg-foreground text-background text-sm"
                onClick={() => setMobileFiltersOpen(false)}
                type="button"
              >
                Show {visibleLibraries.length}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
