# Měsíční soutěž — předání 28. 10. 2026

Pracovní větev `codex/monthly-competition-202611` vychází ze schváleného no-scroll UI `27e7204dfce5e7743ebf19b1eb2a834b5a817a83`. Produkce byla ověřena přes Vercel jako `1de738938ff244fc010808daf33aea7def4b6481`, deployment `dpl_5Z5Eu9YBNZRRGHSEWJM837jpAVac`. Běžící playtest je nadále `27e7204`, deployment `dpl_H83oCtJQ3u7mhUWAQYbvvngF4KTZ`. Tyto větve ani prostředí se nemění.

## Rozhodnutí a rozsah

Nový no-scroll design je závazný základ. Měsíční soutěž je čtvrtý pohled Pořadí. Dnes ani deska se nepřestavují. Pravidla 100 + 20 bez nápovědy, nejlepší dvacítka, nejvýše 2400, společná místa 1–1–3 a odznaky všem na místech 1–3 navazují na `docs/design/archive-first-release-2026-10-13.md` a předání z 27. 10. Měsíc je kalendářní v Europe/Prague; 48 hodin po konci slouží kontrole a reklamacím.

Uživatel 28. 10. 2026 výslovně schválil pravidlo `review-close`: dokončení musí vzniknout v den vydání a server ho musí přijmout před uzávěrkou 48 hodin po konci měsíce. Před uzávěrkou se opravené výsledky přepočítají a odmítnuté vyřadí; po ní se pořadí i odznaky mění pouze výslovnou administrátorskou opravou. Schválení pravidla je oddělené od aktivace soutěže: `enabled=false` zůstává zachováno. Původní záznamy testů s nepotvrzenou politikou dokládají dřívější stav. Propojení veřejného online API zůstává nedokončené.

## Implementované části

- Evidence soutěžních dnů vzniká ve stejné transakci jako potvrzený atomický výsledek. Vyžaduje shodu oficiálního výsledku, puzzle run a dokončeného result command; nečte klientský součet ani analytické události. Platí pouze základní `daily:YYYY-MM-DD` dokončené v den vydání.
- Nejlepší dvacítka a společná místa se počítají v SQL. Uzávěrka používá měsíční transakční lock, uchovává konečný snapshot a idempotentní odznaky v samostatné tabulce. XP, série, referral a týmy se nemění.
- Změna či odmítnutí potvrzeného výsledku před uzávěrkou přepočítá evidenci. Po uzávěrce běžné doručení snapshot nemění; explicitní administrátorská oprava používá samostatný auditovaný příkaz.
- Explicitní `proplet_reconcile_monthly_competition_v1(month)` doplní platné výsledky při aktivaci či obnovení evidence před uzávěrkou. Po uzávěrce odmítá rekonstrukci historického stavu.
- GET `/api/competition/monthly?month=2026-11` používá stávající přihlášení a anonymizaci pořadí. Veřejné odpovědi neobsahují UUID hráčů. Zobrazuje nejvýše první stovku a vlastní výsledek; UI toto omezení přiznává. Osobní odpovědi jsou `no-store`.

## Preview a izolované scénáře

Samostatná preview větev přijme pouze URL `https://eanzztstmwlamwfdskbf.supabase.co` a vlastní proměnnou `PROPLET_MONTHLY_TEST_KEY`. Produkční `SUPABASE_SECRET_KEY` se v ní nepoužije. Proměnná musí být citlivá, pouze Preview, pouze tato větev. Produkční přepínač `PROPLET_MONTHLY_ENABLED` je výchozně vypnutý.

