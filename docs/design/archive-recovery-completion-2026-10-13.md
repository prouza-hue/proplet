# Obnovení Archivu a navazujícího zadání — 13. října 2026

Stav: dokončený kódový kandidát k posouzení; produkční aktivace není provedena. Níže je připnutý runtime kandidát, ověřený preview deployment a samostatně evidované kontrolní běhy.

## Odkud navazujeme

Obnovena práce ze zaseknuté konverzace „Archiv zadání a preview“. Zdroj aktuálního náhledu je PR #197, větev `preview/archive-first-20261013`, původní HEAD `0080faab5f04054b172f63a24b4918f6fc2d0a99`. Předchozí kódový kandidát `abfd0da1f2b17084e3628fdfce1785d704781a9c` měl uložený PASS izolovaného náhledu; jeho výsledek se nesmí vydávat za ověření nynějších změn.

Při převzetí byla produkce ověřena jako Proplet 4.07.3, main `f31c8959323b8edae75e01ccd6b04ded168cf982`, Vercel `dpl_GgHHKDidThE2WYL573mvQF3ZD432`. Handover `archive-first-release-2026-10-13.md` obsahuje starší základ 4.07.1; jeho rozsah a rozhodnutí zůstávají platné, nikoli tamní údaj o aktuální produkci. Večerní `archive-review-2026-10-13-evening.md` již zaznamenává 4.07.3.

Poslední rozšířené zadání nebylo v převzatém PR implementováno: Archiv měl jen ručně otevřitelné CTA, promo 300 nových desek zůstávalo aktivní a `refresh-ui.js` stále vytvářel počítadla „N nových“. Sedm nových ilustrací a pokračování XP/hodností vznikají při tomto navázání.

## Obnovený rozsah a současná implementace

| Oblast | Co obsahuje pracovní kandidát | Hranice tvrzení |
|---|---|---|
| Archiv | 800 původních desek, čtyři obtížnosti po 200, libovolný výběr, 879 schválených úplných řešení, zachované ID a historické sloty | Bez aktivace na produkci; dokončení integračních a databázových kontrol je podmínkou vydání |
| Server a XP Archivu | Autoritativní katalog, jednotlivá deska a stav účtu; kontrola úplného řešení před zápisem; stávající atomická výsledková cesta a připravená historická odměnová migrace | Náhledový lokální ledger není důkaz skutečné databázové transakce |
| Klient Archivu | Čtení serverových claims, účetně oddělený stav, zachování rozehrané hry, uložení výsledku při nedostupném serveru, potvrzené XP až z odpovědi serveru | Hostovi ani při chybě čtení claims se neslibuje neověřená odměna |
| Oznámení | Společná fronta pro Archiv + Extra, samostatné Extra, pozvánky a původní uvedení Mozkokalypsy; pravidla pro hosta, nového a zkušenějšího hráče | Potvrzení zobrazení je v tomto kandidátu podle účtu v daném prohlížeči; nejde o serverovou synchronizaci mezi zařízeními |
| Staré promo | Automatické oznámení 300 nových desek vyřazeno; počítadla „N nových“ na obtížnostech odstraněna | Desky, jejich odměny, pestré pořadí a historie zůstávají |
| Sedm odznaků Mozkokalypsy | Nové WebP ilustrace pro milníky 1, 5, 10, 25, 50, 75 a 100, zapojené přes existující renderer, manifest a PWA prostředky; samostatná galerie s detailem | Zachované názvy, mikrotexty, významy a podmínky odemykání; nezavádí nové XP |
| Hodnosti a XP úspěchy | Samostatný interaktivní návrh a přesný kontrakt dalšího pokračování | Návrh není schválená ani produkčně implementovaná změna registrů, bodů, nároků či ocenění |
| Push | Připravený text, audience, cíl a deduplikační klíč společné kampaně Extra + Archiv v dokumentu pokračování | Nic nebylo odesláno ani naplánováno; skutečný termín Archivu není potvrzen |

Předchozí vizuální úpravy Archivu zůstávají základem: ikony vlevo, skutečná historie obtížností vpravo, jednotné akce, Archiv na Hrát za obtížnostmi a Tajenkou, zachované Extra i současné pozvánky. Wordmark Fraunces, UI Outfit a významy ilustrací Tiskařské dílny se zachovávají. Bez eyebrow nadpisů.

## Konkrétní pravidla automatických CTA

Implementační místo: `public/app/engagement/announcements.js`; registrace jsou ve stávajících modulech jednotlivých funkcí.

