# Living Book implementation and corpus check

## Scope

A visual redesign of the existing native HTML runtime. No new plot, ending, translation API, client-side state, database, account or repository-wide license is introduced. The first story is still the pinned original `Consider the Consequences!`, content version `75b24d5c40c640bb`.

## Source completeness recheck

The existing captured original was reparsed and its hashes checked again. The resulting graph remains 86 scenes, 87 directed choices, 43 terminal endings and 61 complete paths. All 86 scenes are reachable. Original decision clauses and the author notes in H-6 / H-10 remain intact. No missing scene was replaced by generated prose. No additional work was labelled imported.

## Pre-publication checks

- 40 JavaScript tests and 29 Python tests passed locally.
- All 258 scene/language combinations and 61 complete paths passed.
- The actual rendered HTML was visually inspected in Chromium from offline snapshots: language, catalog, introduction, reader, ending; widths 320, 390, 768, 1440 CSS pixels; JavaScript disabled. This is explicitly not a deployed-browser result.
- Added live-browser checks to CI, including image loading, portrait cropping, overflow, main-target sizes, focus visibility, and a clicked language/story/choice/change-language flow.
- The existing production HTTP checks continue to compare the deployed HTML to the expected current-state renderer after main promotion. Deployment, CI and browser reports must be read separately; this file does not assert they have finished.

## Artwork integrity

`public/art/living-book.webp`: 12,202 bytes, SHA-256 `1ffbcecb7a1dedb727a9066b1292390786cd4077ec62d8a0727fee28be731978`.

See ART_DIRECTION.md for intended placement and provenance. No font binaries are included.
