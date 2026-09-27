# Proplet — preview týmového vítězství

Předání: **27. 9. 2026**. Izolované vizuální preview, nikoli nasazený systém odměn.

- [Otevřít oslavu v Propletu](https://proplet-lno44c4ba-pavel-prouzas-projects.vercel.app/)
- [Ovládání stavů, rozměrů, tématu a pohybu](https://proplet-lno44c4ba-pavel-prouzas-projects.vercel.app/preview/team-victory/review.html)
- [Čtyři odznaky ve velkém detailu, 32/48/64 px a zamčeném stavu](https://proplet-lno44c4ba-pavel-prouzas-projects.vercel.app/preview/team-victory/gallery.html)

Oslava se otevře automaticky. **Jdeme pro další** ji zavře a vrátí na Dnes. **Vitrína týmu** otevře společné úspěchy. **Přehrát oslavu znovu** je samostatně označený nástroj preview; nevyžaduje účet a nic nepřičítá.

## Baseline a rozsah

Aktuální produkce i main byly před prací a znovu po implementaci ověřeny na SHA `f07a43d1a8a841ea1ef095a161fda5e47a511238`. Produkční deployment zůstal `dpl_CFegzSHRod9Vw8nYpesSiGaAjQQx`. Historické zdroje **00 — Proplet Pro START** a **01 — registr** z 17. 9. byly přečteny jako kontext, ne použity místo aktuálního stavu.

Větev: `preview/team-victory-20260927`.
Ověřená implementace: `cd570c3f5b522b9a1332fe6b741dff1bda7a30cf`.
Preview deployment: `dpl_2qteDaLeSJHjZW9MvLaeTgCXQbjG`, stav READY, target preview. Odkazy výše jsou na tento konkrétní ověřený deployment. Následný dokumentační commit pouze archivuje toto předání a screenshoty.

Přidané soubory jsou v `public/preview/team-victory/`. `app.html` používá původní aplikační shell a skutečné nezměněné skripty, styly, navigaci a assety z připnuté baseline. Nejde o novou aplikaci. Jediný konfigurační zásah mimo tento adresář je **preview-only `vercel.json`**, který publikuje pouze statické soubory a blokuje `/api/*`; neslučovat ho do main. Původní assety ani jiné rozpracované větve nebyly změněny.

## Výtvarné návaznosti

Produkce byla skutečně otevřena: Dnes, pořadí týmových XP, profil s hodnostmi. Nepřístupné přihlášené týmové stavy byly dohledány v existujících komponentách, nikoli vymyšleny jako skutečné obrazovky. Screenshoty byly vizuálně prohlédnuty.

Zůstává skutečný wordmark **Fraunces**, vlastní červený blok P a původní navigace. Nové dialogy dědí skutečné tělové písmo **Outfit**, ne Fraunces. Používají aplikační proměnné `--td-paper`, `--td-ink`, `--td-muted`, `--td-line`, modrá tlačítka a tlumené zlaté akcenty. Ověřené světlé hodnoty: papír `#FFFCF5`, text `#202B39`, linky `#D8D2C7`; primární akce `#235BCC`, zlato `#F8C742`. Rádiusy odpovídají stávajícím kartám a dialogům (9–20 px), bez nové ornamentální vrstvy.

Obrazovými referencemi nových ilustrací byly skutečné assety `public/rewards/printshop/rank-05.svg`, `rank-16.svg`, `rank-32.svg`: prostorové fazetované tvary, malířská textura, modrá/červená/zelená/zlatá a tmavé kontury. Nové transparentní WebP jsou uložené odděleně. Denní zlato používá nezměněnou stávající medaili `medaile.svg`; odznaky mají jiné siluety a význam.

| Milník | Pracovní práh | Stav ukázky |
|---|---:|---|
| První otisk | 1 vítězství | Získán |
| Zlatá parta | 5 vítězství | Zamčeno, 1/5 |
| Mistři dílny | 15 vítězství | Zamčeno, 1/15 |
| Legenda Propletu | 30 vítězství | Zamčeno, 1/30 |

## Co je simulované

Návrat 28. 9. 2026 po **demonstračním** prvním vítězství Kupkových 27. 9. v denních týmových XP. Není to tvrzení o skutečném vítězi a nesouvisí to s výsledkem Denní výzvy. Počítadlo se vizuálně změní 0 → 1; vitrína obsahuje přesně jedno společné zlato a jeden milníkový odznak. Žádné stříbro, bronz, odměny za účast, XP bonusy, multiplikátory ani podmínka série. Milníky medaile nespotřebovávají.

Profil, datum, tým, statistiky a odpovědi API jsou lokální demonstrační data. Úložiště je pouze v paměti a načtení stránky znovu spustí ukázku. Trvalé medaile, uzávěrka žebříčku a automatické připsání po pozdějším návratu nejsou backendově implementované; preview ukazuje jejich schválenou podobu.

## Ověření

| Oblast | Výsledek |
|---|---|
| Rozměry | Prohlédnuto 360×740, 390×844, rozložený Fold 768×900, desktop 1280×900 a přímá desktopová stránka. Jde o CSS viewporty v prohlížeči, nikoli fyzický Samsung Fold. Klasický scrollbar uvnitř rámu odečítá 15 px od obsahové šířky. |
| Ovládání | Oslava, okamžité zavření tlačítkem i Escape během počítadla 0, návrat na Dnes, otevření skutečné herní desky, vitrína z oslavy i připomínky, opakované přehrání. |
| Počítadlo | Pozorováno 0 po začátku a 1 po animaci; vitrína stále 1 zlato, 1/5, 1/15, 1/30. |
| Rozložení | Bez horizontálního přetékání na zkoušených šířkách. Delší vitrína na úzkém mobilu svisle scrolluje; tlačítka jsou dosažitelná. Obrázky odznaků ověřeny jako načtené. |
| Témata | Světlé, tmavé a systémové. Ve tmě zvýšen kontrast získaného stavu. |
| Omezený pohyb | Použitý tentýž reduced-motion kód přes explicitní přepínač preview; výsledná animace `none`, počet rovnou 1. CSS respektuje i systémový `prefers-reduced-motion`. Nastavení skutečného OS nebylo měněno. |
| Animace | Konečný otisk 850 ms, krátký akcent a přičtení. Žádný automatický zvuk, polling ani nekonečná oslavná animace. |
| Konzole a syntaxe | Na finálním preview nebyly zaznamenány aplikační chyby ani varování; chyby rozšíření cloudového prohlížeče jsou mimo aplikaci. `node --check` pro nové skripty prošel. |
| Izolace | Samostatný statický Vercel build, žádný API backend ani cron. `/api/me`, POST `/api/result`, POST `/api/product-events/batch` a `/sw.js` vracejí 404. |
| Síť a data | Test síťového adaptéru potvrdil blokování externích požadavků a zápisů; jediný předávaný fetch čte statický `/puzzles.json` bez credentials. Reálné tokeny ani uložený účet se nečtou; service worker, beacon, WebSocket a XHR jsou zablokované. Analytické skripty odstraněné z preview shellu, CSP blokuje externí připojení. |

Do produkce nebylo nasazeno, nic nebylo sloučeno do main, nebyly použity databázové přihlašovací údaje a nebyla měněna produkční data.

## Skutečné screenshoty

| Srovnání | Snímek |
|---|---|
| Aktuální produkční Dnes, 27. 9. | [production-before.jpg](production-before.jpg) |
| Stejné původní komponenty, lokální demo bez nové odměny | [baseline-mobile.jpg](baseline-mobile.jpg) |
| Nová oslava, úzký mobil | [victory-mobile.jpg](victory-mobile.jpg) |
| Dnes po oslavě | [after-mobile.jpg](after-mobile.jpg) |
| Oslava, desktop | [victory-desktop.jpg](victory-desktop.jpg) |
| Vitrína, desktop | [cabinet-desktop.jpg](cabinet-desktop.jpg) |
| Oslava, Fold / tmavé téma | [fold-dark.jpg](fold-dark.jpg) |
| Vitrína, Fold / tmavé téma | [cabinet-dark.jpg](cabinet-dark.jpg) |
| Velké i malé odznaky, zamčené stavy | [team-badges.jpg](team-badges.jpg) |

Snímky jsou přímé z prohlížeče, bez dodatečných výtvarných úprav. Produkční srovnání používá reálný den 27. 9.; preview simulovaný následující den. Původní stav v kontrolním panelu umožňuje srovnání téhož demo dne bez ocenění.
