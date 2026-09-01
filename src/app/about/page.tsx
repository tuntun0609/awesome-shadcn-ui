import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { repositoryUrl, SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  description:
    "How Awesome shadcn/ui selects, classifies, and maintains its directory.",
  title: "About",
};

export default function AboutPage() {
  return (
    <main>
      <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
        <SiteHeader />
        <article className="mx-auto max-w-2xl py-20 sm:py-28">
          <p className="font-mono text-[11px] text-blue-600 uppercase tracking-[0.2em] dark:text-blue-400">
            About the directory
          </p>
          <h1 className="mt-5 font-heading text-5xl tracking-[-0.035em] sm:text-6xl">
            A quieter way to explore the shadcn ecosystem.
          </h1>
          <div className="prose-copy mt-12 space-y-10">
            <section>
              <h2>What belongs here</h2>
              <p>
                Awesome shadcn/ui lists UI libraries that publicly describe a
                way to install their work with the shadcn CLI or a compatible
                registry. The directory is organized at the library level, not
                the individual component level.
              </p>
            </section>
            <section>
              <h2>How information is classified</h2>
              <p>
                Source access, pricing, delivery type, access requirements, and
                use cases are summarized from public product information. A
                project can be free to browse while still selling premium
                libraries, so source and pricing are intentionally separate.
              </p>
            </section>
            <section>
              <h2>A necessary disclaimer</h2>
              <p>
                Inclusion is based on each project’s own public claims. We do
                not run installation commands, validate registry contents, or
                guarantee compatibility. Pricing and licensing can change; use
                the official site as the source of truth before adopting a
                library.
              </p>
            </section>
            <section>
              <h2>GitHub activity</h2>
              <p>
                Stars and the latest default-branch commit date are stored as a
                manual snapshot. Libraries without a public repository simply
                omit those values. Older snapshots are labeled as potentially
                outdated instead of being presented as live data.
              </p>
            </section>
            <section>
              <h2>Corrections, not submissions</h2>
              <p>
                The catalog is maintained directly for now and does not accept
                submissions for new libraries. If an existing entry is wrong,
                please open a correction issue with the relevant public source.
              </p>
              <a
                className="mt-4 inline-flex items-center gap-2 text-blue-600 text-sm underline underline-offset-4 dark:text-blue-400"
                href={`${repositoryUrl}/issues/new?template=correction.yml`}
                rel="noreferrer"
                target="_blank"
              >
                Report a correction
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </section>
          </div>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
