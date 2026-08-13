# Proplet v3.16.2 — Pomocník v onboardingu a bezpečný přechod Daily

## Pomocník je konečně vidět včas

- Volba Pomocníka je posledním krokem onboardingu.
- Stávajícím hráčům se po aktualizaci jednou otevře jen tento nový krok; celý úvod neopakují.
- Místo věkových kategorií hráč vybírá skutečné chování: nabídka po 45, 70 nebo 100 sekundách bez nového slova, případně nikdy.
- Po výběru je zvýrazněno přesné chování: Pomocník se pouze zeptá a bez souhlasu nic neukáže. Po souhlasu nabídne jen první stupeň nápovědy — start, první písmeno a délku slova.
- Doplňující text zůstává krátký: XP se nemění, přijatá pomoc však ukončí čisté řešení a ovlivní pořadí.
- Volba funguje i při lokálním hraní a při vytvoření účtu se přenese do profilu.

## Přehrání Daily po přechodu na Gen2

Hráč, který stihl pro stejné datum dokončit starou Daily z cache, nyní uvidí tlačítko **Zahrát novou dnešní výzvu**. Po dokončení:

- aktivní Gen2 deska nahradí starou desku jako oficiální výsledek daného dne,
- výsledek se objeví v dnešním i týdenním pořadí,
- původních 100 XP zůstane a další odměna se nepřidá,
- oba skutečné pokusy zůstávají v historii `puzzle_runs`,
- opožděná synchronizace staré desky už aktivní výsledek nepřepíše.

Oprava je obecná a bezpečně řeší i Pavlův noční výsledek v týmu Prouza bez ručního mazání databázového záznamu.

## Testy

- syntaxe klienta přes `node --check`,
- kompilace serveru přes `py_compile`,
- 11 regresních testů migrace Free/Daily včetně výměny Daily bez druhých XP.