- Host nedostane automatické marketingové/obsahové okno z této fronty. Může hrát a sám otevírat dostupné funkce.
- Přihlášený hráč musí mít hotový onboarding a alespoň pět dokončených desek. Fronta respektuje tichou fázi prvních kroků a nevyřízenou příchozí pozvánku.
- Automatické okno se otevírá pouze na Dnes nebo Hrát, ve viditelné stránce, mimo hru a jiné modaly. Asynchronní příprava znovu kontroluje účet i obrazovku těsně před otevřením.
- Nejvýše jedno automatické oznámení za relaci panelu prohlížeče. Jednou skutečně zobrazená kampaň se eviduje pro daný účet v místním úložišti. Změna účtu zavře cizí aktivní nabídku.
- Priorita: společné **Archiv + Extra** (100), jinak **Extra** (80), potom **pozvánky** (20) a **Mozkokalypsa** (10). Společné CTA vyžaduje skutečně aktivní Archiv a jeho zobrazení označí Extra jako již představené.
- Staré CTA 300 desek se již neregistruje. Ručně otevřené detaily a oznámení nejsou další automatickou kampaní.

Tato pravidla jsou nyní konkrétním kandidátem k posouzení; neslibují globální „právě jednou“ přes více zařízení.

## Místa k posouzení

Nová základní URL preview: **https://proplet-exbmc15o5-pavel-prouzas-projects.vercel.app**. READY deployment `dpl_5KTPt6gFrhBp94T9UmFG8dzVoiVJ`, commit `ae4c773db607ac20226385c25572a63acb2a5459`. HTTP 200 a přesná shoda s lokálními bajty byly ověřeny pro index, app.js, experience.js, oba návrhové přehledy a ilustraci Krotitele. K adrese připojit:

| Obsah | Cesta |
|---|---|
| Dnes s modelovou Extra a pozvánkou | `/?review=daily&reviewExtra=mozkokalypsa&reviewReferral=member` |
| Hrát | `/?review=free&reviewExtra=mozkokalypsa&reviewReferral=member` |
| Archiv a hraní | `/?review=archive` |
| Úvodní oznámení Archivu | `/?review=announcement` |
| Sedm překreslených odznaků, rozklik detailu | `/design/mozkokalypsa-collection.html` |
| Pokračování hodností a XP úspěchů — návrh | `/design/progression-continuation.html` |

Ovládání izolovaného náhledu nabízí další modelové stavy. Datum a účty náhledu nejsou živá produkční data; Extra používá veřejnou ukázkovou desku, nikoli předčasně odhalenou budoucí banku.

Podrobný návrh pokračování a push: `docs/design/progression-continuation-2026-10-13.md`. Navrhuje ponechat všech 51 hodností a 13 XP úspěchů, po 120 000 XP pokračovat kapitolami po 5 000 XP a od 150 000 XP přidat milníky po 50 000 XP. Žádná z těchto hodnot se tímto dokumentem neschvaluje do produkce. Nové milníky zatím používají číselná jména, nemají údajně hotovou novou sadu odznaků.

## Ověření, které musí být doplněno před vydáním

Záznam vzniká během dokončování práce. Finální CI PASS ani průchod produkční databází se zde nepotvrzuje.

- Spustit aktuální runtime gate nad přesným kandidátem; zahrnuje nové testy `test_archive_build.py`, `test_archive_frontend.cjs`, `test_archive_runtime.py` a `test_announcement_queue.cjs` i upravené existující kontroly refresh/Mozkokalypsy. Zkontrolovat syntaxi, reference prostředků a migrační manifest.
- Na skutečném izolovaném PostgreSQL dokončit `tools/test_historical_free_rewards_db.py`: nezměněné historické XP a původní claims, opakovatelný seed, již zaplacená odměna, historicky nezaplacený slot přes novější desku, paralelní varianty stejného slotu, ztracená odpověď a opakování příkazu, rollback dílčí chyby, účetní izolace read RPC, RLS a grants. Skript výslovně přijímá jen syntetickou loopback testovací databázi, nikoli produkci.
- Serverová přejímka musí zahrnout všech 879 schválených úplných řešení, odmítnuté redakční varianty, neúplné či podvržené cesty, chybnou revizi, validaci před zápisem, všechna tři hradla a chybějící/nefunkční read RPC. Selhání claims nesmí vypadat jako 800 nezaplacených slotů.
- Ověřit skutečný browser flow Archivu: start, pokračování, alternativní řešení a nápověda, potvrzená odměna, replay, účet/host a přepnutí účtu. Izolovaný preview test není náhradou skutečného PostgreSQL testu.
- Zkontrolovat CTA pro hosta, nově registrovaného a způsobilého hráče, pořadí při souběhu, reload, změnu účtu během načítání avatarů a uvolnění modalu bez nového zablokování stránky. Nesmí se vracet 300deskové promo ani počítadla.
- Vizuálně prohlédnout Dnes, Hrát, Archiv, oba nové návrhové přehledy a detaily odznaků v úzkém mobilu i Fold šířce, světlé/tmavé téma. Emulace 320/390/690/1440 px není test fyzického Fold telefonu.
- Ověřit zachování existujících Daily/Extra vazeb, série, historie, sdílení, pozvánkového bonusu a telemetrie, současného updateru, nativního pořadí a výkonu bez opakovaného parsování celé historie.
- Sestavit samostatnou produkční variantu přes `VERCEL_ENV=production` a prokázat, že ve vydávaném HTML/SW ani jako dostupný soubor nezůstává `preview-isolation.js`, syntetická identita, API adaptér či review ovladače. Toto je artefakt ke kontrole, nikoli pokyn k publikaci.
- Po deployi preview porovnat SHA a skutečně doručené prostředky s testovaným kandidátem. Doplnit odkazy na CI a současné reporty; staré `public/review-evidence` nepovažovat automaticky za nové důkazy.

