# Archiv a měsíční soutěž — pravidla integrovaného návrhu

Aktualizováno podle připomínek Pavla z 9. října 2026. Návrh patří do PR #188,
navazuje na skutečný main 4.05.2 a zůstává izolovaným náhledem. Spuštění Archivu,
měsíční soutěže a databázové migrace vyžadují samostatné schválení.

## Jednotný systém karet

- Dnes: dominantní původní Denní výzva, Tajenka, Archiv, týdenní soutěž týmů,
  měsíční soutěž jednotlivců a vstup do Volné hry.
- Hrát: nové desky, všech šest obtížností, Tajenka, nakonec Archiv.
  Umístění Archivu pod obtížnostmi nahrazuje starší rozhodnutí mít jej nahoře.
- Stejná anatomie: text vlevo, vyhrazená plocha ilustrace vpravo, akce přes
  šířku karty dole. Tento vzor platí i pro dokončenou Tajenku.
- Outfit pro funkční názvy a texty. Fraunces pro značku, dominantní Denní výzvu,
  slavnostní měsíc pódia a oznamovací CTA. Nadpisy karet mají jednotnou velikost
  a váhu v rámci dané šířky; žádný samostatný font pro Archiv nebo novinky.
- Akce mají společnou výšku 48 px a typografii. Plné barevné tlačítko spouští
  nebo obnovuje hru; ohraničené otevírá výběr, pořadí nebo hotový výsledek.
  Původní barevnost obtížností zůstává zachovaná.
- Ikony jsou původní ilustrace Tiskařské dílny. Čtveřice známých obtížností
  tvoří kompaktní motiv Volné hry ve stejné pravé ploše. Názvy bereme z DIFF;
  interní klíč hardcore se nikdy nezobrazuje hráči místo Mozkožrouta.

## Měsíční soutěž

- Nahoře má hlavní prostor pódium minulého měsíce: skuteční ocenění hráči,
  avatary, body, odznaky a rozklik jejich ocenění. Běžné pořadí pódia je 2–1–3.
- Shodné body znamenají sdílené místo; při dvou prvních následuje třetí.
  Pódium nesmí skrývat společné vítěze. První měsíc má stav bez minulých vítězů;
  období kontroly výsledků je výslovně předběžné.
- Pod pódiem následuje stručný současný stav, odkaz na Denní výzvu, pořadí
  a odznaky aktuálního měsíce. Pravidla patří do dostupného samostatného modalu.
- Měsíc a rok jsou součástí proporcionálního SVG odznaku, nikoli absolutně
  umístěný HTML štítek závislý na zděděné velikosti písma.
- Copy uvádí středoevropský čas, v létě letní. Metodika zůstává 100 + 20 bodů,
  nejlepších 20 dnů, bez rychlosti a bez vlivu celkových XP.
- Náhled používá výslovně ukázkový říjen/listopad 2026. Nevyhlašuje datum startu.

## Oznamovací CTA a ověření

Reference je schválené CTA na 300 nových úrovní Gen6: Fraunces, papírový povrch,
jemné barevné podbarvení, původní ilustrace, silná jednoznačná akce a konkrétní
český text bez výplňových sloganů. Pravidla a odměny musí být srozumitelné.

Vizuální kontrola musí porovnat celé obrazovky, mobil, Fold a desktop, světlé
i tmavé téma a hotovou Tajenku. Nestačí nepřetečení bounding boxu: kontroluje se
skutečný levý okraj nadpisu, šířka odhalené fráze, čitelnost a kontrast tlačítek.

Oba nativní renderery Tajenky sdílejí `PropletArchiveExperience.placePlayExtra`.
Nesmějí přesouvat tutéž kartu na dvě různá místa přes MutationObserver.
Klonované herní akce se vážou před odebráním ID. Herní engine, obnova, nápovědy,
volný výběr 800 archivních desek a jednorázové historické XP se zachovávají.
