"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeNames: Record<string, string> = {
  en: "English",
  zh: "简体中文",
};

export function LocaleToggle() {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const selectLocale = useCallback(
    (value: string) => {
      router.replace(pathname, { locale: value });
    },
    [router, pathname]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label")}
        className="nav-link px-2"
        data-locale={locale}
      >
        <Languages aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup onValueChange={selectLocale} value={locale}>
          {routing.locales.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              {localeNames[item]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
