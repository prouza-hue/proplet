# Předání Astře v Codexu — revize 2: Lexikon v3 → Mozkokalypsa III → společná pestrá cesta

**Aktualizováno 26. 9. 2026 po dalším rozhodnutí Pavla. Tato revize nahrazuje původní HANDOVER_ASTRA_GEN6.md. Kontrolní polovina třetího kola byla odmítnuta; nepřenášej ji zpět ze starších návrhů.**

## Zadání

Pokračuj v existujícím Propletu, nikoli v přepisu. Pavel schválil směr výrazného rozšíření o živou českou slovní zásobu; po prohlédnutí reprezentativní části rozšířeného zásobníku 1 143 kandidátů tento souhlas potvrdil. Výslovně uvádí, že nečetl každé slovo. Chce znát původ dosavadního problému, další kandidáty, po druhém kole nové třetí kolo Mozkokalypsy a zvážit společné pestré pořadí bez ztráty hráčské práce. Nepovažuj současné nadšení a schválení směru za hotové schválení každého hesla nebo za autorizaci produkční migrace.

Toto předání je připravené 26. 9. 2026, aby bylo možné navázat i bez původního chatu. V chatu jsou uzavřena produktová pravidla a zásobník první revize. **Doporučený okamžik předání je nyní: úplné ověření všech 1 143 hesel není podmínkou přechodu do Codexu, ale první úkol v něm.** Spusť nejdříve obsahovou/redakční práci; nespouštěj najednou nové generování, hráčský test a plošnou změnu pořadí. Kandidáty dál nerozmnožuj, není-li to nutné k vyřešení konkrétního kapacitního problému.

## Povinné načtení a aktuální stav

1. Projektové dokumenty 00 — Proplet Pro START a 01 — registr (v balíčku KONTEXT_00_START.txt a KONTEXT_01_REGISTR.txt). Jejich produkční stav ze 17. 9. je historický, nikoli dnešní baseline. Zachovat Tiskařskou dílnu, Fraunces a významy ikon.
2. GitHub `prouza-hue/proplet`, issue #146; načti také jeho novější komentáře. Repozitář je pravý zdroj kódu, nikoli ZIP z historického projektu.
3. Main znovu ověřen při této revizi; produkce naposledy ověřena v předchozí části práce dne 26. 9. 2026, nikoli nově tímto dokumentem: `6e076bccf2a89d99e003667aa2eed0f6f4e24d51`; Vercel `dpl_FX9D1aQ9cT2VekuS6G2oQNGqs1uf` READY, doména hrajproplet.cz. Tým `team_5WMqzMhPV9vWfkNAWCygaeap`, projekt `prj_0XHgnCQhdPS3pPETrxIpoXn0McMG`.
4. Před implementací znovu porovnej main, produkční SHA, pracovní branch, čistotu pracovního stromu a všechny datové zdroje. Produkční Supabase ref z dosavadní konfigurace `iopyhluayfszskyqqpuc` nepovažuj bez ověření za vhodné testovací prostředí. Pro redakční práci ho nepotřebuješ. Pouze read-only analýzy skutečných výsledků.
5. Starý místní Codex úkol k opakování: `01a09b04-4289-7a42-ac99-7bb553f77935` — „Zjisti limity opakování slov“. Cloudový projekt nemá automatický přístup k místním souborům; přebírej jen skutečně dostupné podklady a ověř jejich stáří.

## Co už je hotové / co není

HOTOVÉ: příčinný audit aktuálního importu; totožnost české FrequencyWords 2018 se zdrojovým souborem; 267 původních + 876 dalších = 1 143 kandidátů; deduplikace a kontrola délky/abecedy/vyřazení; zdrojová evidence pro uložené snapshoty; návrh redakčního procesu, testu a společné trasy; žádné změny produkčních souborů ani databáze.

SCHVÁLENÉ UŽIVATELEM: charakter živějšího lexikonu a využití předložené zásoby po odborné/redakční kontrole; třetí kolo se zcela novými deskami a celou osvěženou politikou po doběhnutí kola 2; směr společné pestré cesty se zachováním katalogu, hráčského pokroku, XP a úrovní. **Odmítnuté: šest kontrolních desek dosavadní politiky pro hráče v kole 3.** Pro přijatelná doložená slova z tohoto zásobníku nevyžaduj nové hromadné schválení Pavlem. Schválení směru cesty není souhlas s jejím okamžitým zapnutím v produkci.

