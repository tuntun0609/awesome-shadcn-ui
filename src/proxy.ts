import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const proxy = createMiddleware(routing);

export default proxy;

export const config = {
  // Match only internationalized pathnames (exclude /admin which has its own
  // non-intl layout)
  matcher: "/((?!api|trpc|_next|_vercel|admin|.*\\..*).*)",
};
