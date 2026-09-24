# Aktivace nového hráče — 24. 9. 2026

Stav: oprava a diagnostika připravené k revizi; produkční nasazení není schválené ani provedené. Zadání: ASTRA_ONBOARDING_ACTIVATION_BRIEF_CZ.md z Google Drive. START a REGISTR z 17. 9. načteny jako historický rozcestník.

## Výchozí stav a jistota závěrů

- Aktuální `main` i produkční doména: `4c1f72ed95d9d4b969b0f46bd194126c5e554670`, Vercel `dpl_HLsCg2Yz7GDCyTi9N193kTqYoyE2` (READY, production).
- Supabase `iopyhluayfszskyqqpuc`, ACTIVE_HEALTHY; pouze čtení agregací. Databáze ani hráčské účty nebyly měněny.
- Zdrojový kód čten přes GitHub na přesném SHA; dostupné veřejné soubory porovnány SHA-1 Git blob s produkcí. Nejde o použití historického lokálního checkoutu.
- Aktuální board-v2 otevírá skutečný starter 5×5: MRAK, JABLKO, ČOKOLÁDA, AUTOBUS. Žádná samostatná obrazovka PES. Živý Chrome: deska zobrazena, MRAK vyřešen skutečným tahem myši. Nejde o test fyzického Foldu.
- Vercel query posledních 7 dnů pro `/api/rolling-content`, `/api/tajenka`, `/api/product-event`: žádné vrácené runtime error clustery. To není důkaz nepřítomnosti klientských chyb.

**Vysoká jistota: chyba odesílání telemetrie.** `flush()` dosud načetl jednorázový seznam. Pokud během čekání na request vznikl další event, `track()` jej uložil, ale vrátil se ke stejnému probíhajícímu flush. Po dokončení už novou frontu nikdo nevyprázdnil. Event čekal na další vnější impuls, typicky 60 sekund nebo návrat do aplikace. Zavření bez dalšího návratu znamená nedoručený, lokálně uložený event. Deterministický test chybu reprodukuje. Chybějící completion nelze automaticky nazvat odchodem.

**Střední jistota: zbytečné čekání před starterem.** Po načtení použitelných dat onboarding čekal na dokončení aktualizace týdenní várky. Ta starter nemění a fetch nemá vlastní timeout. Vyjmutí tohoto čekání má nízký rozsah změny; další čekání na Tajenku a konfiguraci pořadí zůstává a měříme je fázemi. Neprohlašujeme celé načítání za vyřešené.

**Nízká jistota: obtížnost jako hlavní důvod propadu.** Trénink má čtyři slova a 25 polí, poslední slovo bez přímého zadání. Malý vzorek lidí u třetího slova vykazuje skutečné delší váhání, ale hlavní počty jsou zkreslené telemetrií. Redesign ani zkracování zatím nejsou podložené.

## Produkční data a odlišný jmenovatel

Reprodukovatelný SQL audit je vedle tohoto dokumentu. První pozorování identity: historie app_open, app_session_started, onboarding_started a herních pokusů. Onboarding kohorta: první platný production / measurement2 / board-v2 / non-test onboarding do 24 hodin od prvního pozorování, začátek mezi 17. a 23. 9. v časové zóně Europe/Prague. Konverze do 24 hodin od tohoto onboardingu; všech 580 oken je uzavřených. Aktéři zahrnují později přiřazené účty. Nejde o stejné vymezení jako 677 stále anonymních identit v briefu. Čísla nepřepisují původní report a drobný rozdíl 684/685 není přisuzován konkrétní příčině bez důkazu.

| Metrika | Aktéři |
| --- | ---: |
| Nově pozorované first-party identity | 685 |
| Platná onboarding kohorta | 580 |
| starter_started | 246 (42,4 % z 580) |
| starter_completed | 29 (11,8 % z 246) |
| Slovo 1 / 2 / 3, nezávisle na start eventu | 58 / 41 / 38 |
| Slovo 1 / 2 / 3, striktně po startu | 57 / 40 / 37 |
| Skutečná Daily/free zahájena / dokončena do 24 h | 51 / 31 |
| Po dokončení starteru: skutečná hra zahájena / dokončena | 26 / 21 z 29 |