NAVRŽENÉ, NEUZAMČENÉ: pracovní rozsah 12 desek preview a jejich konkrétní složení, datum a délka kola 3, účastníci a odměny, detailní migrace společné cesty a produkční nasazení. Kontrolní skupinu/desky nenabízej znovu jako otevřenou volbu. Každé dosud navržené heslo má `runtime_approved=false`; po skutečném doložení a redakční kontrole musí být postup stavu explicitní a dohledatelný. Uživatelský souhlas s charakterem zásoby není doklad pravopisu každé položky.

NEHOTOVÉ: plošné slovníkové ověření nových hesel; finální zařazení A/B/C/D; implementace Lexikonu v3 nebo Gen6; nové desky; migrace rozpoznávání nebo společné trasy; třetí playtest; produkční nasazení.

## Proč dosavadní systém nestačí

- Cílový Lexikon v2: 3 147 slov (A510/B750/C1567/D320). Není totéž jako širší uznávání bonusových slov.
- Import má redakční seed + 1 401 automatických položek + explicitní kultivovanou D vrstvu. `tools/build_lexicon_v2.py` pro automatické rozšíření vyžaduje přesné základní podstatné jméno z uložených Wikidata Lexemes A ZÁROVEŇ přesný zápis ve frekvenčním souboru.
- Wikidata snapshot je z 13. 8. 2026, 16 012 záznamů, ne úplná čeština. `source_cs_50k.txt` je OpenSubtitles 2018 (FrequencyWords; Git blob `ef626682b7e1144e0f6e87f7af899daf5327d256`), jednotlivé povrchové tvary, nikoli agregace tvarů na lemma. Nepřítomnost není vzácnost ani neplatnost.
- Automatická expanze NIKDY nepřiděluje A; B při upravené četnosti ≥3 500, D při <700 a science/technology, ostatní C. Nelehkou skupinu nesmíme mechanicky ztotožňovat s neznámým slovem.
- `review: approved` vyplňuje i automatika. `fun`, téma, věk a část známosti jsou heuristiky, ne skutečná hráčská zábavnost. 2 354 hesel má obecné téma people/everyday/world.
- Další screening Gen5 existuje (`content/gen5/EDITORIAL-FINAL-BATCH.md`); nelži, že nebylo nic kontrolováno. Screening již vybraných slov ale neřeší chybějící kandidáty.
- Gen5 už hlídá opakování. Jeho historie není individuální historie a dosud vynechává Tajenku/Mozkokalypsu. Rodinné/pravopisné varianty nejsou řešeny stejně jako nezávislá slova.

Příklady současného filtru: KNOFLÍK má frekvenci 1 680, nikoli uložené lemma; PETRŽEL má lemma L43040, nikoli frekvenci; VAŘEČKA chybí v obou. Je to rekonstrukce vstupů a brány, nikoli nalezený historický seznam individuálních zamítnutí.

## MorfFlex: opomenutý kontext a podmínky použití

Pavel připomněl původní úvahy o MorfFlexu. Z dohledaných starších konverzací vyplývá plán používat jej jako morfologickou/validační referenci a upozornění na nekomerční licenci. To je evidence dřívějšího návrhu/vyjádření, **ne doklad konkrétního importu či provedené kontroly každého produkčního hesla**. Aktuální `tools/build_lexicon_v2.py` (main 6e076bcc…) používá seed, Wikidata a frekvenční soubor; MorfFlex v této cestě není. Hledání názvu v aktuálním repozitáři nevrátilo výsledek, což samo neprokazuje nulové historické použití.

Oficiální https://ufal.mff.cuni.cz/morfflex byla zkontrolována 26. 9. 2026. Uvádí MorfFlex CZ 2.1, záznamy lemma–morfologická značka–slovní tvar, CC BY-NC-SA 4.0 a možnost komerční licence na vyžádání. Morfologická informace pomůže rozlišit heslo, tvary a slovní druh, nikoli automaticky běžnost nebo hráčskou zábavnost.

