# ADR 0001: Store the catalog in Turso through Drizzle ORM

- Status: Accepted
- Date: 2026-09-02

## Context

The catalog previously loaded twelve library records from a TypeScript module
and the latest GitHub metrics from a checked-in JSON snapshot. Every consumer
had to import those files directly, and updating runtime data required changing
the repository.

The first database phase is intentionally limited to changing persistence. It
must preserve the existing public pages, URL contract, client-side filters,
search rules, sorting rules, and GitHub metric fallback behavior. An admin UI,
authentication, audit trail, content lifecycle, public mutations, and metric
history are separate future decisions.

## Decision

1. Turso/libSQL is the runtime source of truth. Drizzle ORM uses
   `@libsql/client` on the standard Node.js runtime.
2. Local development defaults to `file:local.db`; the same runtime data layer
   accepts a remote Turso URL and token through environment variables.
3. Only stable Drizzle releases are used. SQL migrations and Drizzle snapshots
   are committed, checked in CI, and applied once by a serialized deployment
   step using `generate + migrate`.
4. Initial catalog content is stored in a type-safe, idempotent seed fixture.
   The fixture is bootstrap input, not a runtime fallback or a second read path.
5. Libraries have an internal integer key and a unique public slug. Controlled
   taxonomies remain application contracts. Delivery types, use cases, and tags
   use ordered relation tables. Featured rank is a unique positive integer or
   null.
6. GitHub metrics are a nullable one-to-one extension of a library. Only the
   latest successful snapshot is retained; a missing row is distinct from zero
   stars.
7. Foreign-key enforcement is enabled on every connection and covered by an
   integration test.
8. Public routes are dynamically rendered so builds do not need database
   credentials. Database reads use Next.js' non-fetch cache with a 300-second
   revalidation interval. A database failure is surfaced instead of reading the
   removed static sources.

## Consequences

- A new database must be migrated and seeded before the application serves
  traffic.
- Catalog and sync scripts now fail clearly when the schema or database is
  unavailable.
- Deployments need runtime Turso credentials but builds do not.
- Adding an editing workflow later will require a separate authorization,
  validation, lifecycle, audit, and cache-invalidation design.
- The normalized model adds joins, but it preserves value ordering and allows
  database constraints and future indexed filtering.
