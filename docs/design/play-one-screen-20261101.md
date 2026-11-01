# Hrát na jedné obrazovce

Datum: 1. 11. 2026. Schválená implementace v pracovní větvi `codex/play-one-screen` vychází z ověřeného produkčního main `9569de96794805fb2ae99bc84a56e695b873aa51` (v4.10.9). Toto je implementační a QA záznam; nepotvrzuje produkční nasazení.

## Výsledné chování

Šest barevných dlaždic zachovává původní pořadí, názvy, ikonové podklady a odměny obtížností. Celá dlaždice je jediné nativní tlačítko. Rozehraná obtížnost ukazuje Pokračovat ve své dlaždici; samostatná karta rozehrané hry na této stránce se nevkládá. Všechny akce nadále volají původní asynchronní `startFree(diff)`, který řeší synchronizaci pořadí a vybírá resume → nextUnsolved → první desku. Vše dohrané zobrazuje Hotovo a opakování neslibuje další XP. Nové označuje pouze skutečně dostupný nový obsah; vysoký banner se na Hrát nevykresluje.

Mobil má dva sloupce a tři řádky dlaždic; od šířky obsahu 600 px jsou tři sloupce a dva řádky. Kratší rozměr obrazovky snižuje výšku a velikost ilustrací. Stránka nepoužívá zámek přetečení: menší výška či zvětšený text dovolí potřebný posun. Patička zachovává odkazy a navigaci, jen na aktivní stránce Hrát používá kompaktní podobu. Dnes a herní deska se neredesignují.

Pod obtížnostmi zůstává jeden Přehled úrovní a vedle něj Archiv. Přehled otevírá stávající historii s poslední použitou obtížností a přidává výběr všech šesti obtížností přímo v dialogu. Odehrané, čekající a převedené výsledky, detail úrovně i stávající rozbalovací Všechny úrovně podle čísel zůstávají původní. Pomalejší odpověď předchozího filtru se nezobrazí a nesmí vytvořit další číselný katalog. Nativní ukončení dialogu vrací fokus na skutečný prvek, který jej otevřel, pokud je stále připojený a viditelný. Přepnutí obtížnosti původní prvek nepřepisuje.

Tajenka má nadále svou nativní cestu na Dnes včetně rozehrání a výsledku. Odstranění její duplikované karty z Hrát je sladěné u obou původních vykreslovačů. Kontrola odhalila smyčku, ve které `tajenka-release-fix` kopii znovu tvořil a `printshop-release-polish` ji odstraňoval; oba nyní respektují vlastníka kompaktní stránky. Dočasná diagnostika observerů byla po nalezení příčiny odstraněna. Stejně je sjednocen producent původního rychlého přepínače klidného režimu, který na této stránce už předtím odstraňovalo jiné vykreslování.

## Ověření a otevřené body

Prošly cílené aktivní testy `test_today_mozkomor.js`, `test_result_confirmation_latency.js`, `test_today_one_screen_readiness.cjs` a `test_first_input_diagnostics.cjs`. Nové scénáře ověřují šest stabilních akcí a nativní delegaci, pokračování, pravdivé opakování, skutečnou dostupnost novinek, uložený filtr, opožděné odpovědi a dekorátory historie, dostupnost Tajenky na Dnes ve čtyřech kombinacích a ustálení obou producentů Tajenky bez opakovaného vytváření karty. Izolační kontrola Studio náhledu také prošla.

Root ověřil normální náhled bez diagnostiky: mobil 390 px má výšku dokumentu přesně 844 px, změna na 320 px funguje a všech šest názvů zůstává úplných bez vodorovného přetečení. Barevnost a karty vizuálně prošly. Root potvrdil také Fold 832 × 600, tmavý desktop, změnu filtru na Mozkomor, číselný katalog 150 úrovní, zachování filtru po zavření a otevření, nativní Archiv 800 desek i pokračování rozehraného Medium se zachovaným 1/7 slov, jedním tahem a 12 sekundami. Místní QA běží na portu 8896 v celé aplikaci s izolovanými daty. Standardní Vercel preview, vydání a commit koordinuje root; produkční data ani SQL tato UI práce nemění.

## Závěrečný místní handoff

Root schválil světlý mobil 390 px, úzký mobil 320 px se všemi plnými názvy, tmavý desktop a Fold 832 × 600. Na 390 px je dokument vysoký přesně 844 px. Normální stránka bez diagnostiky funguje při změně rozměru. Fresh případ ukázal pouze Hard označený Nové bez dalšího banneru; all-complete případ má šest Hotovo / Znovu a přístupné názvy výslovně bez dalších XP. Přehled → Mozkomor → číselný katalog má 150 úrovní a po zavření / otevření zachovává filtr. Archiv otevřel nativních 800 desek. Resume Medium spustil skutečnou nativní hru se zachovaným 1/7 slov, jedním tahem a 12 sekundami, výhradně v izolovaném místním stavu.

Poslední oprava přístupnosti ukládá skutečný původní prvek při otevření skrytého dialogu, nepřepisuje jej při změně filtru a při zavření vrací fokus pouze připojenému a viditelnému prvku. Cílený test pokrývá jiný původní prvek než Hrát a odmítnutí skrytého, odpojeného i inertního prvku. Dodatečná vizuální kontrola online nativního Vercel preview je úkol root agenta po vytvoření kandidátního commitu; toto místní QA nepředstavuje produkční hraní ani nasazení.


## Nativní Vercel preview

Preview ponechává kanonickou verzi 4.10.9 a používá samostatný marker `proplet-v4.10.9-play-one-screen1`. Třináct aktivních cache cílů včetně obou producentů Tajenky, klidného režimu, dynamického quality loaderu a náhradního home-layout URL má sjednocené odkazy; stávající rozdělení shellu a doplňkového offline manifestu zůstává zachované. Nezměněné patrony, měsíční pravidla a herní engine nedostávají jiné revize.

Přesná větev `codex/play-one-screen` je nově povolena ve stávajícím `LIVE_PLAYER_PREVIEW` za současného explicitního opt-in, prostředí preview a produkčního projektu. Osm izolovaných testů hranic a Google-start návratu na tentýž preview origin prošlo bez síťového spojení a persistence. Existující přihlašovací účty a běžný postup může používat uživatel; tokeny ani localStorage se mezi originy nekopírují. Google souhlas skutečného uživatele nebyl agentem prováděn.

Vercel má nadále původní FastAPI konfiguraci a python build, žádný statický fixture outputDirectory. Lokální generovaný Studio harness slouží výhradně syntetickému QA mimo checkout; do uživatelského online preview se nevkládá. Produkční main, aliasy, prostředí, databáze a autentizační konfigurace se tímto preview nemění. Nativní `?open=free` vstup již existuje; čerstvý návštěvník má v nativním tréninku také Přihlásit se a Přeskočit trénink. Čtecí agentní vizuální kontrola online blokuje síťové API před navigací pouze v dočasné QA kartě.

Ověření cache kontraktu, unikátních service-worker URL a patron release balíčku prošlo. Online READY a skutečné GET health/config/session/free-order kontrakty budou doloženy po pushi; žádná syntetická online hra ani změna produkčních dat není součástí této kontroly.
