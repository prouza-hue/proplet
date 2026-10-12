# Proplet 4.06.0 — bonusové Daily výzvy

Bonusové výzvy jsou součástí celé aplikace. Na Dnes se přepínají tlačítkem **Navíc** ve stávajícím nadpisu Denní výzvy. Datum, obtížnost, týdenní rytmus a hlavní tlačítko používají stejné řádky jako dosud. Přehled týdne se otevře až po klepnutí na označený den. Výsledek a sdílení speciálu jsou v jeho výsledkovém dialogu.

## Rozsah a pravidla

| Pravidlo | Chování |
| --- | --- |
| Základní Daily | Easy Po–Út, Medium St–Pá, Hard So–Ne; jediný zdroj série a záchrany série |
| Bonus | Mozkožrout St, Mozkomor Pá, Mozkokalypsa Ne; dobrovolný, dostupný nezávisle na základní Daily |
| První dokončení | 100 XP; běžné XP soutěže podle existujících pravidel |
| Opakování a archiv | Procvičení, 0 XP, samostatná identita; původní výsledek zůstává zachovaný |
| Pořadí speciálu | Vlastní tabulka, pouze první serverem ověřené dokončení bez klidného režimu |
| Offline | Ověřená rozehraná oficiální výzva má 24 hodin po expiraci na doručení dokončení |
| Historické odznaky | Dosavadní základní Daily a herní čítače zůstávají zachované; nové souhrnné čítače jsou aditivní |

Banka má 36 desek (12 na obtížnost), dvě nezávislá ověření jedinečného řešení a 404 různých cílů. Cíle se nepřekrývají s aktivní základní Daily bankou. Nejde o tvrzení, že se nikdy neobjevily v jiných bankách. Generování a redakční evidence jsou v `content/gen6/daily-specials-36/`.

## Izolované preview

- Větev: `work/daily-specials-integrated-20261012`.
- Databáze: existující testovací projekt `eanzztstmwlamwfdskbf`; žádné produkční zápisy.
- Datum: středa `2026-10-21`, shodně na základní Daily, bonusu i serverových výsledcích. Herní čas používá skutečné hodiny.
- Změna data funguje pouze na této větvi, ve Vercel preview a s přesnou testovací databází. Ostatní kombinace při startu selžou.
- Manifest banky je stále `candidate`; produkční runtime ho nepřijme. SQL politika vzniká vypnutá.
- URL ověřeného deploymentu a výsledky browser QA se doplní po sestavení do `tests/current/daily-specials-preview.json` a PR.

## Kandidátní kalendář

Začátek týdne je navržen na pondělí **19. října 2026**. První bonus je ve středu 21. října. Poslední z 36 výzev vychází na neděli **10. ledna 2027**. Aktivní základní Daily banka pokrývá tento interval až do 14. ledna. Kalendář je v privátní bance a SQL shodný; zveřejněná identita se později nesmí posunout ani znovu použít.

## Nasazení po závěrečném pokynu uživatele

1. Ověřit aktuální produkční SHA a proti němu připravený PR, aktuální zálohu a shodu nových 36 bindingů v JSON/SQL. Pokud se termín schválení posune za první datum, před aktivací znovu sestavit celý dosud nezveřejněný kalendář; nesmějí se měnit už publikované bindingy.
2. Aplikovat `SUPABASE_MIGRATION_DAILY_SPECIALS_20261012.sql` (totožná CLI migrace `supabase/migrations/20261012000339_daily_specials.sql`). Je aditivní a sama feature nezapne. Základní atomické result/session funkce se nepřepisují.
3. Po schválení obsahu nastavit privátní manifest na `approved`, aktualizovat bankovní hash podle jeho existujícího formátu, dokončit release commit a přepnout `PROPLET_DAILY_SPECIALS_ENABLED=true` v produkčním prostředí.
4. V produkční SQL politice musí být `preview_date=null`; teprve po ověření připravených bindingů nastavit `enabled=true`. Datumové preview proměnné do produkce nepatří.
5. Nasadit schválený commit jako verzi 4.06.0. Ověřit `/api/health`, denní API, zavřený přístup k budoucím des­kám, Dnes na mobilu a základní Daily. Před prvním datem musí bonus zůstat nedostupný.

Vypnutí `PROPLET_DAILY_SPECIALS_ENABLED` a SQL politiky uzavře nové speciály, aniž se smažou výsledky či bindingy. Historické identity a 36 připravených desek se při rollbacku nepřepisují.

## Ověření

- Doménové a ASGI testy kontrolují samostatné klíče, shodné datum, uzavřený budoucí obsah, správnou desku/hash, expiraci a 0 XP za procvičení.
- Klientské testy spouštějí skutečný `finishGame` v obou pořadích základ/bonus a ověřují oddělený cache, obnovu, queue, sloučení hosta, statistiky a férové měření.
- `tests/current/daily_specials_atomic_rollback.sql` používá skutečné SQL funkce a syntetické hráče v transakci zakončené rollbackem. Kontroluje dvě dokončení / 200 XP / jednu základní sérii, idempotenci, procvičení a odmítnutí pozměněné identity.
- `tools/daily_specials/integration_qa.cjs` ověřuje skutečný deployment, dotykové tahy, herní průchody a rozměry karty proti produkci na 320/390/768/1280 px. Produkční kontext blokuje všechny zapisující požadavky. Výstup odlišuje strojové QA od lidského playtestu.
