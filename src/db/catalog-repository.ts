import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { getDatabase } from "@/db/client";
import {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "@/db/schema";
import type {
  AccessModel,
  CatalogSnapshot,
  DeliveryType,
  GithubSnapshot,
  Library,
  PricingModel,
  SourceModel,
  UseCase,
} from "@/lib/catalog-model";

interface PositionedValue {
  libraryId: number;
  position: number;
  value: string;
}

function collectValues<T extends string>(rows: PositionedValue[]) {
  const valuesByLibrary = new Map<number, T[]>();

  for (const row of rows) {
    const values = valuesByLibrary.get(row.libraryId) ?? [];
    values.push(row.value as T);
    valuesByLibrary.set(row.libraryId, values);
  }

  return valuesByLibrary;
}

export async function readCatalog(
  providedDatabase?: Database
): Promise<CatalogSnapshot> {
  const db = providedDatabase ?? (await getDatabase());
  const [libraryRows, deliveryRows, useCaseRows, tagRows, metricRows] =
    await Promise.all([
      db.select().from(libraries).orderBy(asc(libraries.id)),
      db
        .select()
        .from(libraryDeliveries)
        .orderBy(
          asc(libraryDeliveries.libraryId),
          asc(libraryDeliveries.position)
        ),
      db
        .select()
        .from(libraryUseCases)
        .orderBy(asc(libraryUseCases.libraryId), asc(libraryUseCases.position)),
      db
        .select()
        .from(libraryTags)
        .orderBy(asc(libraryTags.libraryId), asc(libraryTags.position)),
      db
        .select({
          latestCommitAt: githubMetrics.latestCommitAt,
          libraryId: githubMetrics.libraryId,
          slug: libraries.slug,
          stars: githubMetrics.stars,
          syncedAt: githubMetrics.syncedAt,
        })
        .from(githubMetrics)
        .innerJoin(libraries, eq(githubMetrics.libraryId, libraries.id)),
    ]);

  const deliveryByLibrary = collectValues<DeliveryType>(deliveryRows);
  const useCasesByLibrary = collectValues<UseCase>(useCaseRows);
  const tagsByLibrary = collectValues<string>(tagRows);

  const catalogLibraries: Library[] = libraryRows.map((row) => ({
    access: row.access as AccessModel,
    addedAt: row.addedAt,
    delivery: deliveryByLibrary.get(row.id) ?? [],
    description: row.description,
    featuredRank: row.featuredRank ?? undefined,
    github: row.github ?? undefined,
    logo: row.logo ?? undefined,
    name: row.name,
    pricing: row.pricing as PricingModel,
    slug: row.slug,
    source: row.source as SourceModel,
    tags: tagsByLibrary.get(row.id) ?? [],
    useCases: useCasesByLibrary.get(row.id) ?? [],
    website: row.website,
  }));

  const metrics: GithubSnapshot = {
    repositories: {},
    syncedAt: null,
  };

  for (const row of metricRows) {
    metrics.repositories[row.slug] = {
      latestCommitAt: row.latestCommitAt,
      stars: row.stars,
      syncedAt: row.syncedAt,
    };
    if (!metrics.syncedAt || row.syncedAt > metrics.syncedAt) {
      metrics.syncedAt = row.syncedAt;
    }
  }

  return { libraries: catalogLibraries, metrics };
}

export async function writeGithubSnapshot(
  snapshot: GithubSnapshot,
  providedDatabase?: Database
) {
  const db = providedDatabase ?? (await getDatabase());

  await db.transaction(async (transaction) => {
    const libraryRows = await transaction
      .select({ id: libraries.id, slug: libraries.slug })
      .from(libraries);
    const idsBySlug = new Map(
      libraryRows.map((library) => [library.slug, library.id])
    );
    const values = Object.entries(snapshot.repositories).map(
      ([slug, metric]) => {
        const libraryId = idsBySlug.get(slug);
        if (!libraryId) {
          throw new Error(
            `Cannot store GitHub metrics for unknown slug: ${slug}`
          );
        }
        return { libraryId, ...metric };
      }
    );

    await transaction.delete(githubMetrics);
    if (values.length > 0) {
      await transaction.insert(githubMetrics).values(values);
    }
  });
}
