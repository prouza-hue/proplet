# Závazné zadání Pavla — kandidátní stovka Mozkokalypsy

Zdroj: poslední úplné výrobní zadání v konverzaci Proplet Pro, 1. 10. 2026. Níže je jeho obsah. Historické předání z 26. 9. jej nepřebíjí. Tento soubor není tvrzení o dokončení práce.

Převezmi roli seniorního designéra slovních her, českého jazykového redaktora a vývojáře generátoru desek. Navaž na dosavadní práci na Mozkokalypse a připrav kompletní kandidátní sérii **100 skutečně hratelných a technicky ověřených desek** pro Proplet.

Výstup musí obsahovat konkrétní mřížky, slova, odpovědní cesty, pořadí série a výsledky kontrol. Samotný seznam slov nebo návrh výrobního procesu nestačí.

## 1. Nejdřív načti současný stav

Projekt: `prouza-hue/proplet`, produkce `https://hrajproplet.cz/`.

Načti:
- projektové dokumenty **00 — Proplet Pro START** a **01 — REGISTR**;
- aktuální generátor, validátory, schválený lexikon a obsahové profily;
- issue #146 a relevantní novější dokumentaci Lexikonu v3;
- banky a vyhodnocení všech tří kol Mozkokalypsy.

Vyhodnocení II:
https://github.com/prouza-hue/proplet/blob/docs/mozkokalypsa-round2-evaluation-20260929/docs/playtests/MOZKOKALYPSA-ROUND2-EVALUATION-20260929.md

Vyhodnocení III:
https://github.com/prouza-hue/proplet/blob/docs/mozkokalypsa-round3-evaluation-20261001/docs/playtests/MOZKOKALYPSA-ROUND3-EVALUATION-20261001.md

Předání `HANDOVER_ASTRA_GEN6_v2.md` z 26. 9. je historický kontext. Některé tehdy nehotové kroky už byly dokončeny. Ověř jejich současný stav a neopakuj je mechanicky.

Před změnami ověř main, pracovní větev, čistotu pracovního stromu a skutečný produkční SHA. Pracuj izolovaně z aktuálního kódu. Nedostupné podklady přiznej; jejich obsah si nedomýšlej. Pokud něco chybí, pokračuj v práci, která na tom nezávisí.

## 2. Závěry, ze kterých vycházej

Třetí kolo podporuje osvěženou českou slovní zásobu a nový charakter desek. U stejných sedmi hráčů proti II:
- zábavnost vzrostla z 3,73 na 4,05;
- náročnost z 3,15 na 3,84;
- medián času z 3:17 na 3:57.

**Snadný závěr se ale nezlepšil.** Podíl času posledních tří slov klesl z 15,7 % na 10,8 %. Žádná deska III v agregovaném tempu neudržela obtížnost až do konce.

Výsledky malého panelu zkušených hráčů ber jako produktový signál. Vyšší čas automaticky neznamená vyšší kvalitu a strukturální skóre není důkaz lidské obtížnosti.

Použij tyto reference:
- `mk3w2-06` a `mk3w2-08`: vzory hlavní série;
- `mk3w2-07`: relativní úleva;
- `mk3w2-03`: výrazná výzva, většinou velmi dobře hodnocená;
- `mk3w2-02` a `mk3w2-04`: podněty k cílené slovní revizi;
- `mk2-09` a `mk2-10`: dosavadní reference zajímavějšího závěru.

Neoznačuj celou desku za špatnou kvůli jedné výhradě. Současně neschovávej konkrétní problém za příznivý průměr.

## 3. Dramaturgie stovky

Použij výchozí skladbu:
- 20 přístupnějších desek pro rozjezd a úlevu;
- 60 hlavních;
- 15 výrazných výzev;
- 5 vrcholů.

Přístupnější znamená přístupnější v rámci Mozkokalypsy, která je další obtížností Propletu.

Řaď desky ve vlnách. Začátek má hráče vtáhnout; výzvy a úlevy se mají střídat. Nevyskládej nejprve všech 20 lehčích a potom monotónně nezvyšuj obtížnost až do stovky. Po výrazném vrcholu dej prostor k nadechnutí.

Střídej slovní témata, charakter cest a typ hledání. Hráč nemá opakovaně řešit stejnou konstrukci s jinými písmeny.

Přibližně u 20 desek cíleně navrhuj zajímavější poslední trojici. Je to výrobní cíl, jehož skutečný účinek musí potvrdit hraní. U ostatních je přirozené závěrečné zrychlení přijatelné.

## 4. Slovní a konstrukční kvalita

Zachovej základ: **10×10, 14 cílových slov, úplné pokrytí 100 polí**, současná pravidla cest a ovládání. Každé pole patří právě jedné odpovědní cestě. Propletení zde neznamená sdílení polí.

Výchozí délková skladba II a III byla: jedno slovo délky 5, tři délky 6, čtyři délky 7, pět délky 8 a jedno délky 9. Začni tímto ověřeným profilem. Případné změny délkové skladby eviduj a zdůvodni; zachovej rozměr, počet slov a plnost.

Používej aktuální schválenou slovní zásobu. Starý zásobník 1 143 kandidátů nepovažuj automaticky za 1 143 ověřených hesel. Neopakuj už doložené kontroly bez důvodu a nežádej znovu hromadné schválení dříve přijatého směru.

