# Card Generator

Fully client-side ID-card / BahnCard-style image generator. Nothing leaves the browser.

- Pick a layout preset, set a background (colour, gradient / stripes, uploaded or URL image),
  edit every text, drag layers on the preview, download front/back/both as PNG/JPEG/WebP.
- The URL fragment (`#s=…`) always holds the current state, so copying the address shares the
  card. `?preset=<id>` opens a preset fresh. Uploaded images are never put in the link.

## Presets (`presets.json`)

Each preset has a `group` (dropdown heading), `width`, `height`, `radius`, a default `font`, Google Fonts `fonts` to load and
`sides.front` / `sides.back`, each with a `background` and ordered `layers`. Layer types are
`text`, `rect` and `image`; the `_schema` block at the top of the file lists every property.
A preset may `extends` another one and only supply what changed: `sides` (replace a whole side),
`background` (per side), per-layer `overrides` (changed fields only) and extra `layers` (appended).
"Export current as preset" in the UI produces a ready-to-paste preset.

Texts may contain variables, resolved when the card is drawn: `{{date}}` (today), `{{date+1y-1d:DD.MM.YY}}`
(offsets in `d`/`m`/`y`, format from `DD`, `MM`, `YYYY`, `YY`) and `{{random:4}}` (digits). Random digits
come from a seed stored in the card state, so a share link reproduces them and "Reset" rolls new ones.

## Development

Plain ES modules under `src/`, typed with JSDoc and checked by `tsc` (`checkJs`, strict). Pure logic
(presets, state, share links, helpers) has Node tests under `test/`; rendering and the DOM are verified
by looking at the page.

```bash
npm install      # TypeScript only, for the type check
npm run verify   # tsc --noEmit + node --test
```

Serve the repository root over HTTP (for example `python3 -m http.server`) and open `tools/card-gen/`;
`presets.json` is fetched, so `file://` does not work.
