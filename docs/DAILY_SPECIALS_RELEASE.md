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
| Offline | Serverem ověřené dokončení lze doručit ještě 24 hodin po expiraci; samotný lokální čas dokončení tento důkaz nenahrazuje |
| Historické odznaky | Dosavadní základní Daily a herní čítače zůstávají zachované; nové souhrnné čítače jsou aditivní |

Banka má 36 desek (12 na obtížnost), dvě nezávislá ověření jedinečného řešení a 404 různých cílů. Cíle se nepřekrývají s aktivní základní Daily bankou. Nejde o tvrzení, že se nikdy neobjevily v jiných bankách. Generování a redakční evidence jsou v `content/gen6/daily-specials-36/`.

## Izolované preview

- Větev: `work/daily-specials-integrated-20261012`.
- Databáze: existující testovací projekt `eanzztstmwlamwfdskbf`; žádné produkční zápisy.
- Datum: středa `2026-10-21`, shodně na základní Daily, bonusu i serverových výsledcích. Herní čas používá skutečné hodiny.
- Změna data funguje pouze na této větvi, ve Vercel preview a s přesnou testovací databází. Ostatní kombinace při startu selžou.
- Manifest banky je stále `candidate`; produkční runtime ho nepřijme. SQL politika vzniká vypnutá.
- Plné preview: <https://proplet-5pt4zgbht-pavel-prouzas-projects.vercel.app/>. Na prvním vstupu lze přeskočit trénink; na Dnes se bonus vybere přes **Navíc**.
- Ověřený aplikační commit: `f0f232d84aadcc8385fea1023c45de58d0e963e8`, deployment `dpl_2F5zVupowwRd4QEdg9CyVEm5Puek`.
- PR: <https://github.com/prouza-hue/proplet/pull/193>. Navazuje na obsahové PR #192; všechny nové desky jsou součástí integrované větve.
- Finální browser QA: <https://github.com/prouza-hue/proplet/actions/runs/38215105093>. Souhrn a skutečné screenshoty jsou v `docs/daily-specials-preview/`.

## Kandidátní kalendář

Začátek týdne je navržen na pondělí **19. října 2026**. První bonus je ve středu 21. října. Poslední z 36 výzev vychází na neděli **10. ledna 2027**. Aktivní základní Daily banka pokrývá tento interval až do 14. ledna. Kalendář je v privátní bance a SQL shodný; zveřejněná identita se později nesmí posunout ani znovu použít.

## Nasazení po závěrečném pokynu uživatele

1. Ověřit aktuální produkční SHA a proti němu připravený PR, aktuální zálohu a shodu nových 36 bindingů v JSON/SQL. Pokud se termín schválení posune za první datum, před aktivací znovu sestavit celý dosud nezveřejněný kalendář; nesmějí se měnit už publikované bindingy.
2. Aplikovat `SUPABASE_MIGRATION_DAILY_SPECIALS_20261012.sql` (totožná CLI migrace `supabase/migrations/20261012000339_daily_specials.sql`). Je aditivní a sama feature nezapne. Základní atomické result/session funkce se nepřepisují.
3. Po schválení obsahu nastavit pouze stav privátního manifestu na `approved` (desky, jejich hashe a datumové bindingy zůstávají shodné), dokončit release commit a přepnout `PROPLET_DAILY_SPECIALS_ENABLED=true` v produkčním prostředí.
4. V produkční SQL politice musí být `preview_date=null`; teprve po ověření připravených bindingů nastavit `enabled=true`. Datumové preview proměnné do produkce nepatří.
5. Sloučit schválený release do `main` a sestavit produkční deployment jako verzi 4.06.0. Izolovaný preview deployment se přímo nepromuje: jeho větev a datum mají výslovnou bezpečnostní závoru. Ověřit `/api/health`, denní API, zavřený přístup k budoucím deskám, Dnes na mobilu a základní Daily. Před prvním datem musí bonus zůstat nedostupný.

Vypnutí `PROPLET_DAILY_SPECIALS_ENABLED` a SQL politiky uzavře nové speciály, aniž se smažou výsledky či bindingy. Historické identity a 36 připravených desek se při rollbacku nepřepisují.

## Ověření

- Doménové a ASGI testy kontrolují samostatné klíče, shodné datum, uzavřený budoucí obsah, správnou desku/hash, expiraci a 0 XP za procvičení.
- Klientské testy spouštějí skutečný `finishGame` v obou pořadích základ/bonus a ověřují oddělený cache, obnovu, queue, sloučení hosta, statistiky a férové měření.
- `tests/current/daily_specials_atomic_rollback.sql` používá skutečné SQL funkce a syntetické hráče v transakci zakončené rollbackem. Kontroluje dvě dokončení / 200 XP / jednu základní sérii, idempotenci, procvičení a odmítnutí pozměněné identity.
- `tools/daily_specials/integration_qa.cjs` ověřuje skutečný deployment, dotykové tahy, herní průchody a rozměry karty proti produkci na 320/360/390/768/1280 px. Kontroluje také celé názvy v přehledu týdne. Produkční kontext blokuje všechny zapisující požadavky. Výstup odlišuje strojové QA od lidského playtestu.

Finální výsledek je **PASS**: 146 aktuálních testů, izolované PostgreSQL testy, všechny UI/obsahové CI kontroly a celý reálný browser průchod. Ten zahrnuje hosta, přihlášení, claim, obnovení na druhém zařízení, nápovědu, pauzu, samostatný postup obou výzev, dva ověřené výsledky po 100 XP, jednu základní sérii, vlastní pořadí a opakování za 0 XP. Žádná chyba prohlížeče ani nečekaná chyba API; syntetický účet byl odstraněn.

| Šířka | Ostrá karta | Základ v preview | Bonus v preview | Změna při přepnutí |
| --- | ---: | ---: | ---: | ---: |
| 320 px | 220 px | 217 px | 217 px | 0 px |
| 360 px | 220 px | 220 px | 220 px | 0 px |
| 390 px | 220 px | 220 px | 220 px | 0 px |
| 768 px | 217,016 px | 217,016 px | 217,016 px | 0 px |
| 1280 px | 245 px | 245 px | 245 px | 0 px |

Produkční `main` při dokončení preview stále ukazuje na `d1f5f7825e07d7e8a1751de7075914278d3de8bb`; produkční tabulka politiky speciálů dosud neexistuje. Verze 4.06.0, její schválení banky a aktivace produkční SQL politiky čekají na závěrečný pokyn uživatele.
