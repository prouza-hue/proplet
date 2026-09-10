# Difficulty icons — Printshop

Five original identities redrawn with the built-in image generation tool. Final transparent WebP assets live in public/difficulty/printshop (512 square; 12–21 KB each). Original occupied dimensions preserved inside the existing UI boxes. No component CSS, labels, rules or game state changed.

References:
- easy: original green diagonal leaf + rewards/printshop/calm.svg painted leaf.
- medium: original two blue snowy peaks + achievement-hard-25.svg painted surfaces/edges.
- hard: original orange/yellow flame + achievement-hc-10.svg painted fire.
- hardcore: original pink-crimson one-eyed horned face + achievement-hc-1.svg toothy mischievous monster and calm.svg brushwork. Retains one eye and pink horns rather than importing purple brain anatomy.
- mozkomor: original purple spiral disc + achievement-hc-25.svg sculpted spiral/ink planes.

Generation prompt set (shared art direction): one isolated production icon, preserve identity, silhouette and color family from original; hand-painted tactile Czech indie printshop illustration, sculpted ink color planes, subtle angular brush marks, uneven integrated dark edge and warm highlights; readable at 32px, no text, props or badge. Solid white background for deterministic export; edge-connected background removed and originals preserved. Export normalized to the original SVG's occupied dimensions, 512px transparent WebP.

Subject prompts:
- easy: one green diagonal leaf with clear central vein, emerald shadows and grass-green planes; no ribbon.
- medium: two triangular snowy blue peaks, small left and tall right, common horizontal base; no scenery.
- hard: upright three-tipped orange flame, tallest central tongue, broad rounded base and pale-yellow heart; no torch or external sparks.
- hardcore: oval pink-crimson cyclops, one large ivory eye looking slightly sideways, short pink pointed horns, crooked sharp-toothed grin; manic, mischievous, comically dangerous; no brain, body, arms or second eye.
- mozkomor: near-circular purple disc, thick lavender inward spiral, ivory center and slanted upper marks; no shell, horns or galaxy.

Only asset paths and cache-release stamps changed in the application. Temporary frame pages are used for responsive browser inspection of the real application and removed afterward; tools/difficulty-qa retains the local harness.

Verification: deployed real UI inspected in Cloud Chrome on desktop and in 390×844 and 760×844 srcdoc viewports. All five loaded at the existing 40×40 card size; checked top and lower mobile cards, locked Mozkomor, and smaller Dnes shortcuts/weekday icons. Source diff changes no layout CSS or gameplay. Transparent export also inspected against dark paper. Temporary public QA files removed after review. Viewport simulation is not a physical Samsung device test.
