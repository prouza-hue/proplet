# Tiskařská dílna — preview

Based on ux/propletene-stuhy / 735ecf0cf607f3ad89a410fa03cdc3ace6c211ed.
Approved scope: 30 new avatar illustrations + 12 reward pilots and surrounding UI.
Production and gameplay rules/geometry/type/animation remain untouched.

Avatars retain all existing IDs/names. New v3 assets have normalized circular bounds;
the old per-character two-layer focus zoom is removed. SVG shape data is unchanged.
Rewards use a presentation-only identity map; unmapped rewards keep their original art.
The 12 new motifs use one shared SVG in both themes, preserving natural pigment colors.
Theme contrast comes from surrounding surfaces. No game r-* tokens are modified.

SVG cleanup is structural only: comments, whitespace and empty attributes. No coordinate
rounding, path simplification or curve conversion. Files are external lazy-loaded images,
not an inline sprite or an eagerly precached collection. Actual device performance still
needs Pavel's phone/Fold check before any production promotion.

Review gallery: /design/tiskarska-dilna.html

Verification: stable avatar ID map and normalized medallion bounds; existing ribbon
catalog and 572 old assets unchanged; existing interaction and daily progression tests;
all 42 master path geometries/colors/transforms preserved by structural optimization.

## Complete collection update

- All 142 catalog entries now resolve to faithful printshop SVG: 35 ranks, 90 achievements, 10 loyalty badges, 3 medals, 4 context symbols.
- The old public ribbon asset directory is removed; the previous reward gallery redirects to the current collection.
- Ten playful avatars append IDs 31–40. First 30 IDs, files and persisted tokens remain unchanged. The unicorn uses a distinct token so it cannot remap the older legacy unicorn token.
- Gameplay CSS, board/input/hints modules and printshop surrounding UI CSS are byte-identical to baseline 2ed41e5.
- Raster masters were generated in eight sheets total (one avatars, seven rewards). Native-resolution VTracer tracing preserves source illustration rather than redrawing simplified vector stand-ins. No embedded raster in SVG.
- Assets load lazily as external images. Gallery filters defer assigning image URLs for unopened families. Artwork is intentionally not service-worker precached.
- Preview only. No production merge, database migration, economy or reward predicate changes.
