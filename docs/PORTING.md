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

## 3. Language selection is the first KIRO interaction

Player language belongs to the KIRO session, not to a story. Before introducing KIRO, presenting catalog descriptions, or asking which story to play, the agent must ask which language the player wants and wait for the answer. Reuse an explicit language already selected in the current session or supplied on resume; do not ask again unnecessarily.

The order is language selection, localized catalog and story selection, localized attribution, then the current scene and its choices. A direct story or resume link still resolves language first, but does not need to repeat catalog selection.

The HTML player must follow the same entry order using a language selector. This is a UX requirement, not a claim that browser translation is already implemented.

Each story inherits the session language. Switching stories or returning to the catalog must not trigger another language question. An explicit language change updates presentation without resetting progress or changing branch targets. Neither the source language nor `fallback_language` may silently override the player's selection; explain any unsupported language and request an alternative.

The old per-story `ask_player_language_before_play` field is deprecated and optional for compatibility. It must not control when language selection occurs. New story templates omit it.

When `localization.mode` is `agent-runtime`:

1. use the already selected session language for narration and visible choice labels;
2. translate the attribution announcement when configured, while preserving the original title and author names;
3. translate only content that has already been revealed by the current story state;
4. do not summarize, translate, or expose unseen branches or endings;
5. preserve branch meaning exactly — translation must not invent new choices or merge distinct choices;
6. keep proper names and recurring terminology consistent throughout the session;
7. preserve story IDs, node IDs, choice IDs, and destination links unchanged.

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

After language selection, the catalog chooses a story. The selected story then owns its own branch graph while inheriting the session's player language.

This keeps KIRO capable of hosting many unrelated works without merging their state spaces.

## 6. Porting checklist

- [ ] Source identified
- [ ] Rights basis recorded
- [ ] Translation/adaptation rights checked when runtime translation is enabled
- [ ] Attribution wording recorded
- [ ] Canonical source language recorded
- [ ] Runtime localization policy recorded
- [ ] Language resolved before catalog presentation or story selection
- [ ] Direct story and resume links also resolve language before story text
- [ ] Story changes inherit language without asking again
- [ ] Language changes preserve progress and branch targets
- [ ] Entry node defined
- [ ] Every choice targets an existing node
- [ ] Every intended ending is explicit
- [ ] No unreachable nodes unless documented
- [ ] No third-party images/audio imported without separate rights review
