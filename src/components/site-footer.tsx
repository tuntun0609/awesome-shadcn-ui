import { useTranslations } from "next-intl";
import { repositoryUrl } from "@/components/site-header";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="flex flex-col gap-3 border-border border-t py-8 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
      <p>{t("note")}</p>
      <div className="flex items-center gap-4">
        <Link className="hover:text-foreground" href="/about">
          {t("methodology")}
        </Link>
        <a
          className="hover:text-foreground"
          href={`${repositoryUrl}/issues/new?template=correction.yml`}
          rel="noreferrer"
          target="_blank"
        >
          {t("reportCorrection")}
        </a>
      </div>
    </footer>
  );
}
