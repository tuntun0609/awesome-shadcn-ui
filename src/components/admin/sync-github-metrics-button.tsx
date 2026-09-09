/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { syncAllGithubMetricsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SyncGithubMetricsButton({ total }: { total: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function syncAll() {
    setSyncing(true);
    try {
      const result = await syncAllGithubMetricsAction();
      if (result.message) {
        toast.error(result.message);
        return;
      }
      const succeeded = result.succeeded ?? 0;
      const totalCount = result.total ?? 0;
      if (result.failures && result.failures.length > 0) {
        toast.warning(
          `已更新 ${succeeded}/${totalCount} 个仓库的 GitHub 指标`,
          {
            description: `以下仓库采集失败，已保留原数据：${result.failures.join("；")}`,
          }
        );
      } else {
        toast.success(`已更新 ${succeeded}/${totalCount} 个仓库的 GitHub 指标`);
      }
      router.refresh();
    } catch {
      toast.error("GitHub 指标采集失败");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      disabled={syncing || total === 0}
      onClick={syncAll}
      size="sm"
      title={total === 0 ? "暂无已关联 GitHub 的组件库" : undefined}
      type="button"
      variant="outline"
    >
      {syncing ? (
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
      ) : (
        <SparklesIcon data-icon="inline-start" />
      )}
      {syncing ? "采集中…" : "采集 GitHub 指标"}
    </Button>
  );
}
