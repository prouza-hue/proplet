# UI refinement — preview, 27. 10. 2026

Uživatel schválil implementaci priorit z navazujícího UX auditu. Změny pokračují na `codex/today-one-screen`; zachovávají schválené kompaktní Dnes. Nejde o produkční release. Samostatná větev `codex/studio-edition` se nemění.

## Provedené priority

- **P0 · Přihlášení:** jeden nadpis, samostatné tlačítko Google, viditelný formulář a klidný odkaz pro změnu režimu. Bonus se uvádí jednou při vytvoření účtu. Nepovinný obnovovací e-mail je rozbalovací, s trvale dostupným vysvětlením nutnosti ověření. Přepnutí režimu zachovává nativní pole, hodnoty a obsluhu. Obnovení hesla i starší týmové účty zůstávají dostupné. Dialog dostává fokus bez otevření mobilní klávesnice, uzavírá cyklus Tab a vrací fokus na původní ovládací prvek.
- **P0 · Výsledek:** vlastní čas, tahy a nápovědy se zobrazí samostatně, dokud je nenahradí odpovídající viditelný vlastní řádek pořadí. Při chybě, chybějícím řádku nebo jiném opakovaném pokusu zůstává souhrn zachovaný. Číselný XP sticker a stav odměny pouze zobrazují kanonický výstup, nic nepřepočítávají. Jedna dominantní další akce, vedlejší akce v jednom řádku. Denní výzva nabízí dostupnou Extra, jinak návrat na Dnes. Výsledková akce Pozvat kamaráda pro způsobilého přihlášeného hráče otevírá původní volbu Poslat tuhle desku / Pozvat nového hráče, s ilustrací a bonusem pro každého. Host sdílí výsledek přímo. Vlastní pozvánka a bonus 1 000 XP pro oba zůstávají v profilu.
- **P1 · Pořadí:** společný přepínač Výzva / XP / Týdenní soutěž, jedna aktivní tabulka. Týmové XP za týden používají existující soutěž. Soukromá týmová účast, ostatní období XP, vlastní pozice a vitrína se zachovávají.
- **P1 · Já:** aktuální hodnost, celkové XP a vzdálenost k další hodnosti tvoří jeden celek. Stručný přehled počtů a nejdelší série je viditelný, statistické detaily, všechny hodnosti a odznaky jsou rozbalovací. Host vidí vlastní lokální postup. Neznámý stav při načítání nepředstírá nulu. Na desktopu jsou cíl a souhrn vedle sebe; otevřené statistiky využijí celou šířku.
- **P1 · Nastavení:** stručnější popisky a návrat na původní obrazovku i pozici. Běžná navigace má nadále vlastní cíl. Host si může uložit účet i z Nastavení. Stávající preference, zabezpečení, export a smazání účtu zůstávají zachované.
- **P2 · Hrát a Archiv:** viditelný odkaz Přehled, informace o další nebo rozehrané úrovni nad tlačítkem. Archiv výslovně rozlišuje získané XP od dokončení.

## Hranice změny

Bez změn backendu, databáze, přihlašovacích protokolů, pravidel odměn nebo herní desky. Zachovány původní ovládací prvky a jejich obsluhy, analytics zdroje, fronta výsledků, opakování her i onboardingové výjimky. Online preview nadále používá dříve schválené skutečné účty a serverové funkce. Automatické hraní a změny produkčních účtů nebyly součástí ověření.

Release marker `proplet-v4.09.13-ui-refinement2`; index, dynamické loadery, SW a offline seznam mají sladěné revize změněných assetů. Zákonné stránky mění pouze revizi společného theme skriptu, nikoli obsah.

## Ověření

Prohlížeč používá skutečnou aplikaci z `public/` s izolovanou lokální transportní vrstvou. Kontrolovány šířky 320, 390, 615, 683 a 1440 px, krátký Fold, oba motivy, host i člen, otevřené statistiky, návrat z Nastavení, přepínání pořadí a návaznost výsledku na Extra. Ověřen fokus nadpisu přihlášení, cyklus Shift+Tab/Tab a návrat fokusu. Vizuální podklady jsou v místním adresáři `ui-refinement-20261027` vedle worktree.

Produkční Google OAuth, registrace, resetovací e-maily, sdílení a administrativní/databázové zápisy se v browser QA neprovádějí. Jejich zachované kontrakty ověřují regresní testy. Lokální fixture soutěže umí zobrazit chybový stav vitríny; tento stav není důkazem poruchy skutečného serveru.

Úplný běh současné sady: 186 úspěšných testů a jediná zastaralá textová kontrola profilu. Tato kontrola byla aktualizována a rozšířena o skutečné vykreslení hosta a chování rozbalovacích hodností; cílený opakovaný běh prošel. Dodatečné kontroly fokusu přihlášení a návratu z Nastavení prošly. Kontrola assetů: 172 bez chyb; syntaxe: 522 bez chyb. Po závěrečných úzkých opravách proběhly dotčené kontroly, nikoli zbytečně druhý úplný běh. Release kontrakt je konzistentní.

Zbývá uživatelské posouzení živého preview před případným schválením produkčního release.

## Dokončení P2 a zpětná vazba k výsledku

Druhá iterace z 27. 10. zachovává schválené umístění hlavní výsledkové akce a obnovuje dřívější pozvánkovou mechaniku. Duplicita výkonu se skrývá pouze po ověření vlastního viditelného řádku proti aktuálnímu výsledku; současně byly přidány kontroly zastaralé odpovědi denního pořadí. Textové stavy odměn a neověřeného času zůstávají nezávislé.

Dokončené P2: pojmenované stručné dialogy hlášení chyby/slova bez eyebrow, přímé texty načítání a chyb pořadí, funkční Začít hrát/Pokračovat v prázdném přehledu úrovní, barevný katalog trofejí bez falešného označení vlastnictví, kontextové názvy Trofeje/Vitrína týmu a stručnější vysvětlení historické odměny. Časování pobídek a onboarding se nemění; plán je odděloval od tohoto vizuálního dotažení.

Ověření druhé iterace: celý gate 190/190, assety 172/172, syntaxe 522/522. Browser ověřil přechod chybějící pořadí → odpovídající vlastní řádek, zachované varování o času, obě větve obnovené pozvánky a právě jedno volání nativního sdílení desky (s lokální náhradou sdílení bez odesílání). Kontrolovány 320/390 px, krátký Fold 683 × 443 a desktop 1440 px, oba motivy. Poslední úpravy CSS pouze odstranily prázdný obal skrytých údajů, starou ikonku sekundární pozvánky a překrytí nadpisu zavíráním na úzkém mobilu. Podklady: místní `ui-refinement2-20261027` vedle worktree.
