import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LibraryForm } from "@/components/admin/library-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "新建组件库",
};

export default function NewLibraryPage() {
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
          新建组件库
        </h1>
      </div>
      <LibraryForm
        defaultValues={{
          access: "direct",
          addedAt: new Date().toISOString().slice(0, 10),
          deliveries: [],
          description: "",
          featuredRank: "",
          github: "",
          logo: "",
          name: "",
          pricing: "free",
          slug: "",
          source: "open-source",
          tags: [],
          useCases: [],
          website: "",
        }}
        mode="create"
      />
    </div>
  );
}
