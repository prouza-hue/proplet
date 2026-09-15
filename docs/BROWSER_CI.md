# Prohlížečová CI kontrola auditních oprav

## Co se změnilo (A05)

Workflow `Printshop browser smoke` již nečte pevný alias staré větve. Pro každý relevantní pull request sestaví frontend ze skutečného checkoutu a spustí jej na loopback serveru. `EXPECTED_SHA` musí odpovídat checkoutu i identitě serveru. Test nečinnosti navíc porovná bajty HTML, aplikace, SW, inicializace tématu a vygenerovaného bootstrapu s místními soubory a uloží jejich SHA-256.

U události `pull_request` se testuje GitHubem připravený merge commit, nikoli samostatný head větve. To odpovídá výchozímu checkoutu a `github.sha`; jde o záměrný test kandidáta ke sloučení. Viz [dokumentace událostí GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

Nejde o ověření běžícího Vercel deploymentu. Síťová konfigurace Vercelu, produkční cache, tajné proměnné a skutečný Supabase backend vyžadují samostatný integrační test.

## Bezpečné a reprodukovatelné prostředí

- Server `tools/browser_fixture_server.cjs` poslouchá pouze na `127.0.0.1`.
- Nemá databázový klient ani přeposílání požadavků. Zápisy vracejí 503; neznámé API endpointy také.
- `tests/fixtures/browser/` obsahuje veřejnou herní desku a konfiguraci syntetického hosta. Push je vypnutý, prostředí označené jako preview; žádné klíče ani hráčské účty.
- `/api/health` výslovně uvádí `isolatedFixture: true`, `database: false` a skutečné Git SHA. Není to falešný důkaz zdraví databáze.
- Testy odmítnou jiný než loopback cíl. Výsledky a CPU profil obsahují syntetický stav, nikoli přihlášené hráče.
- Python i Node používají Playwright 1.57.0. Chromium se instaluje explicitně v CI, viz [doporučený postup Playwright](https://playwright.dev/docs/ci).

## Spuštění lokálně

Z kořene repozitáře:

```text
python tools/generate_puzzles_bootstrap.py
node tools/browser_fixture_server.cjs
```

V druhém terminálu nastavte `EXPECTED_SHA` na výstup `git rev-parse HEAD`, `TEST_URL=http://127.0.0.1:8765`, `PLAYWRIGHT_MODULE` na nainstalovaný Node modul Playwright, případně `CHROME_PATH` na místní Chrome. Pak:

```text
python tools/test_printshop_browser.py
node tools/test_idle_offline_browser.cjs
```

Pro Python je potřeba `playwright==1.57.0`. Bez `CHROME_PATH` nainstalujte příslušný Chromium přes `python -m playwright install chromium`. `RESULT_PATH` určuje JSON nečinnosti, `SMOKE_OUT` adresář screenshotů. Výchozí CI hodnoty jsou v `artifacts/`, který Git ignoruje. Generovaný bootstrap je buildový výstup; jeho změnu necommitujte.

## Co blokuje regresi a co je pouze měření

**Tvrdé invarianty:** shoda verze/souborů; načtení a navigace; žádné neošetřené chyby stránky; žádné opakované renderování fráze či odstraňování výsledkové třídy v klidu; žádné opakované stahování herní banky během klidových oken; platný tah odhalí slovo; změny viewportu zachovají odhalení bez horizontálního přetečení; opuštění hry a 20 cyklů nevytvoří další renderování; offline načtení má herní banku.

**Diagnostické hodnoty:** 3 × 60 sekund času hlavního vlákna, JavaScriptu, layoutu, stylů, počtu DOM uzlů a JS heapu; seznam požadavků během každého okna; oddělený 10s sampling profil. Na hlučné časy sdíleného CI stroje není navázán univerzální procentní limit CPU. Test netvrdí stabilizaci paměti po GC ani automatickou detekci všech typů úniků.

Před měřením se vyvolá a přes UI odmítne nabídka pomocníka. Posune se pouze čas posledního pokroku pro přípravu scénáře. Během měření nesmí zůstat otevřený dialog. Mobilní/Fold rozměry jsou emulované viewporty, ne fyzická zařízení.

## Ověření skutečného deploymentu

Lokální úspěch workflow skriptů není potvrzením běhu na GitHub runneru ani Vercelu. Preview musí obsahovat testovaný commit. Před testy výsledků, účtů a konfliktních zápisů ověřte, že používá oddělený Supabase projekt se syntetickými daty; samotný preview alias izolaci nezajišťuje.
