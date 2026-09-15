# Preview série Gen5 a oznámení

Větev `feat/gen5-lab` načítá celou kandidátní banku pouze v prostředí Vercel
preview. Produkční banky a jejich rolling plán zůstávají beze změny.
Samotné pozdější přesměrování této větve na produkci nové desky nezapne;
publikace vyžaduje samostatné připojení schválené série.

Preview nabízí 965 původních a rezervovaných desek + 450 nových. Zachovává
jejich ID, pořadí, obsah a generaci hráčského postupu 4. Mozkomor je pro
testování odemčený. Backend odmítá zápisové požadavky; klient neposílá
testovací výsledky, frontu ani produktovou analytiku. Přihlášení a změny účtu
jsou v tomto izolovaném preview také zablokované.

Odkaz `/index.html?releasePreview=1&open=free` ukáže CTA bez povinného
tréninku. Ve volné hře je pouze na preview výběr nové desky 1–100 (Mozkomor
1–50) a tlačítko k opětovnému zobrazení CTA. Běžná nabídka zachovává celé
číslování včetně původního obsahu.

CTA používá skutečné HTML/CSS políčka NOVÉ v zatáčce a existující ikonu
Mozkomora. Je responzivní, má světlou i tmavou variantu, nativní modální
dialog, Escape, systémové Zpět a návrat focusu. Běžně se ukáže jednou,
teprve když jsou všechny nové desky načtené a uživatel není ve hře ani
v jiném dialogu. Na preview je záznam pouze v sessionStorage a uvedený
kontrolní odkaz umožní oznámení vynutit při dalším načtení.

Ověření: 6 integračních testů nové banky, behaviorální test CTA a preview
výběru; current runtime sada měla po opravách všech 78 položek úspěšných
(70 v prvním běhu, 7 opravených kontrol v cíleném opakování a nový CTA test).
Kontrola assetů a 311 kontrol syntaxe prošly. Důvod aktualizace dvou API
snapshotů byl nezávisle ověřen: změnil se pouze popis preview endpointu
a přibyl zdravotní příznak `gen5CandidatePreview`.

V prohlížeči ověřeno: desktop, mobil 390×844 a 360×640, oba barevné režimy,
zavření Escape, obnovení focusu, CTA do volné hry, spuštění nové snadné
desky 4 (6×6, celková úroveň 221) a Mozkomora 50 (celková úroveň 150).
