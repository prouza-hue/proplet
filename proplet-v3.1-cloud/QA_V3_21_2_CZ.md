# QA Proplet v3.21.2

## Opravená regrese starteru

V3.21.1 po dvou nalezených slovech nastavovala interní stav `starterAwaitingHint` a `pointerDown()` odmítal všechny další tahy, dokud hráč nepoužil Nápovědu. To bylo odstraněno.

Nové chování:

- žádný stav starteru neblokuje `pointerDown()` kvůli Nápovědě,
- Nápovědu lze otevřít kdykoli,
- po dvou slovech může po 10 s nečinnosti přijít pouze neblokující inline nabídka,
- nabídka nemění herní stav, neblokuje desku a zobrazuje se maximálně jednou,
- po použití / zavření / dalším postupu se správně uklidí.

## Copy

- odstraněno „Kdy se má ozvat?“,
- používá se explicitní „Kdy ti má Pomocník nabídnout nápovědu?“,
- odstraněny nejasné popisy „ozve se po…“.

## Automatické kontroly

PASS:
- JS syntax + Python compile,
- HTML IDs bez duplicit + CSS parser,
- `test_v3212_starter_choice.py`,
- `test_v321_package.py`,
- `test_v321_server.py`,
- Fold7 real-viewport test,
- account nudges 1/4/10,
- Rescue offer,
- focus/visibility pause,
- Free global leaderboard,
- v3.16 migration regression 14/14,
- win praise, share metadata, Daily replay.

Puzzle JSON i SQL migrace v3.21 jsou proti v3.21.1 bitově beze změny.
