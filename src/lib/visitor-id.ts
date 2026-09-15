import "server-only";

import { cookies } from "next/headers";

/** 匿名访客 cookie 的名称与有效期（一年）。 */
const VISITOR_COOKIE = "visitor_id";
const VISITOR_COOKIE_MAX_AGE = 31_536_000;

/** 读取匿名访客 ID；未种下 cookie 时返回 null。 */
export async function readVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value?.trim() ? value : null;
}

/**
 * 读取匿名访客 ID，不存在时生成并种下长期 cookie。
 * 仅可在 Server Action 或 Route Handler 中调用（会写入 cookie）。
 */
export async function ensureVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_COOKIE)?.value;
  if (existing?.trim()) {
    return existing;
  }

  const visitorId = crypto.randomUUID();
  cookieStore.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    maxAge: VISITOR_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return visitorId;
}
