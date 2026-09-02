import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: "en",
  localeDetection: false,
  localePrefix: "as-needed",
  locales: ["en", "zh"],
});
