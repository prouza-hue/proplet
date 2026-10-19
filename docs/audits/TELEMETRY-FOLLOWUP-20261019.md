# Ověření měření první hry a JavaScriptových chyb

Oprava 4.09.8, client_release proplet-v4.09.8-telemetry1, obnovuje nekompatibilní first-steps modul před začátkem hry, zpřesňuje diagnostiku chyb a vrací produkční sběr Vercel Web Analytics a Speed Insights. Nemění desky, odměny, allocator, účty ani definici aktivace.

## Rozsah opravy

Prokazatelnou příčinou výjimky captureFirstGame je volání nevolatelné metody na existujícím objektu. Konkrétní produkční způsob vzniku takového objektu není historickými stacky doložen. Při nekompatibilním rozhraní se jedním sdíleným požadavkem načte verzovaný modul. Neúspěch ani desetisekundový timeout nesmí vyměnit aktuální hru, založit pokus či zahodit postup; další výslovný start může obnovu zopakovat. Obnovený completion hook nahradí starý se stejným ID, nepřidá druhý.

Transport chyb se načítá před app.js. Nový klient si převezme jedinou sadu listenerů; starý dál používá vlastní listenery a úzký transportní adaptér. Původce se určuje jen konstantou skutečně běžícího app.js. reporter_release označuje transport, nikoli původce. Před dostupností konstanty zůstává client_release neznámý a uloží se unknown_producer_reason=before_app_release. Starý dokument bez nového transportu může stále hlásit unreported; historie se nepřeznačuje.

source_availability rozlišuje available / opaque / missing. Odesílají se nejvýše tři souřadnice souboru na stejném originu, bez query, fragmentu, hostu, jmen funkcí a surového stacku. Obecné Script error. nemusí prohlížeč zpřístupnit; opaque je přesnější označení, nikoli vyřešená příčina. Server přijímá jen omezené validované souřadnice a ponechává neznámou verzi neznámou.

## Přijímací kritéria

| Oblast | Podmínka úspěchu | Ověření |
|---|---|---|
| Obnova modulu | Chybějící i nevolatelná captureFirstGame nevyvolá TypeError; obnova předchází přípravě pokusu a výměně hry | test_telemetry_followup.cjs a first-game-safety browser |
| Selhání obnovy | Chyba načítání zachová objekt hry, účet i dokončený postup; výslovné opakování funguje | Jednotkový test a skutečný desktopový klient |
| První hra | PES–LES–ČAJ → g4-e-009 → dokončení → nabídka účtu na desktopu 1440, mobilu 390 a Foldu 768 px | 10 kontrol test_first_game_safety_browser.cjs |
| Počet a propojení | Po jednom řádku assigned, started, completed a offer; stejné flow, varianta, bucket, deska, model, skutečný producer a attempt_id; duplicity zvlášť | Přijaté HTTP události a organický SQL readout |
| Výsledky a profil | Chybějící odznak a historie se vykreslí; přechod ze starého PWA 4.05.3 zachová účet, postup a statistiky | first-game-safety a test_profile_statistics_browser.cjs |
| Diagnostika JS | Správný client_release a samostatný reporter_release, bezpečné souřadnice nebo opaque/missing; neznámý bootstrap nezdědí serverovou verzi; jediná sada listenerů | Skutečná serverová trasa s izolovaným writerem, privacy testy, client-diagnostics browser |
| Vercel | Jedno načtení obou SDK na kanonické produkci; webový i výkonnostní payload bez URL parametrů; žádné načtení v preview, tutorial a OAuth návratu | test_platform_analytics_browser.cjs; lokálně i se skutečnými SDK přečtenými pouze GET |
| Nasazení | Přesný ověřený SHA, READY deployment a shodný app/SW/runtime release | Samostatná čtecí kontrola po nasazení |
| Organická data | Žádné chybějící očekávané události u přímo propojených pokusů, žádné nadbytečné řádky ani návrat sledovaných JS podpisů v doloženém novém vzorku | TELEMETRY-FOLLOWUP-VERIFY.sql a přímé Vercel 5xx logy |

Lokální stav: current gate 170/170, 502 kontrol syntaxe. Prošly PWA updater, 10 onboardingových scénářů, návrat profilu ze starého klienta i desktopový/dotykový transport chyb. Jednořádková oprava ZIP cesty v test_bonus_recognition zachovává stejnou kontrolu bajtů na Windows i Linuxu.

Browser důkazy jsou v browser-results. Platformní ověření se skutečnými SDK pouze přečetlo veřejné skripty; všechny browser requesty včetně beaconů byly zachyceny v paměti. Nejde o provozní návštěvy ani potvrzení přijetí skutečným Vercel kolektorem. CI a následné organické ověření jsou samostatné podmínky.

## Diagnostika připraveného tréninku

Nové starter_v1_presentation_checked a starter_v1_idle jsou diagnostické fáze, ne nové konverzní kroky. První proběhne po dvou renderovacích snímcích, druhá jednou po deseti sekundách bez interaction. Obě mají původní starter_run_id, neměnnou provenance, čas a důvod visible / obscured / paused / not_visible / visibility / navigation. Kontrola středu desky a počtu buněk potvrzuje jen daný okamžik, ne pozornost člověka. Při interakci, odchodu, dokončení či chybě se idle časovač ruší.

Obscured při prvním snímku se nesmí přeznačit na visible jen kvůli ready. Idle není opuštění. Starší klient bez těchto diagnostik není automaticky nefunkční; jeho historie není plně srovnatelná.

## Kontrola skutečných hráčů

Používat pouze environment=production AND is_test=false po skutečném nasazení. Neprovádět další syntetické produkční průchody ani registrace. Nový release, jednotlivé staré releasy a legacy/unreported vykazovat samostatně; novější releasy posoudit podle kódu, ne lexikograficky.

Přiložené SQL je čtecí. Před spuštěním upravit hranice pražského dne. Policy je z autoritativního assignmentu; skutečné pokusy se propojují přes context.run_id. Chybějící oba eventy i přímá vazba vyžadují zvláštní diagnostický cross-check aktéra/desky/času, nikdy domyšlenou registraci. Rozpracovaný pokus nevyžaduje completion ani offer. Pozdější dokončení se označí a nezvýší uzavřený den. Případ změny klienta mezi přiřazením a startem se ukáže, nikoli zamaskuje přeznačením.

Pro JS uvést zprávu, řádky, requesty, route, čas, client_release, reporter_release a dostupné request ID/souřadnice. Stejný podpis bez zdroje nedokazuje stejnou příčinu. Zachovat samostatný přímý dotaz HTTP 5xx za celý interval; nedostupnost zdroje není nula.

Výsledek: „v dostupném organickém vzorku bez nesouladu“, „zjištěn nesoulad / návrat chyby“, nebo „zatím nelze ověřit — žádný či neúplný organický vzorek/zdroj“. Připojit počty aktérů, flow, rozehraných i dokončených pokusů a přesný rozsah. Pod 10 bez procentních závěrů. Jeden kompletní běh potvrzuje pouze tento běh, nikoli všechny klienty ani celou analytiku.

Implementace odpovídá oficiálnímu zapojení [Vercel Web Analytics](https://vercel.com/docs/analytics/quickstart) a [Speed Insights](https://vercel.com/docs/speed-insights/quickstart). Platformní návštěvníci zůstávají odděleni od first-party identit a sessions a nejsou jmenovatelem konverze účtu.
