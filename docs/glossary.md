# Glossary

Domain language lives in [`CONTEXT.md`](../CONTEXT.md). This file records
implementation and operational terminology.

| Term | Meaning |
| --- | --- |
| Catalog | The complete set of library entries and their current GitHub metrics exposed by the site. |
| Library | One externally hosted UI library that supports the shadcn CLI or a compatible registry. |
| Slug | The immutable, unique kebab-case identifier used in `/libraries/{slug}`. |
| Controlled vocabulary | A filter value whose allowed options are released with application code rather than edited as catalog data. |
| Tag | A free-form, ordered search term owned by a Library. |
| Featured rank | A nullable, unique positive integer controlling the manual Featured ordering. |
| GitHub metric | The latest known star count, default-branch commit time, and synchronization time for a Library. |
| Missing metric | The absence of a snapshot row; semantically different from a known repository with zero stars. |
| Seed fixture | Versioned bootstrap input used to populate an empty database; it is not read by the running application. |
| Migration | A committed, ordered SQL change generated and applied through Drizzle Kit. |
| Runtime source of truth | Turso/libSQL, the only persistence source read by public application routes. |
| Admin role | The value `admin` stored in a Clerk user's `publicMetadata.role`; the only grant that unlocks `/admin`. |
| RequireAdmin | The server-side guard in `src/lib/admin-auth.ts` that redirects anonymous requests to sign-in, returns 404 for non-admin sessions, and gates every admin page and server action. |
| AI autofill | The admin pipeline where an autonomous agent (tool loop) fetches the target site via `fetch_page`/`fetch_github_repo` tools, then produces `libraryFormSchema` fields as structured output, streamed for human review in `LibraryForm`. |
| Agent UI message stream | The AI SDK stream returned by `createAgentUIStreamResponse` and consumed through `useChat` with `DefaultChatTransport`; message parts include text and tool activity. |
| Fill-fields tool call | The client-executed `fill_fields` call containing a batch of researched form fields and provenance. The client validates each field, applies eligible values, and returns per-field outcomes through `addToolOutput`. |
| Provenance | The `{ source, confidence }` metadata attached to each AI-filled field indicating which fetched material it came from and how certain the LLM was. |
| OpenAI-compatible endpoint | The user-configured LLM interface (`AI_BASE_URL` + `AI_MODEL` + `AI_API_KEY`) accessed through `@ai-sdk/openai-compatible`; no vendor is hard-coded. |
| Raw material | The markdown fetched from the target website and GitHub README during one autofill run; kept in memory only for in-panel review, never persisted. |
