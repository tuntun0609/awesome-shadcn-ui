/** biome-ignore-all lint/performance/noJsxPropsBind: 内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { useClerk } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  initialFavorited: boolean;
  /** 组件库展示名称，用于无障碍标签。 */
  name: string;
  /** 收藏状态变化后通知父组件（用于列表同步）。 */
  onChange?: (favorited: boolean) => void;
  signedIn: boolean;
  slug: string;
  variant?: "icon" | "labeled";
}

export function FavoriteButton({
  initialFavorited,
  name,
  onChange,
  signedIn,
  slug,
  variant = "icon",
}: FavoriteButtonProps) {
  const t = useTranslations("favorites");
  const clerk = useClerk();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  const applyChange = (next: boolean) => {
    setFavorited(next);
    onChange?.(next);
  };

  const handleClick = () => {
    if (!signedIn) {
      clerk.openSignIn();
      return;
    }

    const next = !favorited;
    applyChange(next);

    startTransition(async () => {
      const result = await toggleFavoriteAction({ favorited: next, slug });
      if (result.status === "ok") {
        if (result.favorited !== next) {
          applyChange(result.favorited);
        }
        toast.success(result.favorited ? t("added") : t("removed"), {
          description: name,
        });
        return;
      }

      applyChange(!next);
      if (result.status === "unauthenticated") {
        clerk.openSignIn();
        return;
      }
      toast.error(t("error"));
    });
  };

  const heart = (
    <Heart
      aria-hidden="true"
      className={cn("size-4", favorited && "fill-current text-primary")}
    />
  );

  if (variant === "labeled") {
    return (
      <button
        aria-pressed={favorited}
        className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 font-medium text-sm transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
        disabled={isPending && signedIn}
        onClick={handleClick}
        type="button"
      >
        {heart}
        {favorited ? t("remove") : t("add")}
      </button>
    );
  }

  return (
    <button
      aria-label={
        favorited
          ? t("unfavoriteAction", { name })
          : t("favoriteAction", { name })
      }
      aria-pressed={favorited}
      className="inline-flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition-[color,border-color] hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      disabled={isPending && signedIn}
      onClick={handleClick}
      type="button"
    >
      {heart}
    </button>
  );
}
