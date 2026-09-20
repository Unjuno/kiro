# KIRO

Branching stories for browsers and live voice agents. Language selection comes **before** the catalog, story selection, attribution, and narration.

## Player contract

Choose a language, choose a story, hear/read the origin notice, choose a viewpoint, then follow one visible decision at a time. The first work is *Consider the Consequences!* (1930), by Doris Webster and Mary Alden Hopkins.

The server returns only the current scene, the original decision paragraph, and current options. Native HTML links work without JavaScript and do not prefetch future branches. A live agent translates only visible material into the explicitly selected language and never changes target IDs or invents options. Browser-only play retains the canonical English story text; this project does not secretly call a paid translation API.

## State and repeatability

The player uses one route, `/`, with `lang`, `story`, `node`, and `v` query parameters. Different choices necessarily produce different query-bearing URLs. The snapshot version is carried forward. A known version mismatch is rejected rather than silently interpreting an old save against a new graph. Language changes preserve story progress. The catalog retains the selected language. No database, cookies, login, or secret is required.

These are navigable, public story states, not cryptographically protected saves. The design prevents accidental full-graph delivery; it does not stop someone intentionally exploring links or reading the public source repository.

## Data and checks

`stories/consider-the-consequences/` holds metadata, an explicit graph, the source manifest, and per-page expanded HTML snapshots. Runtime code has no Wikisource fetch or HTML parser. Network access is restricted to the explicit import command. Verification recompiles the archived sources, checks their hashes, verifies targets, enumerates reachability, rejects cycles, and records a witness path to every ending.

```sh
npm install
npm run import:story       # only for intentional source acquisition/update
npm run verify:story      # offline; rebuild from the archived HTML
npm test
npm run build
npm start
npm run test:http          # exhaustive plain-HTML traversal against localhost:3000
```

Reports live in `reports/`. `/verification` exposes counts and hashes only, not future story content. The parser fails closed on unresolved choices; absence of a parsed link alone is not accepted as proof of a valid ending.

Source rights and software licensing are separate. See the work's `ATTRIBUTION.md`; US public-domain status must not be represented as worldwide clearance. Live voice translation fidelity is not proven by structural or HTTP tests.
