import { asc, eq } from "drizzle-orm";
import { ArrowLeftIcon, ExternalLinkIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteLibraryButton } from "@/components/admin/delete-library-button";
import { LibraryForm } from "@/components/admin/library-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDatabase } from "@/db/client";
import {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "@/db/schema";
import { formatAdminDate } from "@/lib/admin-date";
import type { LibraryFormInput } from "@/lib/library-form-schema";

export const dynamic = "force-dynamic";

interface EditLibraryPageProps {
  params: Promise<{ id: string }>;
}

async function loadLibrary(id: number) {
  const db = await getDatabase();
  const [libraryRows, deliveryRows, useCaseRows, tagRows, metricRows] =
    await Promise.all([
      db.select().from(libraries).where(eq(libraries.id, id)).limit(1),
      db
        .select()
        .from(libraryDeliveries)
        .where(eq(libraryDeliveries.libraryId, id))
        .orderBy(asc(libraryDeliveries.position)),
      db
        .select()
        .from(libraryUseCases)
        .where(eq(libraryUseCases.libraryId, id))
        .orderBy(asc(libraryUseCases.position)),
      db
        .select()
        .from(libraryTags)
        .where(eq(libraryTags.libraryId, id))
        .orderBy(asc(libraryTags.position)),
      db
        .select()
        .from(githubMetrics)
        .where(eq(githubMetrics.libraryId, id))
        .limit(1),
    ]);

  return {
    deliveries: deliveryRows.map(
      (row) => row.value as LibraryFormInput["deliveries"][number]
    ),
    library: libraryRows[0],
    metrics: metricRows[0],
    tags: tagRows.map((row) => row.value),
    useCases: useCaseRows.map(
      (row) => row.value as LibraryFormInput["useCases"][number]
    ),
  };
}

export async function generateMetadata({
  params,
}: EditLibraryPageProps): Promise<Metadata> {
  const { id } = await params;
  const libraryId = Number.parseInt(id, 10);
  if (Number.isNaN(libraryId)) {
    return { title: "编辑组件库" };
  }
  const { library } = await loadLibrary(libraryId);
  return { title: library ? `编辑：${library.name}` : "编辑组件库" };
}

export default async function EditLibraryPage({
  params,
}: EditLibraryPageProps) {
  const { id } = await params;
  const libraryId = Number.parseInt(id, 10);
  if (Number.isNaN(libraryId)) {
    notFound();
  }

  const { library, deliveries, useCases, tags, metrics } =
    await loadLibrary(libraryId);
  if (!library) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          aria-label="返回列表"
          nativeButton={false}
          render={<Link href="/admin" />}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="font-heading font-semibold text-2xl tracking-tight">
          编辑：{library.name}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/libraries/${library.slug}`}
                rel="noreferrer"
                target="_blank"
              />
            }
            size="sm"
          >
            <ExternalLinkIcon />
            查看前台页面
          </Button>
          <DeleteLibraryButton
            id={library.id}
            name={library.name}
            redirectTo="/admin"
            variant="outline"
          />
        </div>
      </div>

      {metrics ? (
        <Card>
          <CardContent className="flex flex-col gap-x-8 gap-y-1.5 py-4 text-sm sm:flex-row sm:flex-wrap sm:items-center">
            <span className="flex items-center gap-1.5 font-medium">
              <StarIcon className="size-4 text-amber-500" />
              GitHub 指标
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              Stars：
              <span className="font-medium">{metrics.stars}</span>
            </span>
            <span className="text-muted-foreground">
              最近提交：
              <span className="font-medium text-foreground tabular-nums">
                {metrics.latestCommitAt
                  ? formatAdminDate(metrics.latestCommitAt)
                  : "未知"}
              </span>
            </span>
            <span className="text-muted-foreground">
              同步时间：
              <span className="font-medium text-foreground tabular-nums">
                {formatAdminDate(metrics.syncedAt)}
              </span>
            </span>
            <span className="text-muted-foreground sm:ml-auto">
              由 <code>sync:github</code> 自动同步，只读
            </span>
          </CardContent>
        </Card>
      ) : null}

      <LibraryForm
        defaultValues={{
          access: library.access as LibraryFormInput["access"],
          addedAt: library.addedAt,
          deliveries,
          description: library.description,
          featuredRank: String(library.featuredRank ?? ""),
          github: library.github ?? "",
          logo: library.logo ?? "",
          name: library.name,
          pricing: library.pricing as LibraryFormInput["pricing"],
          slug: library.slug,
          source: library.source as LibraryFormInput["source"],
          tags,
          useCases,
          website: library.website,
        }}
        libraryId={library.id}
        mode="edit"
      />
    </div>
  );
}
