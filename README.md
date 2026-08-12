# Proplet v3.5.2 — Content & Progression

Česká slovní logická PWA pro Vercel + Supabase.

## Obsah

- 100 Easy (6×6)
- 100 Medium (7×8)
- 100 Hard (střídání 8×8 a 9×9)
- 100 Mozkožrout (10×10)
- 365 Daily Challenge
- 30 streak-rescue 6×6 puzzle

Celkem: **795 puzzle**.

Původních prvních 50 free levelů v každé obtížnosti zůstává obsahově beze změny. V3.5.2 pouze přidává levely 51–100.

Nových 200 free levelů je přísněji generovaných: kromě unikátního exact-cover řešení musí mít každé cílové slovo právě jednu možnou lokální trasu.

## XP a levely

- Easy: 10 XP × 100 = 1 000 XP
- Medium: 20 XP × 100 = 2 000 XP
- Hard: 35 XP × 100 = 3 500 XP
- Mozkožrout: 60 XP × 100 = 6 000 XP
- všechna Free dohromady: **12 500 XP**
- Daily: 100 XP za každý nový den

XP roadmapa má **32 levelů** od Nováčka až po Absolutního Propletače (47 000 XP). Rozestupy jsou zahuštěné hlavně ve střední části progression.

## Hlavní funkce

- strict unique-solution route logic
- interaktivní onboarding
- 3 stupně nápovědy + Clean solve
- streak + jednorázová 30s rescue challenge
- XP, achievementy a level roadmapa
- heslové multi-device účty
- Daily, týdenní a celkový rodinný leaderboard
- persistentní rozehraná Free/Daily
- Fold/tablet responsive herní layout
- telemetry skutečné obtížnosti + dobrovolný rating
- hlášení problematických slov
- History API navigace pro Android/PWA Zpět
- řízené PWA aktualizace
