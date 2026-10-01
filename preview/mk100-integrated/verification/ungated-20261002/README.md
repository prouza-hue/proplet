# Otevřené obtížnosti a původní ilustrace — 2. 10. 2026

Tato sada navazuje na výslovné rozhodnutí Pavla odstranit všechny podmínky
odemykání obtížností a vrátit původní barevné logo Mozkokalypsy z playtestů.
Publikování celé Mozkokalypsy na produkci dosud nebylo schválené.

- `backend-verification.json`: deset cílených kontrol, nové účty i anonymní
  herní session bez předchozích dokončení; původní kontroly identity,
  platných cest, výsledků a termínů vydání zachované. Snapshot RPC používá
  nulovou podmínku; není potřeba migrace ani zápis do živé databáze.
- `source-invariants.json`: přesné otisky změněných runtime zdrojů;
  kandidátní stovka, slovník, Lexikon v3, původní banky a původní SVG se
  bajtově shodují s předchozím dokončeným náhledem.
- `availability-browser.json`: čerstvý nulový postup, všech šest aktivních
  obtížností na Dnes i Hrát, nativní spuštění Mozkomora a Mozkokalypsy,
  obnovení prázdné hry a původní ilustrace včetně CTA. Desktop, telefon390
  a Fold768 jsou emulace; žádná slova, dokončení ani hodnocení se neposílají.
- `original-art-visual-verification.json` a `original-art-inspection.json`:
  skutečná inspekce dvanácti viewport snímků Dnes/Hrát/CTA v light/dark na
  telefonu a desktopu. Výběr tří snímků je přiložený. Ilustrace nemá filtr;
  původní SVG má SHA256 `a598ce93951838be74c6b63a03115a8b85c424e60ee78bb8df529a81f22c0887`.

Předchozí záznamy v nadřazené složce zachovávají ověření první okrové verze
s tehdejším gatingem. Aktuální rozhodnutí je nahrazuje, historii nepřepisuje.
Izolovaný náhled nadále ukládá postup jen lokálně a nemá přístup k účtům,
serverovým funkcím, živým datům ani odesílání výsledků. Nejde o další playtest.
