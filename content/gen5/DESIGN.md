# Gen5: pestřejší desky, ověřitelné výsledky

Stav: neveřejný výrobní generátor se schválenými profily obtížností. Uživatel
potvrdil upravenou snadnou a střední a původní těžkou, Mozkožrouta i Mozkomora.
Snadná střídá 75 % desek 5×5 a 25 % desek 6×6 při stejné zátěži. Dosavadní úrovně,
jejich ID, řešení a uložený postup se nemění. Výrobní plán obsahuje 100 nových
úrovní pro každou ze čtyř běžných obtížností a 50 pro Mozkomora.

## Problém, který řešíme

Ve stávajících 200 snadných deskách tvoří čtyřpísmenná slova 87,5 % řešení.
BOBR, DRAK, UPÍR nebo ŠTÍT se objeví na 151 z nich. Nejde pouze o malý slovník:
dosavadní výběr zvýhodňuje hodnocení `fun` a požaduje alespoň jedno výrazně
hodnocené slovo. Mezi krátkými snadnými slovy tuto podmínku splňuje právě tato
čtveřice. Hlídání několika sousedních desek samo celkové opakování neřeší.

Gen5 proto mění výběr slov a kontrolu celé série. Nerozšiřuje automaticky cílový
slovník o všechny výrazy, které uznává širší slovník bonusových slov.

## Rozhodnutí generátoru

1. **Zmražené vstupy.** Každý běh ukládá otisky slovníků, konfigurace, zdrojového
   kódu a vydaných bank. Při obnovení odmítne změněné vstupy. Výstup je povolen
   pouze do pojmenovaného podadresáře `lab-output/gen5/`, mimo produkční obsah.
2. **Jedna evidence použití.** Počítá historii vydaných i rezervovaných desek,
   penalizuje celkové používání napříč obtížnostmi a novou sérií. Tvrdý odstup
   platí uvnitř obtížnosti. Nové desky se přijímají střídavě podle obtížností,
   aby první obtížnost nevyčerpala nejlepší slova pro ostatní.
3. **Nejprve délky a třídy slov.** Vyberou se proveditelné délkové kombinace a
   přesná dostupná kombinace tříd A–D; až potom jednotlivá slova. Nepoužívá se
   povinná kotva s vysokým `fun` ani její násobná váha. Stávající minimum
   přijatelnosti `fun >= 3` a explicitní výluky zůstávají.
4. **Pestrost má pevné hranice.** Nejvýše 3 čtyřpísmenná slova na snadné a střední desce, 2 na těžké
   a hardcore desce, žádné na Mozkomoru. Snadná je po kalibraci 5×5,
   s běžnými slovy třídy A a jednoduchými cestami. Hodnoty odpovídají uživatelem
   schválené kalibraci.
5. **Samostatná geometrie.** Omezené prohledávání skládá sousední cesty bez
   překryvů. Parametry jednoduchých cest jsou explicitní: stará skrytá výjimka
   v pomocném generátoru už nevnucuje zatáčky snadným slovům. Hlídají se také
   izolované mezery, zatočení a snadné navazování konce slova na další začátek.
6. **Nezávislá kontrola.** Ze samotných písmen a cest se znovu spočítají metriky,
   správný pravopis, sousednost, pokrytí, jedinečnost cest cílových slov a počet
   úplných řešení. Ověření nevěří příznakům `unique` nebo metrikám od generátoru.
7. **Omezené výpočty bez falešných závěrů.** Kontrola rozlišuje jedno řešení,
   více řešení, žádné řešení a vyčerpaný výpočetní limit. Pouze prokázaná
   jednoznačnost vede k přijetí. Výpočet každé desky má navíc samostatný proces
   a časový limit. Rozpracovaný výsledek se atomicky ukládá po každé desce.

## Počáteční limity slov

| Obtížnost | Celé předchozí desky bez opakování | Maximum užití slova v nové sérii |
|---|---:|---:|
| Snadná | 8 | 5 |
| Střední | 10 | 4 |
| Těžká | 12 | 3 |
| Mozkožrout / hardcore | 12 | 3 |
| Mozkomor | 12 | 3 |

Historie zahrnuje konzervativně i dosud rezervovaný rolling obsah. Skutečné pořadí
nového vydání je nutné potvrdit před jeho sestavením; pilotní čísla úrovní nejsou
autorizací k publikaci. Při neúspěchu se další desky dané obtížnosti nepřeskakují.
Obnovení musí nejprve doplnit chybějící pozici.

