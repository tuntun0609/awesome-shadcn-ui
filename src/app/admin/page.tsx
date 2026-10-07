import { asc, eq } from "drizzle-orm";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LibraryTable } from "@/components/admin/library-table";
import { SyncLibraryLogosButton } from "@/components/admin/sync-library-logos-button";
import { SyncRepositoryMetricsButton } from "@/components/admin/sync-repository-metrics-button";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/db/client";
import { libraries, repositoryMetrics } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "组件库",
};

export interface LibraryListRow {
  access: string;
  addedAt: string;
  description: string;
  featuredRank: number | null;
  id: number;
  logo: string | null;
  name: string;
  pricing: string;
  repositoryUrl: string | null;
  slug: string;
  source: string;
  stars: number | null;
  updatedAt: string;
  website: string;
}

export default async function AdminLibrariesPage() {
  const db = await getDatabase();
  const rows = await db
    .select({
      access: libraries.access,
      addedAt: libraries.addedAt,
      description: libraries.description,
      featuredRank: libraries.featuredRank,
      id: libraries.id,
      logo: libraries.logo,
      name: libraries.name,
      pricing: libraries.pricing,
      repositoryUrl: libraries.repositoryUrl,
      slug: libraries.slug,
      source: libraries.source,
      stars: repositoryMetrics.stars,
      updatedAt: libraries.updatedAt,
      website: libraries.website,
    })
    .from(libraries)
    .leftJoin(repositoryMetrics, eq(repositoryMetrics.libraryId, libraries.id))
    .orderBy(asc(libraries.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-semibold text-2xl tracking-tight">
            组件库
          </h1>
          <p className="text-muted-foreground text-sm">
            共 {rows.length} 条记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncLibraryLogosButton
            total={rows.filter((row) => !row.logo).length}
          />
          <SyncRepositoryMetricsButton
            total={rows.filter((row) => row.repositoryUrl).length}
          />
          <Button
            nativeButton={false}
            render={<Link href="/admin/libraries/new" />}
          >
            <PlusIcon />
            新建组件库
          </Button>
        </div>
      </div>
      <LibraryTable data={rows} />
    </div>
  );
}
