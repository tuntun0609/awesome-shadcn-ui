import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Code2,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import metricsData from "@/data/github-metrics.json";
import { libraries } from "@/data/libraries";
import {
  formatCommitDate,
  formatCompactNumber,
  type GithubSnapshot,
} from "@/lib/catalog";

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

export function generateStaticParams() {
  return libraries.map((library) => ({ slug: library.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/libraries/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const library = libraries.find((item) => item.slug === slug);
  if (!library) {
    return {};
  }
  return {
    description: library.description,
    openGraph: { images: [] },
    title: library.name,
    twitter: { images: [] },
  };
}

export default async function LibraryPage({
  params,
}: PageProps<"/libraries/[slug]">) {
  const { slug } = await params;
  const library = libraries.find((item) => item.slug === slug);
  if (!library) {
    notFound();
  }
  const metrics = metricsData as GithubSnapshot;
  const metric = metrics.repositories[library.slug];

  return (
    <main>
      <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
        <SiteHeader />
        <article className="mx-auto max-w-3xl py-16 sm:py-24">
          <Link
            className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to directory
          </Link>
          <div className="mt-12 flex items-start gap-5">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card font-semibold shadow-sm">
              {library.logo ? (
                <Image
                  alt=""
                  className="size-9 object-contain"
                  height={36}
                  src={library.logo}
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
            {[
              ["Source", labels[library.source]],
              ["Pricing", labels[library.pricing]],
              ["Access", labels[library.access]],
              ["Added", library.addedAt],
            ].map(([label, value]) => (
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
              <h2 className="font-medium text-sm">What it ships</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {library.delivery.map((item) => (
                  <span className="tag" key={item}>
                    {labels[item]}
                  </span>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-medium text-sm">Best suited for</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {library.useCases.map((item) => (
                  <span className="tag" key={item}>
                    {labels[item]}
                  </span>
                ))}
              </div>
            </section>
          </div>
          {metric ? (
            <section className="mt-10 rounded-xl border p-5">
              <h2 className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.16em]">
                Manual GitHub snapshot
              </h2>
              <div className="mt-3 flex flex-wrap gap-5 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Star aria-hidden="true" className="size-4" />
                  {formatCompactNumber(metric.stars)} stars
                </span>
                {metric.latestCommitAt ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <CalendarClock aria-hidden="true" className="size-4" />
                    Last commit {formatCommitDate(metric.latestCommitAt)}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="mt-12 flex flex-wrap gap-3 border-t pt-8">
            <a
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-4 font-medium text-background text-sm"
              href={library.website}
              rel="noreferrer"
              target="_blank"
            >
              Visit official site
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
                View repository
              </a>
            ) : null}
          </div>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}
