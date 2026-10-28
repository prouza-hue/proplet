# Měsíční soutěž — předání 28. 10. 2026

Pracovní větev `codex/monthly-competition-202611` vychází ze schváleného no-scroll UI `27e7204dfce5e7743ebf19b1eb2a834b5a817a83`. Produkce byla ověřena přes Vercel jako `1de738938ff244fc010808daf33aea7def4b6481`, deployment `dpl_5Z5Eu9YBNZRRGHSEWJM837jpAVac`. Běžící playtest je nadále `27e7204`, deployment `dpl_H83oCtJQ3u7mhUWAQYbvvngF4KTZ`. Tyto větve ani prostředí se nemění.

## Rozhodnutí a rozsah

Nový no-scroll design je závazný základ. Měsíční soutěž je čtvrtý pohled Pořadí. Dnes ani deska se nepřestavují. Pravidla 100 + 20 bez nápovědy, nejlepší dvacítka, nejvýše 2400, společná místa 1–1–3 a odznaky všem na místech 1–3 navazují na `docs/design/archive-first-release-2026-10-13.md` a předání z 27. 10. Měsíc je kalendářní v Europe/Prague; 48 hodin po konci slouží kontrole a reklamacím.

Dosud není schválena hranice pozdní offline synchronizace a postup opravy po uzávěrce. Implementace ověřuje oba možné limity přijetí (`month-close`, `review-close`), ale žádný automaticky neaktivuje. Výchozí DB settings mají `enabled=false`, `rules_approved=false`, `late_sync_policy=null`. Administrátorská revize již uzavřeného měsíce není implementována. Nejde o potvrzení připravenosti k produkčnímu spuštění.

## Implementované části

- Evidence soutěžních dnů vzniká ve stejné transakci jako potvrzený atomický výsledek. Vyžaduje shodu oficiálního výsledku, puzzle run a dokončeného result command; nečte klientský součet ani analytické události. Platí pouze základní `daily:YYYY-MM-DD` dokončené v den vydání.
- Nejlepší dvacítka a společná místa se počítají v SQL. Uzávěrka používá měsíční transakční lock, uchovává konečný snapshot a idempotentní odznaky v samostatné tabulce. XP, série, referral a týmy se nemění.
- Změna či odmítnutí potvrzeného výsledku před uzávěrkou přepočítá evidenci. Již uzavřený snapshot se nemění.
- Explicitní `proplet_reconcile_monthly_competition_v1(month)` doplní platné výsledky při aktivaci či obnovení evidence před uzávěrkou. Po uzávěrce odmítá rekonstrukci historického stavu.
- GET `/api/competition/monthly?month=2026-11` používá stávající přihlášení a anonymizaci pořadí. Veřejné odpovědi neobsahují UUID hráčů. Zobrazuje nejvýše první stovku a vlastní výsledek; UI toto omezení přiznává. Osobní odpovědi jsou `no-store`.

## Preview a izolované scénáře

Samostatná preview větev přijme pouze URL `https://eanzztstmwlamwfdskbf.supabase.co` a vlastní proměnnou `PROPLET_MONTHLY_TEST_KEY`. Produkční `SUPABASE_SECRET_KEY` se v ní nepoužije. Proměnná musí být citlivá, pouze Preview, pouze tato větev. Produkční přepínač `PROPLET_MONTHLY_ENABLED` je výchozně vypnutý.

Supabase branching není dostupný na současném tarifu. Existující testovací projekt byl obnoven, ale při práci zůstal nedostupný (`COMING_UP`). Konektor neumí získat jeho tajný klíč; na dálku nebylo změněno schéma ani hráčská data. Online skutečný backend proto není ověřen. Je nutné bezpečně nastavit testovací klíč, ověřit obnovený projekt, jeho obsah a aplikovat chybějící migrace pouze v něm.

Preview nabízí odkazy `?open=monthly&monthlyScenario=upcoming`, `empty`, `under20`, `over20`, `ties`, `provisional`, `closed`. Jde o výslovně označené **read-only snapshoty syntetické místní PostgreSQL**, nikoli o živé online výsledky. Průběžné stavy mají říjnové datum testu. API tyto scénáře poskytuje pouze přesně vymezené preview větvi nebo výslovnému místnímu QA; produkce vrací 404. Bez `monthlyScenario` se používá skutečná cesta a dostupnost backendu se přiznává.

