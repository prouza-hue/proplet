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
