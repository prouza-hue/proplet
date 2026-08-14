# Aktualizace Proplet v3.21.2 → v3.21.3

## Co opravuje

v3.21.3 odstraňuje nespolehlivé blokování hry podle orientace/viewportu. Foldable zařízení, tablet ani telefon už nejsou při otočení blokované hláškou „Otoč telefon na výšku“. Otočení pouze vyvolá responzivní přepočet herní plochy.

## Databáze

**Žádná SQL migrace není potřeba.**

`SUPABASE_MIGRATION_V3_21.sql` zůstává beze změny. Pokud už byla spuštěna pro v3.21, nic dalšího v Supabase nespouštěj.

## Nasazení

1. Nahraj obsah `proplet-v3.21.3-update.zip` do GitHub adresáře **`proplet-v3.1-cloud/`** a přepiš stejnojmenné soubory.
2. Commitni změny a nech Vercel nasadit produkci.
3. Aktualizuj/reloadni PWA.
4. Otevři `/api/health`.

Očekávej zejména:

```json
{
  "version": "3.21.3",
  "orientationBlocking": false,
  "foldResponsiveReflow": true,
  "starterHintOptional": true,
  "ok": true
}
```

## Smoke test

Na Fold 7 ověř:

- složený portrait: hra funguje,
- složený landscape: hra se pouze přepočítá a zůstane hratelná,
- rozložený portrait: hra funguje,
- rozložený landscape: hra funguje,
- rozložení/otočení během rozehrané hry: stav i čas pokračují bez orientační blokace.

## Co se nemění

- starter a jeho XP,
- Daily / Free / Rescue / legacy puzzle,
- výsledky a leaderboardy,
- nápovědy, Pomocník a onboarding z v3.21.2,
- databázové schéma.
