# Datované Daily — kandidátní technický balíček

Datum přípravy: 5. 10. 2026. Výchozí main/production SHA: `a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db`. Rozsah: 100 dnů 7. 10. 2026–14. 1. 2027, verze `daily-gen6-20261007-v1`. **Balíček není nasazen a není připravený k samostatnému nasazení.** Obsah banky zůstává v soukromém `server-pack.json`; nepatří do tohoto veřejně použitelného kódu.

## Co je implementováno

- `candidate/backend/dated_daily.py`: přesný konečný rozpis datum → bankVersion → puzzleId → contentHash, ověření každého těla, pražské datum a kalendářní půlnoc, výslovný konec bez modulo, odmítnutí neodsouhlaseného manifestu.
- `candidate/backend/daily_runtime.py`: opt-in serverové zapojení, `/api/daily` s jediným vydaným payloadem, zákaz future date/ID/list, zachování původního předcutoverového resolveru a jeho offline kompatibility, singleton official IDs po cutoveru. Klíč výzvy zůstává `daily:YYYY-MM-DD`.
- `candidate/server.py`: úzké zapojení tohoto serverového modulu před sestavením account služeb a lookup nových vydaných desek pro `/api/shared-puzzle`.
- `candidate/tools/project_dated_daily_public.py`: explicit-output projekce stávající veřejné banky; původní pořadí/ID/historie zůstávají stejné, stará budoucí těla od 7. 10. ztrácejí písmena/masku/řešení. Neobsahuje novou banku. Runtime `dailyGeneration`, `contentGeneration`, `freeGeneration` zůstávají 4.
- `candidate/tools/generate_puzzles_bootstrap.py`: při datovaném režimu žádný future prefetch; datum build validity není oprávnění zveřejnit další desky. Nedatovaný stávající režim zachovává původní kontrakt.
- `candidate/public/app/content/daily-dated.js`: cache datum+verze, autoritativní serverToday, concurrent-request deduplication, obnovování vydané hry offline do serverové následující půlnoci, odmítnutí změny identity téhož dne.
- `candidate/public/app/content/progression.js`: po cutoveru pouze serverem vydaný cache binding, žádný návrat ke staré rotaci.
- `integration.patch`: aplikovatelné změny výše vůči připnutému SHA. **Neobsahuje dokončené browserové propojení app.js ani samotnou soukromou banku.**

`DatedDaily.load()` v runtime vyžaduje `status="approved"`; pouhé nastavení `PROPLET_DATED_DAILY_ENABLED=true` kandidátní obsah neschválí. Výrobní pack má nadále `status="candidate"`. Skutečné schválení není součást testového fixture, který jen v dočasném adresáři používá synteticky schválenou kopii.

## Ověření a jeho hranice

`TEST_REPORT.json` a logy uvádějí skutečné provedené kontroly. Python kontraktové testy používají všech 100 finálních kandidátních těl a přesné funkce ze současného `server.py`, vytažené přes AST. Ověřena historie 279 kalendářních dnů 1. 1.–6. 10. 2026: official puzzleId i původní množina přijímaných kompatibilních ID zůstávají stejné. Node ověřuje chování store/progression. Statický guard umí odmítnout nový ID/hash/písmenové pole v JSON, JS a sourcemapě a byl ověřen i úmyslně vloženým leakem.

**Callable adapter test není ASGI test.** FastAPI, httpx a Starlette nejsou dostupné v běžném ani v `CODEX_PRIMARY_RUNTIME_PYTHON`; import skutečného serveru končí `ModuleNotFoundError: httpx`. Test používá malá protocol doubles pro registraci routy, HTTPException a JSONResponse, a nevydává je za skutečnou frameworkovou obsluhu. Úplný current-runtime gate, skutečný Vercel build/routing, databázová souběžnost a browserový průchod nebyly provedeny. Žádné produkční DB zápisy, merge ani deploy neproběhly.

Současná SQL implementace `SUPABASE_MIGRATION_V4_01_38_ATOMIC_RESULT.sql` byla přečtena: `results` zapisuje přes `ON CONFLICT (player_id, challenge_key) DO NOTHING`, existující řádek zamyká `FOR UPDATE` a při Daily generation upgrade nemění již přidělené points. Nové Daily vrací z `puzzle_info` lokální `generation=6`; ostatní generace se nemění. Návrh po cutoveru odmítá přijímat výsledky, pokud není zapnutý stávající atomic-result režim. To je důkaz z kódu; databázový race test stále čeká.

