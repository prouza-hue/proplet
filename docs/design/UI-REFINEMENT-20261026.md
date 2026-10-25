# Oprava návrhu podle hráčských screenshotů

26. 10. 2026. Pracovní větev `codex/studio-edition`; pouze Vercel preview.
Produkční základ ověřen jako `cc54c0a` (Google OAuth oprava). Backend, databáze,
přihlášení a propojení preview s reálnými účty se v této úpravě nemění.

## Rozhodnutí

- Odstraněn plošný přepis nadpisů na Fraunces a plošné přebarvování tlačítek.
  Profil, pořadí a katalog znovu používají vlastní funkční typografii a barvy.
- Dnes začíná přímo Denní výzvou. Duplicitní nadpis Dnes a datum nejsou viditelné.
  Papírová denní karta, modré hlavní tlačítko, žluté XP samolepky a současná
  ilustrace kalendáře drží identitu hry.
- Před výzvou je hlavní akce Denní. Po ní se nabídne dostupná Extra s barvou její
  obtížnosti. Po dokončení obou se denní souhrn zmenší a výběr volné hry posune výš.
- Desktop má hlavní výzvu vlevo a Extra/Tajenku vpravo. Fold pod 900 px má hlavní
  výzvu přes šířku a doplňky v párech. Pod 600 px se skládají do jednoho sloupce.
- Týden má zřetelné buňky a zvýrazněný dnešek. Extra ikona je uvnitř vlastní buňky
  vedle základní obtížnosti, nikoli absolutně přilepená k jejímu rohu.
- Volná hra a soutěž mají obsahově vysoké řádky. Odstraněny prázdné gridové řádky,
  zdvojené mezery a dekorativní separátory. Postup zůstává stručný na konci.
- Hrát zachovává barevné herní karty, původní ilustrace vlevo, počitadla a plná
  tlačítka. Jeden sloupec na telefonu, dva na Foldu, tři na velkém desktopu.
- Pozvánka není znovu v dokončené Tajence na Dnes. Ve výsledku, profilu a Hrát
  zůstává dostupná; její text je vycentrovaný a nemá zdvojenou šipku.
- Tmavé prostředí používá břidlicový podklad, světlejší povrchy a plné barvy her.
  Nové tokeny platí pouze mimo hraní. Herní deska a její paleta zůstávají původní.
- Prohodit strany se řídí skutečným umístěním desky a ovládání, nikoli samotnou
  kategorií zařízení. Ve skládaném tréninku je skryté, na desktopu zůstává.

## Ověření a hranice

- Prohlédnuté skutečné komponenty v Chrome: 320, 390, 690, 768 a 1440 CSS px;
  světlý i tmavý vzhled, host i reprezentativní přihlášený hráč, před výzvou,
  po Denní, po obou výzvách, dokončená Tajenka, Hrát, Já, Pořadí a trénink.
- Jde o emulované rozměry, nikoli test na fyzickém Samsungu. Přihlášené a dokončené
  stavy byly pro vizuální kontrolu izolované lokální fixtures; žádné syntetické
  hraní nebo zápisy do skutečného hráčského účtu.
- Na 320 px ověřeno nepřekrývání názvů všech šesti obtížností s počitadly.
  Kontrolované stránky neměly vodorovný přesah.
- Devět nových kombinací text/podklad: kontrast 5,20–10,71 : 1. Nejde o tvrzení
  o kompletním auditu přístupnosti celé existující aplikace.
- Celý aktuální gate: 183 testů, 170 kontrol assetů a 521 kontrol syntaxe, vše PASS.
  Následné úpravy byly pouze CSS; finální asset kontrola a diff kontrola prošly.
- Doplněné behaviorální regrese chrání přesun souhrnu výsledku a smysluplné
  zobrazení přepínače stran. Rozšířená browser regrese je v existujícím CI;
  lokální vizuální kontrola proběhla přes ovládaný prohlížeč.
- Aktuální cache marker: `proplet-v4.09.13-studiorefinement4`;
  styl `studio-edition.css?v=refinement4`. Odkazy na app/theme-init a service-worker
  cache jsou sladěné; modul Archivu používá `experience.js?v=config-recovery1`.

## Doplnění podle skutečného pondělí

Navazuje na připravené preview commitu `4410574`. Ve dnech bez Extra nezůstává
vedle Denní výzvy prázdné místo: na desktopu ho využívá Volná hra a soutěž se
zobrazí jako stručný řádek. Na šířkách 600–899 px má samostatná Tajenka kompaktní
řádkové uspořádání. Podmínka vychází ze skutečné dostupnosti Extra, není natvrdo
vázaná na pondělí ani datum.

V předchozím preview dostala modrá ilustrace kalendáře malou světlou podložku,
aby se neztrácela na modrém hero. Tuto variantu uživatel následně odmítl;
nahrazuje ji rozhodnutí níže. Původní asset se nepřebarvuje.

Pro toto doplnění prošel cílený release/cache kontrakt a všech 170 kontrol assetů
(162 lokálních odkazů). Celý runtime gate se kvůli samotnému CSS neopakoval;
jeho předchozí výsledek 183/170/521 PASS zůstává doložený výše.

## Obnova po přechodné chybě konfigurace

Skutečný studený příchod v Chrome odhalil, že nedostupná veřejná konfigurace mohla
zůstat uložená jako dokončený příslib s hodnotou `null`. Archiv se potom nainstaloval
až po opětovném načtení stránky; Dnes mezitím používalo starší katalogové uspořádání.

Revize `studiorefinement3` ponechává potvrzené `true` i výslovné `false`, ale
neznámý výsledek dovolí načíst znovu. Obnova je sdílená mezi souběžnými voláními,
čeká na připravenou aplikaci a kontroluje probíhající hru před požadavkem i po
jeho dokončení. Pokud hráč během čekání začne hrát, instalace počká na bezpečný
návrat; již potvrzená konfigurace se nemusí znovu stahovat.

Cílená regrese ověřila první chybu a následné úspěšné načtení bez reloadu,
výslovné vypnutí navzdory starší cache, neznámý offline stav, souběžné volání
a přechod do hry během čekání. Prošly také dosavadní kontroly odměn, účtové
izolace, offline obsahu a release/cache kontrakt. Backend, databáze a herní stav
se touto opravou nemění.

## Papírová Denní výzva — rozhodnutí 26. 10. 2026

Uživatel odmítl samostatnou světlou podložku pod kalendářem. Celá základní Denní
výzva proto používá teplý papírový povrch, na kterém má původní modrá ilustrace
přirozený kontrast. Modrá zůstává na hlavním tlačítku a detailech. Schválené
rozložení, chování a barevné řešení Extra se zachovávají. Jde pouze o CSS úpravu
pro preview; produkční nasazení není součástí této změny.

Pro revizi `studiorefinement4` prošel cílený release/cache kontrakt a 170 kontrol
assetů (162 lokálních odkazů). Celý 183testový gate se pro tuto CSS změnu neopakoval.

Snímky a logy jsou u místního úkolu ve `studio-refinement-evidence-20261025/`
a `studio-refinement-current-gate-20261025.log`. Produkční nasazení není součástí.
