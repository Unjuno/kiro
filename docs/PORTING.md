# Porting stories into KIRO

## 1. Verify the source before importing text

Before a story is added:

1. identify the original work and author(s);
2. record the canonical source URL;
3. determine the legal basis for reuse or adaptation;
4. keep software licensing separate from story-content rights;
5. record jurisdiction-specific uncertainty instead of guessing.

A public-domain claim should be treated as a rights determination, not as a default assumption.

## 2. Preserve provenance

Every port must include:

- original title;
- author(s);
- source;
- rights status/license;
- any attribution requirements;
- a voice announcement shown/spoken before play when configured.

The runtime must not strip this metadata.

## 3. Convert structure, not navigation hacks

Represent the work explicitly as story nodes and directed choices.

```text
scene
 ├─ choice → scene
 ├─ choice → scene
 └─ choice → ending
```

Do not encode branching only as prose instructions such as "go to page 42".

## 4. Story selection and internal branching are separate

The catalog chooses a story. The selected story then owns its own branch graph.

This keeps KIRO capable of hosting many unrelated works without merging their state spaces.

## 5. Porting checklist

- [ ] Source identified
- [ ] Rights basis recorded
- [ ] Attribution wording recorded
- [ ] Entry node defined
- [ ] Every choice targets an existing node
- [ ] Every intended ending is explicit
- [ ] No unreachable nodes unless documented
- [ ] No third-party images/audio imported without separate rights review
