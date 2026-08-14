# Proplet v3.21 — QA report

## Release gates

**PASS**

- Python syntax (`server.py`)
- JavaScript syntax (`public/app.js`)
- HTML bez duplicitních ID
- CSS parser bez chyb
- všechny DOM ID používané v `bind()` existují
- `data/puzzles.json == public/puzzles.json`
- starter má 25/25 políček přesně pokrytých čtyřmi slovy
- MRAK / JABLKO / ČOKOLÁDA / AUTOBUS mají každý právě jednu ortogonální cestu
- existující `free`, `daily`, `rescue`, `legacyFree`, `legacyDaily` jsou proti v3.20.2 kanonicky identické
- starter výsledek server přijme a 10 XP vyplatí pouze jednou
- starter XP se nezapočítá do `totalCompleted`, Daily streaku ani Clean statistik
- starter produktové eventy jsou povolené
- account nudges 1 / 4 / 10 beze změny
- pause při hidden/focus beze změny
- Rescue offer beze změny
- Daily replay beze změny
- Free globální leaderboard / first-attempt fairness beze změny
- v3.16 migration regression suite: 14/14 PASS

## Fold7 vizuální QA

Použité modelové CSS viewporty vnitřního displeje:

- **984×1092** portrait → tablet layout, PASS
- **1092×984** landscape → tablet layout, bez portrait guardu, PASS

Model složeného telefonu:

- **1260×540** landscape → portrait guard, PASS

Na vnitřním layoutu:

- deska a ovládání jsou vedle sebe,
- herní tlačítka mají 44 px výšku,
- starter 5×5 má velkou čitelnou plochu,
- layout nevyžaduje scroll.

Referenční fyzická specifikace Fold7: 8" vnitřní displej 2184×1968. Vizuální test používá veřejně uváděný přibližný CSS viewport 984×1092 jako konzervativní model; finální fyzický smoke test je vhodné udělat přímo na zařízení.

## Známé omezení testovacího prostředí

Chromium v tomto prostředí blokuje navigaci na localhost policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). Vizuální QA proto proběhla injekcí stejného `index.html`, `styles.css`, `app.js` a `puzzles.json` přímo do headless Chromium bez síťové navigace. Produkční backend/Supabase je potřeba po deployi ověřit přes `/api/health` a krátký smoke test.
