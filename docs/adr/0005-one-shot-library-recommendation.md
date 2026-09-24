# ADR 0005: Use one-shot parsing and deterministic Library recommendation

- Status: Accepted
- Date: 2026-09-21
- Supersedes: ADR 0004

The first recommendation release is a small, authenticated feature rather than a conversational assistant or a product-value experiment. A model converts one natural-language request into typed Hard constraints and equal-weight Soft preferences over the existing Catalog fields plus `visualStyles`; deterministic server code filters and ranks every Library currently stored in the database and returns at most three results. Every Library must have at least one reviewed `visualStyles` value before release, but the first version does not introduce a separate Profile publication lifecycle, evidence store, preview workflow, conversation state, automatic constraint relaxation, personalization, or user-level analytics. This deliberately replaces ADR 0004's broader reviewed-profile and conversational design so the initial implementation can establish a correct functional path before those capabilities are reconsidered.
