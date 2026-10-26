# Dnes na jedné obrazovce — samostatný experiment

26. 10. 2026. Větev `codex/today-one-screen`, základ `e5e9df6`.
Schválené preview na `codex/studio-edition` se nemění. Žádné produkční nasazení.

## Návrh

Dnes je herní rozcestník: jedna hlavní výzva a čtyři celoplošně klikatelné volby.
Zůstávají původní ilustrace, papír, Fraunces a žluté XP samolepky. Samostatné řádky
tlačítek a doprovodné odstavce odpadají. Týdenní proužek otevírá původní přehled.

- Před Denní: hlavní Denní, pod ní dostupná Extra, Tajenka, Volná hra a Soutěž.
- Po Denní: hlavní Extra; malá dlaždice zpřístupňuje dokončenou Denní a její čas.
- Po obou výzvách: kompaktní denní výsledek, zvýrazněná Volná hra a ostatní výsledky.
- Bez Extra zbývající místo využije Archiv. Je nadále dostupný také z Hrát.
- Rozehraná volná nebo archivní hra převezme svou dlaždici; původní pokračování se
  neztrácí. Po návštěvě Extra zůstává dostupná i dosud neodehraná základní Denní.
- Celá odhalená Tajenka a detaily výsledků jsou za jedním klepnutím. Celkový postup
  zůstává v Já, kde je také stálá nabídka bonusových pozvánek.

Mobil a Fold používají hlavní plochu nad dvěma sloupci voleb. Desktop má hlavní
výzvu vlevo a čtyři větší herní tlačítka vpravo. Rozměry reagují i na výšku okna.
Herní deska, vstupy, pravidla, odměny, ukládání ani účtová logika se nemění.

## Důležitá hranice

Bez posouvání se vejdou běžné stavy. Výjimky mají přednost před rozměrem:
chybějící hráčský postup zachovává původní retry/přihlášení a blokuje hraní;
čekající synchronizace, přijatá pozvánka, odměna a záchrana série zůstávají dostupné.
Velké písmo nebo mimořádně nízké okno smí stránku prodloužit. Není použité ořezání
obsahu ani globální zákaz posouvání. Podrobnosti nejsou dostupné jen gestem hover.

## Implementace a ověření

Nový prezentační modul čte skutečné herní komponenty a deleguje jejich původním
ovladačům. Nevytváří vlastní výsledky ani herní relace. Jediná serverová úprava
povoluje přesný název této nové větve v již schváleném režimu skutečných hráčů;
explicitní příznak, prostředí preview a kontrola DB projektu zůstávají povinné.

Prohlédnuto v Chrome: 390 × 640, 320 × 568, 690 × 720 a 1440 × 900, světlý i tmavý
režim, před/po Denní a po dokončení. Naměřený přesah v běžných kontrolovaných stavech
byl 0 px v obou osách. Navíc 320 × 480 prošlo s odstraněnou testovací lištou pro
měření samotné aplikace. Jde o emulaci, nikoliv test fyzických zařízení.

V izolovaném náhledu ověřeno: start a návrat z Denní a Extra, návrat k základní
výzvě po návštěvě Extra, Tajenka, pokračování rozehrané hry, katalog Hrát, Archiv,
týdenní soutěž a výsledek. Týdenní dialog vrací klávesnicový fokus na viditelný
ovladač. Žádné syntetické hraní na skutečném účtu.

Celý aktuální gate: 185 testů, 172 kontrol assetů a 522 kontrol syntaxe, vše PASS.
Následné úzké opravy prezentačního modulu prošly rozšířeným cíleným testem
`test_today_one_screen_readiness.cjs` a syntaxí. Test chrání retry, stav čekání,
souběh kliknutí, přístup k základní Denní i správné označení hotové Extra.
Původní herní CSS a moduly jsou vůči základu beze změny.

Snímky a měření jsou u místního úkolu v `one-screen-evidence-20261026/`.
Před případným převzetím je vhodný krátký test s hráči: rozpoznání klikatelnosti
celých ploch, objevitelnost výsledků a subjektivní porovnání s klidnější současnou
variantou. Tento experiment ji automaticky nenahrazuje.
