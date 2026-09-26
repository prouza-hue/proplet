# Gen6: pokračování bez příloh ChatGPT

26. 9. 2026. Toto je vstupní bod pro nový chat nebo Codex bez nahrávání ZIPu. Nejde o nový produktový návrh ani o nasazení. Větev `docs/gen6-handover-20260926`, složka `docs/gen6-handover/`, repozitář `prouza-hue/proplet`.

## Co udělat hned

1. Načti tento soubor, `HANDOVER_ASTRA_GEN6_v2.md`, `candidate-seeds.json`, `audit-v2.json` a nejnovější komentáře issue #146. Použij autentizovaný GitHub konektor nebo checkout repozitáře; soukromé soubory nehledej veřejným webem. V GitHub fetch_file uveď explicitně ref `docs/gen6-handover-20260926`, nikoli main. Tento adresář není na main.
2. Nemáš-li lokální soubory, nejprve je skutečně načti přes konektor nebo Git. Nepožaduj od Pavla opakované přiložení archivu, dokud funguje přístup k tomuto repozitáři. Samotný název souboru není důkaz jeho načtení.
3. Nejdříve obsahová/redakční práce na stávajících 1 143 kandidátech, ne nové kolečko obecného plánování. Kompletní podrobnou historickou evidenci obnovíš níže uvedeným postupem. Soubor `candidate-seeds.json` je přímo čitelný i bez terminálu a obsahuje úplnou původní zásobu po várkách/tématech.
4. Pro implementaci ověř aktuální main, skutečný produkční SHA, pracovní větev, necommitované změny a datové prostředí. Vývojovou větev vytvoř z aktuálního main. Tuto dokumentační větev nezaměňuj za nový schválený runtime a nic z ní nepromuj do produkce.

## Kde je původní ZIP a co obsahuje tato alternativa

Původní soubor má přesný název `Proplet_Gen6_predani_Codex_v2_2026-09-26.zip`; v projektu Proplet Pro byl při opravě předání viditelný jako projektový zdroj, stejně jako `HANDOVER_ASTRA_GEN6_v2.md`. Jeho SHA-256: `1f2bceb984796565f59c5bcd78821aef32cf050c03b64ae3a422f51e41a6dc87`. Odkaz sandbox z jednoho chatu nepovažuj za ověřenou lokální cestu v jiném prostředí.

ZIP ale pro tuto cestu nepotřebuješ. Zde je celé původní zadání revize 2, úplný zásobník 267 + 876 kandidátů a původní reprodukční skript i audit. Kompaktní seeds zachovávají slova, pořadí, várky a navržená témata. Nejsou novým výběrem slov. Při obnově se z nich vytvoří stejné původní ID a stejné podrobné JSON záznamy včetně důkazů a poznámek. Obnovené dva kandidátní JSON a audit jsou kontrolovány vůči SHA-256 původních souborů ze ZIPu. Nejde o kopii ZIPu bajt po bajtu ani o kopii HTML prohlížeče; prohlížeč není závislost implementace.

Starší odkazy v handoveru na přiložené `kandidati-vse-1143.json` a `audit-v2.json` nyní vyřeš podle tohoto adresáře a obnovy, nikoli další žádostí o přílohy. `VYSVETLENI_A_SMER_GEN6.md` je podpůrné vysvětlení původního ZIPu; příčiny, schválení a opravy jsou zachyceny v handoveru a issue #146, nemusí blokovat navázání. Projektové 00/01 načti, jsou-li v daném prostředí dostupné; základní závazná pravidla i ID relevantního místního úkolu jsou níže a v handoveru. Jejich úplnou historickou inventuru není nutné znovu přenášet kvůli redakční fázi.

## Obnova přesně stejné historické evidence, bez ZIPu

Potřebuješ Python 3.10+ se standardní knihovnou a lokální zdrojový strom odpovídající zaznamenaným SHA-256 v `audit-v2.json`. Historická baseline je commit `6e076bccf2a89d99e003667aa2eed0f6f4e24d51`. Zdrojová data nejsou přesouvána do tohoto adresáře: už jsou ve stejném Git repozitáři. Skript nevolá síť ani databázi, pouze čte a píše nový výstup mimo zdrojový strom.

Z již přístupného a ověřeného checkoutu lze předání získat např. takto (cesty zvol nové, nic existujícího nepřepisuj):

```sh
git fetch origin docs/gen6-handover-20260926
git archive --format=tar --output=../gen6-handover-inputs.tar FETCH_HEAD docs/gen6-handover
```

Rozbal tento malý Git archiv mimo pracovní checkout. Tím předáš pouze dokumenty a skripty, bez změny hlavní pracovní větve. Alternativně stáhni jednotlivé textové soubory přes GitHub konektor; nečekej na ZIP z ChatGPT.

Historický zdrojový strom pro přesnou reprodukci můžeš získat jako samostatný worktree, aniž bys vracel aktuální kód:

```sh
git -c core.autocrlf=false worktree add --detach ../proplet-gen6-baseline 6e076bccf2a89d99e003667aa2eed0f6f4e24d51
```

Pak z adresáře s převzatými skripty:

```sh
python -X utf8 restore_candidate_snapshot.py --root /cesta/proplet-gen6-baseline --out /cesta/novy-gen6-audit
```

