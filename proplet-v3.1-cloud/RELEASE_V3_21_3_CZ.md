# Proplet v3.21.3 — Orientation Safety Hotfix

## Shrnutí

Po reálném smoke testu na Samsung Galaxy Z Fold 7 se ukázalo, že rozlišení telefonu, tabletu a rozloženého foldable zařízení nelze dostatečně spolehlivě odlišit jednoduchou viewport heuristikou. Guard zavedený ve v3.20.2 a dále upravovaný ve v3.21.1 proto mohl na rozloženém Fold 7 nesprávně zablokovat celou hru.

v3.21.3 tento zdroj regresí odstraňuje místo dalšího zpřesňování heuristiky.

## Změny

- odstraněn landscape blocker a jeho DOM/CSS,
- odstraněna klasifikace „telefon vs tablet“ pro účely blokování hry,
- orientace už nikdy sama nepozastavuje herní čas,
- `resize`, `orientationchange`, `visualViewport.resize`, `ResizeObserver` a podporovaný `devicePosture.change` dál přepočítávají velikost desky,
- `/api/health` nově vrací `orientationBlocking: false` a `foldResponsiveReflow: true`.

## Bezpečnost obsahu

`data/puzzles.json`, `public/puzzles.json` i `SUPABASE_MIGRATION_V3_21.sql` jsou bitově identické s v3.21.2.

## Produktové rozhodnutí

Na extrémně nízkém landscape telefonu může být deska menší než v portraitu, ale hra zůstává dostupná. To je preferováno před rizikem, že orientační heuristika zablokuje tablet nebo Fold.