Před systematickým zpracováním/importem či použitím odvozených dat ověř oprávnění pro konkrétní režim Propletu. Neprohlašuj, že offline použití nebo samotná kontrola licence automaticky obchází. Nerozhoduj bez podkladů, že tato hra splňuje nekomerční použití. Nekupuj licenci a nekontaktuj poskytovatele bez samostatného pokynu. Licenční nejistota jednoho zdroje **nesmí zablokovat celé zpracování nezávisle navržených kandidátů**: lze pokračovat s jinými dovolenými doklady. Eviduj zdroj, verzi a způsob použití; definice a celé slovníky nekopíruj bez oprávnění.

## Soubory, které musíš zkontrolovat

- `data/lexicon_v2.json`, `data/vocabulary_tiers.json`, `data/lexicon_v2_wikidata_raw.json`, `data/source_cs_50k.txt`.
- `tools/build_lexicon_v2.py`, `tools/fetch_wikidata_lexemes.py`, `data/target_generation_exclusions_v334.json`.
- `word_recognition_v3330.py`, `data/words.txt`, `public/valid-words-v3328.txt`: širší sjednocení + wordfreq fallback, nerozbít uznávání vedlejších slov.
- `tools/gen5/catalog.py`, `tools/gen5/validation.py`, `tools/gen5/package.py`, `content/gen5/profiles.json` a screening/evidence hotové Gen5 série.
- `public/app/content/free-order-engine.js`, `free-order-store.js` a související API/sync kontrakty: dnešní pestre-v1 není jedna společná trasa; podporuje čtyři základní obtížnosti.
- `docs/playtests/MOZKOKALYPSA-ROUND2-20260926.md`, `data/playtests/mozkokalypsa-v2.json`, backend a migrace tohoto testu. Běžící kolo nesmí být změněno.

## Pořadí další práce

### Fáze A: uzavřít první skutečně zdrojově doloženou redakční dávku

Nejdřív načti přiložené `VYSVETLENI_A_SMER_GEN6.md`, `audit-v2.json`, `kandidati-vse-1143.json`. Prohlížeč seznamu je `KANDIDATI.html` (offline). Várka 2 má 876 slov, 466 z nich 4–6písmenných; 419 má alespoň uloženou lemmatickou nebo frekvenční evidenci. Zatím jsou jen dvě přímo prohlédnutá externí hesla. Nezaměňuj 419 signálů za 419 jazykových schválení.

Zpracuj celý stávající zásobník po ucelených dávkách, prioritně běžná krátká hesla napříč tématy a délkami. Výstup rozlišuje přijaté, opravené a odložené včetně důvodů a rozsahu dokončeného ověření. Nežádej Pavla znovu o revizi celého seznamu; vrať mu pouze jeden krátký přehled skutečně sporných produktových rozhodnutí. Sporné jednotlivosti mohou zůstat odložené a nemusejí blokovat dostatečně širokou doloženou část pro pilot. U povyšovaných hesel ulož konkrétní doklad základního tvaru, význam/register, reviewer a datum, redakční rozhodnutí a obtížnost. Využij IJP / vhodné výkladové slovníky ÚJČ / další vydavatelské zdroje. Nové hromadné zdroje používej pouze s ověřenými podmínkami. Žádné nové výjimky typu „přidej vše, co navrhla AI“.

Slovní druh a pomnožné/hromadné tvary prověřuj jednotlivě, nenutit umělé jednotné číslo. Současnou schválenou šíři slovních druhů zachovej. Kandidátní tematické a rodinné skupiny jsou návrhy: pravopisné varianty řešit přísněji než odvozeniny s jiným významem. Zachovat všechna dosavadní explicitní vyřazení (LUNOCHOD atd.).

### Fáze B: candidate-only Lexikon v3 a kapacita

