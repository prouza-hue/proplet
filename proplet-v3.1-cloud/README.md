# Proplet v3.7 — Playtest release

Česká slovní logická PWA pro Vercel + Supabase.

## Obsah

- 100 Snadných (6×6)
- 100 Středních (7×8)
- 100 Těžkých (8×8 / 9×9)
- 100 Mozkožroutů (10×10)
- 365 Denních výzev
- 30 záchranných 6×6 úloh pro sérii

Celkem: **795 puzzle**.

## Co přináší v3.7

- povinný první interaktivní tutorial (při ručním zopakování v profilu je zavírací)
- herní HUD ukazuje konkrétní číslo úrovně, např. **Mozkožrout 5**
- během hry dva jasné řádky **Zbývá / Nalezeno**
- Těžká a Mozkožrout 10–100 přegenerované s maximálně 2 čtyřpísmennými slovy
- každé nové cílové slovo má jedinou lokální cestu a každá deska jediné kompletní řešení
- u každé obtížnosti seznam **Odehrané úrovně** s nejlepším časem, Clean/hinty a tahy
- detail úrovně: rodinný žebříček stejného puzzle, sdílení a možnost zahrát znovu
- výsledkovka volné hry zobrazuje žebříček právě dohrané úrovně
- Rodinná liga: výběr existující ligy nebo založení nové ligy s PINem
- kód ligy je case-insensitive (`PROUZA`, `Prouza`, `prouza` = totéž)
- zobrazení/skrytí hesla při přihlášení i nastavení hesla
- volitelný Web Push pro novou Denní výzvu
- server neposílá denní push hráči, který už dnešní výzvu dokončil

## Co se nemění

- striktní pravidlo: správné slovo se uzná pouze po cestě patřící do jediného řešení
- Snadná, Střední, Denní výzvy a rescue banka zůstávají obsahově stejné
- u Těžké/Mozkožrouta zůstávají stejné úrovně 1–9; mění se jen 10–100
- XP ekonomika a 32 hodností zůstávají z v3.5.2

## Aktualizace

Viz `UPDATE_V3_7_CZ.md`.

Pro základní v3.7 je nutné jednou spustit `SUPABASE_MIGRATION_V3_7.sql`. Push notifikace jsou volitelné a mají vlastní krátký setup v témže návodu.
