# Voice-agent current-state JSON

KIRO keeps the browser experience and voice-agent data on the same canonical `/`
route. HTML is the default. Add `format=json` to request a read-only structured
representation of the **current state only**.

Examples:

```text
/?format=json
/?lang=ja&format=json
/?lang=ja&story=consider-the-consequences&v=75b24d5c40c640bb&format=json
/?lang=ja&story=consider-the-consequences&node=Helen&v=75b24d5c40c640bb&format=json
```

The first response asks for language before returning the catalog, attribution,
story title, or narration. Subsequent responses contain only the current story
metadata, current narration, current decision text, and immediate choice links.
They never contain the full node graph or a list of hidden endings.

A compatible external voice agent should:

1. ask the player language first;
2. read attribution before beginning a story;
3. translate only returned narration and choices;
4. wait for the player to choose;
5. follow exactly the selected URL;
6. never prefetch alternative choices or enumerate future states;
7. stop at an explicit ending.

The JSON interface does not grant a voice model browsing capability. The external
agent must already be able to open URLs in its current mode. KIRO does not provide
a microphone, speech recognition, an LLM, or a translation API.

The browser URL for the same state is returned as `browser_url`. Story links in
JSON retain language, story, node, content version, and `format=json`. Changing
language deliberately returns to the language gate while preserving story/node
state so play can resume in the newly selected language.

Errors fail closed: unknown states are 404, incompatible pinned versions are 409,
and no error is interpreted as an ending.