Pracuj v izolované větvi z aktuálního main; při nejasném rozsahu připrav diff a zeptej se pouze na skutečně nerozhodnuté produktové volby. Nový lexikon drž odděleně, bez přepsání v2. Schema musí rozlišit doklad, redakční schválení a povolení k výrobě. Staré v2 štítky neprohlašuj zpětně za skutečné nové ověření.

Změř dosažitelnou kapacitu podle délky/obtížnosti/tématu. Rozšiř existující výběr o smysluplné rodiny/témata, společnou historii včetně playtestů a Tajenky a novost vůči vydanému obsahu. Rozliš již vydaný, rezervovaný budoucí a skutečně hráčem viděný obsah. Nepřepisuj fungující generátor a nepřijímej slabá slova kvůli tvrdým kvótám.

### Fáze C: zcela osvěžené kolo 3, bez kontrolní poloviny

Kolo 2: `mozkokalypsa-round2-20260925`, 12 desek mk2-01..12, 10×10, 14 slov, 200 XP za dohrání a obě hodnocení; deadline `2026-09-28T22:00:00Z`. Zůstává zmrazené včetně kohorty a odměn. Naplánovaná průběžná zpráva 27. 9. večer a vyhodnocení 29. 9. ráno existují; nevytvářej je znovu a neměň je bez požadavku.

Přípravu slovníku, výrobní změny a offline/izolované preview lze dělat již během kola 2; není důvod čekat s prací na uzávěrku. **Veškeré hráčské desky kola 3 musí používat novou osvěženou politiku.** Pracovní rozsah preview je 12 nových desek, se samostatnými stabilními ID. Nejde o schválený launch plán. Nevkládej mezi ně hráčskou kontrolní polovinu dosavadního výběru. Neměň současně rozměr, počet slov a ovládání; drž srovnatelné výrobní parametry s kolem 2. Výrazně čerstvější zásoba nemá být nahrazena raritami nebo povinnými 100 % novými tokeny za cenu kvality. Kvalitní stávající hesla zůstávají přípustná; jejich podíl a opakování v celé sérii je třeba transparentně změřit.

Kolo 2 použij jako historické srovnání, přednostně po stejných vracejících se hráčích. Výsledek bude produktový signál, ne randomizovaný kauzální důkaz; zohledni rozdílné desky, trénink, účast a efekt novosti. Sledovat dosavadní zábavnost/náročnost, časy, nápovědy a připomínky k neznámým slovům. Nejvýše jedna stručná závěrečná otázka navíc k vnímané změně slovní zásoby, nikoli další dotazník po každé desce. Úspěchem je chuť pokračovat a zábavná srozumitelná novost, ne automaticky delší čas. Před plošným použitím také lehká/střední sada pro méně zkušené hráče; samotná TOP kohorta obecnou vhodnost neprokáže.

Žádné osobní účty pro syntetické hraní. Test musí mít samostatný experimentId, účetně izolované výsledky a jednorázové odměny. Čas, počet hráčů a přesné metriky potvrdit před aktivací. Nedomýšlet nový datum spuštění; nedělat automatickou produkční várku, protože kalendář dosáhl uzávěrky.

### Fáze D: schválený směr společné pestré cesty, oddělená realizace až po pozitivním produktu

Jedna verzovaná redakční trasa immutable board IDs pro každou obtížnost, pro všechny stejná relativní posloupnost. `resume → první nedokončená deska trasy`. Zachovaný číselný katalog, původní čísla/obsah, XP, odznaky a přístupy. Žebříček je k ID desky, ne k pořadovému místu v trase. Veterán přeskakuje dokončené položky a nováček ne; nenuť je přehrávat staré desky pro sjednocení pozice.

Aktuální generátor pestré cesty není globální manifest. Nestačí všem nastavit mode=varied. Navrhni politiku aktualizací, převodu stávajících osobních plánů, rozehraných her, offline stavu a CAS synchronizace. Výběr snadné obtížnosti nebo zamčeného režimu se tím nesmí obejít. Pro shodnou aktivitu v žebříčcích využij existující aktuální/týdenní várku, bez zbytečného nového režimu.

