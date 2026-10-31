# Patronství — izolované no-scroll preview

31. 10. 2026. Větev `codex/patron-no-scroll-preview`, základ `5901a3626cea6d171d9b938080e74a5f7310e5bc`. Samostatný návrh mimo listopadové vydání a jeho naplánovanou automatizaci. Tiskařská dílna, wordmark Fraunces a významy herních ikon jsou zachované.

## Rozhodnutí a hotová implementace

Jednorázový příspěvek 99 / 199 Kč nebo vlastní celá částka 1–100000 Kč. Stejná trvalá značka pro každou částku, bez XP či herních výhod, veřejná až po výslovném zapnutí. Přihlášení je nutné před přípravou bankovních údajů: neměnná identita hráče je vlastníkem příspěvku i při přejmenování nebo platbě někým jiným. Host má funkční cestu k přihlášení; nepoužívá se zpětné přivlastnění podle jména.

Ruční vstup je v profilu a jako drobný textový odkaz před patičkou Dnes. Automatická nabídka má nízkou prioritu ve stávající frontě oznámení, začne až po úspěšném dohrání a uzavření výsledku, po minimálně 5 různých dokončených deskách ve 3 aktivních dnech. Nevstupuje do onboardingu, dětského režimu, hry, otevřených dialogů ani oslav. Fronta dodržuje limit jednoho automatického oznámení na relaci. Autoritativní serverový limit je 2 nabídky za klouzavých 90 dní, nejméně 30 dní mezi nimi, společný pro účet. Odmítnutí, ignorování i otevření nabídky se zaznamenávají. Přispěvatelům se automaticky nenabízí; volba „Nenabízet mi podporu Propletu“ je v nastavení a ukládá se k účtu.

Backend vytváří idempotentní intent s unikátním číselným VS, částkou CZK a snímkem jména. Příjemce `5531840001/5500`, zpráva „NICKNAME podporuje Proplet“, nejvýše 60 znaků. Platitelný SPAYD/QR vzniká pouze z uloženého intentu přihlášeného hráče. Otevření QR nic nepotvrzuje.

Nativní administrace má sekci **Podpora Propletu**: posledních 7 dní, nejvýše 100 příprav, pravdivý stav „Vygeneroval platební údaje“, vyhledání starší přípravy podle přesného VS. Oprávněný owner/editor podle výpisu ručně ověří účet příjemce, CZK, částku a VS a doplní jedinečné bankovní ID transakce. Potvrzení je atomické, opakovatelné bez druhého přiznání, auditované identitou správce. Jedna transakce nesmí potvrdit dva příspěvky. Přezdívka ani jméno bankovního plátce nejsou párovací klíč. Souběžné nabídky zamykají stejný účet. Tabulky a RPC jsou dostupné pouze aplikační roli serveru, klientské role nemají přímý přístup.

## Náhled a izolace

Hráčská stránka `/patron-preview.html?state=complete` používá skutečný modul `/app/patrons.js`. Pouze oddělený fixture adaptér nahrazuje jeho API lokálním syntetickým úložištěm. Stejný admin modul jako nativní administrace je na `/patron-admin-preview.html?state=complete`. Tlačítko „Náhled patronství“ otevře scénáře, reset, posun modelového času o 31 dní a odkaz na modelového správce. Modelový účet má 5 historických dokončení. Potvrzení se provádí ve správci; v hráčském průchodu není tlačítko pro potvrzení vlastní platby. Obě stránky se stejným originem a `state=complete` sdílejí ukázkový registr; produkční úložiště nepoužívají.

Po ověření bankovní aplikací 31. 10. 2026 byl původní neplatební obrázek nahrazen skutečným SPAYD QR pro schválený účet `5531840001/5500` / `CZ5355000000005531840001`. QR se generuje přímo v prohlížeči lokálně přibalenou knihovnou qrcode-generator 2.0.4 (MIT), bez externí služby. Bere částku, frekvenci, datum první platby, zprávu a VS z uloženého modelového intentu; opakovaný požadavek i přejmenování hráče zachovají stejné údaje. Zpráva má přesně stejné UTF-8 percent-encoding jako backend a měsíční volba přidává `FRQ:1M` a `DT:YYYYMMDD`.

Každý nový modelový intent dostává kryptograficky náhodný desetimístný číselný VS s lokálním testovacím prefixem `99`, s kontrolou jedinečnosti v modelovém úložišti. Nejde o registraci ani rezervaci v produkční databázi. U QR je viditelné **TEST – modelová reference** a upozornění: „Testovací platební QR – údaje lze načíst v bance. Platbu v tomto náhledu neodesílej; vazba je modelová.“ QR obsahuje skutečné platební údaje, takže by banka mohla převod odeslat; upozornění je třeba respektovat. Zobrazený QR, stažený PNG a kopírovaný SPAYD mají shodná data. PNG se tvoří nativně v prohlížeči ze stejného SVG v plném rozlišení; nevyžaduje síťovou službu a lépe se hodí k načtení z galerie telefonu. Samotný soubor má bílé pozadí a ochranný okraj čtyř modulů, na obrazovce 256 × 256 px.

Vytvoření ani načtení QR nepřidá značku ani XP. Modelový správce nadále potvrzuje pouze syntetické převody, nemá bankovní přístup ani vazbu na skutečný převod. Produkční backend a jeho vypnutá aktivace se nemění. Funkční načtení platebních údajů není důkazem produkčního párování plateb.

`vercel.json` publikuje pouze `public/**` pomocí `@vercel/static`, bez backendu, cronů a databázových změn. `/api/*` a `/sw.js` vracejí 404. Kořen a `/index.html` se mapují na izolovanou hráčskou stránku. Izolátor je před všemi nativními skripty, blokuje odchozí API, externí transporty, analytiku a service worker; CSP povoluje jen vlastní statické zdroje. Celá větev se nesmí sloučit do produkce se svou hostingovou konfigurací.

