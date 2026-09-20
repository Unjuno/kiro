# Complete local port: implementation and validation

## Source preservation

The acquisition workflow enumerated the original Wikisource scene inventory
independently, captured rendered HTML for all 86 scenes, stored revision IDs and
SHA-256 hashes, and rechecked the inventory. Main page revisions do not freeze
transcluded Page: revisions; the stored HTML freezes the rendering actually used.
The offline importer normalizes whitespace and removes site chrome, without
summarizing or regenerating prose. Original choice instructions are preserved.
H-6 and H-10 contain reviewed author notes after the final link; these remain in
decision_text. Unexpected trailing content still fails instead of being discarded.
The immutable source snapshot is committed with the work. No third-party abridged
adaptation, image or voice recording is substituted for the original.

## Graph and runtime evidence

The real graph has 86 nodes, 87 directed choice links, 43 terminal endings and
61 complete paths. Every node is reachable; there are no dangling targets,
unreachable scenes, trapped components or cycles. Multiple paths converge on
some endings. A route witness for each ending is stored in VALIDATION.md.

Python and JavaScript perform independent graph checks. Unit tests use explicitly
marked controlled fixtures; five additional Python tests cover the real corpus.
The real-corpus HTTP playthrough checker exercises 258 node/locale combinations
and all 61 complete paths. The host checker compares anonymous HTTP output with
the pure current-scene renderer, including language-change/resume links.

## Delivery contract

Language selection precedes catalog, attribution and story narration. Direct
resume links without language keep their pending story, node and version through
the language gate. Changing language does not restart a scene. Native anchors
provide same-path navigation without JavaScript, client story data or prefetch.
The server reads local files only. Unknown state returns 404, stale version 409,
invalid query input 400, and unavailable local corpus 503. None is an ending.

The URL is a bookmarkable state address, not a credential. The public source
repository and original book remain readable; this prevents accidental delivery
of future prose, not deliberate spoiler lookup or cheating. Same-path URLs with
different query states still require new HTTP reads; no claim of unlimited
external-agent reading or guaranteed cache behavior is made.

The browser displays source-English story prose with Japanese/English interface
copy. An external voice agent translates the visible content and choices into
the language explicitly selected by the user, and reads source attribution.
The agent must not invent choices or select for the user. Actual speech quality
and agent instruction-following are not certified by structural HTML tests.

## Release gates

A source import must preserve the complete independent inventory and pass all
hash and graph checks before replacing previous data. The build requires local
validated data, passing tests, an installed lockfile and a successful Next build.
The workflow checks production dependency advisories at high severity or above.
Only the migration branch receives generated data/lock updates. Main is promoted
after successful validation, without force updates. Vercel READY and anonymous
production HTTP are checked separately from local and build success.

## Rights boundary

The source provides a US public-domain notice, not global clearance. Attribution
is preserved but is not a substitute for adaptation/translation permission in a
jurisdiction where rights remain. Wiki contributor notices, source links and the
applicable CC license link are recorded separately. Software license selection
remains the repository owner's decision.

Related engineering domains: digital-text preservation (source/revision hashes),
graph verification (reachability and ending witnesses), and localization/accessibility
(language-first, script-free HTML and external speech presentation).
