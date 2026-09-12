# Tiskařská dílna — complete collection

Art direction: sculptural painted letterpress objects, saturated cobalt/vermilion/jade/gold/plum, upper-left highlights and dark dimensional planes. Categories share a drawing language, not a universal badge frame. Existing approved twelve illustrations are immutable.

Built-in ImageGen: one 5×2 playful avatar sheet, two 4×4 rank sheets, four 5×4 achievement sheets, one 6×3 speed/rescue/loyalty/symbol sheet. Eight calls total, no regenerated alternatives. Exact generated source filenames, SHA256 and row-major cells are in provenance.json. The original prompts are preserved in the creation conversation.

Production files: public/rewards/printshop and public/assets/avatars/v3. No base64/raster embedded in SVG. VTracer 0.6.15, color precision 6, stacked spline paths, speckle 1, layer difference 8, path precision 3. Native raster tracing avoids inventing interpolated detail through pre-upscaling. Collection extraction uses connected components on whole sheets so silhouettes are not cut at grid boundaries. Avatar backgrounds and illustrations are traced together; no recoloring filter.

The scripts are asset preparation recipes expecting original source sheets under the sibling generated_images directory. They do not run during application build. `integrate.py` records the one-time integration; do not rerun it on an already-integrated checkout.

Validation: test_ribbon_assets.py checks full 142-key coverage, true paths, immutable approved illustrations and gameplay files. test_avatar_optical_sizing.py checks stable old IDs plus full circular bounds. Gallery exposes real 24/32/40/64 pixel sizes on light/dark surfaces.