## Ověření

Skutečný PostgreSQL 17.11 na `127.0.0.1:55432`, čerstvá databáze `proplet_test_monthly_9fe9cb78de`, pouze syntetická data: devět skupin ověření zahrnuje RLS, prázdnou sezónu, aktivaci/dopočet, osm souběžných doručení, nejlepší dvacítku z 25 dnů, čisté a asistované dokončení, opakování, nesoutěžní režimy, pražskou půlnoc, opravy/odmítnutí, oba offline limity, přesnou hranici 48 hodin, osm souběžných uzávěrek, společné odznaky a nulový dopad na XP. Existující týdenní `pg_cron` migrace byla v lokálním Windows testu výslovně vynechána kvůli chybějícímu rozšíření; měsíční finalizer běžel skutečně. Vzdálený automatický scheduler není ověřen.

Adaptér má šest testů; HTTP test chrání aktivaci, identitu, autentizaci uzávěrky, zákaz produkčního připojení a osobní cache. Browser QA ověřuje světlo/tmu, 320 a 390 px, zavřený Fold 344×882 / 882×344, otevřený 768×1024 / 1024×768 a desktop 1440×900. Jde o Chromium emulaci, ne fyzický Fold. Síťové zápisy a externí požadavky byly při syntetickém browser QA blokované. Důkazy jsou ve složkách `../monthly-evidence` a `../monthly-evidence-20261028`.

## Postup listopadového spuštění — dosud neprovedeno

1. Rozhodnout offline limit a opravy po uzávěrce; zapsat konečné schválené pravidlo. Dokončit skutečné izolované online propojení a integrační ověření od dokončení přes API po evidenci a odznak.
2. Znovu ověřit aktuální main, produkční SHA a souběžné opravy. Sloučení no-scroll vzhledu a nasazení vyžaduje samostatné oprávnění; tento PR se neslučuje.
3. Po autorizaci nasadit schéma `supabase/migrations/20261028003751_monthly_competition.sql`. Přezkoumat jeho checksum v manifestu. Migrace nechává soutěž vypnutou a nenastavuje žádná produkční testovací data.
4. Ještě před **1. 11. 2026 00:00 CET** nastavit DB `enabled=true`, `rules_approved=true`, schválené `late_sync_policy`, `launch_month='2026-11-01'`, `isolated=false`, `preview_now=null`. Zavolat reconciliation pro listopad (před sezónou bezpečně prázdná). Změny a výsledek ověřit.
5. Zapnout produkční `PROPLET_MONTHLY_ENABLED=true` až po ověření databáze, UI a odměn. V produkci nikdy nenastavovat `PROPLET_MONTHLY_TEST_KEY` ani testovací čas. Ověřit autentizaci cron route a její spuštění bez zveřejnění tajných hodnot.
6. Přidaný Vercel cron `0 23 * * *` volá `/api/cron/monthly-competition` pouze na produkčních deploymentech. V listopadu odpovídá požadované uzávěrce **3. 12. 2026 00:00 CET** (`2. 12. 23:00 UTC`). Po změně letního času může běžet hodinu po přesné hranici; příjem soutěžních změn přesto SQL zastaví přesně na hranici. Scheduler a případné limity tarifu ověřit před aktivací. Ostatní push cron položky se nemění.
7. Po uzávěrce ověřit snapshot, všechny shodné vítěze, jedinečnost odznaků a opakované spuštění s `finalized=0`.

## Rollback

Vypnout `PROPLET_MONTHLY_ENABLED` a případně vrátit předchozí ověřený deployment. DB evidenci ponechat zapnutou: umožní bezpečné znovuzobrazení bez ztráty soutěžních dnů. Neodstraňovat výsledky ani tabulky. Pokud je nutné vypnout i DB evidenci kvůli závadě, před obnovením použít reconciliation pro dotčený otevřený měsíc a ověřit ji před uzávěrkou. Po uplynutí uzávěrky je nutné samostatné rozhodnutí o opravě; žádný automatický přepis konečného pořadí není povolen. Produkční data ani nasazení se v tomto úkolu neměnily.
