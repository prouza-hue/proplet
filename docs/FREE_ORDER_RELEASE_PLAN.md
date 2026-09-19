# Pestré pořadí — implementace a provozní plán

Stav 2026-09-19: uživatel výslovně schválil produkční nasazení po ověření preview všech čtyř obtížností.

## Výchozí stav a prostředí

- Základ: aktuální main `e58aadab5889d43ecceb83333eb49fb9238e384b`.
- Nová větev: `feat/pestre-poradi-production`; nevznikla sloučením preview větve.
- Reference algoritmu a vzhledu: `preview/pestre-poradi`, `4cee6c73ae9306cdbb418036ba7396afbe92cd0f`.
- Původní izolované preview zůstává na `https://proplet-8ck70bq92-pavel-prouzas-projects.vercel.app/`.
- Nové backendové preview: `https://proplet-git-feat-pestre-poradi-pr-c66440-pavel-prouzas-projects.vercel.app/`.
- Znovu použita databáze `eanzztstmwlamwfdskbf`, `proplet-s08b-atomic-result-test`. Žádný nový Supabase projekt.
- Produkční DB `iopyhluayfszskyqqpuc`: při přípravě beze změn; schválené aditivní migrace provedeny 2026-09-19, viz produkční záznam níže.
- Nový testovací secret ve Vercelu je scoped pouze na novou preview větev. Existující nastavení `fix/fair-play-progress` zůstalo zachované.
- Backend se při nesprávném URL DB nebo při pokusu nasadit tuto testovací konfiguraci do Production odmítne spustit před inicializací databázového klienta.

## Chování

Řazení vlastní jen preferenci a seznam původních puzzle ID. Nemění čísla, desky, odpovědi, výsledky, XP ani identitu účtu. Výběr rozehrané hry má přednost; dokončené desky se přeskočí podle existujícího postupu. Přepínače jsou pro Snadnou, Střední, Těžkou a Mozkožrouta. Těžká a Mozkožrout vždy používají běžnou sekvenci nová → starší → starší, bez desetideskového úvodu; Mozkomor zůstává beze změny. Nabídka má rovnou jednotný přepínač a krátké vysvětlení, bez nadpisu a dalších potvrzovacích tlačítek.

Neznámá instalace není důkaz nového hráče: zůstává číselné pořadí s výslovným opt-in. Automatický úvodní pestrý plán vzniká pouze po serverem potvrzeném založení účtu, pokud není historie hosta ani dřívější volba. Přihlášení existujícího účtu, obnovení hesla a dočasně prázdná cache nejsou založení účtu. Google větev označuje pouze skutečně nově vloženého hráče, nikoli připojení identity k existujícímu hráči.

Pořadí je uložené zvlášť pro účet a obtížnost; host má vlastní lokální záznam. Přechod hosta přenese plán do účtu, ale existující účetní volba vždy vyhraje. RPC serializuje souběžné zápisy včetně prvního vložení, používá očekávanou revizi a opakované request ID. Konflikt načte skutečný serverový stav a ukáže oznámení. RLS a oprávnění umožňují přístup jen serverové roli; klient neposílá autoritativní player ID.

Nové vydané várky se připojují na konec plánu. Dřívější prefix se nepřerovnává; dočasně chybějící ID se uchovávají a při výběru přeskakují. Nevydané/neznámé ID server odmítá. Stávající plán nepřepisuje nová verze algoritmu: budoucí změna verze musí mít explicitní kompatibilní migraci.

Offline se uchová poslední ověřené zapnutí i volba. Nedokončený zápis se uloží lokálně a po připojení znovu odešle. Nové zařízení bez ověřeného postupu nepovažujeme za nový účet a při nedostupném serveru nenahrazujeme vzdálené pořadí prázdným. Zařízení, které je offline, nemůže přijmout nově vydaný kill switch; to je explicitní limit, nikoli důvod smazat jeho plán.

## Ověření

- `python tools/test_current.py`: aktuální runtime, syntaxe a assety; zahrnuje engine, klientský store, API validaci/identity, novou Google registraci vs. existující účet.
- `tools/test_free_order_db.py`: navazuje na existující izolovaný Postgres job; žádná druhá testovací infrastruktura. Testuje skutečné RPC a granty.
- `tools/test_free_order_preview.py`: guard na přesný testovací DB ref před jakýmkoli zápisem, syntetický účet a dvě nezávislé přihlašovací relace. Pokrývá všechny čtyři obtížnosti, guest import, souběžný CAS, retry, stabilní prefix, odmítnutí neplatných ID, obnovu rozehrané desky a skutečné dokončení/XP. Výstup `docs/qa/free-order-hosted.json`; neobsahuje hesla ani tokeny.
- Browser kontrola: host, oba přepínače, Snadná 218 se zachovanou deskou, přepnutí na číselné během rozehrání, reload a obnovení. Široký světlý layout vizuálně ověřen. CI prohlížeč ověřil šířky 390, 768 a 1440 px. Fyzický Samsung Fold a instalované PWA nebyly v automatizaci ověřeny; uživatel schválil preview na svém mobilu.
- Obsahová data a soubory definující XP nebyly změněny. Testovací zápisy byly ověřeny přímo v oddělené DB.