## Praktický postup produkčního vydání Archivu

Platí předchozí handover: nejprve konkrétní ověřený kandidát a výslovné schválení produkčního spuštění. Toto pokračování není samo o sobě schválením termínu nebo aktivace.

1. **Znovu ověřit prostředí.** Zaznamenat aktuální main, production SHA/deployment, kandidátní SHA a datový projekt `iopyhluayfszskyqqpuc`. Případné nové změny main zachovat; starý PR #188 nepřepisovat přes současné sdílené soubory. Ověřit efektivní hodnoty všech tří flagů v konkrétním nasazení, ne pouze soubor `vercel.json`.
2. **Ponechat Archiv zavřený během přípravy.** Kandidát má `PROPLET_ARCHIVE_ENABLED=false` a `PROPLET_HISTORICAL_FREE_REWARDS_ENABLED=false`. `PROPLET_ATOMIC_RESULT_V1_ENABLED=true` je již nutné pro současné výsledky včetně Extra; kvůli Archivu jej nevypínat. Serverová `archive_release_enabled()` vrací true pouze při současném zapnutí všech tří. Do té doby `/api/archive*` nejsou dostupné a `archiveEnabled` není true.
3. **Připnout databázový preflight k vydání.** Přečíst živé definice `proplet_submit_result_v1`, závislé tabulky, role, grants a aktuální migrační historii. Porovnat s přesným připraveným SQL; zejména nevytěsnit mezitím přidané opravy atomických výsledků, Extra nebo existujících referral triggerů. Zaznamenat agregované počty a součty výsledků a kontrolní otisk původních `free_slot_rewards`, bez exportu soukromých hráčských dat do veřejného PR. Pokud se živý stav liší od testovaného předpokladu, nejprve připravit a otestovat odpovídající aktualizaci.
4. **Po schválení aplikovat přesný SQL artefakt.** `supabase/prepared/historical_free_rewards.sql`, zkontrolovaný SHA-256 z `supabase/migrations/manifest.json`. Aktuální status je `prepared-not-applied-archive-only` a sám o sobě není doklad aplikace. Soubor spustit celý jako jednu transakci, bez vypouštění úvodních zámků, limitů a závěrečných invariantů. Obsahuje `lock_timeout=3s`, `statement_timeout=20s`; timeout nebo invariant znamená rollback, nikoli částečné ruční pokračování. Při potřebě změnit podmínky znovu posoudit konkrétní příčinu.
5. **Ověřit výsledek migrace před otevřením.** Tabulka `historical_free_slot_rewards` má unikátní `(player_id, difficulty, level)`, RLS a service-only čtení. Nové RPC `proplet_archive_state_v1(uuid,text[])` i zápisové `proplet_submit_result_v1(uuid,text,text,text,jsonb)` mají správná oprávnění; anonymní a authenticated role je nemohou přímo volat. Seed nesmí změnit existující výsledky, součet XP ani původní ledger. Nový historický ledger je evidence již spotřebované odměny a nesmí se podruhé sčítat do XP. Do záznamu přidat skutečné migrační ID, checksum a read-only ověření; až poté změnit stav evidence aplikace.
6. **Vydat čistý, schválený kandidát s účinnými flagy.** Pro produkční prostředí nastavit `PROPLET_ARCHIVE_ENABLED=true`, `PROPLET_HISTORICAL_FREE_REWARDS_ENABLED=true`, zachovat `PROPLET_ATOMIC_RESULT_V1_ENABLED=true`. Hodnoty se načítají při startu aplikace, proto ověřit nový deployment. Fronta společného CTA se řídí serverově potvrzeným `archiveEnabled`; ruční podvržení pouze klientské konfigurace nesmí otevírat nároky.
7. **Produkční smoke a sledování.** Ověřit health/verzi/SHA, `/api/config` a `/api/bootstrap`, katalog 800 položek a jednotlivou veřejnou historickou desku, odmítnutí neautorizovaného `/api/archive/claims`, skutečný soukromý read pro oprávněný účet a běžné Daily/Extra/pozvánky. Nezakládat testovací odměny skutečným hráčům jen kvůli smoke. Potvrzení write path vychází z izolované přejímky; případný živý end-to-end průchod musí mít jasně určený oprávněný účet a skutečný herní kontext. Zkontrolovat chyby, latenci a rozumný objem dat.
8. **Návrat při problému.** Přednostně zavřít pouze `PROPLET_ARCHIVE_ENABLED` a vydat tuto konfiguraci; podle příčiny zavřít také historické zápisy. Zachovat atomický mechanismus ostatních her. Nemazat výsledky, claims, již připsané XP ani novou tabulku; nevracet starou definici výsledkového RPC bez porovnání se současnými závislostmi. Uložené neodeslané výsledky musí zůstat k pozdější synchronizaci a již potvrzený idempotentní receipt se nesmí odměnit znovu.

