/** biome-ignore-all lint/performance/noJsxPropsBind: 管理后台交互组件，内联事件处理器依赖闭包状态，保持可读性。 */
"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteLibraryAction } from "@/app/admin/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteLibraryButtonProps {
  id: number;
  name: string;
  redirectTo?: string;
  variant?: "ghost" | "outline" | "destructive";
}

export function DeleteLibraryButton({
  id,
  name,
  redirectTo,
  variant = "ghost",
}: DeleteLibraryButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirm() {
    setIsDeleting(true);
    const result = await deleteLibraryAction(id);
    setIsDeleting(false);
    if (result.message) {
      toast.error(result.message);
      return;
    }
    toast.success(`已删除「${name}」`);
    setOpen(false);
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  async function handleActionClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    await handleConfirm();
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger
        render={
          <Button aria-label={`删除 ${name}`} size="icon-sm" variant={variant}>
            <Trash2Icon
              className={variant === "ghost" ? "text-destructive" : undefined}
            />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除「{name}」？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后将同时移除它的交付类型、使用场景、标签及 GitHub
            指标，且前台不再展示。此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={handleActionClick}
          >
            {isDeleting ? "删除中…" : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
