import Link from "next/link";
import { repositoryUrl } from "@/components/site-header";

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-3 border-border border-t py-8 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
      <p>Curated independently. Compatibility claims are not verified.</p>
      <div className="flex items-center gap-4">
        <Link className="hover:text-foreground" href="/about">
          Methodology
        </Link>
        <a
          className="hover:text-foreground"
          href={`${repositoryUrl}/issues/new?template=correction.yml`}
          rel="noreferrer"
          target="_blank"
        >
          Report a correction
        </a>
      </div>
    </footer>
  );
}
