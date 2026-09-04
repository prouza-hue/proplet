# Proplet Avatar SVG v2

Final production SVG asset set for the warm-paper avatar redesign.

- 30 standalone SVG files: 15 forest animals + 15 craft avatars.
- Canonical master viewBox: `0 0 64 64`.
- Designed for UI rendering at 24 / 32 / 40 px.
- Transparent outside the circular medallion.
- No external fonts, raster images, filters, or runtime dependencies.
- Dark charcoal outlines and the warm Proplet palette are embedded in each SVG.
- The asset filenames and Czech labels are mapped in `manifest.json`.

## Integration

Assets live at:

`public/assets/avatars/v2/`

At runtime they are served as:

`/assets/avatars/v2/<file>.svg`

Use `manifest.json` as the authoritative name-to-file mapping.

This branch is intentionally asset-only and was branched from `ux/warm-paper-refactor`.
