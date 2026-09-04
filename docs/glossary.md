# Glossary

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
