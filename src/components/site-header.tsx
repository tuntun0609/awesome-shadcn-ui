import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const repositoryUrl = "https://github.com/tuntun0609/awesome-shadcn-ui";

export function SiteHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-border border-b">
      <Link className="inline-flex items-center gap-2.5" href="/">
        <Image
          alt=""
          aria-hidden="true"
          className="h-7 w-auto shrink-0"
          height={853}
          src="/logo.svg"
          unoptimized
          width={878}
        />
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="font-heading font-semibold text-base leading-none">
            Awesome
          </span>
          <span className="font-medium font-mono text-[11px] text-muted-foreground tracking-tight">
            shadcn/ui
          </span>
        </span>
      </Link>
      <nav aria-label="Primary navigation" className="flex items-center gap-1">
        <Link className="nav-link" href="/about">
          About
        </Link>
        <a
          className="nav-link px-2"
          href={repositoryUrl}
          rel="noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
          </svg>
          <span className="sr-only">View the project on GitHub</span>
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
