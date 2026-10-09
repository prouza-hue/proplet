# Pozvánky — refresh 9. října 2026

## Umístění a hierarchie
- Dnes: hráč nejdřív vidí Denní výzvu a Tajenku. Za nimi je zavíratelná oznamovací karta pozvánek. Profil zachovává trvalý vstup a přehled pozvaných.
- Pozvaný: osobní pozvánka a postup přímo pod Denní výzvou; reklama na 300 desek se nezobrazuje.
- Výsledek: sdílení právě dohrané desky je první akcí této sekce. Pozvánka s bonusem má menší textovou akci s ilustrací. Zachováváme původní tlačítko i handler sdílení.
- Připsaná odměna: zavíratelná karta, historie zůstává v profilu.
- Žádné automatické překrytí první hry. Oznamovací dialog se otevírá z CTA; parametr intro=1 slouží k přímému posouzení dialogu.

## Vizuální návaznost
Čtený podklad: PR #188, docs/design/archive-discovery-contract.md na 20428b4.
Outfit pro funkční karty, Fraunces pro oznamovací CTA. Původní sova a liška se společnou řadou písmen; barevný papír a pět různě barevných kroků. Ohraničená akce pro výběr nebo otevření dialogu. Archiv a měsíční soutěž se tímto nenasazují.

## Ověření
Workflow Isolated integrated referral preview testuje lokální statický server i nasazené preview. Skutečné řešení desky tažením, registrace v izolovaném účtu, Tajenka, jednorázové připsání bonusu oběma, oddělení týdenních bodů, zavření karet, zachování původního sdílení. Snímky 320/390/690/1440 px v obou tématech, kontrola přetečení a centrování výsledkovky.
Běh 38001365245 prošel na f1926d3; další drobná copy/CTA úprava má vlastní navazující běh.

## Co brání produkčnímu spuštění
Toto je stále PREVIEW ONLY a PR #176 se nesmí sloučit do main jako celek. Izolace nahrazuje úložiště pamětí a API fixtures; údaje mizí při reloadu. Větev vznikla na starším runtime a je v konfliktu s aktuálním main 4.05.2 (1627610).
Pro produkční implementaci přenést UI na aktuální main bez preview izolace a doplnit:
1. Trvalé, serverem ověřované přiřazení nového účtu k pozvánce; zákaz self-referral, změny pozývajícího a zpětného uplatnění existujícím účtem.
2. Počítání pěti různých uznaných dokončení podle serverových dokladů; vyloučení tréninku a replay, časový limit se nezavádí.
3. Atomické jednorázové připsání 1000 XP oběma s idempotentním ledgerem; neovlivnit týdenní hráčské ani týmové body a budoucí měsíční metodiku.
4. Trvalý stav postupu a zavření oznámení, obnova po přihlášení a mezi zařízeními.
5. Zkoušky souběhu a opakovaných požadavků, ochrana zneužití, oddělené testovací prostředí, produkční vypínač a kontrolovaný rollout.
Backend ani produkční databáze nebyly touto změnou upraveny. Víkendové spuštění nelze slíbit jen na základě hotového designu.
