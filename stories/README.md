# Stories

Each directory under `stories/` represents one independently ported branching story.

## Separation of concerns

- `catalog.json` answers **which story should be played?**
- `<story-id>/story.json` describes **what is this story and where does it start?**
- `<story-id>/nodes/*.json` describes **what choices exist inside the story?**

A story should therefore be portable without changing the runtime.

## Recommended layout

```text
stories/
  catalog.json
  story-id/
    story.json
    nodes/
      start.json
      ...
```

Do not put third-party story text into KIRO until its reuse/porting basis has been recorded in `story.json`.
