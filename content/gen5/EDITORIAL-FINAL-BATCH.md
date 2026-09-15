# Závěrečná redakční kontrola Gen5

Zkontrolována dokončená série `release-candidate-01`: **450 desek a 1 978
unikátních cílových slov**. První dva průchody pokryly 1 468 slov; nyní jsem
ručně jazykově prověřil zbývajících **510 unikátních slov**. Kumulativně je
tak prověřena celá množina cílových slov této konkrétní série.

## Výsledek

**Žádný konkrétní blokující jazykový nález.** Nenašel jsem zjevný překlep,
rozpadlé heslo ani neopodstatněný náhodný řetězec, kvůli kterému by bylo nutné
některou desku přepracovat. Neznamená to, že jsou všechna slova stejně běžná:
vyšší obtížnosti záměrně obsahují také platné odborné a méně časté výrazy.
Schválenou šíři slovních druhů a tvarů jsem při kontrole neměnil.

U několika potenciálně matoucích hesel jsem doplnil konkrétní ověření:

- **babylon** je obecné podstatné jméno pro zmatek či směsici; současný
  akademický slovník uvádí i krátký zápis bez čárky. Není nutné jej vyřadit
  jako vlastní jméno. [Akademický slovník současné češtiny](https://www.slovnikcestiny.cz/heslo/babylon/0/239).
- **venuše** má obecný archeologický význam sošky, takže není omezena na název
  planety nebo jméno bohyně. [Slovník spisovného jazyka českého](https://ssjc.ujc.cas.cz/search.php?heslo=Venu%C5%A1e&hsubstr=no).
- **polárka** má také obecný potravinářský význam; velké počáteční písmeno
  hvězdného jména tedy není důvodem k automatickému vyřazení.
  [Slovník spisovného jazyka českého](https://ssjc.ujc.cas.cz/search.php?heslo=Pol%C3%A1rka&hsubstr=no).
- **kappa** je doložený název řeckého písmene, používaný i v české odborné
  příručce Masarykovy univerzity. Je méně běžný, ale nejde o zjevný překlep.
  [Příručka pro přepis do bodového písma, řecká abeceda](https://www.teiresias.muni.cz/czbraille/Z-5).

## Evidence a meze

Přesná konečná množina všech 1 978 prověřených slov, zdrojové položky,
výskyty na deskách i otisk dokončené série jsou v souboru mimo repozitář
`../gen5-editorial-final-snapshot.json`. Obsahuje také seznam posledních
510 slov v poli `newWords` a stav `screened-no-obvious-blockers`.
Přesná kopie je verzována jako `evidence/release-candidate-01/editorial.json.gz`.

Jde o dokončený redakční screening konkrétní série, nikoli o tvrzení, že
každé heslo bylo jednotlivě prověřeno ve všech českých slovnících, ani
o nové schvalování obtížností. Technická validace všech řešení je samostatná
část výrobního procesu. Závěr sám nepovoluje publikaci a nemění žádný profil,
lexikon, zdrojový soubor, vygenerovanou desku ani konfiguraci.
