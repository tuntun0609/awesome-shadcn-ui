import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site-footer";
import { repositoryUrl, SiteHeader } from "@/components/site-header";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });

  return {
    alternates: {
      languages: {
        en: "/about",
        "x-default": "/about",
        zh: "/zh/about",
      },
    },
    description: t("metadataDescription"),
    title: t("metadataTitle"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  const sections = [
    "scope",
    "classification",
    "disclaimer",
    "github",
    "corrections",
  ] as const;

  return (
    <main>
      <div className="mx-auto w-full max-w-[1080px] px-5 sm:px-8">
        <SiteHeader />
        <article className="mx-auto max-w-2xl py-20 sm:py-28">
          <p className="font-mono text-[11px] text-primary uppercase tracking-[0.2em]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 font-heading text-5xl tracking-[-0.035em] sm:text-6xl">
            {t("title")}
          </h1>
          <div className="prose-copy mt-12 space-y-10">
            {sections.map((section) => (
              <section key={section}>
                <h2>{t(`sections.${section}.heading`)}</h2>
                <p>{t(`sections.${section}.body`)}</p>
              </section>
            ))}
            <section>
              <a
                className="mt-4 inline-flex items-center gap-2 text-primary text-sm underline underline-offset-4"
                href={`${repositoryUrl}/issues/new?template=correction.yml`}
                rel="noreferrer"
                target="_blank"
              >
                {t("reportCorrection")}
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
