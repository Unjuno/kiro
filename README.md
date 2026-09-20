# KIRO

KIRO turns branching and multi-ending stories into a voice-agent-friendly web experience.

The first playable work is **Consider the Consequences!** (Doris Webster & Mary Alden Hopkins, 1930).

## Runtime order

Language is always resolved first.

```text
Enter KIRO
  ↓
Choose / ask player language
  ↓
Show story catalog in that language
  ↓
Choose a story
  ↓
Announce source and attribution
  ↓
Reveal only the current scene and its choices
  ↓
Player chooses
  ↓
Reveal only the selected next scene
  ↓
Ending
```

A live voice agent is instructed to translate only the currently visible narration and choices into the selected language. It must not expose unseen branches or endings.

## One endpoint, no database

The MVP uses a single page route. State is carried by query parameters:

```text
/?lang=ja
/?lang=ja&story=consider-the-consequences
/?lang=ja&story=consider-the-consequences&node=H-1
```

No database or user account is required. The server renders only the current state.

## First story

**Consider the Consequences!** is fetched scene-by-scene from Wikisource. KIRO never sends the full story graph to the browser or voice agent in one response.

The original 1930 work is public domain in the United States. Copyright status may differ by jurisdiction; provenance and source links remain visible in the runtime.

## Development

```bash
npm install
npm run dev
```

Vercel can deploy the repository as a Next.js project.

## Repository layout

```text
app/                  # single-page browser + agent runtime
lib/
  i18n.js             # language gate / UI copy
  stories.js          # story catalog metadata
  wikisource.js       # selective current-scene adapter
stories/              # future locally ported story data
schema/               # story metadata schema
docs/                 # porting rules
```

## Porting rule

Story source rights and software licensing are separate. Every imported or adapted story must keep origin, author, source, and rights metadata. Runtime translation is only appropriate where translation/adaptation is permitted.
