import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LibraryDirectory } from "@/components/library-directory";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/db/catalog-data";
import { getFavoriteSlugs } from "@/db/favorites-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/favorites">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "favorites" });

  return {
    alternates: {
      languages: {
        en: "/favorites",
        "x-default": "/favorites",
        zh: "/zh/favorites",
      },
    },
    description: t("metadataDescription"),
    title: t("metadataTitle"),
  };
}

export default async function FavoritesPage() {
  const { redirectToSignIn, userId } = await auth();
  if (!userId) {
    return redirectToSignIn();
  }

  const [t, { libraries, metrics }, favoriteSlugs] = await Promise.all([
    getTranslations("favorites"),
    getCatalog(),
    getFavoriteSlugs(userId),
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
        <LibraryDirectory
          favoritesOnly
          initialFavorites={favoriteSlugs}
          libraries={libraries}
          metrics={metrics}
          signedIn
        />
        <SiteFooter />
      </div>
    </main>
  );
}
