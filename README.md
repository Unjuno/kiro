# KIRO

KIRO ports branching and multi-ending stories into a web-addressable format that live voice agents can play with users.

## Language comes first

Language selection is the first KIRO interaction, before the catalog introduction, story selection, attribution, or narration. It is a session-level preference, not a per-story setup step.

At entry, ask the player which language they want to use and wait for their answer. If the player has already explicitly selected a language in the current session or supplied it when resuming, reuse that selection instead of asking again. Do not silently choose a language from a story's source language or fallback setting.

The selected language applies to KIRO's introduction, story descriptions and selection prompts, attribution, narration, choices, and other player-facing guidance. Carry it across story changes and returns to the catalog. An explicit language change must not reset story progress.

```text
Enter KIRO
  ↓
Ask player language (or reuse an explicit existing selection)
  ↓
Introduce KIRO and present the catalog in that language
  ↓
Player chooses a story
  ↓
Announce source / attribution in that language
  ↓
Translate and narrate the current scene and visible choices
  ↓
Player chooses
  ↓
Open only the selected next state, retaining the language
```

A direct story or resume link must also resolve the player language before presenting attribution or story text. It need not send the player back through the catalog.

## Core model

After language selection, KIRO separates two levels of navigation:

1. **Story selection** — choose which story to play.
2. **Story branching** — move through that story's scenes and choices until an ending is reached.

```text
Story Catalog
  ├─ Story A
  │   └─ Scene → Choice → Scene → ... → Ending
  ├─ Story B
  │   └─ Scene → Choice → Scene → ... → Ending
  └─ Story C
      └─ Scene → Choice → Scene → ... → Ending
```

## Voice-first localization

A story has one canonical source language, but the player does not need to play in that language. Each story inherits the player language already selected at KIRO entry; it must not ask again when play begins.

The agent translates only the currently revealed narration and choices into that language while preserving names, branch semantics, and attribution. Runtime translation is intentionally selective: the agent must not reveal or summarize unseen branches or endings.

Language changes affect presentation only. They must not change story IDs, node IDs, choice IDs, link targets, or progress. If the selected language cannot be served, explain the limitation and ask the player to choose an alternative rather than silently falling back.

## Repository layout

```text
stories/
  catalog.json          # playable story registry
  _template/            # template for a ported story
    story.json
    nodes/
      start.json

schema/
  story.schema.json     # metadata contract for each story

docs/
  PORTING.md            # rules for importing/porting stories
```

## Attribution is part of the runtime

Each imported story must carry explicit origin and rights metadata.

When a story starts, the voice agent must announce the configured attribution, for example:

> This story is adapted from "Example Story" by Example Author. Source and rights information are available in the story metadata.

When runtime translation is enabled, the announcement may be spoken in the player's selected language, but the original title, author names, source, and rights metadata must remain intact.

The exact wording is stored per story so public-domain, Creative Commons, and other permitted sources can be handled correctly.

## Scope

The first milestone is intentionally small:

- player language is resolved at KIRO entry, before catalog presentation or story selection;
- multiple stories can be registered and selected in that language;
- the selected language persists across story changes;
- narration and visible choices can be translated at runtime;
- each story contains explicit scene/choice branches;
- only the current branch state is exposed during play;
- endings are explicit;
- source and rights metadata travel with the story;
- the voice agent announces attribution before play.

Repository-level licensing will be decided separately. Imported story content must not be assumed to share the repository's eventual software license.