Supabase branching není dostupný na současném tarifu. Existující testovací projekt byl obnoven a ověřen: má pouze 12 historických testovacích hráčů, žádné e-maily, auth uživatele ani push subscriptions. Byla aplikována pouze aditivní měsíční migrace, serverová verze `20261028004956`, zdrojový checksum shodný s repozitářem. Při původním ověření byla pravidla nepotvrzená. Po uživatelském schválení byla aplikována aditivní migrace `20261028005634_monthly_admin_corrections.sql` (vzdálená verze `20261028010200`): `rules_approved=true`, `late_sync_policy='review-close'`, ale soutěž stále `enabled=false`, `isolated=true`. Auditované administrátorské opravy prošly vzdáleným rollback testem včetně revize, opakování příkazu, změn odznaků a oprávnění. Důkaz: `release-evidence/monthly-approved-policy-verification.json`. Vzdálený rollback test prošel 65 skutečnými atomickými dokončeními, shodami 1–1–3, uzávěrkou a odznaky; žádná syntetická data nezůstala. Důkazy: `release-evidence/monthly-remote-rollback.sql` a `monthly-remote-verification.json`. Původní schéma je ale ručně upravovaný historický preview stav z 12. října, bez dnešních offline/referral/weekly součástí. Nejednoznačný plošný replay se neprováděl. Konektor neumí získat tajný klíč. Veřejné API preview proto není připojeno ani end-to-end ověřeno; nutné bezpečně nastavit testovací klíč a připravit jednoznačnou aktuální izolovanou schema baseline.

Preview nabízí odkazy `?open=monthly&monthlyScenario=upcoming`, `empty`, `under20`, `over20`, `ties`, `provisional`, `closed`. Jde o výslovně označené **read-only snapshoty syntetické místní PostgreSQL**, nikoli o živé online výsledky. Průběžné stavy mají říjnové datum testu. API tyto scénáře poskytuje pouze přesně vymezené preview větvi nebo výslovnému místnímu QA; produkce vrací 404. Bez `monthlyScenario` se používá skutečná cesta a dostupnost backendu se přiznává.

## Ověření

Skutečný PostgreSQL 17.11 na `127.0.0.1:55432`, čerstvá databáze `proplet_test_monthly_9fe9cb78de`, pouze syntetická data: devět skupin ověření zahrnuje RLS, prázdnou sezónu, aktivaci/dopočet, osm souběžných doručení, nejlepší dvacítku z 25 dnů, čisté a asistované dokončení, opakování, nesoutěžní režimy, pražskou půlnoc, opravy/odmítnutí, oba offline limity, přesnou hranici 48 hodin, osm souběžných uzávěrek, společné odznaky a nulový dopad na XP. Existující týdenní `pg_cron` migrace byla v lokálním Windows testu výslovně vynechána kvůli chybějícímu rozšíření; měsíční finalizer běžel skutečně. Vzdálený automatický scheduler není ověřen.

Nové ověření schválené politiky navíc pokrývá šest souběžných opakování stejného opravného příkazu, šest konfliktních příkazů s jediným vítězem, povinný důvod a provozovatele, neměnný audit a rollback všech změn při selhání auditu. Pozdní offline doručení po uzávěrce zachová dřívější způsobilý příspěvek.

Adaptér má šest testů; HTTP test chrání aktivaci, identitu, autentizaci uzávěrky, zákaz produkčního připojení a osobní cache. Browser QA ověřuje světlo/tmu, 320 a 390 px, zavřený Fold 344×882 / 882×344, otevřený 768×1024 / 1024×768 a desktop 1440×900. Jde o Chromium emulaci, ne fyzický Fold. Síťové zápisy a externí požadavky byly při syntetickém browser QA blokované. Důkazy jsou ve složkách `../monthly-evidence` a `../monthly-evidence-20261028`.

Kompletní místní gate prošel: **201 testů a 536 syntaktických kontrol**. První pokus narazil na Windows konce řádků kontrolovaných obsahových/licenčních souborů; po obnovení kanonických bajtů prošel celý gate bez oslabení testů. Vercel build prošel. Online Chromium ověřilo skutečné GET scénářů (bez interceptování měsíční odpovědi) na mobilu, Foldu a desktopu ve světle i tmě. Důkazy: `../monthly-evidence-online-20261028`.

Preview: https://proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app/?open=monthly&monthlyScenario=over20 — draft PR https://github.com/prouza-hue/proplet/pull/221.

## Postup listopadového spuštění — dosud neprovedeno

