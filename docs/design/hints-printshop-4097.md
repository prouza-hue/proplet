# Nápovědy Tiskařské dílny — 4.09.7

Tři finální rastrové ikony vznikly pomocí vestavěného `image_gen` s `transparent_background: true`. Obrázky byly vizuálně ověřeny na světlém a tmavém podkladu; finální WEBP zachovávají alpha kanál (průhledné rohy). Jde o novou malovanou trojici, nikoli SVG náhradu.

| Volba | Motiv | Asset | Velikost |
|---|---|---|---|
| Lehká | Mosazná lupa a jedna sazečská kostka | `public/assets/hints/printshop/gentle-v1.webp` | 384×384, 51 860 B |
| Silnější | Tři propojené zelené kostky | `public/assets/hints/printshop/steps-v1.webp` | 384×384, 26 742 B |
| Odhalit | Rozvinutá mapa celé cesty | `public/assets/hints/printshop/reveal-v1.webp` | 384×384, 38 318 B |

Referencí byl skutečný styl existujících `calm.svg` a `symbol-secret.svg`: malovaný reliéf, smaragdová a mosazná, výrazná silueta. Generované originály byly pouze zmenšeny a převedeny do WEBP; průhlednost ani kresba se ručně nepřemalovávaly.

## Finální prompty

### Lehká

Use case: stylized-concept. Asset type: single production game UI icon, the gentle hint in the Czech word puzzle Proplet's Tiskařská dílna printshop art family. Subject: one antique golden brass magnifying glass leaning across a single deep teal green wooden letterpress type block, the face of the block blank with a simple small engraved dot, no readable letters. Magnifying lens is pale turquoise TRANSLUCENT GLASS so actual transparent negative space shows through, no opaque white lens. The whole object is a clean friendly handcrafted painted relief, chunky beveled wood and brass, tactile gouache brush facets, rich honey gold, forest emerald and turquoise, warm edge highlights and dark ink outlines, slight three-quarter view, bold silhouette legible at 48 px. Match the illustrative polish and chunky painterly surfaces of the viewed leaf/secret-envelope Proplet printshop references. Centered square composition, object occupies 82% with generous transparent margin. Actual fully transparent alpha background around object and through lens holes, no floor, no rectangular plate, no paper backing, no white blobs, no checkerboard, no glow, no cast shadow disconnected from object, no text, no watermark. One icon only.

### Silnější

Use case: stylized-concept. Asset type: a single production hint icon for the Czech word puzzle Proplet's Tiskařská dílna printshop art family. Style: friendly handcrafted painted relief, chunky beveled wooden printing type and antique brass, tactile gouache brush facets, rich forest emerald/turquoise, honey gold edge highlights and dark ink outlines, slight three-quarter view, bold silhouette legible at 48px. Match the viewed Proplet leaf and secret envelope reference's chunky painterly polish. Centered square, object 82% with generous margin. Actual fully transparent alpha backdrop and negative spaces. No floor, no base plate, no paper backing behind motif, no white blobs, no checkerboard, no glow, no detached shadows, no readable text, no watermark, one icon only. Subject: three deep emerald-green square wooden letterpress blocks forming three successive ascending STEPS in a gently bending path, linked by a narrow golden brass strip that follows the steps. Exactly THREE clear blocks, blank faces with a single small gold dot each. Compose a compact appealing three-step path; no magnifying glass.

### Odhalit

Use case: stylized-concept. Asset type: a single production hint icon for the Czech word puzzle Proplet's Tiskařská dílna printshop art family. Style: friendly handcrafted painted relief, chunky beveled wooden printing type and antique brass, tactile gouache brush facets, rich forest emerald/turquoise, honey gold edge highlights and dark ink outlines, slight three-quarter view, bold silhouette legible at 48px. Match the viewed Proplet leaf and secret envelope reference's chunky painterly polish. Centered square, object 82% with generous margin. Actual fully transparent alpha backdrop and negative spaces. No floor, no base plate, no paper backing behind motif, no white blobs, no checkerboard, no glow, no detached shadows, no readable text, no watermark, one icon only. Subject: an elegant small open parchment MAP SCROLL in a slight three-quarter view, cream parchment with two short rolled ends. Across its face a thick turquoise winding route of five connected square printing marks ending in a small golden star. All marks and route fully visible, a complete revealed word path. Parchment is the MAP OBJECT itself and no background plate. Rich teal and honey golden details, no letters or words. No magnifying glass.

## Chování

Modál obsahuje jen nadpis a tři volby s krátkým popisem. Starý eyebrow a vysvětlující odstavce jsou odstraněny. Herní pravidla se nemění: normální nápověda zaznamenává použití i sílu; trénink a Tajenka zachovávají své výjimky. Klávesnice zůstává uvnitř otevřeného modálu, Escape jej zavře a fokus se vrací na původní ovládání bez posunu stránky. První fokus má zavírací tlačítko, aby Enter omylem neuplatnil nápovědu.
