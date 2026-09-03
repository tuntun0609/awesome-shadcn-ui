/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { Loader2Icon, SparklesIcon, StarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  fetchGithubMetricsAction,
  saveGithubMetricsAction,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAdminDate } from "@/lib/admin-date";
import type { GithubMetric } from "@/lib/catalog-model";

interface GithubMetricsCardProps {
  /** 已保存的 GitHub 仓库地址，空串表示未关联仓库。 */
  github: string;
  libraryId: number;
  /** 当前库的 GitHub 指标快照，null 表示尚未同步。 */
  metric: GithubMetric | null;
}

export function GithubMetricsCard({
  github,
  libraryId,
  metric,
}: GithubMetricsCardProps) {
  const router = useRouter();
  const [collecting, setCollecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<GithubMetric | null>(null);

  async function collectMetrics() {
    setCollecting(true);
    try {
      const result = await fetchGithubMetricsAction(github);
      if (
        result.message ||
        result.stars === undefined ||
        result.syncedAt === undefined
      ) {
        toast.error(result.message ?? "GitHub 指标采集失败");
        return;
      }
      setPending({
        latestCommitAt: result.latestCommitAt ?? null,
        stars: result.stars,
        syncedAt: result.syncedAt,
      });
    } catch {
      toast.error("GitHub 指标采集失败");
    } finally {
      setCollecting(false);
    }
  }

  async function applyPending() {
    if (!pending) {
      return;
    }
    setSaving(true);
    try {
      const result = await saveGithubMetricsAction(libraryId, pending);
      if (result.message) {
        toast.error(result.message);
        return;
      }
      toast.success("已更新 GitHub 指标");
      setPending(null);
      router.refresh();
    } catch {
      toast.error("GitHub 指标保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 text-sm">
        <div className="flex flex-col gap-x-8 gap-y-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="flex items-center gap-1.5 font-medium">
            <StarIcon className="size-4 text-amber-500" />
            GitHub 指标
          </span>
          {metric ? (
            <>
              <span className="flex items-center gap-1.5 tabular-nums">
                Stars：
                <span className="font-medium">{metric.stars}</span>
              </span>
              <span className="text-muted-foreground">
                最近提交：
                <span className="font-medium text-foreground tabular-nums">
                  {metric.latestCommitAt
                    ? formatAdminDate(metric.latestCommitAt)
                    : "未知"}
                </span>
              </span>
              <span className="text-muted-foreground">
                同步时间：
                <span className="font-medium text-foreground tabular-nums">
                  {formatAdminDate(metric.syncedAt)}
                </span>
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              暂无数据，可点击自动采集。
            </span>
          )}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              disabled={collecting || github === ""}
              onClick={collectMetrics}
              size="sm"
              title={github === "" ? "请先填写并保存 GitHub 地址" : undefined}
              type="button"
              variant="outline"
            >
              {collecting ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              {collecting ? "采集中…" : "自动采集"}
            </Button>
          </div>
        </div>
        {pending ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="text-muted-foreground text-xs">
                采集自 GitHub API：Stars {pending.stars}
                {pending.latestCommitAt
                  ? `，最近提交 ${formatAdminDate(pending.latestCommitAt)}`
                  : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={saving}
                  onClick={applyPending}
                  size="xs"
                  type="button"
                >
                  {saving ? "保存中…" : "使用采集结果"}
                </Button>
                <Button
                  disabled={saving}
                  onClick={() => setPending(null)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  取消
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
