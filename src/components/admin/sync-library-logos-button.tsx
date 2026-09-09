/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { ImageIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { syncAllLibraryLogosAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SyncLibraryLogosButton({ total }: { total: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function syncAll() {
    setSyncing(true);
    try {
      const result = await syncAllLibraryLogosAction();
      if (result.message) {
        toast.error(result.message);
        return;
      }
      const succeeded = result.succeeded ?? 0;
      const totalCount = result.total ?? 0;
      if (result.failures && result.failures.length > 0) {
        toast.warning(`已为 ${succeeded}/${totalCount} 个组件库采集 Logo`, {
          description: `以下组件库采集失败，已保持无 Logo 状态：${result.failures.join("；")}`,
        });
      } else {
        toast.success(`已为 ${succeeded}/${totalCount} 个组件库采集 Logo`);
      }
      router.refresh();
    } catch {
      toast.error("Logo 采集失败");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      disabled={syncing || total === 0}
      onClick={syncAll}
      size="sm"
      title={total === 0 ? "所有组件库都已有 Logo" : undefined}
      type="button"
      variant="outline"
    >
      {syncing ? (
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
      ) : (
        <ImageIcon data-icon="inline-start" />
      )}
      {syncing ? "采集中…" : "采集缺失 Logo"}
    </Button>
  );
}
