import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

const ADMIN_ROLE = "admin";

const SIGN_IN_PATH = `/sign-in?redirect_url=${encodeURIComponent("/admin")}`;

/** 判断 session claims 是否携带 admin 角色（Clerk publicMetadata 写入 JWT 的 metadata 声明）。 */
export function isAdminSession(sessionClaims: unknown): boolean {
  const metadata = (
    sessionClaims as { metadata?: { role?: unknown } } | null | undefined
  )?.metadata;
  return metadata?.role === ADMIN_ROLE;
}

/**
 * /admin 的服务端防护边界：未登录跳转登录页（登录后跳回 /admin），
 * 已登录但非 admin 返回 404。页面 layout 与每个 admin server action 都必须调用。
 */
export async function requireAdmin(): Promise<void> {
  const { sessionClaims, userId } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  if (!isAdminSession(sessionClaims)) {
    notFound();
  }
}