Použij skutečné cesty; na Windows lze použít také `py -3 -X utf8`. Výstupní adresář musí být nový a mimo zdrojový i předávací strom. Kontrolují se všechny otisky vstupů, počty 267/876, unikátnost a identita pořadí/ID/témat. Pak i původní SHA-256 těchto výstupů:

- `kandidati-vse-1143.json`: `0c53368ca5ba6bcb297581272b457a7a88530a5f956b039c3c67a1015ff81033`
- `kandidati-varka-2.json`: `2f6a883231fe92af04c164373e31b7bbb16b9803935e90109b5e32838b7e5789`
- `audit-v2.json`: `b8250c5b49a0bb60ae823174b96c98ebaae5657a96c6c25cee370db746391b9a`

Úspěch znamená obnovení historických podkladů, nikoli nové slovníkové ověření! Při chybě otisku neměň manifest tak, aby test prošel. Nejprve prověř správný commit a konce řádků/UTF-8. Historický skript má záměrně pevné datum původního auditu a dvě původní vnější kontroly; nepoužívej jeho neměněná datová tvrzení jako nový audit jiného zdroje. Pro další aktualizace založ nové evidence se skutečným datem a skutečně ověřenými vstupy.

## Závazné produktové zadání

Živá přirozená česká slovní zásoba, ne rarity kvůli kvótě. Pavel schválil charakter zásoby, nikoli pravopis každé položky. Nežádat o novou revizi všech 1 143 slov; samostatně doložit a redakčně zpracovat, jen skutečné sporné produktové volby předložit stručně. `runtime_approved=false` není možno automaticky přepnout u celé dávky. Žádné plošné importy bez oprávnění, žádné povýšení frekvenčního výskytu na slovníkový důkaz.

Pořadí práce: doložená redakční dávka → oddělený kandidátní Lexikon v3 a kapacita → rozšíření existující Gen5 výrobní politiky → izolované hratelné preview Mozkokalypsy III. Třetí kolo celé s osvěženou politikou a zcela novými deskami, **bez šesti kontrolních desek starého typu**. Pracovní rozsah 12, 10×10 a 14 slov; launch až po doběhnutí a vyhodnocení kola 2, schválení preview a potvrzení termínu, kohorty a odměn. Příprava může začít před koncem kola 2.

Běžící kolo 2 `mozkokalypsa-round2-20260925` se nemění, deadline `2026-09-28T22:00:00Z`. Nepřepisovat jeho desky/pozvánky/odměny/výsledky. Neduplikovat již plánované zprávy 27. a 29. září. Historické srovnání po vracejících se hráčích nepředstírat jako randomizovaný důkaz. Zachovat motivaci testerů, nezahltit dalšími dotazníky.

Společná pestrá cesta je schválený navazující směr, ne aktuální pokyn k zapnutí všem: po pozitivním ověření produktu jedna relativní posloupnost stabilních ID, priorita rozehrané hry, přeskakování dokončených, celý číselný katalog a všechny XP/odznaky/odemčení beze změny. Gen6 je verze výrobního algoritmu, ne reset `freeGeneration`/`contentGeneration`.

Zachovat Tiskařskou dílnu, Fraunces, významy ikon a fungující herní UI. Nezhoršit uznávání vedlejších slov. Ověřit řešení nad odpovídající širší slovní sadou, timeout není důkaz jedinečnosti. Při relevantních změnách přiměřené testy a skutečné preview; bez zbytečného opakování drahých kontrol. Produkce, hráčské účty a XP nejsou testovací data. Nenasazovat bez dalšího potvrzení.

MorfFlex: starší zmínky nejsou důkaz uskutečněného importu. Před systematickým použitím znovu ověř licenci pro konkrétní použití; dříve zjištěné CC BY-NC-SA a možnost komerční licence jsou v handoveru. Bez pokynu licenci nekupovat a poskytovatele nekontaktovat. Nejistota jednoho zdroje neblokuje nezávislé kandidáty a jiné dovolené jazykové doklady.

## Odkazy a bezpečné pokračování

Repoz itář: `prouza-hue/proplet`. Main při tomto přesunu podkladů ověřen `6e076bccf2a89d99e003667aa2eed0f6f4e24d51`; nejde o nové ověření produkčního endpointu. Před implementací produkci znovu zkontroluj. Historické údaje Vercel/Supabase jsou v handoveru. Starý místní Codex úkol k opakování: `01a09b04-4289-7a42-ac99-7bb553f77935`; jeho místní soubory neprohlašuj bez přístupu za přečtené.

- Issue s původním auditem: https://github.com/prouza-hue/proplet/issues/146
- Rozšířený audit a druhá várka: https://github.com/prouza-hue/proplet/issues/146#issuecomment-5848742995
- Novější rozhodnutí (bez kontrolní poloviny): https://github.com/prouza-hue/proplet/issues/146#issuecomment-5848867176

Při rozporu platí nejnovější skutečné zadání uživatele. Tato oprava předání nemění kandidáty, jejich schválení, aplikaci ani databázi. Zpracuj první doloženou dávku a pokračuj k izolovanému preview; nespotřebuj celou relaci novým plánováním již rozhodnutého směru.