1. Pravidlo `review-close` a explicitní administrátorské opravy jsou schválené 28. 10. 2026. Dokončit skutečné izolované online propojení a integrační ověření od dokončení přes API po evidenci a odznak. Uživatel potvrdil, že testovací klíč nastaví a poté dá vědět; tato odpověď sama nepotvrzuje jeho nastavení.
2. Znovu ověřit aktuální main, produkční SHA a souběžné opravy. Sloučení no-scroll vzhledu a nasazení vyžaduje samostatné oprávnění; tento PR se neslučuje.
3. Po autorizaci nasadit v pořadí `supabase/migrations/20261028003751_monthly_competition.sql` a `supabase/migrations/20261028005634_monthly_admin_corrections.sql`. Přezkoumat jejich checksumy v manifestu. Druhá migrace zaznamenává schválené pravidlo; soutěž zůstává vypnutá a žádná produkční testovací data nevznikají.
4. Ještě před **1. 11. 2026 00:00 CET** nastavit DB `enabled=true`, `rules_approved=true`, `late_sync_policy='review-close'`, `launch_month='2026-11-01'`, `isolated=false`, `preview_now=null`. Zavolat reconciliation pro listopad (před sezónou bezpečně prázdná). Změny a výsledek ověřit.
5. Zapnout produkční `PROPLET_MONTHLY_ENABLED=true` až po ověření databáze, UI a odměn. V produkci nikdy nenastavovat `PROPLET_MONTHLY_TEST_KEY` ani testovací čas. Ověřit autentizaci cron route a její spuštění bez zveřejnění tajných hodnot.
6. Přidaný Vercel cron `0 23 * * *` volá `/api/cron/monthly-competition` pouze na produkčních deploymentech. V listopadu odpovídá požadované uzávěrce **3. 12. 2026 00:00 CET** (`2. 12. 23:00 UTC`). Po změně letního času může běžet hodinu po přesné hranici; příjem soutěžních změn přesto SQL zastaví přesně na hranici. Scheduler a případné limity tarifu ověřit před aktivací. Ostatní push cron položky se nemění.
7. Po uzávěrce ověřit snapshot, všechny shodné vítěze, jedinečnost odznaků a opakované spuštění s `finalized=0`.

## Výslovná administrátorská oprava po uzávěrce

Pouze důvěryhodný provozovatel přes služební SQL/RPC, žádný veřejný HTTP endpoint. Nejprve přezkoumat a opravit či odmítnout autoritativní zdrojový výsledek; příkaz nikdy nepřijímá počet bodů. Zkontrolovat aktuální revizi uzavřeného měsíce a dotčený den. Následně zavolat:

```sql
select public.proplet_correct_monthly_competition_v1(
  p_month => date '2026-11-01',
  p_player_id => 'SKUTECNE_UUID_HRACE'::uuid,
  p_day => date '2026-11-05',
  p_expected_revision => 1,
  p_idempotency_key => 'jedinecny-klic-konkretní-reklamace',
  p_operator_ref => 'identifikator-overeneho-spravce',
  p_reason => 'Konkretni dolozeny duvod opravy zdrojoveho vysledku'
);
```

Příklad obsahuje záměrně neplatné UUID a před použitím vyžaduje konkrétní ověřené údaje. Povinný důvod, provozovatel, očekávaná revize a idempotentní klíč jsou součástí auditu. Identický opakovaný příkaz vrací původní potvrzení; konflikt revize se řeší novou kontrolou aktuálního stavu, nikoli slepým opakováním. Jedna transakce přepočítá celý měsíc včetně společných míst a přidání, změny či odebrání odznaků. Uchovává stav před a po opravě v `proplet_private.monthly_corrections`; služební role má k auditu pouze čtení. XP se nemění. Pozdní běžný offline výsledek doručený až po uzávěrce nesmí při opravě zrušit původní včas potvrzený soutěžní příspěvek.

## Rollback

Vypnout `PROPLET_MONTHLY_ENABLED` a případně vrátit předchozí ověřený deployment. DB evidenci ponechat zapnutou: umožní bezpečné znovuzobrazení bez ztráty soutěžních dnů. Neodstraňovat výsledky ani tabulky. Pokud je nutné vypnout i DB evidenci kvůli závadě, před obnovením použít reconciliation pro dotčený otevřený měsíc a ověřit ji před uzávěrkou. Po uplynutí uzávěrky je přípustná pouze výslovná administrátorská oprava se zdůvodněním a auditním záznamem; žádný automatický přepis konečného pořadí není povolen. Produkční data ani nasazení se v tomto úkolu neměnily.
