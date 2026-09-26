# KIRO

Branching stories for ordinary HTML browsers and live voice agents.

## Language comes first

Select the player language before the catalog, story choice or attribution.
The selected language is retained across story navigation. Changing language
preserves the story, node and content version. A live voice agent translates
only the currently revealed narration and choice instructions. Browser-only
story text remains in English; Japanese and English interface copy is included.
There is no built-in paid translation service or voice-call API.

## First complete local port

**Consider the Consequences!** (Doris Webster and Mary Alden Hopkins, 1930).
The captured Wikisource text has **86 nodes, 87 choice links, 43 endings and
61 complete start-to-ending paths**. The importer measured these counts from the
original capture, rather than substituting a third-party summary or test fixture.
Content version: `75b24d5c40c640bb`.

The player uses one `/` route with `lang`, `story`, `node` and `v` query parameters.
It returns only the current scene and its immediate choice links. No database,
account, client-side story graph, RSC payload, JavaScript navigation or prefetch
is needed. There are no runtime requests to Wikisource. Save the complete URL
to resume. Unknown nodes return 404; mismatched saved versions return 409 rather
than silently resetting progress. Old versions require explicit archiving.

## Structure

- `stories/catalog.json`: selection between works.
- `stories/<id>/story.json`: origin, rights, language and entry viewpoints.
- `stories/<id>/nodes.json`: complete server-side branching text.
- `source.capture.json` and `source.manifest.json`: pinned HTML, revision links and hashes.
- `validation.json`, `VALIDATION.md`, `playthrough-validation.json`: generated evidence.
- `app/route.js`, `lib/player.mjs`: current-scene native HTML rendering.
- `tools/import_wikisource.py`: offline conversion from the pinned source.

Original author notes following choices in H-6 and H-10 remain in `decision_text`.
They explain converging paths, not additional choices.

## Development

Python 3.10+, Node 22.x and npm are required. Network access is needed only for
initial dependency installation or deliberate new source capture.

```sh
python3 tools/import_wikisource.py
npm ci --ignore-scripts --no-audit --no-fund
npm test
node tools/verify-playthrough.mjs
npm audit --omit=dev --audit-level=high
npm run build
npm run dev
```

The importer and independent Node graph validator check every target, inventory,
reachable node and ending. The actual-corpus tests reparse every source page and
verify its hash. The playthrough checker tests all 86 scenes in three locale
selection modes and walks all 61 complete paths through actual HTML links.
These are navigation tests, not a claim of verified live-agent translation quality.

`tools/verify-host.mjs` checks a running host with anonymous HTTP requests against
the exact expected current-scene HTML. CI stores build and host-check artifacts.
No successful local test is reported as a successful production deployment.

## Source rights

Each scene retains original attribution and source links. The agent is instructed
to read the attribution before a new story. Wikisource identifies the original
as public domain in the United States; this is **not** worldwide or Japanese
translation/distribution clearance. Original text rights, Wikisource contributions
and software licensing are separate. No repository-wide license is imposed.
See [porting rules](docs/PORTING.md) and [implementation notes](docs/OFFLINE_PORT.md).


## Additional branching works

KIRO now has a fail-closed import path for plain static Twee 3 works. It is not a
general Twine interpreter: macros, variables, HTML, setters, special runtime
passages, cycles and undeclared dead ends are rejected rather than guessed.

Rights are supplied as reviewed metadata, never inferred from an attribution
line or source URL. Check a work without writing anything:

```sh
npm run import:twee -- --source /path/work.twee --metadata /path/rights.json --check
```

After an eligible work is reviewed, append it to the local library with the same
command minus `--check`. Existing IDs are never overwritten. Every registered
work is revalidated by:

```sh
npm run validate:library
```

See [static Twee import profile](docs/IMPORT_TWEE.md) and
[metadata template](examples/twee-metadata.template.json). The fixture used by
the importer tests is synthetic and cannot be served by the production library.