Z 334 bez `starter_started` má 333 jen čtyři vstupní eventy, pak nic. Jeden má zaznamenaná všechna tři první slova bez startu — přímý důkaz podměření. Medián rozpětí vstupních eventů v této skupině je 0,7805 s. Vzor odpovídá chybě fronty, ale nerozliší všechny rychlé odchody, boty, technické problémy a nedoručená data.

Ze 217 se startem bez dokončení má 38 explicitní přeskočení a 2 přihlášení. 25 zahájilo skutečnou hru a 10 ji dokončilo. Ze 178 po odečtení skip/login nemá 157 první slovo; 12 má jen první, 2 druhé a 7 třetí. Z posledních sedmi jich pět vidělo nabídku nápovědy, medián poslední aktivity je asi 127 s. Medián zaznamenaného dokončení starteru je 76,5 s. Jde o malé a výběrové vzorky.

Provozní vedlejší signál: 53 chyb `Java object is gone`, z nich 52 na Facebook UTM cestách; dále 66 obecných `Script error.`. Jde o počty událostí, nikoli osob. Provozní tabulka nemá spojitelnou identitu, takže je nelze připsat propadu kohorty. Facebook in-app prohlížeč zůstává samostatným otevřeným ověřením.

## Varianty a volba

| Priorita | Varianta | Očekávaný přínos | Riziko | Měřitelnost |
| --- | --- | --- | --- | --- |
| 1 | Opravit odčerpávání fronty + přidat fáze | Vysoký pro správnost rozhodování; velikost herního dopadu neznámá | Nízké; omezený drain a zachovaný backoff | Přímá reprodukce, ID událostí, časy fází |
| 2 | Spouštět starter nezávisle na týdenním obsahu | Odstranění doložené zbytečné síťové závislosti | Nízké až střední; nutná kontrola pozvánek | Pomalý/zablokovaný request a čas ready |
| 3 | Kratší či snazší poslední část | Možné zlepšení dokončení | Střední; změna herního učení bez čisté baseline | Až po opravě měření, ideálně experiment |
| 4 | Pomoc po prvním skutečném zaváhání | Možné zlepšení první interakce | Střední; nevhodná pomoc může rušit | Nejprve nové first-interaction/first-correct fáze |

Vybrány 1 a úzce vymezená 2. Vzhled Tiskařské dílny, Fraunces, slova, pravidla, XP, pozvánky a nabídka účtu nejsou redesignovány.

## Implementace a bezpečnost

- Fronta po každém requestu přečte aktuální položky stejného scope. Nejvýše 100 unikátních ID na jeden flush, žádný nový polling. Zachovaný auth snapshot, trvalé 400, dočasné selhání a nejméně 60s backoff. Neodstranitelná položka nemůže způsobit nekonečnou smyčku.
- Nové additive eventy `starter_v1_requested`, `data_ready`, `ready`, `interaction`, `first_correct`, `completed`, `left`, `hidden`, `failed`, `cancelled` (vše s prefixem `starter_v1_`). Každá fáze nejvýše jednou za run, replay/reload má nový run. `requested` při bootu je kandidát na nový trénink; bez finální fáze není automaticky chyba ani odchod. `ready` je vykreslená deska po nastavení runtime; funkčnost vstupu potvrzuje interakce a browser test.
- UUID runu, čas od požadavku v ms, whitelist příčiny a `auth_at_event` pouze v existujícím JSON context. Žádné e-maily, jména, celé URL či volné chybové zprávy. Stav auth je klientská analytická deklarace, nikdy autorizace.
- Capture-time hlavičky se zachovají při čekání a claimu. Staré eventy bez nich zůstávají unknown. Claim nadále mění actor vazby; historická pseudonymní identita není identita člověka.
- Selhání dat, přípravy či renderu se měří bezpečnou kategorií. Starter promise chyba dostane srozumitelnou hlášku. Explicitní navigace a skrytí se rozlišují; skrytí není definitivní odchod.
- Žádná SQL migrace. Kanonický registry a serverový embedded seznam aktualizovány společně. Preview nadále nesmí zapisovat produkční produktovou telemetrii. CI používá pouze syntetické API na loopbacku.
- Service worker a client release změněny společně na `proplet-v4.02.2-startermeasure1`; verze URL změněných skriptů brání staré cache.