Upřednostňuj živou a pestrou češtinu. Méně běžné slovo může být dobrý „aha“ moment. Kontroluj především **souběh více takových slov na jedné desce**. Pro hlavní sérii vycházej z pravidla nejvýše jednoho záměrně raritního, technického nebo obdobně polarizujícího výrazu; případné výjimky odůvodni jednotlivě. Nezaměňuj všechna nebanální česká slova za rarity.

Prověř HŘEBELEC a další konkrétní výhrady z III jazykově i produktově. Nevyřazuj mechanicky všechna kritizovaná slova.

Změř opakování:
- uvnitř série;
- vůči předchozím playtestům;
- vůči ostatnímu vydanému a rezervovanému obsahu Propletu.

Rozliš přesné opakování, pravopisné varianty a významově blízké rodiny. Používej odstupy a penalizace; nevynucuj absolutní novost za cenu slabých slov. Historie banky není osobní historie každého hráče.

## 5. Zajímavější závěr vyřeš samostatně

Nejdřív rozeber, čím se `mk2-09` a `mk2-10` liší od III. Odděl vliv slovní zásoby a struktury zbytku. Nespoléhej na samotnou plnost nebo větší prostorové promíchání.

Pro každého kandidáta určeného k náročnějšímu závěru:
- vyhodnoť zbytky po odstranění 11 slov při více plausibilních pořadích nalezení;
- zkontroluj, zda poslední cesty nejsou ihned čitelné jako izolované řetízky;
- posuď, zda hledání zůstává zajímavé i při jiném pořadí, než které zvýhodňuje autor;
- uveď, zda závěr stojí především na konstrukci, méně známém slově, nebo kombinaci.

Nevydávej simulované pořadí za hráčskou telemetrii. Případná nová měřítka označ jako pracovní proxy a porovnej je se známými referenčními deskami.

## 6. Pracovní postup

Nejprve vytvoř a interně prověř **12 reprezentativních kandidátů**: například 3 přístupnější, 6 hlavních, 2 výrazné výzvy a 1 vrchol. Zahrň několik různých pokusů o zajímavější závěr.

Na této dávce zkontroluj slovní výběr, kapacitu generátoru, validaci a chování zbytků. Slabiny oprav před rozšířením výroby. Potom dotáhni kompletní stovku; neskonči pouze plánem nebo prvními 12 deskami.

Reprezentativní dávku připrav také pro krátký hráčský test. **Test sám neaktivuj.** Pokud nové hráčské měření neproběhne, dokonči technicky ověřenou kandidátní banku a jasně označ, které předpoklady stále čekají na potvrzení hráči.

Generuj dostatek kandidátů pro skutečný výběr. Nevydávej prvních 100 technicky průchozích desek automaticky za nejlepší stovku. Doplň skutečnou redakční kontrolu každé vybrané desky.

## 7. Technická validace a výstupy

U každé desky dolož:
- platnost všech cest podle runtime;
- soulad písmen, slov a odpovědí;
- úplné pokrytí bez překryvů;
- jednoznačnost podle současných pravidel a validátoru;
- seed nebo jinou reprodukovatelnou výrobní evidenci;
- stabilní ID, obsahový hash a nekolidující identitu.

Validátor musí vidět celou relevantní zmrazenou rozpoznávací množinu. Nezískávej falešnou jednoznačnost tím, že vynecháš uznávaná slova. Vedlejší platná slova zachovej v souladu s pravidly Propletu. Vyčerpání limitu solveru není úspěšný důkaz.

Odevzdej:
1. Strojově použitelnou banku přesně 100 desek s mřížkami a řešeními.
2. Manifest pořadí 1–100, profilů, identit a výrobních verzí.
3. Čitelný redakční katalog: slova, charakter desky, důvod zařazení a případná rizika.
4. Souhrn slovní pestrosti, opakování, konstrukčních metrik a kontroly závěrů.
5. Reprodukovatelné validační výsledky a popis neověřených předpokladů.
6. Hratelné izolované preview a připravenou reprezentativní testovací dávku.

Preview drž ve stávajícím vzhledu Propletu: Tiskařská dílna, Fraunces, významy ikon. Nepřidávej eyebrow nadpisy. Ověř skutečný tok hry na mobilním, Fold a desktopovém viewportu; emulaci nevydávej za fyzický test zařízení.

## 8. Rozsah autorizace

Toto zadání opravňuje k izolované výrobě kandidátů, potřebným úpravám výrobní pipeline a preview.

Nenasazuj stovku do produkce, neaktivuj další playtest, neměň hráčské výsledky, XP, týmy, odemčení ani stávající postup. Historické desky playtestů a jejich hashe zachovej. Obsahově upravená deska musí mít novou identitu. Případné převody dokončení a odměn připrav jako samostatný návrh, aby nevzniklo dvojí plnění.

Pracuj autonomně v tomto rozsahu. Ptej se pouze na skutečně nerozhodnuté produktové volby, které nelze rozumně vyřešit z podkladů. Po důležitých krocích zapiš datum, použitý commit, rozhodnutí, ověření a otevřené body.

Cílem je stovka, u které má hráč opakovaně chuť na další desku. Vyšší čas ani větší počet neznámých slov nejsou náhradou za tento výsledek.
