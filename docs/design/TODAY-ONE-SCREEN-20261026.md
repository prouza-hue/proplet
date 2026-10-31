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

## Nižší Fold a úplná patička — doplnění 26. 10. 2026

Uživatel schválil vzhled běžných stavů bez posouvání a požaduje lepší využití
nízkého prostoru na Foldu i obnovení celé původní patičky. Kontrolními cíli jsou
skutečně využitelné CSS rozměry **615 × 520** a **683 × 443**; jde o prostor
aplikace po odečtení okolních lišt, nikoli o tvrzení o fyzickém testu zařízení.
Patička se má zobrazit se vším původním obsahem. Nesmí se skrýt nebo oříznout
jen kvůli dosažení jedné obrazovky.

Úprava je pouze CSS v tomto samostatném experimentu. Rozložení zůstává pružné;
nutné chybové stavy či zvětšené písmo mohou vyžadovat posouvání. Herní chování
ani stabilní Studio preview se nemění. Nový marker je
`proplet-v4.09.13-onescreen2`, styl `today-one-screen.css?v=2`; prezentační
JavaScript zůstává na `today-one-screen.js?v=1`.

Pro toto CSS doplnění prošel cílený release/cache kontrakt a všech 172 kontrol
assetů (164 lokálních odkazů). Celý 185testový gate se neopakoval. Předběžná
vizuální kontrola čtyř Fold stavů před/po výzvě vykázala nulový přesah a viditelný
úplný obsah patičky; finální vizuální matice se zapisuje samostatně po dokončení.

Snímky a měření jsou u místního úkolu v `one-screen-evidence-20261026/`.
Před případným převzetím je vhodný krátký test s hráči: rozpoznání klikatelnosti
celých ploch, objevitelnost výsledků a subjektivní porovnání s klidnější současnou
variantou. Tento experiment ji automaticky nenahrazuje.

### Výsledek kontroly patičky a Foldu

Finální CSS používá pro rozložený Fold do 600 px využitelné výšky hlavní výzvu
vlevo a čtyři volby vpravo. Při výšce 500–600 px dostanou karty a ilustrace více
prostoru. Ve vyšším, užším okně 601–699 px se obsah opět skládá nad sebe, ale bez
zděděných příliš velkých obrázků a paddingu. Telefon a velký desktop drží dosavadní
kompozici. Dokončený výsledek využívá celou šířku levé karty pro své údaje.

Původní footer DOM zůstává zachovaný: copyright, autor, verze, Soukromí, Podmínky
a Nahlásit chybu. Flexové zalomení metadata zhušťuje, neodstraňuje. Právní odkazy
a hlášení mají 44px dotykovou výšku; staré spodní marginy 96–142 px jsou pouze
na Dnes nahrazené rezervou pro pevnou navigaci.

V běžných kontrolovaných stavech prošly bez přesahu a překrytí menu oba cíle
615 × 520 a 683 × 443 před/po dokončení, světlý i tmavý režim. Dále prošly
600 × 420 s Extra, 615 × 650, 690 × 720, 390 × 640 a 320 × 568. Údaje o rozměrech
jsou emulační předpoklad podle screenshotů, nikoli přímé měření fyzického Foldu.
Testovací lišta byla pro měření aplikace dočasně skrytá a poté vrácena.
Ověřeno otevření původního formuláře Nahlásit problém; žádné hlášení se neodeslalo.
Doklady jsou v místní složce `one-screen-fold-footer-20261026/`.
