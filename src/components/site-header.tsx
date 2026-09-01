import { Code2 } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const repositoryUrl = "https://github.com/tuntun0609/awesome-shadcn-ui";

export function SiteHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-border border-b">
      <Link
        className="inline-flex items-center gap-2 font-semibold text-sm"
        href="/"
      >
        <span className="flex size-6 items-center justify-center rounded-md bg-foreground font-mono text-[10px] text-background">
          A/
        </span>
        Awesome shadcn/ui
      </Link>
      <nav aria-label="Primary navigation" className="flex items-center gap-1">
        <Link className="nav-link" href="/about">
          About
        </Link>
        <a
          aria-label="View the project on GitHub"
          className="nav-link px-2"
          href={repositoryUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Code2 aria-hidden="true" className="size-4" />
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
