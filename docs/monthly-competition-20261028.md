# Měsíční soutěž — provozní stav a spuštění

Aktualizace 29. 10. 2026. Pracovní větev `codex/monthly-competition-202611`, draft [PR #221](https://github.com/prouza-hue/proplet/pull/221). Samostatné preview vychází ze schváleného no-scroll UI; běžící playtest ani produkce se nemění. Podrobné nezávislé QA zadání je v `docs/monthly-competition-astra-qa-handoff-20261028.md`.

## Prostředí a současné ověření

- Produkce: `hrajproplet.cz`, SHA `84e64aa97928c67e580679090e831c9007b7e5a6` (ověřeno při přípravě 29. 10.), Supabase `iopyhluayfszskyqqpuc`. Bez zásahu.
- Poslední zde zaznamenaný no-scroll playtest (28. 10.): větev `codex/today-one-screen`, SHA `27e7204dfce5e7743ebf19b1eb2a834b5a817a83`. Bez zásahu.
- Měsíční preview: `proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app`, izolovaný projekt `eanzztstmwlamwfdskbf` / `proplet-s08b-atomic-result-test`.
- Integrovaný kandidát `c0b549b21053cf2ffa256a24b78f713573734efd`: runtime gate 202 testů, 179 assetů, 540 syntaktických kontrol a CI prošly. Celý skutečný online průchod následně prošel včetně nejlepších 20 dnů, shod, offline doručení, uzávěrky a odznaků. Finální QA kandidát a přesné důkazy jsou v předání pro Astru.
- Izolovaná databáze byla cíleně doplněna o potřebnou současnou cestu pro historické odměny, offline výsledky a referral čtení. Původních 12 testovacích hráčů, 7 výsledků a 530 XP včetně digestů zůstalo zachováno. Důkazy a přesné aplikované verze: `release-evidence/monthly-isolated-lifecycle-parity.json`.

Důkazem dokončení je skutečný herní průchod; samotný HTTP 200 ani označené čtecí scénáře jej nenahrazují. Veřejný online E2E má PASS a používá skutečné syntetické účty, dodané oficiální desky, nativní herní pipeline, potvrzení API a živé SQL pořadí; bez sázení výsledků do ledgeru. Soukromé tokeny a hesla zůstávají mimo Git.

## Schválené chování

První platné dokončení základní Denní výzvy v den vydání: 100 bodů, dalších 20 bez nápovědy. Nejlepších 20 dnů kalendářního měsíce, nejvýše 2400 bodů. Rychlost ani XP nerozhodují; Extra, Tajenka, volná hra, Archiv, trénink a opakování měsíční body nepřidávají. Shody mají místa 1–1–3 a odznak dostane každý na místě 1–3, bez XP bonusu.

Čas je Europe/Prague. Uživatel 28. 10. schválil přijetí offline dokončení z dne vydání před uzávěrkou 48 hodin po konci měsíce. Před uzávěrkou se opravy/odmítnutí přepočítají, po ní jen výslovná administrátorská oprava s důvodem, provozovatelem, očekávanou revizí, idempotentním klíčem a neměnným auditem. **Listopadové herní období končí 1. 12. 2026 00:00 CET** (`2026-11-30T23:00:00Z`). Následujících 48 hodin slouží jen k přijetí oprávněných listopadových offline výsledků a kontrole. **Uzávěrka je 3. 12. 2026 00:00 CET** (`2026-12-02T23:00:00Z`); doručení přesně na této hranici je již pozdní. Prosincové dokončení do listopadu nepatří.

Odměny jsou původní schválené postavičky Krále, Rytíře a Knížete pro listopad a prosinec. Přesné assety, hlášky a zdroj schválení jsou v `docs/design/monthly-awards-recovery-20261028.md`. Prohlídka kolekce není získaná odměna. Přímé odkazy: `/?open=monthly&panel=awards&collection=2026-11` a `2026-12`.

## Implementace a izolované QA

Body vznikají ve stejné transakci jako potvrzený atomický výsledek; vyžadují oficiální result, run a dokončený command. Klientský součet ani analytické události nejsou zdrojem bodů. SQL počítá nejlepší dvacítku, shody a konečný snapshot. Měsíční lock serializuje zápis proti uzávěrce, odznaky jsou idempotentní. Otevřený měsíc má explicitní reconciliation; uzavřený měsíc mění pouze auditovaný správce.

GET `/api/competition/monthly` respektuje přihlášení, anonymizaci a `no-store`, nevrací UUID soupeřů. První stovka plus vlastní řádek jsou v UI označené. Skutečné izolované výsledky jsou odlišené od parametrů `monthlyScenario=...`, které načítají pouze označené snímky dřívějších SQL testů.

QA čas vyžaduje přesně preview prostředí, měsíční větev, izolovanou URL a soukromý `PROPLET_MONTHLY_QA_SECRET`. Chráněný POST `/api/qa/monthly-control` přijímá pouze `status`, `clock`, `finalize`; žádné SQL, bodové součty či mazání dat. Serverové HTTP i označené databázové požadavky používají stejné běžící hodiny. Produkce a neoznačené požadavky starších testovacích větví zachovávají skutečný čas. Offline dokončení si ponechává původní čas. Nastavení hodin zpět neotevírá uzavřený měsíc.

Secret je pouze ve větvové citlivé Vercel proměnné a místním souboru `../monthly-evidence/monthly-qa-control.secret`; nesmí do klienta, reportu, trace nebo repozitáře. Běžné hraní jej nepotřebuje. Veřejné přihlášení používá výhradně syntetické účty v izolované databázi.

## Konečné QA prostředí

Listopad je skutečně uzavřený: A/B 2400 bodů a Král listopadu, C 100 bodů a Kníže listopadu. Odznaky nepřidaly XP; opakovaná uzávěrka nic nepřidala. Prosinec je otevřený, A má 120 bodů za jednu skutečnou prosincovou Daily. D byl při původním předání nulový; následné nezávislé QA na něm dokončilo Daily 3. 12., takže nyní má 100 XP a 120 soutěžních bodů. QA hodiny běží od 3. prosince poledne; všechny tyto výsledky jsou pouze izolované testovací.

Opraveno i uchování ověřeného časového posunu po offline restartu a odmítnutí nepodložených klientských bonusů při autoritativních XP. Hostovská historická migrace ani skutečně potvrzené bonusy se nemění. Lokální starý odhad 500 XP nesmí přebít backend; čekající základní offline XP zůstávají viditelné bez duplicit.

## Příprava produkčního vydání — stav 29. 10.

Schválena je příprava vydání v pracovní větvi, včetně integrace aktuálního main a jednorázového oznámení na účet. Tato příprava sama není nasazení ani autorizace produkčních databázových zápisů. Kontroly přípravy jsou popsány níže včetně rozsahu a omezení; produkční kroky zatím provedené nejsou.

**Dokončeno:** merge `689477c` spojil kandidáta `0b6470d` s produkčním main `84e64aa`. Nové no-scroll UI, měsíční izolace a QA omezení zůstaly zachovány. Převzata je současná administrace, zabezpečená obnova účtů, audit a úplné jednorázové načtení kalibračních dat. Šest konfliktů bylo vyřešeno kombinací obou sad omezení; původní API otisky zůstaly beze změny. Prošlo 13 cílených kontrol integrace (S04/S06, admin prostředí/obnova/workspace/cache, kalibrační dataset, měsíční HTTP/QA, live-preview hranice, release kontrakt, Dnes a návrat z Nastavení) a syntaxe app/SW. Tento merge průchod následně doplnilo finální ověření uvedené níže.

**Dokončeno v kandidátu:** serverový receipt a automatické oznámení jednou na účet, sjednocení cache a 216 current kontrol po opravě testovací FastAPI fixture. CI včetně skutečného izolovaného PostgreSQL ověřilo receipt a závod osmi souběžných žádostí o zobrazení. Cílený browser průchod ověřil finální PWA aktualizaci, offline zachování a následné jediné odeslání fronty; podrobnosti níže. Starší kompletní herní E2E důkazy výše platí pro své uvedené kandidáty a nezaměňují se za tento kontrolní průchod.

**Zbývá před skutečným vydáním:** přesměrovat PR #221 z aktuálního základu `codex/today-one-screen` na `main` a přezkoumat celý výsledný diff; znovu potvrdit vydávané SHA a aktuální produkční základ. Produkční migrace, merge, nasazení i aktivace jsou samostatné dosud neprovedené kroky. Fyzická instalace PWA ani fyzický Fold nebyly tímto ověřením pokryté.

### Přesný seznam databázových změn

Zbývající produkční změny oproti main, v pořadí:

1. `supabase/migrations/20261028003751_monthly_competition.sql` — evidence dnů, snapshot, odznaky a služební RPC; výchozí `enabled=false` a `isolated=false`.
2. `supabase/migrations/20261028005634_monthly_admin_corrections.sql` — schválená politika 48 hodin, revize a auditované opravy; soutěž nezapíná.
3. `supabase/migrations/20261029120000_release_news_receipts.sql` — privátní evidence jednorázového oznámení, kampaň `november-2026-release-v1` je výchozí neaktivní. Závisí na `proplet_monthly_now_v1()` z první migrace; aplikace až po dokončení testů a kontrole.

4. `supabase/migrations/20261030230000_team_leave_atomic.sql` — PR #224, atomický odchod z týmu. Přidává pouze služební funkci; aplikovat před serverem. Bez oprav historických účtů.

Produkční závislosti byly 29. 10. ověřeny pouze čtením katalogu na `proplet / iopyhluayfszskyqqpuc` proti kandidátu `fe0f09f`. Nasazení přes MCP použilo jiné časové verze než názvy souborů v Git; prázdný výsledek hledání původních čísel proto neznamená chybějící migrace:

| Zdrojová migrace | Skutečně aplikovaná verze / název |
|---|---|
| `20261028235517_admin_workspace_reads.sql` | `20261029012926 / admin_workspace_reads` |
| `20261028235549_admin_atomic_recovery.sql` | `20261029013003 / admin_atomic_recovery` |
| `20261029000850_admin_case_audit_transaction.sql` | `20261029013005 / admin_case_audit_transaction` |
| `20261029014507_quality_dataset_single_read.sql` | `20261029015508 / quality_dataset_single_read` |

Všech 19 funkcí těchto čtyř migrací existuje a jejich těla odpovídají zdrojovým SQL (normalizovány pouze konce řádků a okrajové mezery). Všechny jsou `security invoker`, `anon` ani `authenticated` nemají EXECUTE, `service_role` jej má; deklarované search paths odpovídají zdrojům. Tyto migrace **nepřehrávat**, zejména obnova účtu zneplatňuje nedokončené staré odkazy.

V produkci zatím nejsou žádné měsíční ani release-news tabulky/funkce. Tři nové migrace výše jsou tedy skutečně pending, bez nalezené kolize objektů. Potřebné sloupce, primární klíče a service SELECT na `players`, `results`, `puzzle_runs`, `result_commands` existují, stejně jako unikátní vazby výsledku na challenge a běhu na result command. Schéma `proplet_private` zatím neexistuje a bezpečně jej zakládá druhá migrace. Pořadí aplikace zůstává **003751 → 005634 → release_news120000**; třetí používá časovou funkci z první. Kontrola nenašla drift existujících závislostí ani další blokující podmínku. Žádná migrace, aktivace či testovací zápis nebyly během této kontroly provedeny.

Podrobné lokální důkazy mimo Git: `../release-prep20261029/production-migration-readiness.json` a přesné read-only dotazy ve stejnojmenném `.sql`. Kontrola využívá existující CI důkazy; nová testovací sada nebyla opakována. Při aplikaci zachovat přesné bajty SQL: soubor `20261028005634_monthly_admin_corrections.sql` je v Git uložen s CRLF a jeho schválený checksum tomu odpovídá.

**Vyloučit z produkční dávky:** `20261028085718_monthly_isolated_preview_clock.sql`, `20261028094820_monthly_preview_special_clock_policy.sql`, `20261028095102_monthly_preview_difficulty_parity.sql`, `20261028095256_monthly_preview_extra_xp_parity.sql`, `20261028101522_monthly_preview_special_bindings.sql` a `20261028103442_monthly_preview_empty_claim_probe.sql`. Jde o hodiny a paritu izolované testovací databáze. Ani automatický seznam všech datovaných migrací používaný při stavbě prázdné CI databáze není produkční rollout plán.

Produkční runtime používá základní měsíční funkce z prvních dvou migrací. QA ovladač a transportní časové hlavičky mají nadále přesné omezení na měsíční preview a testovací DB; produkce je nesmí aktivovat. Admin a měsíční preview vybírají izolovaný klíč a nepřebírají obecný produkční secret. Produkční `PROPLET_MONTHLY_ENABLED` ani databázové `enabled` při tomto merge nebyly zapnuty.

Oznámení má samostatnou dvojitou aktivaci: `PROPLET_RELEASE_NEWS_ENABLED=true` a `release_news_campaigns.active=true`. SQL navíc vyžaduje datum nejméně 1. 11. 2026 00:00 Europe/Prague, účet vytvořený před touto hranicí a alespoň pět uložených her v běžných režimech. Atomický receipt je unikátní pro kampaň a účet. Ověření v preview vyžaduje stávající přesnou QA hranici měsíční větve; samo o sobě nezapíná produkční oznámení.

## Produkční spuštění — zatím neprovedeno

Finální kontrolní kandidát této přípravy je `d8095e5` (`proplet-v4.10.0-monthly-releaseprep2`); produkční srovnávací základ je `84e64aa`. Před provedením znovu ověřit, že oba odkazy stále označují zamýšlené verze. Dokončené testy neopakovat bez nové změny nebo nálezu; výsledky posledního gate, CI a browser průchodu se připojí k přesnému vydávanému SHA.

**PWA přechod potvrzen:** skutečný APP/SW z produkčního základu `84e64aa` (`proplet-v4.09.15-admin-workspace1`) se na loopback originu aktualizoval na `d8095e5`. Nativní stav účtu včetně identity/tokenu, dokončený výsledek, rozehraná hra a jeden čekající výsledek ve frontě se zachovaly přesně. Po CDP přepnutí sítě do offline a reloadu byla aplikace připravená, `online=false` a všechny stejné údaje i fronta zůstaly zachované. Po obnovení spojení odešel čekající výsledek právě jednou, fronta klesla na nulu a druhá nativní synchronizace nevytvořila další POST.

APP a service worker byly skutečné bajty obou verzí; API tvořil syntetický loopback transport. Fixture potřebovala explicitní `livePlayerPreview` capability, aby místní kandidát dovolil syntetickou synchronizaci přes svůj preview guard. Není to důkaz produkční autorizace účtů ani skutečného přiznání odměny. CSP blokovala externí komunikaci a po nastavení izolace neprobíhal provoz vůči produkci. Důkazy mimo Git: `../release-prep20261029/pwa/before.json`, `after-upgrade.json`, `offline-reload.json`, `after-sync.json` a `send-confirmation.json`. Samostatné již úspěšné CI testy pokrývají odklad aktualizace během hry/editace, retry a datovou cache; bez nové změny se neopakovaly.

1. Před skutečným vydáním přesměrovat PR #221: aktuální base je **`codex/today-one-screen`, nikoli `main`**. Po změně base na `main` přezkoumat celý diff a znovu ověřit kandidáta, produkční SHA, souběžné opravy a produkční schéma. Neslučovat omylem do původní playtest větve. Již potvrzené kontroly neopakovat, pokud změna base či nový diff neodhalí další změny nebo riziko. V této přípravě se PR neslučuje.
2. Po samostatném oprávnění aplikovat pouze přesnou produkční dávku z migrační sekce výše, v uvedeném pořadí, včetně neaktivního release receipt. Ověřit checksumy, skutečnou historii a oprávnění. QA hodiny a migrační opravy historické testovací databáze nejsou pokynem k plošnému replay v produkci. Nasadit schválený commit s vypnutými veřejnými přepínači a zkontrolovat skutečně běžící verzi, dostupnost administrace a produkční prostředí bez QA capability.
3. Před 1. 11. 2026 00:00 CET ověřit `launch_month='2026-11-01'`, `rules_approved=true`, `late_sync_policy='review-close'`, **`isolated=false`, `preview_now=null`**. Teprve po oprávnění zapnout DB `enabled=true`; spustit reconciliation pro listopad a ověřit výsledek.
4. Zapnout produkční `PROPLET_MONTHLY_ENABLED=true` až po ověření. Oznámení aktivovat samostatně oběma přepínači popsanými výše; pevná listopadová hranice a serverová způsobilost zůstávají v platnosti. V produkci nesmí být zapnuté QA ani testovací čas či testovací klíč. Ověřit autentizaci cron route bez zveřejnění secretu. Po aktivaci ověřit veřejné čtení soutěže, ruční otevření oznámení a verzi skutečně vykonávaného klienta; nevkládat syntetické výsledky ani nevynucovat receipt na skutečném účtu.
5. Vercel cron `0 23 * * *` volá `/api/cron/monthly-competition`. V listopadu odpovídá přesně požadované uzávěrce. V letním čase může finální zobrazení přijít o hodinu později; SQL příjem skončí přesně na hranici. Produkční scheduler se v preview automaticky nespouští; online QA vyvolává stejný finalizer chráněným ovladačem. Ostatní push plány se nemění.
6. Po první uzávěrce ověřit konečné pořadí, všechna společná ocenění a opakování s `finalized=0`, bez dalších odznaků nebo XP.

## Rollback a výslovná oprava

Vypnout `PROPLET_MONTHLY_ENABLED` a případně vrátit předchozí ověřený deployment. DB evidenci ponechat zapnutou, aby se neztrácely platné dny. Pokud musela být vypnutá i evidence, obnovit ji reconciliation před uzávěrkou. Nemaže se herní historie ani tabulky. Po uzávěrce běžné doručení snapshot neotevře.

Pro problém pouze s oznámením vypnout `PROPLET_RELEASE_NEWS_ENABLED` a deaktivovat jeho konkrétní kampaň; receipt ponechat, aby návrat vydání nerozeslal automatický panel znovu. Pro návrat aplikace použít předem zaznamenaný kompatibilní produkční deployment `84e64aa` nebo novější ověřený základ a následně ověřit skutečný APP/SW marker. Nemazat localStorage, cache hráčských dat, rozehrané hry ani synchronizační frontu. Additivní měsíční a receipt schéma zůstává; nevracet produkční administraci/obnovu účtů před převzaté bezpečnostní opravy. Rollback není oprávnění k mazání odznaků, znovuotevření uzávěrky ani obcházení auditu.

Správce nejprve přezkoumá a opraví či odmítne autoritativní zdrojový výsledek. Potom přes důvěryhodné služební SQL/RPC zavolá `proplet_correct_monthly_competition_v1(p_month,p_player_id,p_day,p_expected_revision,p_idempotency_key,p_operator_ref,p_reason)`. Příkaz nepřijímá počet bodů. Shodné opakování vrací původní potvrzení, konflikt revize vyžaduje novou kontrolu. Jedna transakce přepočítá pořadí i přidání/změnu/odebrání odznaků, bez změny XP, s auditním stavem před a po. Pozdní běžný offline výsledek nesmí omylem odstranit dříve způsobilý soutěžní příspěvek. Audit `proplet_private.monthly_corrections` je pro runtime pouze ke čtení.


## Oznámení nového vzhledu a soutěže — kontrolní preview a příprava 29. 10.

Schválený společný panel je dostupný přes `/?showNews=1` a v preview Nastavení → Co je nového. Používá novou ikonu soutěží; hlavní akce otevírá skutečnou měsíční soutěž, Jdu hrát a zavření ponechají Dnes. Původní kontrolní panel nevytvářel receipt a neposílal data. Dne 29. 10. je schválena implementace automatického jednorázového zobrazení na účet se serverovou evidencí napříč zařízeními; je implementovaná a ověřená v kandidátu, nikoli nasazená v produkci. Ruční otevření z Nastavení nebo přes `?showNews=1` zůstává oddělené od automatického receipt. Produkční aktivace se provede až podle dokončeného rollout plánu a samostatného oprávnění.

Nezávislé QA následně dokončilo na syntetickém účtu D Daily 3. 12.: účet již není nulový, má 100 XP a 120 prosincových soutěžních bodů. Čtyři P2 klientské nálezy byly opraveny v preview; produkce i původní playtest zůstaly beze změny.


## Dotažení načítání, výsledků a typografie — 30. 10. 2026

Podle připomínek ze staršího playtestu 4.09.15 je v kandidátu 4.10.0 opraven první render: finální CSS se načítá v hlavičce ve stejném pořadí kaskády, písma jsou přednačtena a odhalení aplikace čeká na no-scroll projekci, styly a písma. Fatální chyba dat stále odhalí ovladatelnou chybu. Výsledková úprava se načítá před síťově závislými doplňky.

Standardní výsledkovka drží čistý vršek i během načítání/chyby pořadí. Nativní čas, tahy a čistota jsou v existujících Detailech výsledku; zdroj Tajenky a skutečná varování zůstávají viditelná. Celkové XP i dostupný rozpis bonusu za slova jsou v jediném stickeru. Odměnová matematika a serverová data se nemění. Historické rekapitulace používají existující uložené hodnoty; chybějící per-run bonus se neodhaduje.

Fraunces je použito na nadpisy a titulky karet včetně soutěží; běžný text, ovládání, skóre a deska si zachovávají Outfit. Na 320 px je ikona obtížnosti menší, aby se název Mozkokalypsa vešel vedle přehledu bez zmenšování písma.

Ověření: 216 aktuálních testů a 187 asset kontrol prošlo. V izolovaném prohlížeči se zpožděnými CSS a no-scroll skriptem byl první viditelný snímek již kompletní no-scroll, bez mezilehlé verze. Nadpisy bez horizontálního přetékání ověřeny na 320, 390, 768, 832, 1024 a 1440 px; světlý/tmavý Dnes, Hrát, profil a bonusový sticker na mobilu/Foldu. Jde o emulované viewporty, nikoli fyzický Fold. Důkazy mimo Git: `ui-load-polish-20261030/`. Žádné produkční hry ani DB zápisy; změna pouze do preview a plánovaného vydání.


31. 10. 2026: do kandidáta integrován PR #224 (167d1e6), včetně rollback/ACL testů. Produkční dávka nově obsahuje čtyři výše uvedené migrace. Historická kontrola z 29. 10. níže popisuje tehdejší tři; novou čtvrtou před vydáním zkontrolovat v katalogu. Žádný produkční zápis ani oprava účtu nebyly při integraci provedeny.
