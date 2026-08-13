# Proplet v3.20 — méně vysvětlování, víc hraní

v3.20 je UX sprint zaměřený na první kontakt s hrou, čitelnost a ukládání postupu. Vizuální identita Propletu zůstává; obrazovky mají méně soutěžících prvků a jasnější hierarchii.

## Onboarding ve třech krocích

Nový hráč už nezačíná delším vysvětlením pravidel.

1. **Najdi PES** — hned táhne prstem přes desku.
2. **Propleť úplně všechno** — jediná klíčová myšlenka: každé políčko patří právě jednomu slovu, bez diagonál.
3. **Pomocník** — hráč si zvolí, za jak dlouho se má nabídnout malé postrčení.

Pokročilé principy zůstávají kontextové. Například správné slovo vedené špatnou cestou hra vysvětlí až ve chvíli, kdy se to opravdu stane.

## Účet bez povinného týmu

Nový účet se vytváří pouze pomocí:

- jména,
- osobního hesla.

Tým je od v3.20 volitelná funkce. Hráč ho může přidat později z profilu pro společné pořadí a Ligu týmů. Existující týmové účty zůstávají kompatibilní.

Interně používá účet bez týmu neveřejný `SOLO_*` identifikátor, aby nebylo nutné destruktivně měnit původní `family_code NOT NULL` model. Tento kód se nikdy nemá zobrazit hráči.

## Tři chytré nabídky uložení postupu

Anonymní hráč dostane nabídku účtu po dokončení:

- 1. hry,
- 4. hry,
- 10. hry.

Pak už Proplet automatickými modaly neobtěžuje. Zůstává pouze trvalé nenásilné **☁️ Uložit** a přirozené CTA u funkcí, které účet potřebují.

Analytics nově rozlišuje zobrazení, kliknutí, odmítnutí a autentizaci pro každou ze tří nabídek zvlášť. QA dashboard proto ukáže, která nabídka skutečně přináší účty.

## Přehlednější obrazovky

- **Dnes**: Daily hero, rychlá Free hra a jeden kompaktní blok XP + série. Statistiky Daily jsou v profilu.
- **Výsledkovka**: nejdřív oslava a výkon, potom pořadí; sekundární akce a feedback už nesoutěží s hlavním CTA.
- **Navigace**: hlavní funkční ikony mají jednotný jednoduchý line styl.
- **Typografie**: důležité sekundární texty jsou větší; mikrotext zůstává jen tam, kde je skutečně metadatový.
- **Karty**: menší vizuální hluk a méně zbytečné vrstvenosti.

## Kompatibilita a QA

- Free a Daily banky jsou proti v3.19.2 **bitově identické**.
- XP, achievementy, série, historické výsledky a leaderboardová pravidla se nemění.
- `team_joined_at` zabraňuje tomu, aby pozdější vstup do týmu zpětně změnil historické týmové skóre.
- Zachované jsou hotfixy v3.19.1/3.19.2, globální Free leaderboardy i focus/pause logika.
