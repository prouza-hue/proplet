# Archiv nejprve, měsíční soutěž samostatně
Rozhodnutí Pavla: 13. 10. 2026 (Europe/Prague). Preview; bez schválení produkčního spuštění.

## Ověřený základ
Produkce hrajproplet.cz: 4.07.1 / 7a4338f10d89ae21680cd133e1725260f5231856,
Vercel dpl_39944BGfL8WKDdnivA4Rwyhvd4iW READY, main.
PR188 zůstává historický podklad (4.05.2, konfliktní proti dnešnímu main).
Nová větev musí obsahovat main jako předka; staré celé sdílené soubory nekopírovat.

## Dvě vydání
1. Archiv v nejbližších dnech podle připravenosti a samostatného schválení.
   800 původních desek, 4 obtížnosti, volný výběr, 879 úplných schválených řešení.
   Vlastní archivní CTA ve schváleném stylu Gen6 / 300 desek.
   Žádná měsíční karta, route, skript ani CTA v tomto buildu.
2. Měsíční soutěž od listopadu 2026. Její původní vizuální podklady a pravidla
   zůstávají v PR188 (20428b4d5a43a8ea2c4ac6099deb47592f2ef889), neztrácejí se.
   Před listopadovým releasem přenést na tehdy aktuální main a znovu ověřit.
   Archiv je samostatně nasaditelný bez této soutěže.

## Vizuální pravidla
Ikona vlevo, titul a informace vedle ní; původní ilustrace Tiskařské dílny.
U obtížností zůstává nativní rozklik počtu odehraných desek vpravo nahoře.
Plná akce spouští hru; ohraničená otevírá katalog/pořadí. Sdílení zachovává
aktuální růžový vzhled pozvánek. Písmo Outfit; Fraunces pro značku a úvodní CTA.
Denní výzva dominantní; Extra uvnitř současné karty. Původní pozvánkové bloky
se nepřekreslují a zachovávají své kontextové místo. Na Hrát nové desky,
šest obtížností, Tajenka, Archiv.
Žádné eyebrow nadpisy, paralelní click-targety ani rozdílné verze téže karty.

## Co především nesmí zmizet
- 4.05.3 první herní telemetrie a zachování uzlů odznaků.
- 4.05.4 sdílení Daily s úplným snapshotem, funkční HUD.
- 4.05.5 statistiky šesti obtížností a osobní časy.
- 4.06.0 Extra: středa/pátek/neděle, samostatný režim daily_special a 100 XP,
  pouze základní Daily udržuje sérii; od 14. října. Neměnit publikované bindingy.
- Omezení egress v pořadí z PR194.
- 4.07.0 pozvánky: pět nových různých desek po registraci, +1000 XP oběma
  atomicky a jen do celoživotních XP; trvalé zavření připsané odměny.
- 4.07.1 volba konkrétní deska / nový hráč ze správného tlačítka na Dnes,
  Tajence i výsledkovce; současná kompaktní výsledkovka a růžové CTA.
Backend, referral renderery a Daily Extra moduly se přebírají z main beze změny.
Ve sdílených souborech pouze úzké podmíněné archivní hooky.

## Náhled a průkaznost
Izolované zařízení Alex; oddělené úložiště, API zápisy zachyceny lokálně.
Extra a pozvánkové stavy v ovládání náhledu používají označená modelová data.
Budoucí neveřejné Extra desky se nesmí odhalovat; k ukázce se použije veřejná
deska s testovacím ID. Skutečné odměny a transakce nejsou tímto simulovány
jako produkční důkaz.
Žádný automatický modal Archivu; otevření přes ovládání náhledu. Produkční
oznamování doplnit po schválení, respektovat onboarding, Extra, pozvánky a hru;
nejvýše jedna nabídka současně, žádné vrstvení CTA.
Šířky 320/390/690/1440 jsou emulace, nikoli fyzický test Fold.

## Před schváleným spuštěním Archivu
- Reověřit aktuální main a vydat už ověřený kandidát.
- Připojit náhledové historické nároky k autoritativnímu serverovému čtení
  a jednorázovému atomickému zápisu. Zachovat základ z PR177; nespoléhat
  na lokální claims z preview. Ověřit historickou odměnu již získanou,
  nezískanou navzdory novější desce, opakování a souběh variant stejného slotu.
- Zkontrolovat připravené editorial manifesty/879 řešení a serverovou validaci.
- Vytvořit produkční variantu bez synthetic profilu, API adapteru a reviewcontrols.
  Builder záměrně blokuje produkční nasazení náhledu.
- Společná fronta jednorázových oznámení: Archiv nesmí přebít existující intro.
- Teprve potom schválit přesný release, zapnutí flagu a produkční smoke.

## Listopadová soutěž – oddělená příprava
Schválená metodika: první platné dokončení základní Daily v den zveřejnění;
100 bodů +20 bez nápovědy; nejlepších 20 dnů, maximum2400; rychlost nerozhoduje.
Extra, Archiv, Volná hra ani pozvánkové/celoživotní XP skóre nezvyšují.
Kalendářní měsíc ve středoevropském čase včetně letního; interně Europe/Prague.
Shodné body sdílejí místo (1,1,3); každý na příčce1–3 získá měsíční odznak,
nikoli XP. Po konci48h kontrola a potom uzavření/odměny.
První listopadový měsíc nesmí předstírat říjnové vítěze; použít schválený
první-sezóna stav. Od prosince výrazné pódium listopadových vítězů.
Zbývá samostatně dokončit serverový ledger, uzávěrku/ties/odměny, datové čtení
pódia a produkční featureflag. Existující modelové pódium není hotový backend.
Soutěž spouštět novým releasem/CTA až po ověření těchto bran.
