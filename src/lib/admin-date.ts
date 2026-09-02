import { formatCommitDate } from "@/lib/catalog";

export function formatAdminDate(value: string) {
  return formatCommitDate(value.replace(" ", "T"), "zh-CN", "可能已过期");
}
