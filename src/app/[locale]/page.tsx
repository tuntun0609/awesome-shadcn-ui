import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LibraryDirectory } from "@/components/library-directory";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/db/catalog-data";
import { getFavoriteSlugs } from "@/db/favorites-repository";
import { getLikeCounts, getLikedSlugs } from "@/db/likes-repository";
import { readVisitorId } from "@/lib/visitor-id";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      languages: { en: "/", "x-default": "/", zh: "/zh" },
    },
  };
}

export default async function Home() {
  const [{ userId }, t, { libraries, metrics }] = await Promise.all([
    auth(),
    getTranslations("home"),
    getCatalog(),
  ]);
  const favoriteSlugs = userId ? await getFavoriteSlugs(userId) : [];
  const visitorId = await readVisitorId();
  const [likeCounts, likedSlugs] = await Promise.all([
    getLikeCounts(),
    visitorId ? getLikedSlugs(visitorId) : Promise.resolve<string[]>([]),
  ]);

  return (
    <main>
      <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
        <SiteHeader />
        <section className="grid gap-10 py-20 sm:py-28 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
          <div>
            <p className="font-mono text-[11px] text-primary uppercase tracking-[0.2em]">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl">
              {t("title")}
            </h1>
          </div>
          <p className="max-w-sm text-muted-foreground text-sm leading-6 md:pb-1">
            {t("subtitle")}
          </p>
        </section>
        <Suspense fallback={<div className="min-h-[460px] border-t" />}>
          <LibraryDirectory
            initialFavorites={favoriteSlugs}
            initialLiked={likedSlugs}
            libraries={libraries}
            likeCounts={likeCounts}
            metrics={metrics}
            signedIn={Boolean(userId)}
          />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}
