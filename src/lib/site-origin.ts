import "server-only";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const siteUrl =
  configuredSiteUrl ??
  (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

if (!siteUrl) {
  throw new Error("NEXT_PUBLIC_SITE_URL must be set in production.");
}

const parsedSiteUrl = new URL(siteUrl);

if (parsedSiteUrl.protocol !== "http:" && parsedSiteUrl.protocol !== "https:") {
  throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
}

if (
  process.env.NODE_ENV === "production" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(parsedSiteUrl.hostname)
) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL must use the public production domain."
  );
}

export const siteOrigin = parsedSiteUrl.origin;
