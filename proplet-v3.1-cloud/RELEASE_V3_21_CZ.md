# Proplet v3.21 — First Touch & Game Feel

## Nový první Proplet

Nový hráč po onboardingu nejde do menu, ale rovnou do ručně kurátorovaného `starter-v1` 5×5:

**MRAK → JABLKO → ČOKOLÁDA → AUTOBUS**

Starter postupně ukáže rovnou cestu, zatáčení, délky slov, Nápovědu a stočenou cestu. Vedení se během hry zmenšuje. Tréninková Nápověda nezruší ✨ Čistě.

Dokončení starteru dává skutečných **10 XP**. Existující účty dostanou stejných 10 XP migrací, takže nevznikne nerovnost mezi novými a starými hráči.

## Lepší pocit ze hry

- deska s postupem velmi jemně získává ambientní glow,
- poslední slovo nejdřív dokončí a „zaklapne“ celou plochu; výsledkovka přijde až po krátké pauze,
- skutečně chybná cesta zůstane cca 210 ms viditelná korálově,
- cesty kratší než 4 písmena se nepočítají jako tah ani chyba,
- Reset je okamžitý a nabízí `VRÁTIT`, bez potvrzovacího modalu,
- bezpečnější minimální výška herních tlačítek.

## Fold7 / tablet

Rozložený Fold už není podle mobilního user-agentu zaměněný za telefon. Velký vnitřní viewport používá tabletový dvousloupcový layout a může hrát i naležato. Složený telefonní viewport si ponechává portrait guard.

## Copy cleanup

Hráčské UI už nepoužívá interní vývojářské výrazy typu `Gen2`, `slot` apod. Převod staršího progresu se vysvětluje hráčským jazykem a XP copy rozlišuje novou a již započítanou úroveň.

## Obsah

Existující Free, Daily, Rescue, `legacyFree` a `legacyDaily` banky jsou obsahově beze změny. Přibyl pouze samostatný top-level `starter`.
