# Proplet v3.21.1

Aktuální release: **v3.21.1 — Fold viewport hotfix** nad v3.21 First Touch & Game Feel.

Hlavní novinky:

- v3.21.1 opravuje reálný Fold7 viewport: rozložený režim je tablet, složený landscape zůstává chráněný a fold/unfold spouští stabilní reflow,
- v3.21 přidává samostatný kurátorovaný první Proplet 5×5 (MRAK / JABLKO / ČOKOLÁDA / AUTOBUS), který po onboardingu rovnou učí hru hraním a dává skutečných 10 XP,
- dokončená deska dostává jemný ambientní progres a krátký solved-board moment před výsledkovkou,
- chybné cesty jsou lokálně viditelné, tahy kratší než 4 písmena se nepenalizují a Reset má bezpečné `VRÁTIT`,
- rozložený Fold7 se chová jako tablet v portrait i landscape; složený telefon si zachovává landscape guard,
- hráčské texty jsou očištěné od interních pojmů jako Gen2 / slot.
- nový kurátorovaný Lexicon v2 s 3 153 cílovými lemmaty a metadaty `familiarity`, `complexity`, `fun`, `theme`, `register` a `age_floor`,
- banka 800 Free úrovní: 200 Snadných, Středních, Těžkých i Mozkožroutů,
- unikátní Gen2 puzzle ID, přísná jednoznačnost řešení a minimálně 24 mezilehlých úrovní před opakováním slova,
- první stovka Mozkožroutů zůstává odvážná; nová stovka má umírněnější mix C/D a ručně zúžený výběr Tier D,
- původní Free desky zůstávají v archivu `legacyFree` a jejich časy se nemíchají s Gen2 leaderboardy,
- postup hráče se převádí po slotech obtížnost + číslo úrovně; XP, hodnost, achievementy i historie zůstávají,
- převedenou Gen2 desku lze dobrovolně zahrát pro nový čas a leaderboard, ale bez druhé XP odměny.
- všech 365 Daily úloh je nově vytvořeno z Lexiconu v2 s rodinným mixem A/B/C a vlastními ID `g2-d-*`,
- každá Daily má alespoň jedno slovo s `fun` 4–5 a kruhový anti-repeat nejméně 24 mezilehlých dní,
- původní Daily banka je archivovaná; staré a offline výsledky se bezpečně přijmou, ale leaderboard nemíchá dvě různé desky.
- Pomocník se nastavuje už v onboardingu podle skutečného času 45 / 70 / 100 sekund nebo „nenabízet“, s přesným popisem dopadu před uložením,
- hráč se starou Daily pro dnešní datum může dokončit aktivní Gen2 desku; výsledek se započítá do týdne bez druhých 100 XP.
- každé dokončení dostane krátkou hravou pochvalu podle obtížnosti; Těžká a Mozkožrout mají vlastní výrazně odměňující sadu textů,
- čisté řešení přidává ještě jednu drobnou pochvalu a stejný uložený výsledek si při znovuotevření ponechá stejný text.
- sdílený odkaz má vlastní velký náhled, favicony a instalační ikony pro Android i iOS,
- Daily výsledkovka ukazuje anonymní globální pořadí, počet dnešních hráčů, percentil a sousední výsledky bez zveřejnění jmen.
- výsledkovka Daily nabízí nový tréninkový pokus bez dalších XP a bez přepsání prvního soutěžního výsledku,
- hráč se starou generací Daily může z výsledkovky spustit aktivní desku a bezpečně převést pořadí bez ručního mazání databáze.
- samostatná, serverově chráněná administrace `/admin` je navázaná na účet Pavel / Prouza, ale používá oddělený grant;
- admin obsahuje Přehled, Quality Analytics, frontu hlášení slov, uživatele a audit zásahů;
- více nahlášených slov z jedné desky se už navzájem nepřepisuje;
- běžný přihlášený hráč už nemá přístup ke skrytým Quality datům.
- každá aktivní Gen2 Free úroveň má vlastní anonymní globální pořadí s přesným místem, sousedními výsledky a percentilem od deseti hráčů;
- výsledkovka a detail úrovně přepínají mezi pohledy **Globálně** a **Můj tým**;
- do pořadí dál platí pouze první dokončený pokus a replay zůstává tréninkem;
- vysvětlení pořadí i administrace nově jednotně používají české označení **Čistě / Čisté vyřešení**.
- hotfix 3.18.1 doplňuje do update balíčku chybějící `admin.html` a `admin.css` a přidává kontrolu `adminStatic` do `/api/health`.
- v3.19 přidává úrovně 101–200, mírnější slovní profil nových Mozkožroutů a automatickou pauzu při skrytí či ztrátě focusu aplikace.
- hotfix 3.19.1 obnovuje kompletní HTML aplikace, opravuje vstup `/admin` pro Vercel a přidává kontrolu skutečně spustitelného release shellu.
- hotfix 3.19.2 doplňuje chybějící nabídku záchrany série a odstraňuje poslední chybu čistého startu v konzoli.
- v3.20.2 při aktivní hře na telefonu naležato zobrazí čistý portrait guard, pozastaví hru i čas a po otočení zpět automaticky pokračuje; ostatní obrazovky a větší zařízení landscape neblokuje.
- v3.20.1 opravuje celoplošnou onboarding ukázku na skutečná slova PES / LES / MOC, zmenšuje stránku Pomocníka bez scrollu a dává anonymnímu hráči výrazné uložení účtu přímo vedle globálního pořadí; sekundární akce ve výsledku jsou kompaktní.
- v3.20 zkracuje onboarding na tři kroky, umožňuje uložit účet bez týmu, nabízí uložení po 1./4./10. dokončení a čistí obrazovky Dnes i výsledkovku bez zásahu do puzzle banky.

Nasazení: `UPDATE_V3_21_CZ.md`  
Migrace: `SUPABASE_MIGRATION_V3_21.sql`  
Release notes: `RELEASE_V3_21_CZ.md`  
QA: `QA_V3_21_CZ.md`  
Lexikon: `LEXICON_V2_PRODUCTION_CZ.md`  
Audity: `FREE_GENERATION2_AUDIT_CZ.md`, `FREE_EXTENSION_V3_19_AUDIT_CZ.md`, `DAILY_GENERATION2_AUDIT_CZ.md`
