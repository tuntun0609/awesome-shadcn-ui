/** biome-ignore-all lint/performance/noJsxPropsBind: 内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { ThumbsUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleLikeAction } from "@/app/actions/likes";
import { formatCompactNumber } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  initialCount: number;
  initialLiked: boolean;
  /** 组件库展示名称，用于无障碍标签。 */
  name: string;
  /** 点赞状态变化后通知父组件（用于列表同步）。 */
  onChange?: (liked: boolean, count: number) => void;
  slug: string;
  variant?: "icon" | "labeled";
}

export function LikeButton({
  initialCount,
  initialLiked,
  name,
  onChange,
  slug,
  variant = "icon",
}: LikeButtonProps) {
  const t = useTranslations("likes");
  const locale = useLocale();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const applyChange = (nextLiked: boolean, nextCount: number) => {
    setLiked(nextLiked);
    setLikeCount(nextCount);
    onChange?.(nextLiked, nextCount);
  };

  const handleClick = () => {
    const next = !liked;
    applyChange(next, likeCount + (next ? 1 : -1));

    startTransition(async () => {
      const result = await toggleLikeAction({ liked: next, slug });
      if (result.status === "ok") {
        if (
          result.liked !== next ||
          result.count !== likeCount + (next ? 1 : -1)
        ) {
          applyChange(result.liked, result.count);
        }
        return;
      }

      applyChange(!next, likeCount);
      toast.error(t("error"));
    });
  };

  const label = liked ? t("unlikeAction", { name }) : t("likeAction", { name });
  const icon = (
    <ThumbsUp
      aria-hidden="true"
      className={cn("size-4", liked && "fill-current text-primary")}
    />
  );
  const countLabel = formatCompactNumber(likeCount, locale);

  if (variant === "labeled") {
    return (
      <button
        aria-pressed={liked}
        className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 font-medium text-sm transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {icon}
        {liked ? t("unlike") : t("like")}
        <span className="font-mono text-muted-foreground text-xs">
          {countLabel}
        </span>
      </button>
    );
  }

  return (
    <button
      aria-label={`${label} (${countLabel})`}
      aria-pressed={liked}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-muted-foreground text-xs transition-[color,border-color] hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      {icon}
      {countLabel}
    </button>
  );
}
