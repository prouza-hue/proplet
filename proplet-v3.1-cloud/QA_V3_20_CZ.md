# Proplet v3.20 — QA report

**Výchozí stav:** plný cloud balík v3.19.2.  
**Scope:** UX/account sprint; puzzle obsah je zmrazený.

## Automatické kontroly — PASS

- Python syntaxe `server.py`.
- JavaScript syntaxe `public/app.js`.
- HTML parse + unikátnost všech `id` atributů.
- CSS parse bez syntaktických chyb.
- kompletní `bind()` kontrakt: všechny JS prvky navázané přes ID existují v HTML.
- vytvoření účtu bez týmu při zachování původního `family_code NOT NULL` schématu.
- přihlášení účtu bez týmu jménem + heslem.
- kompatibilní přihlášení starého týmového účtu a disambiguace jmenovců.
- interní solo identifikátor se nevrací přes `/api/me` ani jako veřejný tým.
- skutečný starý tým s případným `SOLO_*` názvem není zaměněn za solo účet.
- pozdější přidání / založení týmu a zápis `team_joined_at`.
- account nudges přesně po 1., 4. a 10. unikátním dokončení; starý one-shot stav se bezpečně migruje.
- stage-specific analytics pro 1./2./3. nabídku účtu.
- v3.19.2 rescue nabídka zůstává modal-safe a jednorázová pro daný stav.
- aktivní herní čas se dál pauzuje při hidden / blur.
- globální Free leaderboard zachovává first-attempt fairness.
- Gen2 migrace Free i Daily zachovává staré výsledky a nepřidává druhé XP.

## Obsahová integrita

SHA-256 `data/puzzles.json` ve v3.19.2:

`1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84`

SHA-256 `data/puzzles.json` ve v3.20:

`1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84`

Totéž platí pro `public/puzzles.json`. Puzzle banka je tedy **bitově identická**.

## Co je potřeba ověřit po produkčním deployi

Automatizovaný browser v pracovním prostředí nedovolil navigaci na lokální aplikaci kvůli administrátorské Chromium policy, takže finální vizuální smoke test je záměrně ponechaný na skutečný Vercel deployment.

Doporučený post-deploy test je rozepsaný v `UPDATE_V3_20_CZ.md`: čistý onboarding, účet bez týmu, refresh, tým dodatečně, 1/4/10 nudge, legacy týmový účet, Daily/Free, rescue, leaderboard a `/admin`.
