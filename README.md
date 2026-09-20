# KIRO

KIRO ports branching and multi-ending stories into a web-addressable format that live voice agents can play with users.

## Core model

KIRO separates two levels of navigation:

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

The exact wording is stored per story so public-domain, Creative Commons, and other permitted sources can be handled correctly.

## Scope

The first milestone is intentionally small:

- multiple stories can be registered;
- a player can choose a story;
- each story contains explicit scene/choice branches;
- scenes can be addressed individually;
- endings are explicit;
- source and rights metadata travel with the story;
- the voice agent announces attribution before play.

Repository-level licensing will be decided separately. Imported story content must not be assumed to share the repository's eventual software license.
