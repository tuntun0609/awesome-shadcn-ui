import { auth } from "@clerk/nextjs/server";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Code2,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FavoriteButton } from "@/components/favorite-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog, getCatalogEntry } from "@/db/catalog-data";
import { isFavorite } from "@/db/favorites-repository";
import { Link } from "@/i18n/navigation";
import {
  formatCommitDate,
  formatCompactNumber,
  relatedLibraries,
} from "@/lib/catalog";
import { logoPublicUrl } from "@/lib/logo-url";
import { withRefParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/libraries/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getCatalogEntry(slug);
  if (!entry) {
    return {};
  }
  return {
    alternates: {
      languages: {
        en: `/libraries/${slug}`,
        "x-default": `/libraries/${slug}`,
        zh: `/zh/libraries/${slug}`,
      },
    },
    description: entry.library.description,
    openGraph: { images: [] },
    title: entry.library.name,
    twitter: { images: [] },
  };
}

export default async function LibraryPage({
  params,
}: PageProps<"/[locale]/libraries/[slug]">) {
  const { slug } = await params;
  const entry = await getCatalogEntry(slug);
  if (!entry) {
    notFound();
  }
  const { library, metric } = entry;
  const host = (await headers()).get("host") ?? "";
  const logoSrc = library.logo ? logoPublicUrl(library.logo) : undefined;
  const catalog = await getCatalog();
  const related = relatedLibraries(library, catalog.libraries, catalog.metrics);
  const { userId } = await auth();
  const favorited = userId ? await isFavorite(userId, slug) : false;

  const [t, tagsT, metricsT, locale] = await Promise.all([
    getTranslations("libraryDetail"),
    getTranslations("tags"),
    getTranslations("metrics"),
    getLocale(),
  ]);

  const stats = [
    [t("source"), tagsT(library.source)],
    [t("pricing"), tagsT(library.pricing)],
    [t("access"), tagsT(library.access)],
    [t("added"), library.addedAt],
  ] as const;

  return (
    <main>
      <div className="mx-auto w-full max-w-270 px-5 sm:px-8">
        <SiteHeader />
        <article className="mx-auto max-w-3xl py-16 sm:py-24">
          <Link
            className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("backToDirectory")}
          </Link>
          <div className="mt-12 flex items-start gap-5">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card font-semibold shadow-sm">
              {logoSrc ? (
                <Image
                  alt=""
                  className="size-9 object-contain"
                  height={36}
                  src={logoSrc}
                  unoptimized
                  width={36}
                />
              ) : (
                library.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-heading text-5xl tracking-[-0.035em] sm:text-6xl">
                {library.name}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-8">
                {library.description}
              </p>
            </div>
          </div>
          <dl className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {stats.map(([label, value]) => (
              <div className="bg-background p-5" key={label}>
                <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                  {label}
                </dt>
                <dd className="mt-2 text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <section>
              <h2 className="font-medium text-sm">{t("whatItShips")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {library.delivery.map((item) => (
                  <span className="tag" key={item}>
                    {tagsT(item)}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-medium text-sm">{t("bestSuitedFor")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {library.useCases.map((item) => (
                  <span className="tag" key={item}>
                    {tagsT(item)}
                  </span>
                ))}
              </div>
            </section>
          </div>
          {metric ? (
            <section className="mt-10 rounded-xl border p-5">
              <h2 className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                {t("snapshot")}
              </h2>
              <div className="mt-3 flex flex-wrap gap-5 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Star aria-hidden="true" className="size-4" />
                  {metricsT("stars", {
                    count: formatCompactNumber(metric.stars, locale),
                  })}
                </span>
                {metric.latestCommitAt ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <CalendarClock aria-hidden="true" className="size-4" />
                    {metricsT("lastCommit", {
                      date: formatCommitDate(
                        metric.latestCommitAt,
                        locale,
                        metricsT("possiblyOutdated")
                      ),
                    })}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="mt-12 flex flex-wrap gap-3 border-t pt-8">
            <FavoriteButton
              initialFavorited={favorited}
              name={library.name}
              signedIn={Boolean(userId)}
              slug={library.slug}
              variant="labeled"
            />
            <a
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-4 font-medium text-background text-sm"
              href={withRefParam(library.website, host)}
              rel="noreferrer"
              target="_blank"
            >
              {t("visitSite")}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
            {library.github ? (
              <a
                className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 font-medium text-sm"
                href={library.github}
                rel="noreferrer"
                target="_blank"
              >
                <Code2 aria-hidden="true" className="size-4" />
                {t("viewRepository")}
              </a>
            ) : null}
          </div>
          {related.length ? (
            <section className="mt-14 border-t pt-8">
              <h2 className="font-medium text-sm">{t("related")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((item) => {
                  const relatedLogoSrc = item.logo
                    ? logoPublicUrl(item.logo)
                    : undefined;
                  const relatedMetric = catalog.metrics.repositories[item.slug];
                  return (
                    <Link
                      className="group flex gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/35"
                      href={`/libraries/${item.slug}`}
                      key={item.slug}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card font-semibold text-xs shadow-sm">
                        {relatedLogoSrc ? (
                          <Image
                            alt=""
                            className="size-5 object-contain"
                            height={20}
                            src={relatedLogoSrc}
                            unoptimized
                            width={20}
                          />
                        ) : (
                          item.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm underline-offset-4 group-hover:underline">
                            {item.name}
                          </span>
                          {relatedMetric ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <Star aria-hidden="true" className="size-3" />
                              {formatCompactNumber(relatedMetric.stars, locale)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-5">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
