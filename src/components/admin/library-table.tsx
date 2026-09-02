/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ExternalLinkIcon,
  PencilIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { LibraryListRow } from "@/app/admin/page";
import { DeleteLibraryButton } from "@/components/admin/delete-library-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDate } from "@/lib/admin-date";
import {
  LIBRARY_ACCESS_OPTIONS,
  LIBRARY_PRICING_OPTIONS,
} from "@/lib/library-form-schema";

function labelFor(
  options: ReadonlyArray<{ label: string; value: string }>,
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ArrowUpIcon className="size-3" />;
  }
  if (sorted === "desc") {
    return <ArrowDownIcon className="size-3" />;
  }
  return <ArrowUpDownIcon className="size-3 opacity-50" />;
}

function SortableHeader({
  column,
  children,
}: {
  children: React.ReactNode;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === "asc")}
      type="button"
    >
      {children}
      <SortIcon sorted={sorted} />
    </button>
  );
}

export function LibraryTable({ data }: { data: LibraryListRow[] }) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<LibraryListRow>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="font-mono text-muted-foreground text-xs">
            {row.original.slug}
          </span>
        </div>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>名称</SortableHeader>
      ),
    },
    {
      accessorKey: "pricing",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {labelFor(LIBRARY_PRICING_OPTIONS, row.original.pricing)}
        </Badge>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>收费模式</SortableHeader>
      ),
    },
    {
      accessorKey: "access",
      cell: ({ row }) => (
        <Badge variant="outline">
          {labelFor(LIBRARY_ACCESS_OPTIONS, row.original.access)}
        </Badge>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>访问方式</SortableHeader>
      ),
    },
    {
      accessorKey: "stars",
      cell: ({ row }) => (
        <span className="flex items-center gap-1 tabular-nums">
          <StarIcon className="size-3.5 text-amber-500" />
          {row.original.stars ?? "—"}
        </span>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>Stars</SortableHeader>
      ),
    },
    {
      accessorKey: "featuredRank",
      cell: ({ row }) => row.original.featuredRank ?? "—",
      header: ({ column }) => (
        <SortableHeader column={column}>精选位次</SortableHeader>
      ),
    },
    {
      accessorKey: "addedAt",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatAdminDate(row.original.addedAt)}
        </span>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>收录日期</SortableHeader>
      ),
    },
    {
      accessorKey: "updatedAt",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatAdminDate(row.original.updatedAt)}
        </span>
      ),
      header: ({ column }) => (
        <SortableHeader column={column}>更新时间</SortableHeader>
      ),
    },
    {
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {row.original.website ? (
            <Button
              aria-label={`访问 ${row.original.name} 官网`}
              nativeButton={false}
              render={
                <a
                  href={row.original.website}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              size="icon-sm"
            >
              <ExternalLinkIcon />
            </Button>
          ) : null}
          <Button
            aria-label={`编辑 ${row.original.name}`}
            nativeButton={false}
            render={<Link href={`/admin/libraries/${row.original.id}`} />}
            size="icon-sm"
            variant="ghost"
          >
            <PencilIcon />
          </Button>
          <DeleteLibraryButton id={row.original.id} name={row.original.name} />
        </div>
      ),
      header: () => <span className="sr-only">操作</span>,
      id: "actions",
    },
  ];

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).toLowerCase();
      return (
        row.original.name.toLowerCase().includes(query) ||
        row.original.slug.toLowerCase().includes(query)
      );
    },
    onSortingChange: setSorting,
    state: {
      globalFilter: search,
      sorting,
    },
  });

  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            placeholder="搜索名称或 slug…"
            value={search}
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="bg-muted/40" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  没有匹配的记录
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-sm">
            第 {table.getState().pagination.pageIndex + 1} / {pageCount} 页
          </span>
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            上一页
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  );
}
