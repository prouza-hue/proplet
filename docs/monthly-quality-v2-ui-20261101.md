# Měsíční skóre v2 — UI a izolovaný náhled

Datum: 1. 11. 2026. Pracovní větev: `codex/monthly-score-v2`; výchozí SHA `6cfca03e8d789115f6d5d68299f42f22b4e80cb4` (produkční v4.10.1 s patrony). Tento záznam popisuje implementaci a místní ověření, nikoli produkční nasazení.

## Zobrazení

Stávající měsíční obrazovka zachovává Tiskařskou dílnu, Fraunces, navigaci a detaily odznaků. Osobní skóre má maximum 2 500 a dvě položky: Denní výzvy 2 000 (80 % maxima), další hraní 500 (20 %). Rozpis uvádí vybraných 20 dnů, čtyři serverem dodané složky denního skóre a získané herní XP. Neověřený čas se výslovně označuje. Veškeré body, jejich rozpad i rozhodující shoda přicházejí ze serveru; klient je nepočítá z místního postupu ani celoživotních XP.

Pravidla popisují způsobilá první dohrání ostatních desek, strop 6 000 XP / 12, zaokrouhlení na desetinu a vyloučené odměny. Přehled i novinkové oznámení již nepoužívají stará pravidla 100/120, 2 400 bodů, rychlost nerozhoduje nebo konečná společná místa 1–1–3. Čas konce měsíce a uzávěrky čerpáme z API. Úplná průběžná shoda má hvězdičku, vysvětlení čekajícího losu a nemá obrázek přislíbené ceny. Finální výsledek rozlišuje rozhodnutí uloženým losem.

Dnes, herní deska, geometrie hry, patroni a XP ekonomika se touto UI změnou nemění.

## Ověření

Prošly `node tests/current/test_monthly_competition_ui.cjs`, `node tests/current/test_release_news.cjs` a `node tools/studio-preview/verify.cjs`. První dvě sady jsou již v aktivním manifestu. Ověření zahrnuje skutečné serverové hodnoty, komponenty a neověřený čas, rozhodující čistá řešení, čekající los bez ceny, uzávěrku, konečný los, stávající změny účtu a závody odpovědí i původní chování oznámení.

Nativní aplikace běžela přes existující izolovaný Studio náhled na `http://127.0.0.1:8892/?open=monthly&monthlyCase=ready`. Varianty `provisional`, `ties`, `closed` používají stejnou API smlouvu. Jde pouze o jasně označené syntetické hráče, nikoli data či zápis produkční soutěže. Hraní ani výsledky v produkci se neprováděly.

CUA ověřilo skutečný DOM na mobilu 390 × 844 a Fold 344 × 882: šířka dokumentu 375 a 329 px, žádné vodorovné přetečení osobního skóre, rozpisu, pořadí či záhlaví. Otevřel se skutečný rozpis dnů, pravidla ukázala konec 1. 12. 00:00 a uzávěrku 3. 12. 00:00. Čekající shoda neměla odznak; konečný výsledek otevřel skutečný detail Krále listopadu a po zavření vrátil fokus na původní tlačítko. Konzole neměla chyby. Dočasný mobilní rozměr byl po kontrole zrušen.

Otevřený bod: snímky a vizuální kontrola root agentem. CUA v podřízeném agentovi vracelo „Unable to capture screenshot“ a viditelnost odmítlo jako nepodporovanou v subagentovi; DOM a rozměrové kontroly nejsou náhradou vizuální kontroly. Produkční nasazení, cache/release bump a úplný integrační gate koordinuje root agent.

## Koordinovaný balíček v4.10.2

Na pokyn root agenta jsou kanonická a runtime verze 4.10.2; aplikace i service worker používají `proplet-v4.10.2-monthly-quality2`. App/theme URL má token `41002monthly-quality2`, runtime metadata `41002`. Změněný měsíční modul, jeho CSS a novinkový skript mají token `monthly-quality2`. Ostatní URL v shellu se nezměnila (přesně šest náhrad); offline index obsahuje odpovídající aktuální zdroje. Patroní skripty, CSS, obrázky a všechny ostatní assety zůstaly zachované.

Prošly `test_release_contract.py`, `test_monthly_sw_install.cjs`, `test_patron_release_package.py`, měsíční UI i release-news testy. Izolovaný preview byl znovu sestaven 1. 11. 2026 v 00:40 UTC a prošel kontrolou izolace i přesné kopie současných herních souborů. Neproběhl commit, push ani produkční nasazení. Vizuální kontrolu a širší integrační ověření stále koordinuje root agent.

## Kompatibilita již uzavřených měsíců

Výslovná serverová verze `scoringVersion: 1` nebo `rulesVersion: monthly-basic-v1` zachovává historické maximum 2 400, denní pravidla 100/120 a společná umístění v osobním přehledu, pravidlech, rozpisu i poznámce k odznakům. Platí také pro přechodný stav před aktivací v2. Samotná URL ani výše bodů stará pravidla nezapne. Test ověřuje oba serverové příznaky, potlačení případných přidaných v2 polí i správný návrat na v2 po nové serverové odpovědi.
