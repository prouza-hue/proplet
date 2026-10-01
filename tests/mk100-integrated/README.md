# Ověření Mozkokalypsy v celé aplikaci

Tato kontrola používá běžnou Volnou hru Propletu. Nevytváří další playtest,
nevyplňuje hodnocení, nepřihlašuje hráče a nezapisuje na server.

## Rozsah

1. Zobrazit normální obrazovku Dnes, poté Hrát; Mozkokalypsa musí být poslední
   obtížnost a při odemknutém Mozkomoru bezprostředně vedle něj.
2. V nových samostatných testovacích profilech ověřit Mozkomor při 0, 199 a 200
   syntetických dokončeních Mozkožroutů. Podmínka 200 i zapamatované odemknutí
   zůstávají beze změny. Syntetická data dodává izolovaný bootstrap přes
   `?previewPlayer=new`, `?previewHC=199` a `?previewHC=200`; existují jen v
   samostatném namespace náhledu.
3. Porovnat všech 100 integrovaných desek se schválenou bankou: stabilní ID,
   pořadí, matice, masky, cesty a slova; profily 20/60/15/5. Samostatná obtížnost
   nesmí přejmenovat ani nahradit dosavadní Mozkomor či nižší banky.
4. Začít hru přes Dnes i Hrát, skutečně protáhnout slova myší nebo dotykem,
   ověřit nalezená pole, nápovědu, obnovení rozehrané hry, dokončení, další
   úroveň a lokální přehled dokončených úrovní. Výsledek používá běžné herní
   modální okno, nikdy formulář playtestu.
   Vedlejší slovo AKCI na první desce se ověřuje myší před cílovými slovy:
   normální rozpoznání, +1 lokální XP, žádná vyplněná cílová pole.
5. Otevřít odkaz `?review=12` na reprezentativních 12 desek a vstup `?board=20`,
   ověřit počet i identitu. Výběr používá normální data všech 100 desek.
6. Pořídit Dnes, Hrát, hru a dokončení při desktopu 1440×1080, telefonu 390×844
   a rozloženém Foldu 768×1024. Telefon a Fold používají skutečné CDP dotykové
   události. Jde o emulaci, ne fyzické přístroje.
   Dotykové snímky zachycují viewport a zvlášť poslední karty po posunu;
   Chromium 154 při `fullPage` snímku vypíná dotykovou emulaci.
7. Zachytit síťové požadavky před otevřením stránky. Všechny mutace,
   `/api/`, cizí adresy a service worker jsou zablokovány a každý takový pokus
   znamená selhání ověření. Výjimkou jsou původní Google Fonts: pouze GET
   stylesheet/font z přesných domén fonts.googleapis.com a fonts.gstatic.com.
   Test nepřidává falešné odpovědi síťovým routám.

## Použití

Před ověřením je nutné přečíst Browser skill a zkusit jeho runtime. Skript je
izolovaný záložní postup pouze tehdy, pokud runtime není dostupný a záloha byla
autorizována. Nepoužívá profil ani přihlášení uživatelova prohlížeče.

```
node tests/mk100-integrated/verify.cjs --url http://127.0.0.1:8765/ \
  --approved-isolated-fallback --output work/mk100-integrated-browser
```

Skript vyžaduje Playwright na `NODE_PATH` a samostatný headless Chromium.
Výchozí Windows cesta je instalovaný Chrome; lze změnit pomocí `--chromium`.
`--bonus-only` provede pouze ověření AKCI a žádnou desku nedohraje.
`--flows-only` pokračuje pouze ve třech běžných herních průchodech a odkazu na
dvanáctku, pokud již byly integrita, všechny brány i AKCI prokazatelně ověřeny.
`--all` rozšíří skutečné desktopové dohrání na všech 100 desek. Výchozí běh
ověří geometrii a integraci všech 100 a skutečné dohrání jedné desky v každém
ze tří rozměrů. `--representative-path` nastaví adresu dvanáctky. Náhled musí
mít výslovný marker `PROPLET_RUNTIME_META.mk100IntegratedPreview === true` a
`PROPLET_MK100_INTEGRATED_PREVIEW === true`, prostředí `preview`; skript nikdy
nesmí být spuštěn proti produkčnímu aliasu. Profily pro syntetické brány
používají uvedené fixture parametry; test nikdy nepřepisuje herní funkci pro
odemykání.

Záznamy, screenshoty a případná chyba se ukládají výhradně do `work/`.
Screenshoty je nutné následně prohlédnout; jejich uložení samo nepotvrzuje
vizuální kvalitu.
