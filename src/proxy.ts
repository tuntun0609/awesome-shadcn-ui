import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const proxy = createMiddleware(routing);

const intlMiddleware = proxy;

const ADMIN_PREFIX = "/admin";

const API_PREFIX = "/api";

function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

export default clerkMiddleware(async (auth, request) => {
  if (isAdminPath(request.nextUrl.pathname)) {
    // /admin 是非国际化路由，跳过 next-intl；未登录由 Clerk 在此处
    // 直接跳转登录页，避免 layout 渲染中抛 redirect
    await auth.protect();
    return;
  }
  if (isApiPath(request.nextUrl.pathname)) {
    // API 路由不参与国际化，避免被 next-intl 重写为 /en/api/... 后 404
    return;
  }
  return intlMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
