# Proplet v3.21.1 — Fold viewport hotfix

## Opraveno

- rozložený Galaxy Z Fold už není chybně považovaný za telefon naležato,
- tabletový herní layout reaguje na reálně dostupný viewport, ne na nominální rozlišení panelu,
- landscape guard používá geometrii + touch/coarse pointer místo samotného user-agentu,
- složený telefon naležato je opět bezpečně blokovaný,
- fold/unfold reflow se stabilizuje pomocí ResizeObserveru a následných viewport přepočtů,
- podporovaná změna Device Posture v Chromu spouští nový layout přepočet.

## Beze změny

- starter v3.21,
- Free / Daily / Rescue / legacy puzzle banky,
- XP a leaderboard pravidla,
- Supabase schema a data.
