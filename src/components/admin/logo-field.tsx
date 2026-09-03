/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { Loader2Icon, SparklesIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchLibraryLogoAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { logoPublicUrl } from "@/lib/logo-url";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = ".svg,.png,.ico,.webp";

interface PendingLogo {
  file: File;
  sourceUrl: string;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function decodeBase64(base64: string) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

interface LogoFieldProps {
  file: File | null;
  /** 用于自动采集的 GitHub 仓库地址（来自表单，空串表示未填写）。 */
  github: string;
  id: string;
  /** 当前表单中的 R2 对象 key，空串表示无 Logo。 */
  logoKey: string;
  /** 组件库名称，用于首字母占位。 */
  name: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
  /** 用于自动采集的官网地址（来自表单）。 */
  website: string;
}

export function LogoField({
  file,
  github,
  id,
  logoKey,
  name,
  onFileChange,
  onRemove,
  website,
}: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);
  const [collecting, setCollecting] = useState(false);
  const [pending, setPending] = useState<PendingLogo | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!pending) {
      setPendingUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(pending.file);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  async function collectLogo() {
    setCollecting(true);
    try {
      const result = await fetchLibraryLogoAction(website, github);
      if (
        result.message ||
        !result.base64 ||
        !result.contentType ||
        !result.filename
      ) {
        toast.error(result.message ?? "Logo 采集失败");
        return;
      }
      setPending({
        file: new File([decodeBase64(result.base64)], result.filename, {
          type: result.contentType,
        }),
        sourceUrl: result.sourceUrl ?? "",
      });
    } catch {
      toast.error("Logo 采集失败");
    } finally {
      setCollecting(false);
    }
  }

  const previewSrc =
    objectUrl ?? (logoKey === "" ? undefined : logoPublicUrl(logoKey));
  const canRemove = file !== null || logoKey !== "";

  return (
    <div className="flex min-w-0 items-center gap-4">
      <button
        aria-label="上传 Logo"
        className={cn(
          "flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border bg-card font-semibold shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          dragging && "border-primary bg-accent"
        )}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) {
            onFileChange(dropped);
          }
        }}
        type="button"
      >
        {previewSrc ? (
          <Image
            alt=""
            className="size-9 object-contain"
            height={36}
            src={previewSrc}
            unoptimized
            width={36}
          />
        ) : (
          <span aria-hidden="true">{initialsOf(name)}</span>
        )}
      </button>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="text-muted-foreground text-sm">
          点击或拖拽图片到方块上传，支持 SVG/PNG/ICO/WebP，最大 512KB。
        </span>
        <div className="flex items-center gap-2">
          <Button
            disabled={collecting || website === ""}
            onClick={collectLogo}
            size="sm"
            title={website === "" ? "请先填写官网地址" : undefined}
            type="button"
            variant="outline"
          >
            {collecting ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            {collecting ? "采集中…" : "自动采集"}
          </Button>
          {canRemove ? (
            <Button onClick={onRemove} size="sm" type="button" variant="ghost">
              <Trash2Icon data-icon="inline-start" />
              移除 Logo
            </Button>
          ) : null}
        </div>
        {pending ? (
          <div className="flex w-full min-w-0 items-center gap-3 rounded-xl border bg-card p-3">
            {pendingUrl ? (
              <Image
                alt=""
                className="size-9 shrink-0 object-contain"
                height={36}
                src={pendingUrl}
                unoptimized
                width={36}
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="max-w-full truncate text-muted-foreground text-xs">
                采集自 {pending.sourceUrl}
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onFileChange(pending.file);
                    setPending(null);
                  }}
                  size="xs"
                  type="button"
                >
                  使用采集结果
                </Button>
                <Button
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
      </div>
      <input
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        id={id}
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
