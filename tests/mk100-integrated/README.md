# Dostupnost obtížností v běžném náhledu Propletu

Krátký technický smoke používá normální Dnes, Hrát a Volnou hru. Všechny
obtížnosti musí být dostupné hned, také Mozkomor a Mozkokalypsa. Test nezačne
playtest, neřeší slova, nedokončuje desky, nevyplňuje hodnocení ani nezapisuje
na server. Dřívější odemykací scénáře 0/199/200 a hromadné dohrávání odstraněny.

## Rozsah

1. V samostatném prázdném profilu `?previewPlayer=new` ověřit skutečnou nulu
   dokončení u všech šesti obtížností, nulovou frontu výsledků a anonymní fixture.
   Test nepřidává žádné dokončení ani příznak odemknutí.
2. Na Dnes i Hrát musí být všech šest aktivních tlačítek v pořadí Snadná,
   Střední, Těžká, Mozkožrout, Mozkomor, Mozkokalypsa. Žádná zamčená karta.
3. Skutečným kliknutím či dotykem spustit Mozkomor a Mozkokalypsu z obou
   nabídek. Obnovit stejnou prázdnou rozehranou desku po reloadu. Počet tahů,
   nápověd, nalezených polí i dokončení musí zůstat nula.
4. Ověřit původní barevný artwork `/difficulty/printshop/mozkokalypsa-v2.svg`
   na Dnes, Hrát a v oznámení: skutečně načtený obrázek a nenulové rozměry.
   Primární CTA oznámení musí otevřít běžnou Mozkokalypsu. Herní ikonu
   kontrolujeme také, pokud ji běžný header obsahuje.
5. Provést tentýž krátký průchod na desktopu 1440×1080, telefonu 390×844 a
   rozloženém Foldu 768×1024. Telefon a Fold používají touchscreen tap; jde
   o emulaci, nikoli fyzické přístroje. Dotykové snímky zachycují viewport,
   protože Chromium154 při fullPage snímku vypíná dotykovou emulaci.
6. Zachytit skutečnou síť před otevřením stránky. Mutace, `/api/`, produkční
   a cizí adresy i service worker jsou zablokovány a pokus znamená FAIL.
   Povolen je pouze původní read-only Google Fonts stylesheet/font GET
   z přesných domén fonts.googleapis.com a fonts.gstatic.com. Test nikdy
   nevrací falešné síťové odpovědi; in-memory fixture patří aplikaci.

## Použití

Nejprve přečíst Browser skill a zkusit jeho runtime. Zadání ověřit náhled
zahrnuje izolované reverzibilní technické testy, bez dalšího potvrzení.
Headless runner používá výhradně nové prázdné kontexty, nikoli existující
uživatelský profil nebo jeho cookies. Pokud dostupný runtime nenabízí oddělené
kontexty, síťový guard či potřebnou dotykovou emulaci, runner tyto kontroly
provede odděleně; existující browser ovládá pouze runtime.
`--approved-isolated-fallback` je výslovný přepínač tohoto rozsahu, nikoli
požadavek na nové uživatelské potvrzení.

```text
node tests/mk100-integrated/verify.cjs --url http://127.0.0.1:8866/ \
  --approved-isolated-fallback --availability-only --output work/mk100-ungated-local
```

`--availability-only` je výchozí a jediný rozsah. Historické `--all`,
`--flows-only` a `--bonus-only` jsou odmítnuty. Geometrii, zamrazenou banku
stovky a rozpoznávání slov tento rychlý smoke znovu neověřuje. Na konkrétní
Vercel Preview URL se spouští stejně s novým adresářem v `work/`.

Playwright musí být dostupný na `NODE_PATH`. `--chromium` mění cestu k
samostatnému Chromium; výchozí Windows cesta je instalovaný Chrome. Náhled
musí mít oba výslovné markery integrovaného preview a prostředí `preview`.
Produkční aliasy jsou zakázané. Výstupy zůstávají v `work/`; uložené snímky
je nutné skutečně prohlédnout před potvrzením vizuální kontroly.