## Ověření a otevřené body

Lokální unit regresní test fronty: původní kód 2/7 PASS, oprava 7/7 PASS. Další ověření: capture-time hlavičky, backend whitelist/claim preservation/registry parity a existující přímý board onboarding test PASS. Automatizovaná browser matice a celé required gates budou potvrzeny konkrétním CI runem; bez nich není změna připravená k nasazení.

Produkční úspěch nelze potvrdit před nasazením a sběrem nové kohorty. Preview je správně izolované od zápisu produkční telemetrie; syntetický recorder testuje doručení, backend test context/ID a required DB gates smlouvu úložiště. Test fyzického Foldu a skutečného Facebook in-app browseru není nahrazován emulací.

## Rizika a rollback

Po opravě může stoupnout počet doručených eventů a zlepšit se vykazovaný funnel, i když se chování nezmění. Přerušené měřicí řady se nesmějí prezentovat jako čistý produktový uplift. Při trvalém zavření stále nelze zaručit doručení; local queue přežije jen pokud úložiště zůstane dostupné a uživatel se vrátí. Jiný účet vzniklý během flush čeká na další explicitní flush, aby se nesmíchaly identity.

Rollback: revert této PR, vytvořit nový jedinečný rollback release marker pro app i SW a cache-busting URL, nasadit obvyklým schváleným postupem. Nevracet se ručním smazáním storage nebo hráčských dat. Nové eventy/context nevadí starému čtení; bez datové migrace, bez mazání. Případné navrácení staré fronty znovu zavede známé podměření.

## Definice vyhodnocení

Kohorty v Europe/Prague, podle prvního pozorování pseudonymní identity. Odlišit všechny nové identity a validní onboarding kohortu; navíc explicitně vykázat skip/login a první skutečnou hru bez starteru. Filtry production, non-test, measurement2, board-v2 a přesný client_release. Nemíchat legacy či preview. Rozlišovat initial run a replay, unique aktéry a unique run UUID. Příchod účtu nevyvozovat ze současného player_id: použít nový auth_at_event; unknown samostatně.

Primární srovnatelné názvy: unikátní `starter_started / onboarding_started`; `starter_completed / starter_started`; first Daily/free started/completed do24h po dokončení starteru; podíl všech nových identit s jakoukoli zahájenou hrou; podíl nové kohorty s account_nudge_shown. Proporce musí používat stejnou kohortu, časové okno a pořadí eventů. Completion/onboarding_completed není další funnel krok.

Diagnostika: requested→data_ready→ready; ready→interaction→first_correct→completed. Uvést medián a p90 času, failed podle whitelist kategorie, explicit left, hidden, cancelled i nedokončené neznámé průběhy. Readiness rate pouze mezi způsobilými starter pokusy; automatický návrat/login a sdílené pozvánky oddělit. Jeden run se počítá jednou, ani když se HTTP event opakuje se stejným ID.

**Po prvním plném dni:** až všichni v kohortě mají24h okno; počet identit a eventů, zda start/word1 nezůstávají v queue, žádné completion bez ready u nového releasu, chyby a latence, držení cache verze, případné zásahy rate limitu. Pod10 v jmenovateli jen počty, bez rozhodnutí. Při selhání integrity nebo nárůstu technických chyb řešit rollback; produktový uplift ještě nevyhlašovat.

**Po sedmi plných dnech:** vyhodnotit uzavřená24h okna, rozklad příčin nedokončení, platformy měřit jen pokud jsou skutečně dostupné, porovnat výsledky po opravě měření. D1 až z uzavřených návratových dnů, D7 pouze u již způsobilých kohort. Účty a retence následně. Zkrácení tréninku rozhodnout až pokud zůstane doložený propad mezi skutečnou interakcí a dokončením; uvést absolutní počty a intervaly nejistoty, ne samotná procenta.