## Zbývající integrační práce

1. Ve skutečném aktuálním checkoutu v `public/app.js` vytvořit store a předat jej `progression().create()`. Při bootu a každém vstupu do oficiální Daily počkat na `/api/daily`; pro Daily řídit datum serverToday. Přidat přiměřený loading/error stav. Neobnovit starý modulo výběr při chybě serveru.
2. Zapojit asynchronní historii v `showDailyResult`, `replayDailyFromWin`, sdílených výzvách a příslušných místech `mergeRemoteAll`. Historické identity musí vycházet z uloženého výsledku/bindingu, ne z přítomnosti staré desky v `puzzleDB.daily`.
3. Při návratu po půlnoci nejprve načíst nový binding; rozehraný starší den ponechat na jeho původním puzzleId. Nepřepsat inProgress ani offline frontu. Dvě zařízení musí dostat stejné ID/verzi/hash.
4. Do `public/index.html` a `public/sw.js` přidat `daily-dated.js` s konkrétní verzí. Změnit shell/data cache jména a migraci starého `/puzzles.json` tak, aby se již nezachovávaly nepoužitelné budoucí Daily payloady. `/api/daily` nesmí používat SW stale-while-revalidate nebo prefetch. Čerstvě vydaný payload ukládá store, nikoli globální SW cache.
5. Release build musí vytvořit veřejnou projekci před bootstrapem a aktualizovat skutečné provenance/`content/generation-manifest.json` výslovným novým input delta. Soukromý pack uložit jen v serverovém bundle na `data/daily_gen6_private.json`; ověřit Vercel output/routy/sourcemapy a spustit `assert_no_private_payload` nad **skutečným** static outputem.

Relevantní současné gate zdroje byly přečteny z `tests/current/manifest.json`: `tools/test_v4002_daily_sync_p0.py`, `tools/test_v4010_gen4_xp_rewards.py`, `tests/current/test_s08b_atomic_result_adapter.py`, `tests/current/test_s12b2_daily_progression.js`, `tests/current/test_s14_content_pipeline.py`. Před release spustit odpovídající gate nad kompletním checkoutem a doplnit ASGI future-date/ID/list probes, nezveřejnění privátního `/data/...`, stale-client a historical-offline průchod, simultaneous/replayed completion na oddělené test DB, history/streak/XP a mobile/Fold/desktop browser průchod. Bez těchto důkazů není release schválený.

## Release a rollback

Před 7. 10. nejprve schválit konkrétní obsahový hash, dokončit browser/build/server propojení a uvedené gate. Nový obsah aktivovat až s approved packem a shodným veřejným date markerem; stará ID nerecyklovat, staré výsledky ani odměny nemazat. `PROPLET_DATED_DAILY_ENABLED` je serverový activation flag, nikoli náhrada schválení. Přechod je pražská půlnoc 7. 10. 2026, tedy 6. 10. 2026 22:00 UTC.

Před cutoverem lze vrátit původní aplikaci bez zásahu do výsledků. **Po cutoveru nesmí rollback vypnout datovaný resolver a obnovit starou budoucí modulo banku.** Vrátit předchozí stabilní UI při zachování vydaného resolveru a stejných date bindings; není-li to bezpečné, oficiální Daily dočasně nedostupná. Vyřešit příčinu vpřed bez přepsání již otevřeného dne, puzzleId, hashů, historie či XP. Zachovat private pack a historická okna i po konci banky pro legitimní offline synchronizaci. Po 14. 1. 2027 chybějící navazující plán znamená výslovně nedostupnou novou výzvu.

## Datové prostředí a reprodukce

Z aktuálního source byly ověřeny production CSP projekt `iopyhluayfszskyqqpuc` a existující isolovaný test projekt `eanzztstmwlamwfdskbf`. Runtime vlastní URL bere z `SUPABASE_URL`; tajné hodnoty nebyly čteny a skutečná DB konfigurace/deployed schema nebyly tímto balíčkem ověřeny.

Lokálně: `python daily-integration/tests/test_dated_daily.py` a `node daily-integration/tests/test_dated_client.cjs`. Python testy očekávají připnuté source kopie v `daily-integration/upstream` a skutečný kandidátní pack/baseline v `daily-work`; tento layout je evidence pracovního balíčku, nikoli nový release layout repozitáře.
