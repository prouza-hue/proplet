# Aktualizace Proplet v3.21.1 → v3.21.2

## Supabase

**Nic nespouštěj.** v3.21.2 nemá novou SQL migraci. Migrace `SUPABASE_MIGRATION_V3_21.sql` zůstává beze změny.

## GitHub / Vercel

Obsah `proplet-v3.21.2-update.zip` nahraj do existujícího adresáře:

`proplet-v3.1-cloud/`

Ne do rootu repozitáře. Přepiš stejnojmenné soubory, commitni a nech Vercel nasadit.

## Kontrola

Na `/api/health` očekávej zejména:

```json
{
  "version": "3.21.2",
  "gameFeelSprint": "3.21",
  "foldViewportHotfix": true,
  "starterHintOptional": true,
  "starterHintOfferIdleSeconds": 10,
  "starterMigration": true,
  "ok": true
}
```

## Ruční smoke test

1. Spusť onboarding a ověř text Pomocníka.
2. Spusť starter.
3. Najdi MRAK a JABLKO.
4. **Bez kliknutí na Nápovědu pokračuj v tahání po desce** — musí být plně aktivní.
5. Po cca 10 s bez dalšího správného slova se může zobrazit malá nabídka nápovědy.
6. Nabídku ignoruj a dál hraj — deska musí dál fungovat.
7. Ověř Fold7 chování z v3.21.1.
