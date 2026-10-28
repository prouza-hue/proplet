# Měsíční soutěž — provozní stav a spuštění

Aktualizace 28. 10. 2026. Pracovní větev `codex/monthly-competition-202611`, draft [PR #221](https://github.com/prouza-hue/proplet/pull/221). Samostatné preview vychází ze schváleného no-scroll UI; běžící playtest ani produkce se nemění. Podrobné nezávislé QA zadání je v `docs/monthly-competition-astra-qa-handoff-20261028.md`.

## Prostředí a současné ověření

- Produkce: `hrajproplet.cz`, SHA `1de738938ff244fc010808daf33aea7def4b6481`, Supabase `iopyhluayfszskyqqpuc`. Bez zásahu.
- Běžící no-scroll playtest: větev `codex/today-one-screen`, SHA `27e7204dfce5e7743ebf19b1eb2a834b5a817a83`. Bez zásahu.
- Měsíční preview: `proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app`, izolovaný projekt `eanzztstmwlamwfdskbf` / `proplet-s08b-atomic-result-test`.
- Integrovaný kandidát `c0b549b21053cf2ffa256a24b78f713573734efd`: runtime gate 202 testů, 179 assetů, 540 syntaktických kontrol a CI prošly. Celý skutečný online průchod následně prošel včetně nejlepších 20 dnů, shod, offline doručení, uzávěrky a odznaků. Finální QA kandidát a přesné důkazy jsou v předání pro Astru.
- Izolovaná databáze byla cíleně doplněna o potřebnou současnou cestu pro historické odměny, offline výsledky a referral čtení. Původních 12 testovacích hráčů, 7 výsledků a 530 XP včetně digestů zůstalo zachováno. Důkazy a přesné aplikované verze: `release-evidence/monthly-isolated-lifecycle-parity.json`.

Důkazem dokončení je skutečný herní průchod; samotný HTTP 200 ani označené čtecí scénáře jej nenahrazují. Veřejný online E2E má PASS a používá skutečné syntetické účty, dodané oficiální desky, nativní herní pipeline, potvrzení API a živé SQL pořadí; bez sázení výsledků do ledgeru. Soukromé tokeny a hesla zůstávají mimo Git.

## Schválené chování

První platné dokončení základní Denní výzvy v den vydání: 100 bodů, dalších 20 bez nápovědy. Nejlepších 20 dnů kalendářního měsíce, nejvýše 2400 bodů. Rychlost ani XP nerozhodují; Extra, Tajenka, volná hra, Archiv, trénink a opakování měsíční body nepřidávají. Shody mají místa 1–1–3 a odznak dostane každý na místě 1–3, bez XP bonusu.

Čas je Europe/Prague. Uživatel 28. 10. schválil přijetí offline dokončení z dne vydání před uzávěrkou 48 hodin po konci měsíce. Před uzávěrkou se opravy/odmítnutí přepočítají, po ní jen výslovná administrátorská oprava s důvodem, provozovatelem, očekávanou revizí, idempotentním klíčem a neměnným auditem. Listopadová uzávěrka: **3. 12. 2026 00:00 CET**, tedy `2026-12-02T23:00:00Z`.

Odměny jsou původní schválené postavičky Krále, Rytíře a Knížete pro listopad a prosinec. Přesné assety, hlášky a zdroj schválení jsou v `docs/design/monthly-awards-recovery-20261028.md`. Prohlídka kolekce není získaná odměna. Přímé odkazy: `/?open=monthly&panel=awards&collection=2026-11` a `2026-12`.

## Implementace a izolované QA

Body vznikají ve stejné transakci jako potvrzený atomický výsledek; vyžadují oficiální result, run a dokončený command. Klientský součet ani analytické události nejsou zdrojem bodů. SQL počítá nejlepší dvacítku, shody a konečný snapshot. Měsíční lock serializuje zápis proti uzávěrce, odznaky jsou idempotentní. Otevřený měsíc má explicitní reconciliation; uzavřený měsíc mění pouze auditovaný správce.

GET `/api/competition/monthly` respektuje přihlášení, anonymizaci a `no-store`, nevrací UUID soupeřů. První stovka plus vlastní řádek jsou v UI označené. Skutečné izolované výsledky jsou odlišené od parametrů `monthlyScenario=...`, které načítají pouze označené snímky dřívějších SQL testů.

QA čas vyžaduje přesně preview prostředí, měsíční větev, izolovanou URL a soukromý `PROPLET_MONTHLY_QA_SECRET`. Chráněný POST `/api/qa/monthly-control` přijímá pouze `status`, `clock`, `finalize`; žádné SQL, bodové součty či mazání dat. Serverové HTTP i označené databázové požadavky používají stejné běžící hodiny. Produkce a neoznačené požadavky starších testovacích větví zachovávají skutečný čas. Offline dokončení si ponechává původní čas. Nastavení hodin zpět neotevírá uzavřený měsíc.

Secret je pouze ve větvové citlivé Vercel proměnné a místním souboru `../monthly-evidence/monthly-qa-control.secret`; nesmí do klienta, reportu, trace nebo repozitáře. Běžné hraní jej nepotřebuje. Veřejné přihlášení používá výhradně syntetické účty v izolované databázi.

## Konečné QA prostředí

Listopad je skutečně uzavřený: A/B 2400 bodů a Král listopadu, C 100 bodů a Kníže listopadu. Odznaky nepřidaly XP; opakovaná uzávěrka nic nepřidala. Prosinec je otevřený, A má 120 bodů za jednu skutečnou prosincovou Daily, nový D 0. QA hodiny běží od 3. prosince poledne; všechny tyto výsledky jsou pouze izolované testovací.

Opraveno i uchování ověřeného časového posunu po offline restartu a odmítnutí nepodložených klientských bonusů při autoritativních XP. Hostovská historická migrace ani skutečně potvrzené bonusy se nemění. Lokální starý odhad 500 XP nesmí přebít backend; čekající základní offline XP zůstávají viditelné bez duplicit.

## Produkční spuštění — neautorizováno a neprovedeno

1. Nechat Astru nezávisle projít kandidáta a uzavřít blokující nálezy. Před případným sloučením znovu ověřit main, produkční SHA, souběžné opravy a produkční schéma. Tento PR se nyní neslučuje.
2. Po samostatném oprávnění aplikovat **jen produkční soutěžní migrace** `20261028003751_monthly_competition.sql` a `20261028005634_monthly_admin_corrections.sql` v uvedeném pořadí. Ověřit checksumy a oprávnění. QA hodiny a migrační opravy historické testovací databáze nejsou pokynem k plošnému replay v produkci.
3. Před 1. 11. 2026 00:00 CET ověřit `launch_month='2026-11-01'`, `rules_approved=true`, `late_sync_policy='review-close'`, **`isolated=false`, `preview_now=null`**. Teprve po oprávnění zapnout DB `enabled=true`; spustit reconciliation pro listopad a ověřit výsledek.
4. Zapnout produkční `PROPLET_MONTHLY_ENABLED=true` až po ověření. V produkci nesmí být zapnuté QA ani testovací čas či testovací klíč. Ověřit autentizaci cron route bez zveřejnění secretu.
5. Vercel cron `0 23 * * *` volá `/api/cron/monthly-competition`. V listopadu odpovídá přesně požadované uzávěrce. V letním čase může finální zobrazení přijít o hodinu později; SQL příjem skončí přesně na hranici. Produkční scheduler se v preview automaticky nespouští; online QA vyvolává stejný finalizer chráněným ovladačem. Ostatní push plány se nemění.
6. Po první uzávěrce ověřit konečné pořadí, všechna společná ocenění a opakování s `finalized=0`, bez dalších odznaků nebo XP.

## Rollback a výslovná oprava

Vypnout `PROPLET_MONTHLY_ENABLED` a případně vrátit předchozí ověřený deployment. DB evidenci ponechat zapnutou, aby se neztrácely platné dny. Pokud musela být vypnutá i evidence, obnovit ji reconciliation před uzávěrkou. Nemaže se herní historie ani tabulky. Po uzávěrce běžné doručení snapshot neotevře.

Správce nejprve přezkoumá a opraví či odmítne autoritativní zdrojový výsledek. Potom přes důvěryhodné služební SQL/RPC zavolá `proplet_correct_monthly_competition_v1(p_month,p_player_id,p_day,p_expected_revision,p_idempotency_key,p_operator_ref,p_reason)`. Příkaz nepřijímá počet bodů. Shodné opakování vrací původní potvrzení, konflikt revize vyžaduje novou kontrolu. Jedna transakce přepočítá pořadí i přidání/změnu/odebrání odznaků, bez změny XP, s auditním stavem před a po. Pozdní běžný offline výsledek nesmí omylem odstranit dříve způsobilý soutěžní příspěvek. Audit `proplet_private.monthly_corrections` je pro runtime pouze ke čtení.


## Oznámení nového vzhledu a soutěže — kontrolní preview 28. 10.

Schválený společný panel je dostupný přes `/?showNews=1` a v preview Nastavení → Co je nového. Používá novou ikonu soutěží; hlavní akce otevírá skutečnou měsíční soutěž, Jdu hrát a zavření ponechají Dnes. Nevytváří oznámení ani receipt v produkci a neposílá žádná data. Automatické jednorázové zobrazení stávajícím hráčům a synchronizace zhlédnutí napříč zařízeními se zapojí až při samostatně schváleném ostrém vydání.

Nezávislé QA následně dokončilo na syntetickém účtu D Daily 3. 12.: účet již není nulový, má 100 XP a 120 prosincových soutěžních bodů. Čtyři P2 klientské nálezy byly opraveny v preview; produkce i původní playtest zůstaly beze změny.
