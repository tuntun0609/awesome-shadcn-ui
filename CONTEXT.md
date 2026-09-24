# Catalog Discovery

This context defines how people discover suitable UI libraries from the site's
curated catalog, either through filters or an assisted conversation.

## Language

**Catalog**:
The complete set of Library entries available for discovery on the site.
_Avoid_: Marketplace, component index

**Library**:
One externally hosted UI library that supports the shadcn CLI or a compatible
registry. It is the smallest item the Catalog recommends.
_Avoid_: Component, block, template, UI

**Recommendation conversation**:
An exchange in which a signed-in User describes their needs and receives a
shortlist of matching Libraries from the Catalog.
_Avoid_: Component search, web search

**Shortlist**:
A small set of matching Libraries presented with reasons so the User can decide
which entries to inspect or save.
_Avoid_: Search results, final selection

**Hard constraint**:
A requirement that a Library must satisfy to appear in a Shortlist.
_Avoid_: Preference, ranking signal

**Soft preference**:
A desirable quality used to rank and explain otherwise eligible Libraries; it
does not exclude a Library by itself.
_Avoid_: Filter, requirement

**Library profile**:
The reviewed discovery facts and representative traits that describe a
Library and support preference matching. Representative visuals and
trait-level evidence may be added by later review workflows.
_Avoid_: AI guess, live website analysis

**Profile trait**:
A reviewed value from a controlled vocabulary that describes a Library's
visual style, interaction, density, customizability, or distinguishing strength.
_Avoid_: Tag, inferred preference

**Representative preview**:
A reviewed image in a Library profile that faithfully demonstrates the
Library's visual character and records where it came from.
_Avoid_: Live website image, generated mockup

**Profile evidence**:
The source material that supports a Profile trait or editorial description and
allows an administrator to verify it before publication.
_Avoid_: Model confidence, unsupported claim

**Reviewed profile**:
A Library profile whose every trait dimension has been examined by an
administrator; a dimension may remain Undisclosed when evidence is insufficient.
_Avoid_: Fully populated profile, AI-completed profile

**Undisclosed trait**:
An explicitly reviewed Profile trait for which there is not enough evidence to
claim a value. It cannot satisfy a Hard constraint and remains neutral for a
Soft preference.
_Avoid_: Missing review, negative trait

**Constraint relaxation**:
The User-approved change of a Hard constraint into a Soft preference after the
Catalog produces no exact match.
_Avoid_: Automatic fallback, hidden mismatch

**Recommendation state**:
The current set of Hard constraints, weighted Soft preferences, and approved
Constraint relaxations derived from a Recommendation conversation.
_Avoid_: Chat transcript, saved profile

**Directory filter state**:
The filters a User applies directly to the Catalog directory. It remains
independent from Recommendation state and affects only the directory results.
_Avoid_: Recommendation constraint, shared conversation state

**Recommendation surface**:
The self-contained homepage area that holds a Recommendation conversation and
its Shortlist without reading or changing Directory filter state.
_Avoid_: Directory filter, Catalog replacement

**Match score**:
A reproducible measure of how well an eligible Library's reviewed Profile
traits satisfy the weighted Soft preferences in the Recommendation state.
_Avoid_: Model opinion, popularity rank

**Recommendation reason**:
A concise explanation grounded in the matching Library profile and the User's
stated needs.
_Avoid_: Marketing copy, unsupported claim
