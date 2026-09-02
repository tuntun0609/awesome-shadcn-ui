import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { readCatalog } from "@/db/catalog-repository";

const CATALOG_CACHE_SECONDS = 300;

const readCachedCatalog = unstable_cache(readCatalog, ["catalog"], {
  revalidate: CATALOG_CACHE_SECONDS,
  tags: ["catalog"],
});

export const getCatalog = cache(readCachedCatalog);

export const getCatalogEntry = cache(async (slug: string) => {
  const catalog = await getCatalog();
  const library = catalog.libraries.find((item) => item.slug === slug);

  if (!library) {
    return null;
  }

  return {
    library,
    metric: catalog.metrics.repositories[slug],
  };
});
