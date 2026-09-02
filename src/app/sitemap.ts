import type { MetadataRoute } from "next";
import { getCatalog } from "@/db/catalog-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const updatedAt = new Date("2026-09-01");
  const { libraries } = await getCatalog();

  return [
    { changeFrequency: "weekly", lastModified: updatedAt, url: siteUrl },
    {
      changeFrequency: "monthly",
      lastModified: updatedAt,
      url: `${siteUrl}/about`,
    },
    ...libraries.map((library) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(library.addedAt),
      url: `${siteUrl}/libraries/${library.slug}`,
    })),
  ];
}
