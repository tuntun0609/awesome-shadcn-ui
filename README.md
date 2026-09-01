# Awesome shadcn/ui

A minimal, filterable directory of UI libraries that publicly support the
shadcn CLI or a compatible registry.

## Local development

```bash
bun install
bun run dev
```

Useful checks:

```bash
bun run check
bun test
bun run build
```

## Maintaining the catalog

Library records live in [`src/data/libraries.ts`](src/data/libraries.ts). Add or
edit entries there; the schema, enum values, URLs, and duplicate slugs are
covered by tests. A public GitHub repository is optional. If it is omitted,
stars and commit activity are not shown.

Refresh GitHub snapshots manually when needed:

```bash
bun run sync:github
```

The script reads every configured repository and writes
`src/data/github-metrics.json`. Set `GITHUB_TOKEN` to reduce the chance of API
rate limiting. Failed requests retain the previous snapshot when one exists.
There is no scheduled job or automatic data collection.

## Inclusion policy

Inclusion is based on each project’s own public claim that it supports the
shadcn CLI or a compatible registry. The commands and registries are not
verified by this project. Pricing, source availability, and access requirements
can change, so the official product site remains the source of truth.

The catalog does not accept submissions for new libraries at this time. GitHub
Issues are available only for corrections to existing entries.

## Deployment

The site is a standard Next.js application and is ready for Vercel. Set
`NEXT_PUBLIC_SITE_URL` to the production origin so metadata, `robots.txt`, and
the sitemap use the correct canonical host.
