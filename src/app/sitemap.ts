import type { MetadataRoute } from "next";
import { getCatalog } from "@/db/catalog-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const updatedAt = new Date("2026-09-01");
  const { libraries } = await getCatalog();

  const pages: ReadonlyArray<{
    changeFrequency: "weekly" | "monthly";
    lastModified: Date;
    path: string;
  }> = [
    { changeFrequency: "weekly", lastModified: updatedAt, path: "" },
    { changeFrequency: "monthly", lastModified: updatedAt, path: "/about" },
    ...libraries.map((library) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(library.addedAt),
      path: `/libraries/${library.slug}`,
    })),
  ];

  return pages.flatMap((page) => {
    const en = `${siteUrl}${page.path}`;
    const zh = `${siteUrl}/zh${page.path}`;
    const alternates = { languages: { en, "x-default": en, zh } };

    return [
      { ...page, alternates, url: en },
      { ...page, alternates, url: zh },
    ];
  });
}
