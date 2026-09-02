import { fileURLToPath } from "node:url";
import { inArray, sql } from "drizzle-orm";
import { type Database, getDatabase } from "../src/db/client";
import {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "../src/db/schema";
import { seedGithubSnapshot, seedLibraries } from "./fixtures/catalog";

export async function seedCatalog(database: Database) {
  await database.transaction(async (transaction) => {
    const slugs = seedLibraries.map((library) => library.slug);

    await transaction
      .update(libraries)
      .set({ featuredRank: null })
      .where(inArray(libraries.slug, slugs));

    const libraryRows = await transaction
      .insert(libraries)
      .values(
        seedLibraries.map((library) => ({
          access: library.access,
          addedAt: library.addedAt,
          description: library.description,
          featuredRank: library.featuredRank ?? null,
          github: library.github ?? null,
          logo: library.logo ?? null,
          name: library.name,
          pricing: library.pricing,
          slug: library.slug,
          source: library.source,
          website: library.website,
        }))
      )
      .onConflictDoUpdate({
        set: {
          access: sql`excluded.access`,
          addedAt: sql`excluded.added_at`,
          description: sql`excluded.description`,
          featuredRank: sql`excluded.featured_rank`,
          github: sql`excluded.github`,
          logo: sql`excluded.logo`,
          name: sql`excluded.name`,
          pricing: sql`excluded.pricing`,
          source: sql`excluded.source`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
          website: sql`excluded.website`,
        },
        target: libraries.slug,
      })
      .returning({ id: libraries.id, slug: libraries.slug });

    if (libraryRows.length !== seedLibraries.length) {
      throw new Error("Not every seed library was persisted");
    }
    const idsBySlug = new Map(
      libraryRows.map((library) => [library.slug, library.id])
    );
    const getLibraryId = (slug: string) => {
      const libraryId = idsBySlug.get(slug);
      if (!libraryId) {
        throw new Error(`Missing seeded library id for slug: ${slug}`);
      }
      return libraryId;
    };

    const libraryIds = [...idsBySlug.values()];
    await transaction
      .delete(libraryDeliveries)
      .where(inArray(libraryDeliveries.libraryId, libraryIds));
    await transaction
      .delete(libraryUseCases)
      .where(inArray(libraryUseCases.libraryId, libraryIds));
    await transaction
      .delete(libraryTags)
      .where(inArray(libraryTags.libraryId, libraryIds));

    await transaction.insert(libraryDeliveries).values(
      seedLibraries.flatMap((library) =>
        library.delivery.map((value, position) => ({
          libraryId: getLibraryId(library.slug),
          position,
          value,
        }))
      )
    );
    await transaction.insert(libraryUseCases).values(
      seedLibraries.flatMap((library) =>
        library.useCases.map((value, position) => ({
          libraryId: getLibraryId(library.slug),
          position,
          value,
        }))
      )
    );
    await transaction.insert(libraryTags).values(
      seedLibraries.flatMap((library) =>
        library.tags.map((value, position) => ({
          libraryId: getLibraryId(library.slug),
          position,
          value,
        }))
      )
    );

    await transaction
      .delete(githubMetrics)
      .where(inArray(githubMetrics.libraryId, libraryIds));
    await transaction
      .insert(githubMetrics)
      .values(
        Object.entries(seedGithubSnapshot.repositories).map(
          ([slug, metric]) => ({ libraryId: getLibraryId(slug), ...metric })
        )
      );
  });
}

async function run() {
  const database = await getDatabase();
  await seedCatalog(database);
  console.log(`Seeded ${seedLibraries.length} libraries.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run();
}
