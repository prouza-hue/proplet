# Aktualizace Propletu z v3.11 na v3.12

## Databáze

**Žádná SQL migrace není potřeba.**

Produkční SQL manifest už byl použit pouze při přípravě této konkrétní banky. Při nasazení nic v Supabase nespouštěj.

## Nasazení

1. Nahraj obsah `proplet-v3.12-update.zip` do stejného GitHub repozitáře a nech přepsat stejnojmenné soubory.
2. Commitni změny.
3. Vercel vytvoří nový Production deployment.
4. Po deployi otevři `/api/health`.

Očekávej mimo jiné:

- `"version": "3.12.0"`
- `"vocabularyVersion": 2`
- `"freeTieredFromVersion": "3.12"`
- `"freeFreezeCutoffs": {"easy":54,"medium":50,"hard":10,"hardcore":11}`
- `"tieredDailyFrom": "2026-08-13"`

V patičce bude `Proplet v3.12`.

## Co se hráčům stane s progressem

Nic se nemaže ani nepřepočítává. Všechny úrovně, které spadají do zmrazeného produkčního prefixu, jsou obsahově stejné. Až hráč dojde do bezpečně nehrané části banky, dostane už nové v3.12 puzzle s tierovanou slovní zásobou.

Daily a Rescue jsou v3.12 proti v3.11 beze změny.
