# Static Twee import profile

KIRO can append a restricted class of Twee 3 works to the local story library.
This importer is deliberately **not** a general Twine runtime. It is designed for
plain, finite branching prose that can be represented safely as KIRO's
current-scene graph.

## Supported source

The metadata file must declare:

```json
"import_profile": "kiro-twee3-static-v1"
```

A source contains one `StoryTitle`, optional `StoryData`, and ordinary passages.
The entry passage is `metadata.start`, `StoryData.start`, or `Start`, in that
order. Endings must be explicit with the `[ending]` tag or
`metadata.ending_passages`.

Supported choice forms, as complete lines at the end of a passage:

```twee
[[Target]]
[[Visible label|Target]]
[[Visible label->Target]]
[[Target<-Visible label]]
```

The importer rejects rather than guesses when it sees unsupported stateful or
executable features: macros, variables, hooks, setters, HTML, special runtime
passages, external choice URLs, prose after choices, unknown tags, broken links,
cycles, undeclared dead ends, duplicate passages, or ambiguous syntax.

Current limits are 2 MB source text, 500 passages, at least two explicit endings,
and at most 10,000 complete start-to-ending paths.

## Rights review is a gate, not a legal opinion

The importer never infers permission from a URL or attribution string. Metadata
must record an actual review, evidence URL, reviewer/date, territories, and
explicit booleans for translation and distribution permission. The tool checks
that these fields exist; it does **not** prove that the legal conclusion is
correct.

Start from:

```text
examples/twee-metadata.template.json
```

Do not mark a field reviewed merely to make a test pass. Attribution alone is not
permission, and a U.S. public-domain conclusion is not automatically worldwide
clearance.

## Check without writing

```sh
node tools/import-twee.mjs \
  --source /path/to/work.twee \
  --metadata /path/to/rights.json \
  --check
```

This parses, validates all nodes/targets/endings, proves the graph is acyclic,
and counts complete paths without changing the repository.

## Append to a library

```sh
node tools/import-twee.mjs \
  --source /path/to/work.twee \
  --metadata /path/to/rights.json \
  --story-root stories
```

The write path uses an exclusive catalog lock, a staging directory, an atomic
directory rename, and an atomic catalog replacement. Existing story IDs or
folders are never overwritten. On failure, the newly staged directory is
removed and the old catalog remains authoritative.

Each imported work stores:

- `story.json`: identity, entries, rights, attribution, localization, statistics
- `nodes.json`: complete server-side graph
- `source.twee`: exact imported source text
- `import.metadata.json`: exact review metadata used for conversion
- `source.manifest.json`: source/bundle hashes and explicit ending inventory
- `validation.json`: measured graph results
- `ATTRIBUTION.md`: human-readable provenance summary

Runtime still serves only the selected scene and immediate choices.

## Reproducibility

```sh
npm run validate:library
```

For a Twee-imported work, the verifier recompiles the stored source and metadata
and requires exact canonical equality with the stored story, node bundle and
manifest. It also exhaustively counts finite paths for every registered work.

The synthetic fixture under `tests/fixtures/static-twee` is test-only.
Production library loading refuses any story marked `test_fixture`.

Primary format reference:
https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md


## Published Twine HTML intake

If a licensor provides only a published Twine HTML build, first extract its embedded
source passages without executing the game:

```sh
npm run extract:twine-html -- \
  --source /path/to/game.html \
  --output /path/to/review.twee \
  --manifest-output /path/to/review.extract.json
```

The extractor reads the single `<tw-storydata>` block and its
`<tw-passagedata>` children, decodes one HTML-serialization layer, preserves
passage names/tags/layout and the declared start node, and records SHA-256 hashes
for both the original HTML and extracted Twee. Script and style blocks are never
executed and are not copied into story prose.

Extraction is **not** approval for import. Review the resulting Twee source,
rights evidence, and extractor manifest. Then run the normal `import:twee`
check. Any macros, variables, setters, HTML, unsupported tags, cycles, or other
stateful Twine features remain visible in the extracted source and are rejected
by the downstream static compiler rather than being stripped.

Use `--check` to inspect metadata without writing files:

```sh
npm run extract:twine-html -- --source /path/to/game.html --check
```

The HTML extractor refuses to overwrite existing output files.
