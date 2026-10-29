## 1. Potvrzení výchozího stavu a izolace

- [x] 1.1 Znovu zjistit skutečný produkční deployment/SHA, main, pracovní větev a souběžné změny; zaznamenat rozdíly proti auditu 28.–29. 10. 2026.
- [x] 1.2 Potvrdit datový projekt skutečného produkčního runtime a vyhrazené testovací prostředí; zavést blokaci produkčních mutací z realizačního preview.
- [x] 1.3 Přečíst aktuální release/cache a DB fixture kontrakty, zmapovat všechny adminové endpointy včetně installerů a původní testy PR 118.

## 2. Ochrana a datové kontrakty

- [x] 2.1 Centralizovat serverový owner pin a aktivní grant pro všechny adminové cesty, explicitně vyžadovat write oprávnění u všech zápisů včetně quality-snapshot.
- [x] 2.2 Zavést společný popis období, zdroje, času generování, úplnosti a chyb; rozlišit nulu od nedostupných dat.
- [x] 2.3 Opravit stránkování, serverové hledání a true total pro hráče; doplnit přesné UUID a povolené řazení.
- [x] 2.4 Sjednotit XP seznamu a detailu s dnešním autoritativním účtem v dávkovém souhrnu včetně account rewards; ověřit dotazový plán a zamezit N+1.
- [x] 2.5 Doplnit odpovídající stránkování/filtry/true total pro support, word reports a audit; bezpečně zpřístupnit známé cílové hráčské/puzzle ID.

## 3. Základ nového adminu

- [x] 3.1 Převést shell na schválenou identitu Propletu s lokálním Fraunces/Outfit, světlem/tmou a bez eyebrow nadpisů.
- [x] 3.2 Zavést sedm sekcí s Přehledem jako výchozím a samostatné adminové moduly pro API, stav/routing a oblasti.
- [x] 3.3 Implementovat bezpečné URL výběru sekce/hráče a Back/Forward; zabránit citlivým údajům v URL.
- [x] 3.4 Implementovat nezávislé loading/empty/partial/stale/error stavy, ruční obnovu s časem zdroje a ochranu rozepsaných formulářů.
- [x] 3.5 Zpřístupnit tabulky, detail a dialogy klávesnici, Escape, návrat fokusu a mobilní reflow.

## 4. Hráči, týmy a dohledatelná podpora

- [x] 4.1 Vytvořit nový seznam a detail hráče: UUID, XP, postup, aktivita, poslední hra, tým, bezpečné stavy přihlašovacích vazeb a související případy.
- [x] 4.2 Přidat porovnání vybraných účtů a týmový přehled ke čtení; odlišit členství od historického soutěžního přiřazení.
- [x] 4.3 Vyvést obecný support z Launch do Hlášení vedle samostatného podtypu Slova; přidat vyhledání, stavy, poznámky a dostupný archiv.
- [x] 4.4 Propojit případy, hráče a puzzle a zachovat dohledání vyřízeného případu po změně stavu.
- [x] 4.5 Vytvořit Přehled s konkrétní frontou a přímými odkazy, oddělenými jednotkami a doloženou čerstvostí zdrojů.

## 5. Obnova přístupu z PR 118

- [x] 5.1 Přenést recovery funkce PR 118 na aktuální auth základ; zachovat Google PKCE, link intent a ověření providerova e-mailu, nenahrazovat dnešní auth starým souborem.
- [x] 5.2 Navrhnout a implementovat sdílený transakční challenge lifecycle pro issue/supersede/consume včetně konfliktů při finálním ověření, souběhu a idempotence; kontrolovat stav/revizi cílové identity při preview/send/consume a nepřepsat mezitím ověřenou jinou schránku.
- [x] 5.3 Zajistit fail-closed revokaci, neúčinný stav po selhání doručení a spolehlivý audit; revidovat stejný problém i v dnešním běžném auth helperu.
- [x] 5.4 Zavést validovaný serverový náhled recovery a pevné potvrzení cílového UUID se zobrazeným maskovaným e-mailem a důvodem.
- [x] 5.5 Implementovat recovery v novém detailu s rušením starých requestů/generací a kontrolou identity při renderu i odeslání.
- [x] 5.6 Ověřit callback origin pro každé prostředí, hash/expiraci/rate limit, maskování odpovědí/auditu a jasné rozlišení odesláno/čeká/ověřeno/selhalo.