V tomto obnovení nebyl proveden produkční release, aplikace SQL, zapnutí produkčních flagů ani odeslání push. Přesný termín Archivu zůstává otevřený.

## Co do tohoto vydání nepatří

Měsíční soutěž je stále samostatné listopadové vydání. Referenční návrhy zůstávají v PR #188 (`20428b4d5a43a8ea2c4ac6099deb47592f2ef889`). Do kandidáta Archivu se nezapíná měsíční karta, route, CTA, odměny ani její backend. Zbývá samostatný ledger, uzávěrka po 48 hodinách, shodná pořadí, ocenění, skutečné pódium a feature flag; první sezóna nesmí předstírat říjnové vítěze.

Pokračování hodností a XP je jen návrh. Produkční `LEVELS`, dosavadní hranice, odměnové registry a body se nemění. Zpětné přiznání a synchronizace budoucích ocenění nejsou v této větvi implementované.

Společný push Extra + Archiv se odešle až po ověření dostupnosti obou funkcí a konkrétním pokynu k odeslání. Příprava textu nezakládá automatizaci ani souhlas s dnešním/zítřejším rozesláním.

## Ověření a hranice vydání

- Runtime kandidát: `ae4c773db607ac20226385c25572a63acb2a5459`. Navazující změny pouze upravují regresní testy po záměrném odstranění starého promo a náhradě SVG ilustrace WebP; nemění dodaný runtime.
- Lokální current gate: **151 testů PASS, 157 kontrol assets PASS, 272 kontrol syntaxe PASS**, bez selhání. Cílené browser ověření: skutečné tažení slov, 879 schválených pokrytí, pokračování, alternativy a nápovědy, odměna jednou, host → účet, změna účtu i během dokončovací animace.
- CI [Current runtime gate 38454807102](https://github.com/prouza-hue/proplet/actions/runs/38454807102): **SUCCESS**; 151 testů, 157 kontrol assets, 462 syntaxí bez selhání. PostgreSQL 17.11: atomicita, souběh, replay, rollback, nezávislost G4, autentizace a nový service-only Archive RPC PASS. Skutečný pg_cron/background test i scheduled playtest PASS.
- Browser: lokální integrovaný test **PASS, 61 kontrol, 0 JS chyb, 0 přetečení, 0 síťových zápisů**; 320/390/690/1440 px a obě témata. Samostatný production-form test PASS při archiveEnabled true i false bez preview adaptéru. Prohlédnuty úzký Archiv, společné CTA, result, galerie odznaků/detail Krotitele a návrh hodností. Čtení živé produkce pro volitelné srovnávací screenshoty nebylo v lokálním Chromium dostupné přes síť; tento limit neomezuje hlavní test.
- CI [Archive review 38454807609](https://github.com/prouza-hue/proplet/actions/runs/38454807609): **SUCCESS**, production-form true/false i integrovaných 61 kontrol PASS. Parity guard: 1253 existujících produkčních souborů přesně beze změny, ostatní jednotlivě zdůvodněny. Evidence commit `63e2798b54487c89df153b4402cb4b47508412aa`. Volitelné srovnávací snímky živé produkce se nepodařilo zachytit ani v CI (prvky existovaly, ale nebyly viditelné); nejsou vydávány za hotový důkaz.
- Verified client update, Gen4 contract, referral release (10 scénářů) a Mozkokalypsa acceptance: SUCCESS.
- Dva historické browser asserts aktualizovány dle zadání: absence starého promo300 a nová ilustrace Krotitele WebP. Původní regresní požadavky zachované; lokálně kompletní refresh browser 25 kontrol PASS a achievement-details včetně 97 úspěchů, ovládání/focusu, čtyř šířek a dark/locked stavu PASS.
- Preview URL a ověřený deployment/SHA: viz připnutá adresa výše.
- Schválení vzhledu, pravidel CTA a konkrétního produkčního release: čeká na posouzení uživatele.
- Produkční migrace/deployment: neprovedeno. Push: neodeslán, nenaplánován.

