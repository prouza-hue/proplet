# Aktualizace Propletu z v3.20 na v3.20.1

## Supabase

**Žádná nová SQL migrace není potřeba.** v3.20.1 používá stejné databázové schéma jako v3.20.

Pokud už běží v3.20, v Supabase teď nic nespouštěj.

## GitHub

Nahraj obsah `proplet-v3.20.1-update.zip` do stejného projektového adresáře jako předchozí verzi — v tomto repozitáři tedy do:

`proplet-v3.1-cloud/`

Ne do rootu repozitáře.

Update přepisuje:

- `server.py`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`

Dokumentaci můžeš nahrát také.

## Kontrola po deployi

Otevři `/api/health` a ověř zejména:

```json
"version": "3.20.1",
"ok": true,
"accountWithoutTeam": true,
"accountNudgeCompletions": [1, 4, 10]
```

V patičce má být **Proplet v3.20.1**.

### Rychlý smoke test

1. V čistém/inkognito profilu otevři onboarding.
2. Na kroku 2 musí být v řádcích **PES / LES / MOC**.
3. Na kroku Pomocníka ověř, že na telefonu není potřeba scrollovat k CTA.
4. Dokonči jednu hru anonymně.
5. Ve výsledku pod globálním pořadím musí být `☁️ Uložit postup a zobrazit své místo`.
6. Klikni, vytvoř účet a ověř návrat do výsledku + načtení vlastního místa po synchronizaci.
7. Ověř kompaktní řádku `Sdílet / Znovu / Dnes` (nebo `Menu`).

## Co se nemění

- žádné puzzle,
- žádné XP,
- žádné dosavadní výsledky,
- žádné 1/4/10 nudge thresholdy,
- žádné týmové členství ani liga,
- žádná nová env proměnná.
