# 4.08.8: illustration sizing and result headings
Base: production 481637038f58d6ddbdb0864b28afc2dc0741ba21 (4.08.7).

## Changes
- Discovery cards used a 32px illustration slot at narrow phone and 600–779px widths, with another 8px lost to padding. Set 56px minimum, 64px otherwise, and remove illustration padding. Applies to difficulty cards, Tajenka, weekly competition and release cards. The six-icon Free card on Today keeps its existing independent layout.
- Remove the large right-hand Archive plaque layout. All Archive entry cards use the common left illustration; the catalogue header has an 80px left illustration.
- Replace the flat inline SVG plaque with a 512px transparent WebP illustration (about 62 KB): six tactile letterpress blocks ARCHIV connected by painted paths.
- Remove the Tajenka polish observer's mutation of #winTitle. It could quote a normal win heading while the shared modal still had its Tajenka class. Solved Tajenka phrase quotations in discovery cards remain intentional; victory headings are solely owned by their renderer.
- Every changed runtime asset has a new URL. Release metadata and service-worker shell advance to 4.08.8. No database, rewards, push or weekly-competition preview code changes.

## Verification
Chromium: mobile 320/353/390, Fold widths 600/768, desktop 1280. Illustration sizes asserted, screenshots inspected, no horizontal page overflow. Daily order, unsolved/solved Tajenka position, progress panel, Archive navigation, both themes, click responsiveness and no client exceptions checked.
The existing 4.07.3 service-worker upgrade regression passes, including activation/reload with persisted completion. A separate 4.08.7 cache check exercises the title-quoting asset under its old URL. Victory texts “Je to tam!” and “Je po něm, nesežral tě!” stay unquoted even with a stale Tajenka result class.
Not a physical-device test.

## Artwork provenance
Built-in imagegen; generated original preserved locally. Deployed asset: public/assets/archive/archive-letterpress-v2.webp.
Prompt: single transparent Archive game icon in Tiskařská dílna style; tactile hand-painted chunky wooden letterpress blocks, golden oak, emerald/deep blue ink and small vermilion accents; six connected tiles A R C / H I V, large raised dark serif letters, beveled edges, compact square silhouette, no small slogan, no plaque, no flat vector.
