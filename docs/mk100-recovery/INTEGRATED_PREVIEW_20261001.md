# Mozkokalypsa v běžném Propletu — náhled před vydáním

Aktuální rozhodnutí Pavla z 1. a 2. 10. 2026 nahrazuje předchozí návrhy dalšího
playtestu: **další playtest nebude**. Stovka půjde do vydání po jeho stručném
projití reprezentativní dvanáctky a schválení vzhledu. Publikování dosud
nebylo povoleno a tento náhled nic nenasazuje na produkci.

Větev `work/mk100-proplet-preview-20261001` navazuje na dokončenou kandidátní
stovku `debd415486ced6cbcd1513178d6a52f64d9cd55d`. Původní samostatný náhled
i archiv výroby zůstávají zachované. Základem celého uživatelského rozhraní
je současný produkční Proplet `174e0fa2a3e8befd0fe01ac8ba7771f4ece25558`.

## Aktuální rozsah

- Šestá obtížnost v běžné Volné hře: na Dnes vedle Mozkomora; na Hrát poslední.
  Všechny obtížnosti jsou dostupné od nulového postupu.
- Na přání z 2. 10. byla vrácena přesná původní barevná ilustrace z playtestů
  `mozkokalypsa-v2.svg`, na kartách i v CTA. Odvozený okrový obrázek byl odstraněn.
  Okrový akcent karty zůstává; samotná ilustrace se nijak nepřebarvuje.
- Všech 100 stabilních ID, mřížek a cest je totožných s dokončenou bankou
  `84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab`.
  Odvozená kopie pro zobrazení používá samostatný klíč `mozkokalypsa`, aby
  nemíchala pořadí, postup ani odměny s Mozkomorem. Zdrojová banka je nedotčená.
- `?review=12` nabízí úrovně 1–11 a 20 uvnitř téže normální hry; `?board=20`
  otevře konkrétní desku. Nejde o další banku ani formulář hodnocení.
- `?announcement=mozkokalypsa` ukazuje pouze vyžádaný návrh budoucího CTA.
  V běžném náhledu se oznámení automaticky neotevírá.

## Odemykání a izolace

Pavel 2. 10. výslovně schválil odstranění všech bran obtížností. Mozkomor
ani Mozkokalypsa nevyžadují dokončení předchozí obtížnosti. Zmizela podmínka
z obou vstupních stránek, spuštění hry i připraveného serveru. Kompatibilní
projekce účtu vrací Mozkomor dostupný i při nulovém postupu. Historická
SQL migrace zůstává zachovaná; snapshot RPC dostává nulovou podmínku.
Žádná živá databáze ani produkční nasazení se v tomto kroku nemění.

Nové ověření z 2. 10. prošlo: deset serverových kontrol, šest dostupných
obtížností z nulového postupu na Dnes i Hrát, přímé spuštění Mozkomora a
Mozkokalypsy a obnovení prázdné hry na desktopu, telefonu a Foldu. Žádná
deska nebyla řešena ani hodnocena. Původní ilustrace byla načtená bez filtru
a dvanáct skutečných snímků light/dark z obou nabídek a CTA bylo prohlédnuto.

Ověření celého rozhraní prošlo: všechny matice/cesty/identity stovky,
všechny původní desky pěti obtížností, tehdejší brány 0/199/200 i dřívější odemčení,
normální dohrání myší a dotykem, nápověda/lupa/obnovení/další úroveň/historie,
výběr dvanáctky a konkrétní deska 20. AKCI na první desce se uznává jako
vedlejší slovo a přidává pouze místní +1 XP. Desktop, telefon 390 px a Fold
768 px jsou emulace, nikoli fyzické přístroje. Vizuální kontrola light/dark
i návrhu CTA prošla. Důkazy jsou v `preview/mk100-integrated/verification/`,
včetně otisků skutečně testovaných zdrojů. Jde o historické ověření první
verze náhledu; nová kontrola otevřených obtížností a původní ilustrace je
vedena odděleně v `verification/ungated-20261002/`. Nejde o hráčský playtest.

Náhled je kompletní statické rozhraní bez serverových funkcí, databázových
přístupů, skutečných účtů nebo produkčního proxy. Data potřebná ke spuštění
hry mají odpovědi přímo v paměti stránky. CSP zakazuje herní síťová spojení
a service worker. Výsledky a XP jsou pouze místní, fronta k odeslání je
vypnutá. Výchozí místní profil má nulový postup a všechny obtížnosti jsou
hned dostupné. Výslovný parametr `?previewHC=199` zůstává jen technickou
pomůckou pro porovnání zobrazení již existujícího postupu.

## Co patří až k pozdějšímu schválenému vydání

Při integraci do skutečného serveru je nutné přidat samostatnou obtížnost do
`FREE_DIFFICULTIES`, odměn, validace výsledků, atomického ukládání, kontrol
obtížnosti ve třech tabulkách a projekce statistik účtu. Připravená deska
nesmí být ukládána pod identitou Mozkomoru. Pořadí volné hry má nyní pět
podporovaných obtížností; rozšíření musí zahrnout i tuto projekci.

Produkční konfigurace se nebude přebírat ze statické větve náhledu.
Její sestavení úmyslně odmítá `VERCEL_ENV=production`. Budoucí vydání musí
zachovat hráčský postup, schválené odstranění gatingu a publikovat CTA
samostatným výslovně schváleným krokem. Další playtest není podmínkou.