## Ověření

- HTTP testy: vypnutá funkce, nepřihlášený hráč, podvržený vlastník, typy a limity částky, idempotence, nepřístupný cizí intent, role správce, platební pole, poškozená RPC odpověď, neaktivní backend v prostředí preview a ochrana SPAYD proti vložení dalšího pole.
- Oprava statického QR 31. 10. 2026: čtyři skutečné uložené modelové intenty pro 99 / 199 / 12347 / 100000 Kč, jednorázově i měsíčně, české znaky, emoji a oddělovače ve zprávě. Výstupní SVG se nezávisle rasterizují pomocí resvg na PNG (256 px a plná velikost) a ZXing všech osm obrazů dekóduje na přesný řetězec `backend.patrons.payment_data`, včetně IBAN, částky, měny, VS, zprávy a měsíčního data. Test pokrývá i idempotenci po obnovení stránky, neměnnost zprávy po přejmenování, rozdílné reference a nepřiznání patronství. Je zařazen do current manifestu. Fyzická bankovní aplikace nebyla tímto automatickým testem ověřena.
- CUA opravy QR: skutečný snímek 390 × 844 px (`patron-preview-evidence-20261031/real-qr-390.png`) nezávisle dekódován ZXingem na backend-exaktní SPAYD pro 99 Kč, VS `9930702816` a zprávu „Ukázkový hráč podporuje Proplet“. Finální skutečně stažený `Proplet-TEST-NEODESILAT.png` z prohlížeče (456 × 456 px, 99 Kč, VS `9935757281`) byl nezávisle dekódován na přesný backendový payload včetně české zprávy. CUA ověřilo úspěšný stav tlačítka kopírování přesného SPAYD; obsah systémové schránky nebyl samostatně přečten.
- Skutečná migrace na nové izolované lokální PostgreSQL databázi: vlastnictví, přejmenování, idempotence, 5 desek / 3 dny, dvě souběžné relace, cooldown 30 dní a 2/90 dní, opt-out, přesné párování, opakované potvrzení, duplicitní bankovní transakce, audit, výchozí soukromí, vyhledání starého VS a ACL klientských rolí. Lokálně použit minimální syntetický základ, plný migrační řetězec ověřuje stávající CI job s přidanou patron acceptance.
- Prošly klientské testy první nabídky až po výsledku a asynchronního přiznání zobrazení, fronta oznámení, pořadí a jeho rozbalení, modulové kontrakty, historické HTTP/OpenAPI kontrakty S04/S06, admin kontrakt, plán migrací a konzistence vydání.
- Browser CUA: ruční vstup → syntetický intent a QR; native admin modul odmítl chybnou částku a přijal správný modelový převod; osobní poděkování se správným avatarem a vypnutou veřejnou značkou; nabídka až po zavření úspěšného výsledku; mobilní šířka 390 px bez vodorovného přetékání; preference v nativním nastavení. Dřívější designová kontrola základního návrhu pokrývá 320 / 390 / 768 / 1440 px. Nejde o test fyzického telefonu.

## Otevřené body před aktivací

Produkční databáze ani platby nebyly aktivovány. `PROPLET_PATRONS_ENABLED` je výchozí vypnuté a prostředí Vercel preview je vždy odmítnuté. Před produkční aktivací je třeba schválit aplikaci migrace do určené databáze, projít plný databázový CI gate, koordinovat běžné vydání a PWA cache revize a ověřit skutečný autentizovaný průchod. Žádná bankovní oprávnění ani tajné údaje nebyly přidány. Automatické bankovní napojení není implementováno; další možnosti a nezjištěné podmínky RB API popisuje `patron-bank-options-20261031.md`.

Ilustrace `/assets/support/patron-letterpress-v1.webp` pochází ze schváleného imagegen návrhu. Inkoustové srdce zůstává oddělené od získaných herních odznaků.


## Synchronizace náhledu s kandidátem vydání — 1. 11. 2026

Náhled používá totožný nativní hráčský modul a CSS jako připravený kandidát `aec7236fe966930f45eabc0f3825cf8dda489e2e`. Pouze izolovaný fixture překládá běžné požadavky `fetch` do lokálních modelových dat. Ovládání náhledu je oddělené: zachytí i situaci, kdy nativní událost připravenosti proběhla před načtením posledního skriptu. Úvodní scénář počká na vykreslený profil a obnovení stavu. Testovací upozornění i vstup do ovládání jsou dostupné uvnitř otevřeného dialogu včetně QR; tlačítko v pozadí je při modálním zobrazení nepřístupné.

CUA v místním prohlížeči ověřilo nabídku, vlastní poděkování, soukromou historii dvou modelových měsíčních převodů a vypnutou veřejnou značku. Na odděleném modelovém účtu ověřilo první návštěvu → čekání 48 hodin → dostupnost; pozdější novinky → nové čekání 48 hodin → stále čeká při 0/2 a 1/2 deskách → dostupnost při 2/2. QR zobrazuje upozornění „TESTOVACÍ NÁHLED — platbu neodesílej“. Test skutečného nativního fetch bridge potvrdil vlastnictví modelového intentu, soukromou historii, veřejnou značku výchozí vypnutou a jediné přiznání poděkování ze dvou souběžných požadavků. Prošel cílený test nativního klienta a osm nezávisle dekódovaných QR obrazů.

Jde o statický náhled, nikoli produkční aktivaci. Produkční databáze, listopadové vydání ani bankovní oprávnění se touto synchronizací nemění.
