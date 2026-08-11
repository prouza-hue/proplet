# Proplet v3.4 — release notes

## Hlavní změny
- Adaptivní herní obrazovka pro telefon, rozložený Samsung Fold a tablet: během hry se nescrolluje a „Aktuálně“ zůstává viditelné.
- „Slova“ jsou kompaktní jednorádkový pás; na krátkých displejích se ještě zmenší.
- Interaktivní onboarding včetně skutečného gesta P → E → S; lze ho kdykoli zopakovat v profilu.
- Streak rescue: při přesně jednom vynechaném dni lze jedním 30s pokusem na speciální 6×6 úloze streak zachránit.
- Tři úrovně nápovědy a Clean solve. Daily leaderboard řadí Clean → méně hintů → čas → tahy.
- Výraznější haptika a tlačítko „Otestovat haptiku“.
- Karty obtížností mají jednu ikonu vlevo a vpravo progress ring + šipku.

## Herní banky
- 50 Easy
- 50 Medium
- 50 Hard
- 50 Mozkožrout
- 365 Daily
- 30 Rescue

Celkem 595 úloh včetně rescue banky. Původních 565 herních úloh z v3.3 se nemění; rescue banka pouze přibývá.

## Aktualizace
Pro existující v3.3 použij `UPDATE_V3_4_CZ.md`. Je potřeba jednou spustit `SUPABASE_MIGRATION_V3_4.sql` a teprve potom deploynout kód.
