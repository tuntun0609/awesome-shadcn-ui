# ADR 0004: Ground public Library recommendations in reviewed Catalog profiles

- Status: Accepted
- Date: 2026-09-20

## Context

The homepage needs a conversational way for signed-in users to find suitable
Libraries. The existing Catalog is Library-level, while users also express
subjective preferences such as visual style, motion, density, and
customizability that the current data cannot support reliably. A public model
must not invent entries, silently relax requirements, browse unreviewed sources,
or turn the recommendation feature into a general-purpose assistant.

## Decision

1. The first version recommends only Libraries already present in the Catalog.
   It does not index individual components, search the web at runtime, or use a
   vector database.
2. Every recommendable Library has a Reviewed profile containing controlled
   Profile traits, one Representative preview, editorial context, and
   trait-level Profile evidence. An administrator reviews every dimension;
   insufficient evidence is recorded explicitly as an Undisclosed trait.
3. AI converts conversation into typed Hard constraints and weighted Soft
   preferences. A read-only `search_catalog` boundary performs filtering and
   reproducible scoring on the server. The server validates all returned slugs,
   while the model explains validated results using reviewed data only.
4. A Hard constraint may be relaxed only after the User explicitly agrees. An
   Undisclosed trait cannot satisfy a Hard constraint and is neutral for a Soft
   preference.
5. The Recommendation surface is independent from Directory filter state. It
   shows its own Shortlist and never reads, changes, or serializes the directory
   filters or ordering.
6. Recommendation conversations are temporary browser state. The application
   does not persist raw messages. It stores only pseudonymous, structured funnel
   events for up to 90 days and keeps rate-limit counters separately. Existing
   favorites influence a result only after an explicit User request.
7. The endpoint requires Clerk authentication, has configurable per-user and
   per-conversation limits, uses a recommendation-specific model configuration,
   and can be disabled server-side. Passing the fixed bilingual evaluation suite
   and completing all twelve initial Library profiles are release gates; after
   those gates, the feature is released to all signed-in users at once.

## Consequences

- Profile schema, evidence storage, preview asset handling, admin review UI, and
  a complete initial backfill must exist before the public assistant launches.
- Recommendations are explainable, testable, and resilient to model invention,
  but they cannot answer from newly changed websites until an administrator
  reviews the Profile again.
- The first version deliberately excludes component-level discovery, runtime
  browsing, RAG, persistent or shareable conversations, implicit
  personalization, directory-filter synchronization, and automatic
  multi-provider failover.
