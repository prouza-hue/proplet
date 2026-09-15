# Redakční kontrola druhé části Gen5

Kontrolována jedna nová kopie `release-candidate-01/series.json`:
239 přijatých desek, 1 468 unikátních cílových slov. Poslední zachycená pozice
je `g5-r1-hardcore-048`. Odečteno 405 slov prověřených v první části; nyní
ručně jazykově prověřeno dalších **1 063 unikátních slov**.

## Výsledek

V nové množině jsem nenašel konkrétní zjevný překlep, nečeský náhodný řetězec,
rozpadlé heslo ani vlastní jméno, které by vyžadovalo vyřazení. Seznam
blokujících jazykových nálezů zůstává prázdný.

Kontrola nevyřazuje existující povolená přídavná jména, slovesa, odvozeniny,
množná čísla ani odborné termíny. Například `železa` nejsou automaticky
chybným heslem jen proto, že vypadají jako skloňovaný tvar; `synek` má také
obecný význam. Výrazy biologické či medicínské povahy rovněž nejsou
pravopisnými chybami. Schválenou slovní politiku při kontrole neměním.

## Jedna poznámka k interpretaci pestrostí

Slovník obsahuje zároveň `balon` a `balón`; obě položky jsou již dříve
schválené. Ve vzorku je `balon` na `g5-r1-medium-034`, `balón` na
`g5-r1-easy-019` a `g5-r1-easy-038`. Evidence je počítá jako dvě rozdílná
slova. Není to chyba konkrétní desky ani porušení nynějších limitů, ale
počet unikátních zápisů proto nelze zaměňovat za počet odlišných významů.
Nejde o požadavek na změnu právě běžící výroby.

## Návaznost

Kumulativní přesná množina všech dosud prověřených 1 468 hesel, jejich
původ, dosavadní použití a ID desek je uložena mimo repozitář v
`../gen5-editorial-second-snapshot.json`. Klíč `newWords` označuje nově
prověřených 1 063 hesel; klíč `words` obsahuje celou kumulativní množinu.
Závěrečný průchod může kontrolovat pouze zbytek proti této množině.

Tento zápis nepotvrzuje dosud nezachycené desky ani nevydává pokyn
k publikaci. Zdrojové soubory, profily a konfigurace výroby se neměnily.
