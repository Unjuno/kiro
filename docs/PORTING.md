# Porting stories into KIRO

## 1. Verify the source before importing text

Before a story is added:

1. identify the original work and author(s);
2. record the canonical source URL;
3. determine the legal basis for reuse or adaptation;
4. keep software licensing separate from story-content rights;
5. record jurisdiction-specific uncertainty instead of guessing.

A public-domain claim should be treated as a rights determination, not as a default assumption.

Translation is an adaptation of the story text. Runtime translation must only be enabled where the source work's public-domain status or license permits the intended use.

## 2. Preserve provenance

Every port must include:

- original title;
- author(s);
- source;
- rights status/license;
- any attribution requirements;
- a voice announcement shown/spoken before play when configured.

The runtime must not strip this metadata.

## 3. Runtime language selection

When `localization.mode` is `agent-runtime`:

1. ask the player which language they want before the story begins;
2. use the selected language for narration and visible choice labels;
3. translate the attribution announcement when configured, while preserving the original title and author names;
4. translate only content that has already been revealed by the current story state;
5. do not summarize, translate, or expose unseen branches or endings;
6. preserve branch meaning exactly — translation must not invent new choices or merge distinct choices;
7. keep proper names and recurring terminology consistent throughout the session.

The canonical story text remains the source of truth. Runtime translation is a presentation layer, not a second story graph.

## 4. Convert structure, not navigation hacks

Represent the work explicitly as story nodes and directed choices.

```text
scene
 ├─ choice → scene
 ├─ choice → scene
 └─ choice → ending
```

Do not encode branching only as prose instructions such as "go to page 42".

## 5. Story selection and internal branching are separate

The catalog chooses a story. The selected story then owns its own branch graph.

This keeps KIRO capable of hosting many unrelated works without merging their state spaces.

## 6. Porting checklist

- [ ] Source identified
- [ ] Rights basis recorded
- [ ] Translation/adaptation rights checked when runtime translation is enabled
- [ ] Attribution wording recorded
- [ ] Canonical source language recorded
- [ ] Runtime localization policy recorded
- [ ] Entry node defined
- [ ] Every choice targets an existing node
- [ ] Every intended ending is explicit
- [ ] No unreachable nodes unless documented
- [ ] No third-party images/audio imported without separate rights review
