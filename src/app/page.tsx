import { Suspense } from "react";
import { LibraryDirectory } from "@/components/library-directory";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/db/catalog-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { libraries, metrics } = await getCatalog();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
        <SiteHeader />
        <section className="grid gap-10 py-20 sm:py-28 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
          <div>
            <p className="font-mono text-[11px] text-blue-600 uppercase tracking-[0.2em] dark:text-blue-400">
              A curated shadcn ecosystem index
            </p>
            <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl">
              Find the UI library that fits your next build.
            </h1>
          </div>
          <p className="max-w-sm text-muted-foreground text-sm leading-6 md:pb-1">
            Compare component registries, pricing models, source access, and
            project activity—all in one quiet directory.
          </p>
        </section>
        <Suspense fallback={<div className="min-h-[460px] border-t" />}>
          <LibraryDirectory libraries={libraries} metrics={metrics} />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}
