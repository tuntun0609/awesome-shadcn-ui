import type { MetadataRoute } from "next";
import { getCatalog } from "@/db/catalog-data";
import { siteOrigin } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { libraries } = await getCatalog();

  const paths = [
    "",
    "/about",
    ...libraries.map((library) => `/libraries/${library.slug}`),
  ];

  return paths.flatMap((path) => {
    const en = new URL(path, siteOrigin).toString();
    const zh = new URL(`/zh${path}`, siteOrigin).toString();
    const alternates = { languages: { en, "x-default": en, zh } };

    return [
      { alternates, url: en },
      { alternates, url: zh },
    ];
  });
}