Gen6 je výrobní verze. Nesahat slepě na `freeGeneration`/`contentGeneration`: v nynějším runtime by to mohlo resetovat obsahový postup. `tools/gen5/package.py` výslovně zachovává runtime generation a přidává `generatorGeneration`. Nový obsah má vlastní nové ID; stávající odměny nikdy znovu nezapočítat jen kvůli jiné trase.

## Přiměřené ověření

- Tato kandidátní/dokumentační práce nepotřebuje novou baterii testů UI. Reprodukovatelný audit už kontroluje vstupní otisky, abecedu, délky, unikátnost a vyřazení.
- Při změně výrobní pipeline zachovat důkaz platnosti cest, úplného pokrytí a jedinečnosti řešení nad širší zmrazenou rozpoznávací množinou. Nová slova přidat konzistentně do kontrolního slovníku; nezískávat falešně unikátní řešení tím, že solver některá uznávaná slova nevidí. Při vyčerpání limitu solveru kandidát neprošel; neoslabovat důkaz.
- Ověřit přehratelné seed/manifest/contentHash, kolize identit a počty slov; srovnání stejných profilů. Před hratelným preview skutečný browser flow na mobil/Fold viewport/desktop; viewport není test fyzického Foldu.
- Pro nové pořadí jsou důležité scénáře: nováček, téměř hotová stará banka, souběžná zařízení, offline rozehraná stará deska, návrat k numerickému katalogu, přidání další várky. Ověřit zachování XP a vazbu leaderboardu na boardID.
- Na běžící produkci žádné syntetické výsledky, žádná migrace bez schváleného provedení a rollbacku. Po splnění relevantních kontrol neopakovat drahé testy bez nové změny nebo konkrétního problému.

## Reprodukce auditu

Příloha není plný zdrojový repozitář ani aktuální runtime patch. Obsahuje `expand_candidates.py`, `curated_wave2.json` a původní `lexicon-v3-candidates-wave1.json`. Python používá standardní knihovnu a pouze čte vstupy.

```sh
python expand_candidates.py --root /cesta/k/overenemu/proplet \
  --previous lexicon-v3-candidates-wave1.json --seeds curated_wave2.json \
  --out /cesta/mimo/repozitar/audit --source-sha SKUTECNE_OVERENY_SHA
```

Použitý starší archiv e1b7ba2 měl GitHubem ověřenou shodu VŠECH čtených lexikálních/generačních vstupů s tehdejším main6e076bc; nešlo o úplný checkout současné aplikace. Nový běh nad změněným lexikonem může oprávněně nahlásit kolizi; neignorovat ji, ale aktualizovat výběr/evidenci. Posuzování výskytů je statické nad bankou, nikoli inference osobních her.

## Jak začít bez nového kolečka plánování

Nejprve ověř přístupy, reálný checkout a možnost spustit potřebný validátor. Potom zpracuj první zdrojově doloženou redakční podmnožinu ze stávajících 1 143 návrhů, ukaž změněné stavy a zbývající otázky a připrav candidate-only lexikon/kapacitní výsledek. Nevyráběj další tisíce slov namísto ověření už slibných návrhů. Po každém důležitém kroku zapiš datum, rozhodnutí, SHA a co je opravdu ověřeno.

Práce v chatu přes konektory je možná; toto předání doporučuje přejít nyní do Codexu a začít fází A. Není potřeba další povinné kolo schvalování zásobníku v chatu. Ověř skutečně dostupný checkout, terminál a browser. Nepředstírej, že přepnutí režimu samo automaticky zpřístupní staré místní soubory nebo odstraní omezení nástrojů.


Zápis pokračování a kompletní druhá várka jsou také v GitHub issue #146:
https://github.com/prouza-hue/proplet/issues/146#issuecomment-5848742995

## Záznam této revize

26. 9. 2026: opravené rozdělení práce chat/Codex, odmítnuté kontrolní dvojice, potvrzená společná cesta jako další etapa, doplněný MorfFlex včetně meze historického důkazu a licenční podmínky. Data kandidátů se touto revizí neměnila ani nově neověřovala. Main znovu potvrzen 6e076bcc…; produkce/databáze nebyly v této revizi dotazovány nebo měněny. Nový zápis: https://github.com/prouza-hue/proplet/issues/146#issuecomment-5848867176