## 6. Obsah, kvalita a provoz

- [x] 6.1 Zpřístupnit program dnešního a nejbližšího publikovaného obsahu podle aktuálního runtime; jasně oddělit analytické pokrytí režimů.
- [x] 6.2 Převést Quality se zachováním kalibrace, calm mode a vyloučených ID; doplnit 90denní okno, první životní pokusy, vzorek a omezenou historii.
- [x] 6.3 Zapojit quality-history a autorizované snapshoty včetně prázdných/chybových stavů.
- [x] 6.4 Zapojit read-only account-integrity a push-diagnostics s jejich skutečným rozsahem a bezpečnými limity.
- [x] 6.5 Vytvořit provozní pohled s bezpečnými metadata vydání, typy chyb a dostupným request ID; poslední plánované běhy zobrazit jen s doloženým zdrojem.
- [x] 6.6 Doplnit filtrovatelnou Historii s jednoznačným výsledkem, cílovými odkazy a bezpečnými detaily zásahů.

## 7. Současná analytika

- [x] 7.1 Ověřit emitované události a serverové signály aktuálního board-v3-short včetně přeskočení tréninku, první skutečné hry, autentizace a potvrzeného uložení.
- [x] 7.2 Definovat a implementovat verzovaný funnel s populací, jmenovatelem, pokrytím a počátkem měření; chybějící kroky označit, případné doplnění eventů zahrnout do rozsahu.
- [x] 7.3 Implementovat D1/D7 pouze nad dozrálými kohortami, s oddělením návštěv, lokálních hráčů a účtů a respektováním skutečných vazeb/preferencí měření.
- [x] 7.4 Přesunout starý board-v2 Launch do označené historie; opravit názvy metrik počítajících pokusy místo hráčů a uvádět přesná období.

## 8. Smysluplné ověření a release candidate

- [x] 8.1 Přidat behaviorální regresní scénáře pro autorizaci všech adminových cest, druhý owner grant, chybějící write právo a citlivé výstupy.
- [x] 8.2 Ověřit recovery A→B s opožděnou odpovědí, obsazený e-mail, změnu ověřené schránky/auth revize cíle během čekání, neověřeného providera, expirovaný/použitý/superseded token, souběh a selhání revokace/doručení/auditu.
- [x] 8.3 Provést celý e-mail→ověření→obnova hesla v izolovaném prostředí a vyhrazené schránce; žádní produkční hráči jako fixture.
- [x] 8.4 Ověřit XP s bonusy, stránkování více než 200 záznamů, dohledání vyřízeného supportu, partial-source failure a správné analytics denominátory/nezralé kohorty.
- [x] 8.5 Zařadit potřebné regrese do aktuálního manifestu/workflow a spustit celý dotčený gate; nepsat testy pouze zrcadlící CSS nebo statické popisky.
- [x] 8.6 Ověřit browser průchody desktop1440/mobil390/úzký320/Fold690, světlo/tmu, klávesnici a fokus, reload a Back/Forward; uložit skutečně prohlédnuté důkazy.
- [x] 8.7 Dokončit release/cache kontrakt a připravit konkrétní RC, draft PR, preview, výsledky kontrol a rollback zachovávající bezpečnost k rozhodnutí o vydání.

## 9. Produkční vydání — mimo aktuální autorizaci

- [ ] 9.1 Po rozhodnutí o vydání znovu ověřit main/RC/prostředí/databázi a provést schválený produkční postup s nedestruktivními migracemi.
- [ ] 9.2 Ověřit produkční URL, oprávnění, verzi, čerstvost zdrojů a chybové logy bez testovacích mutací skutečných hráčů; zaznamenat datum, SHA/deployment, ověření a otevřené body.

Druhá etapa citlivých týmových/identitních oprav není součást tohoto implementačního seznamu. Vyžaduje samostatný konkrétní návrh a akceptační scénáře. Implementační stav odpovídá ověřeným krokům. Produkční úkoly 9.1–9.2 jsou výslovně odložené: uživatel autorizoval samostatnou větev a preview, nikoli main nebo produkci.
