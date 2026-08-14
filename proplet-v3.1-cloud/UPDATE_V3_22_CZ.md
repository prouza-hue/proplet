# Aktualizace Proplet v3.21.3 → v3.22.0

## Co přináší

v3.22 přidává plnohodnotný tmavý režim pro celý Proplet. Nejde o barevnou inverzi: tmavá varianta má vlastní povrchy a odstíny pro herní desku, vyřešené cesty, modaly, výsledkovku, onboarding, leaderboardy, profil i administraci.

Hráč má v **Já → Vzhled** tři možnosti:

- **Automaticky** — podle systémového vzhledu zařízení,
- **Světlý** — vždy světlý,
- **Tmavý** — vždy tmavý.

Volba se ukládá pouze na konkrétním zařízení. Režim `Automaticky` reaguje i na změnu systémového nastavení za běhu aplikace.

## Databáze

**Žádná SQL migrace není potřeba.**

`SUPABASE_MIGRATION_V3_21.sql` zůstává beze změny. Pokud už byla spuštěna při v3.21, v Supabase nyní nic nespouštěj.

## Nasazení

1. Nahraj obsah `proplet-v3.22-update.zip` do GitHub adresáře **`proplet-v3.1-cloud/`** a přepiš stejnojmenné soubory.
2. Commitni změny a nech Vercel vytvořit Production deployment.
3. Aktualizuj/reloadni PWA.
4. Otevři `/api/health`.

Očekávej zejména:

```json
{
  "version": "3.22.0",
  "darkModeSprint": "3.22",
  "themeModes": ["auto", "light", "dark"],
  "themePreferenceScope": "device",
  "orientationBlocking": false,
  "foldResponsiveReflow": true,
  "starterMigration": true,
  "ok": true
}
```

## Doporučený smoke test

1. Otevři **Já → Vzhled** a postupně zkus `Světlý`, `Tmavý` a `Automaticky`.
2. V tmavém režimu otevři Dnes, výběr Free hry, profil, onboarding/Pomocníka a leaderboard.
3. Spusť normální úroveň a ověř nevyřešené buňky, barevné vyřešené cesty, chybný tah, Nápovědu, Reset/VRÁTIT a dokončení hry.
4. Ověř výsledkovku a account modal.
5. Na Fold 7 zkus rozložený i složený stav v obou orientacích — orientace nesmí hru blokovat.
6. Pokud používáš administraci, otevři `/admin`; převezme stejnou lokální preference vzhledu.

## Co se nemění

- žádné Daily / Free / Rescue / legacy puzzle,
- starter ani jeho +10 XP,
- žebříčky, výsledky, XP a streaky,
- Pomocník a systém nápověd,
- account nudge cadence 1 / 4 / 10,
- orientation safety z v3.21.3,
- databázové schéma.
