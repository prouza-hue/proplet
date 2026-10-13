# Dokončení vizuálních připomínek — 13. října 2026

Navazuje na `archive-recovery-completion-2026-10-13.md` a připomínky Pavla k prvnímu dokončenému preview.

## Rozhodnutí uživatele

- Sedm ilustrací Mozkokalypsy je výslovně přijato k nasazení. Významy, názvy a podmínky úspěchů zůstávají stejné.
- Archiv a Extra mají jednu společnou push. Extra v společném oznámení potřebuje vlastní výrazné CTA.
- Archiv potřebuje méně textu a navigaci blízkou stávajícímu Propletu.
- Směr XP úspěchů je přijat, doplnit kvalitní ilustrace a odměňující podobu kapitol.
- Pavel ještě ověří nový náhled. Cílem je vydání **14. října 2026 v 00:00 Europe/Prague** (13. října 22:00 UTC). Nejde o schválení dosud neviděného finálního preview ani o již naplánované nasazení.

## Co se změnilo

Oznámení má dvě samostatně barevné části. Archiv nabízí původních 800 desek a tlačítko „Prozkoumat Archiv“. Extra má tři velké ikony podle dnů, odměnu 100 XP a vlastní modré tlačítko „Ukázat Extra“. Tlačítko vybere skutečnou Extra výzvu; není-li dostupná, otevře týdenní přehled. Obě části dál sdílejí jedno oznámení, potvrzení i dosavadní pravidla fronty.

Archiv má zpětné „Hrát“, jedinou větu pod nadpisem, čtyři obtížnosti v kompaktním přepínači, tři filtry a vyhledání čísla. Na telefonu je pět desek v řádku, na široké obrazovce osm. Podrobná pravidla jsou pod informačním tlačítkem a v detailu konkrétní desky. Síťová chyba, host a neověřená odměna zůstávají explicitně rozlišené. Změna nezasahuje serverový nárok ani výplatu XP.

XP pokračování je stále oddělené interaktivní designové preview. Doplněno pět původních transparentních ilustrací, dodávaných jako optimalizované 512px WebP:

| Motiv | Použití | Soubor |
|---|---|---|
| Smaragdový kompas | 150 000 XP · Vlastní směr | `xp-compass.webp` |
| Hvězdný astroláb | 200 000 XP · Mezi hvězdami | `xp-astrolabe.webp` |
| Ametystový maják | 250 000 XP · Světlo v dálce | `xp-lighthouse.webp` |
| Rubínová brána | 300 000 XP a další milníky · Další obzor | `xp-gateway.webp` |
| Otevřená kronika | Kapitoly, číslovaná pečeť a oslava postupu | `chapter-chronicle.webp` |

Všechny soubory jsou v `public/rewards/continuation/`. Výtvarný směr: bohatě provedené fantasy sběratelské předměty, zlatý kov, výrazné drahokamy, čistá silueta a skutečná průhlednost. Referencí byla již schválená nová ilustrace Krotitele Mozkokalypsy. Čísla a texty jsou přesné HTML, nejsou součástí generovaných obrázků. Motiv brány se pro další nekonečné milníky opakuje; jednotlivé prahy odlišuje číslo XP. Původních 51 hodností a 13 úspěchů zůstává v registrech nedotčených.

Kroniku doplňuje číslo kapitoly, předchozí/současná/příští kapitola a zelený průběh. Tlačítko „Ukázat oslavu kapitoly“ otevře krátkou animovanou oslavu; respektuje omezení pohybu a nemění modelová XP. V náhledu lze rozkliknout všechny milníky i původní sbírku.

## Ověření

- `test_archive_frontend.cjs`: autoritativní odměny, účet/host/offline, alternativní úplná řešení a idempotence PASS.
- `test_announcement_queue.cjs`, `test_refresh_release.cjs`: jediná fronta a zachované podmínky zobrazení PASS.
- `archive_integrated_review.py`: celá původní sada prošla po redesignu; dále rozšířena o oba cíle oznámení, opakuje se v CI na skutečném commitu.
- `archive_design_review.py`: cílené čtyři šířky, nejužší obrazovka 320 × 720; kontrola kolize nadpis/ilustrace, obě CTA, nedostupné Extra, hledání Archivu, přesné přelomy kapitol, ilustrace, oslava bez změny XP, zachovaných 13 úspěchů a nulové síťové zápisy. Výsledek a snímky ukládá CI do `public/review-evidence/`.
- Veškerá hra a produkční SQL zůstávají na dříve ověřeném runtime; produkční preflight a finální schválení jsou nutné před půlnočním vydáním.

## Jedna společná push

**Extra výzvy a Archiv jsou tady**

Třikrát týdně těžší výzva navíc. A 800 původních desek v Archivu. Co rozpleteš jako první?

Cíl `https://hrajproplet.cz/?open=daily&via=push-content`, jedna kampaň `content:extra-archive-launch-v1`. Publikum a deduplikace podle `progression-continuation-2026-10-13.md`. Odeslat až po schváleném vydání a ověření dostupnosti obou funkcí. Půlnoc je cíl nasazení, není tím automaticky určena noční hodina push.
