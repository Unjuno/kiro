# Stories

The catalog selects between works. Each active work has a v2 story.json,
a server-only nodes.json and source.manifest.json. See schema/*.schema.json.
A scene contains original text, original decision_text, explicit choice IDs and
next-node IDs. Endings are explicit and have no story choices.

The historical _template directory describes the earlier v1 proposal and is not
registered or served. Use the completed consider-the-consequences v2 work as the
reference for a new adapter; do not treat a placeholder or fixture as a real port.
Player language is global to the player flow, not a per-story setup question.