## Bezpečné nasazení — schválený postup

1. Vyžádat výslovné schválení konkrétního release commitu a produkční migrace. Znovu ověřit aktuální main/produkční SHA a případné souběžné změny. Nikdy neslučovat referenční `preview/pestre-poradi`.
2. Připravit samostatný release commit z této implementace: odstranit test-only `SUPABASE_URL` a `PROPLET_ORDER_TEST_ONLY` z `vercel.json`, obnovit produkční CSP z aktuálního main a nastavit `PROPLET_FREE_ORDER_ENABLED=false`. Testovací secret nikdy nepřenášet do produkce. Preview větev ponechat beze změny pro porovnání. Tento krok je nutný: současná větev záměrně obsahuje fail-closed testovací konfiguraci a není určena k přímému Promote to Production.
3. Ověřit snapshot/zálohu produkční DB a spustit pouze nové migrace `20260919103255_free_order_v1.sql` a následně `20260919133525_free_order_all_difficulties.sql`, nikoli historické setupy ani plný replay migrací. Migrace přidává tabulku a RPC; nepřepisuje žádného hráče ani výsledek. Zkontrolovat RLS a granty.
4. Nasadit schválený release se stále vypnutou funkcí; ověřit přihlášení, dokončení, XP, synchronizaci a PWA update na mobilu/Foldu. Ověřit, že build skutečně obsahuje vypnutý flag.
5. Zapnout funkci samostatným malým config commitem a preview/produkčním postupem schváleným uživatelem. Stávající hráči mají opt-in, nikoli nucené přerovnání. Sledovat chyby order API, konflikty, úspěšnost synchronizace a rozdíly XP/completion; žádné plošné zpětné doplňování plánů.

## Vypnutí a rollback

- Kill switch: změnit `PROPLET_FREE_ORDER_ENABLED` v deployment konfiguraci na `false` a redeploy správného prostředí. V této větvi je flag v `vercel.json`; nespoléhat na změnu stejnojmenné dashboard proměnné, kterou může konfigurace přebít.
- Online klient načte config při startu, návratu do okna, obnovení připojení a každých 30 s v aktivním okně. Přepínače zmizí, výběr se vrátí k původnímu číselnému resolveru; rozehraná hra, výsledky a XP zůstanou. Přijetí vypnutí se uloží i pro další offline start.
- Nevypouštět tabulku, nesmazat plány ani lokální preference. Opětovné zapnutí obnoví stejný stabilní prefix.
- Při širší regresi vrátit předchozí ověřený aplikační deployment. Aditivní tabulka/RPC mohou zůstat, starší aplikace je nepoužívá. Žádný rollback hráčských výsledků ani XP.

## Rozhodnutí uživatele: redakční sekvence

Ruční redakční práce na sekvenci není požadavek ani blokátor vydání. Používáme deterministický algoritmus se stabilním uloženým plánem; budoucí ruční dramaturgii nyní nepřipravujeme.

## Produkční release

Větev `release/pestre-poradi` zachovává testovací preview na samostatné větvi. Produkční CSP a prostředí jsou převzaty z ověřeného main. První release má `PROPLET_FREE_ORDER_ENABLED=false`; zapnutí následuje samostatným commitem po kontrole produkce. Automatické CI včetně Printshop browser smoke prošlo na schválené implementaci `db5387620e1eeeaa4377cd46c9a80c2684e87457`.

### Záznam schváleného nasazení 2026-09-19

- PR #128 sloučen jako `c5a6630c208a3650ef8e7c1f66969290561af19e`, všechny relevantní CI kontroly úspěšné.
- Produkční migrace `free_order_v1` a `free_order_all_difficulties` úspěšné. Nová tabulka byla prázdná; RLS zapnuto, přístup a RPC pouze pro service_role, všechny čtyři obtížnosti povolené. Existující hráčské výsledky ani XP migrace nemění.
- Úplnou zálohu Supabase nebylo možné bez dalšího přihlášení ověřit; tato výjimka byla uživateli sdělena. Ověřen byl výchozí stav dotčeného schématu a aditivní charakter změny.
- Deployment s vypnutou funkcí `dpl_GnruEWuqBUJhj6D6szoCfP3EBqKE` READY na hrajproplet.cz; /api/health ok=true, database=true; /api/free-order/config enabled=false, isolatedPreview=false. Živý prohlížeč zobrazil čtyři obtížnosti bez přepínačů.
- Následující config commit zapíná funkci; pro rychlé vypnutí vrátit pouze flag na false a redeploy, nebo rollback na výše uvedený deployment. Původní aplikace: `dpl_9wAe4BnnJRrbcrcPWzDdioYk7zbF`.
- Testovací větev db538762 a původní reference 4cee6c7 zachované. Úplný autentizovaný regresní scénář a XP ověřeny na izolovaném testovacím backendu; produkční kontrola používá hosta bez dokončování úrovní.
