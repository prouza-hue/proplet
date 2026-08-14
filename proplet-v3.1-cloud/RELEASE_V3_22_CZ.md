# Proplet v3.22.0 — Night Mode

## Cíl releasu

Umožnit hrát Proplet večer a v noci bez velkých světlých ploch a současně zachovat jeho vizuální identitu. Tmavý režim není invertovaný light mode; má vlastní paletu a vlastní chování herních povrchů.

## Vzhled

V profilu přibyla sekce **VZHLED — Jak má Proplet svítit?** se třemi režimy:

- `Automaticky` — respektuje `prefers-color-scheme`,
- `Světlý`,
- `Tmavý`.

Preference je záměrně **per-device**. Telefon může být trvale tmavý a notebook světlý bez synchronizace přes účet.

## Tmavá paleta

Základní noční povrchy jsou hluboké ink/plum odstíny místo čisté černé. Text je lehce teplý, nikoli ostrá čistá bílá. Fialová, mint, korálová a žlutá zůstávají součástí identity Propletu, ale velké plochy mají nižší luminanci.

Nejdůležitější rozdíl je na herní desce: vyřešená slova už nevznikají mícháním barvy s bílou. V dark mode se barva slova míchá do tmavého povrchu, takže cesty zůstávají jasně odlišitelné, ale hotová deska v noci nesvítí jako pastelová plocha.

## Pokrytí

Tmavou variantu mají zejména:

- Dnes a Daily hero,
- Free obtížnosti a historii,
- herní deska, aktuální cesta, vyřešené cesty a ambientní progres,
- Nápověda, chybné cesty, starter guidance a Reset/VRÁTIT,
- výsledkovka a celebration stavy,
- onboarding a Pomocník,
- účet, modaly a formuláře,
- globální/týmové leaderboardy,
- profil a nastavení,
- bottom navigation,
- interní QA obrazovky,
- `/admin`.

## Startup a PWA

Téma se aplikuje malým inline bootstrapem ještě před načtením hlavního CSS, aby se při otevření tmavého Propletu nejdřív neukázala bílá obrazovka. Runtime současně aktualizuje `<meta name="theme-color">` podle aktivního režimu.

Manifest používá tmavý, neutrální startup background, aby instalovaná PWA nevytvářela při nočním spuštění bílý záblesk.

## Přístupnost

- primární dark CTA s bílým textem má kontrast alespoň 4.5:1 přes celý gradient,
- hlavní text a muted text mají silný kontrast proti tmavým kartám,
- dark mode zachovává existující `prefers-reduced-motion`,
- herní stavy nejsou rozlišované pouze jasem pozadí; zůstávají barva, border, cesta a textové/haptické/audio signály.

## Bezpečnost

Release neobsahuje novou SQL migraci ani změnu puzzle obsahu. `data/puzzles.json`, `public/puzzles.json` a `SUPABASE_MIGRATION_V3_21.sql` zůstávají bitově stejné jako v3.21.3.

Orientation blocker se nevrací; v3.22 zachovává bezpečné responsive-only chování v3.21.3.
