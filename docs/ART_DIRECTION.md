# The Living Book — KIRO visual system

Approved brief: 1930s editorial printmaking with contemporary, restrained navigation. The story—not ornamental UI—is the primary reading content.

## Generated artwork

`public/art/living-book.webp` contains a consistent illustrated cast and an open-book vignette cropped from a newly generated concept sheet (generation `dd5bc09e-7431-469f-bf43-fe02ca0ec500`). It is newly generated illustrative artwork, not the original book cover, authenticated author portraits, or an illustration of a particular ending. Only the unlettered art regions are used; mockup text, imaginary works and invented story passages are excluded.

The compressed atlas is 324 × 240 pixels and uses a logical 432 × 320 layout: three 144 × 176 cast panels on top and a 432 × 144 book vignette below. Cast images are intentionally shown at modest print-portrait sizes rather than as full-bleed photography. Language entry uses only the neutral book vignette. Catalog and introduction use the triptych; the reader contains no narrative images. Endings use a neutral branching ornament, not an image that invents the player's fate.

The branching mark and favicon are project-authored SVG geometry. Paper is a CSS surface, not a large downloaded texture. Artwork never carries a necessary control or choice. No font files or third-party font requests are included.

## Interface rules

- Resolve language before revealing the catalog, even on a deep link.
- Keep the canonical story text and graph unchanged. No abridgment.
- Preserve the single `/` endpoint, ordinary links, no JavaScript, no database.
- Keep source credit and the spoken attribution available as actual HTML. Agent guidance is human-readable, not hidden instructions.
- Never fabricate history at an ending: the current URL identifies position, not the path taken.
- Body text: system serif stack; controls: system sans stack. Reader width: 44rem.
- Large text, visible keyboard focus, 48px main controls, reduced-motion support, responsive 1-column layout.
- Main colors: paper #F4EFE5; bright paper #FBF8F1; ink #201C18; muted #645D54; wine #743D3D.

## Verification references

https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum

The test suite checks selected requirements; it is not a certification of complete WCAG conformance, machine translation quality, or worldwide copyright status.
