# Awesome shadcn/ui

A minimal, filterable directory of UI libraries that publicly support the
shadcn CLI or a compatible registry.

## Local development

```bash
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

The default database is `file:local.db`, which is ignored by Git. Copy
`.env.example` to `.env.local` to use another local file or a remote Turso
database. Runtime database access uses `TURSO_DATABASE_URL` and, for remote
`libsql://` URLs, `TURSO_AUTH_TOKEN`.

Useful checks:

```bash
bun run check
bun test
bun run db:check
bun run build
```

## Maintaining the catalog

Turso/libSQL is the runtime source of truth. Drizzle schema and migrations live
in `src/db/schema.ts` and `drizzle/`. The bootstrap fixture in
`scripts/fixtures/catalog.ts` initializes an empty database but is never read by
the application. This phase intentionally provides no catalog editing UI or
routine mutation CLI. `bun run db:studio` is available for local inspection.

Create and apply reviewed migrations with:

```bash
bun run db:generate
bun run db:check
bun run db:migrate
```

Set Turso credentials and use `bun run db:migrate:turso` to migrate a remote
database. Apply production migrations once in a serialized deployment step;
do not run migrations from every application instance.

Refresh GitHub snapshots manually when needed:

```bash
bun run sync:github
```

The script reads repository URLs from the database and updates the current
metric rows in place. Set `GITHUB_TOKEN` to reduce the chance of API rate
limiting. Failed requests retain the previous database value when one exists.
There is no scheduled job or metric history.

## Inclusion policy

Inclusion is based on each project’s own public claim that it supports the
shadcn CLI or a compatible registry. The commands and registries are not
verified by this project. Pricing, source availability, and access requirements
can change, so the official product site remains the source of truth.

The catalog does not accept submissions for new libraries at this time. GitHub
Issues are available only for corrections to existing entries.

## Deployment

The site is a standard Node.js Next.js application and is not tied to a hosting
provider. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and
`NEXT_PUBLIC_SITE_URL` in the runtime environment. Public routes query the
database at request time through a five-minute server cache, so `next build`
does not require database credentials. Database failures are surfaced rather
than hidden behind a static fallback.

Library logos are stored in Cloudflare R2 (object keys such as
`awesome-shadcn-ui/icons/<slug>.svg`) and served from a public custom domain. Configure
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and
`NEXT_PUBLIC_R2_PUBLIC_DOMAIN` to enable logo uploads from the admin form and
`bun run sync:icons`. `bun run migrate:logos` moves legacy `public/logos`
files into R2 and rewrites the stored paths; append `--cleanup` to remove the
local files afterwards.
