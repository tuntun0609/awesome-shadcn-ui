# Catalog domain model

## Aggregate

`Library` is the catalog aggregate root. Its integer `id` is internal; `slug`
is the stable public URL identifier. A library owns its delivery types, use
cases, tags, and optional current GitHub metric.

| Entity | Cardinality | Purpose |
| --- | --- | --- |
| `libraries` | One per catalog entry | Scalar identity, description, access, pricing, source, URLs, dates, and Featured rank |
| `library_deliveries` | Many per library | Ordered, controlled delivery capabilities |
| `library_use_cases` | Many per library | Ordered, controlled use-case classifications |
| `library_tags` | Many per library | Ordered, free-form search terms |
| `github_metrics` | Zero or one per library | Latest successful stars and default-branch commit snapshot |

## Invariants

- A slug is non-empty, kebab-case, and globally unique.
- Source, pricing, access, delivery, and use-case values belong to the
  application-controlled vocabularies in `src/lib/catalog-model.ts`.
- Relation positions are non-negative and unique within a library so reads can
  reproduce the existing display and search order.
- Featured rank is null or a globally unique positive integer.
- `addedAt` remains a valid `YYYY-MM-DD` business date and preserves the current
  UI and sorting semantics.
- Stars are non-negative. No metric row means no known snapshot; it must not be
  converted to a row with zero stars.
- Removing a library cascades to its owned relations and metric.

## Read model

The repository assembles the normalized rows into the existing client-safe
`Library[]` and `GithubSnapshot` shapes. The UI therefore retains its current
search, filter, sorting, metadata, and detail-page behavior while persistence
changes underneath it.
