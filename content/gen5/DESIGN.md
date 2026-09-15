# Gen5: pestřejší desky, ověřitelné výsledky

Stav: neveřejný prototyp, nikoli schválené vydání. Dosavadní úrovně, jejich ID,
řešení, uložený postup ani produkční generátor se nemění. První etapa připravuje
malý pilot a nástroje pro následnou kalibraci. Plánovaný obsah je 100 nových desek
pro každou ze čtyř běžných obtížností a 50 pro Mozkomora.

## Problém, který řešíme

Ve stávajících 200 snadných deskách tvoří čtyřpísmenná slova 87,5 % řešení.
BOBR, DRAK, UPÍR nebo ŠTÍT se objeví na 151 z nich. Nejde pouze o malý slovník:
dosavadní výběr zvýhodňuje hodnocení `fun` a požaduje alespoň jedno výrazně
hodnocené slovo. Mezi krátkými snadnými slovy tuto podmínku splňuje právě tato
čtveřice. Hlídání několika sousedních desek samo celkové opakování neřeší.

Gen5 proto mění výběr slov a kontrolu celé série. Nerozšiřuje automaticky cílový
slovník o všechny výrazy, které uznává širší slovník bonusových slov.

## Rozhodnutí prototypu

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
   s běžnými slovy třídy A a jednoduchými cestami. Hodnoty jsou hypotéza pro
   kalibraci, nikoli nový slib obtížnosti hráčům.
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

Počet zatáček ani počet slovníkových odboček nejsou spolehlivou náhradou lidské
obtížnosti. Tři desky na obtížnost neprokazují „dramaticky těžší a stále zábavný“
Mozkomor. Ten musí projít slepým srovnáním se současnými deskami: dokončení,
nápovědy, čas, pocit férovosti a rozpoznatelnost slov. Obdobně je třeba ověřit,
že delší běžná slova nepřetížila snadnou obtížnost.

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

## Postup k vydání

1. Projít pilotní slova a zahrát nové i referenční desky bez znalosti řešení.
2. Doladit pouze profily Gen5 podle zjištění. Staré desky zůstanou identické.
3. Zvětšit neveřejný pilot; posoudit skutečnou distribuci po odmítání kandidátů,
   délku výroby, obtížnost a pestrost v sousedních oknech i celé sérii.
4. Až poté vytvořit plánovaný obsah a provést kontrolu všech 450 desek, všech
   hranic s rezervovaným obsahem, opakování a redakční kvality slov.
5. Připravit samostatný append-only release manifest a preview. Produkční
   nasazení je další krok; tento nástroj k němu nemá příkaz.