## Dva slovníky mají dvě role

Generování používá stávající kurátorovanou cílovou zásobu v povolených třídách.
Přijetí bonusového slova neznamená, že jde o dobré povinné řešení pro hráče.
SETR a další schválené doplňky rozpoznávání jsou samostatná již provedená oprava.

Kontrola úplných řešení používá explicitní širší sjednocený slovník bez
dřívějšího ořezu na 12 000 položek. Jeho obsah i velikost jsou zapsané ve výsledku.
Online frekvenční fallback není konečný slovník, takže prototyp netvrdí důkaz
jednoznačnosti vůči všem slovům, která by kdy mohl rozpoznávač přijmout.
Položky původem z automatického rozšíření jsou ve výsledcích označené pro
redakční kontrolu; ani zbývající slova nejsou automaticky prohlášena za schválená.

## Co znamená obtížnější Mozkomor

Cílem jsou přesvědčivé slepé odbočky a více rozhodování, nikoli jen delší či
neznámá slova. Prototyp vybírá nejlepší ze tří ověřených kandidátů podle lokálních
alternativ. Zachovává rozumnou velikost desky, omezuje třídu D na 10 % a nepoužívá
krátká slova. Výsledek se porovnává se současným Mozkomorem pomocí stejného
slovníku a stejné výpočetní metody.

Počet zatáček ani skóre odboček nejsou samy měřítkem lidské obtížnosti.
Uživatel pilot zahrál a jeho zpětná vazba byla zapracována; další opakované
schvalování stejných obtížností není podmínkou výroby. Mozkomor zůstává v
odsouhlasené podobě. Netvrdíme neprokázané násobné zvýšení jeho obtížnosti.

## Co už testujeme a co ještě ne

- Unit testy kontrolují výběr slov, kapacitu, odstupy, obnovu, poškozené cesty,
  alternativní řešení a rozlišení vyčerpaného limitu.
- Malý geometrický pilot prochází plnou nezávislou kontrolou.
- Tři slovníkové simulace plánovaných 450 sad kontrolují dlouhodobou kapacitu.
  Nejsou to vygenerované úrovně: nezahrnují odmítání geometrií ani jeho dopad na
  výslednou distribuci. Proto nestačí pro schválení velkého vydání.
- Pevné seedy určují pořadí hledání. Časový limit může na pomalejším stroji změnit
  dostupnou množinu kandidátů; bitovou reprodukovatelnost přes takový limit
  netvrdíme. Uložené přijaté desky se při obnovení znovu negenerují.

## Výroba a vydání

`gen5_series.py` vyrábí naplánovanou sérii souběžně, nejvýše jednu desku každé
obtížnosti v jednom kole. Všechny úlohy kola vidí stejnou historii dokončených
kol. Tvrdé odstupy a maxima použití zůstávají přesné uvnitř obtížnosti; měkké
váhy globálního použití se aktualizují mezi koly. Jediný zapisovatel přijímá
výsledky v pevném pořadí a znovu kontroluje shodu úlohy, slova, strukturu a variantu.
Neúspěch nikdy nepřeskočí pozici. Každý pokus má uložené číslo a odvozený seed.

Checkpoint tvoří kanonický začátek plánu, nese hash obsahu, otisky zdrojů a
počty pokusů. OS zámek brání dvěma zapisovatelům; po pádu procesu se uvolní.
Po obnovení se kontroluje celý přijatý obsah. Na konci se znovu provede plné
nezávislé ověření každé desky. Při nedokončené výrobě příkaz hlásí neúspěch,
pokud nešlo o výslovné plánované pozastavení přes `--max-rounds`.

Výroba je oddělená od publikace. Výstupní soukromý balíček zachová současnou
runtime generaci postupu (`contentGeneration=4`) a označí algoritmus zvlášť
jako `generatorGeneration=5`. Změna globální `freeGeneration` na 5 se neprovádí.
Manifest uchovává otisky a pořadí všech původních i rezervovaných úrovní.

Před nasazením zbývá uzavřít kontrolu unikátních slov celé série a napojit její
append-only balíček za dosavadní banku včetně rolling rezervy. Publikace musí
zachovat všechny staré ID, pořadí i payloady a potvrdit započítání staré i nové
výhry a odemykání Mozkomora ve skutečné hře. Výrobní nástroj nic nenasazuje.
