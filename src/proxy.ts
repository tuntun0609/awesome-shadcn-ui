import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const proxy = createMiddleware(routing);

const intlMiddleware = proxy;

export default clerkMiddleware((_auth, request) => intlMiddleware(request));

export const config = {
  matcher: [
    // Match internationalized pathnames only (exclude /admin which has its
    // own non-intl layout)
    "/((?!_next|admin|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
