# Proplet 4.06.0 — bonusové Daily výzvy

Bonusové výzvy jsou součástí celé aplikace. Na Dnes se přepínají tlačítkem **Extra** ve stávajícím nadpisu Denní výzvy. Datum, obtížnost, týdenní rytmus a hlavní tlačítko používají stejné řádky jako dosud. Přehled týdne se otevře až po klepnutí na označený den. Výsledek a sdílení speciálu jsou v jeho výsledkovém dialogu.

## Úpravy podle připomínek 12. 10. 2026

- Z Dnes je odstraněná karta „300 nových Propletů“.
- Přepínač **Extra** má světlý papírový podklad a tmavé modré písmo i před vybráním. Při přepnutí zůstává výška karty stejná.
- Při prvním vhodném otevření Dnes s dostupnou extra deskou se jednou zobrazí krátké vysvětlení. Tlačítko **Ukázat Extra** pouze přepne stávající kartu.
- Vysvětlení počká na konec onboardingových kroků a ostatních dialogů; má přednost před staršími oznámeními. Potvrzení je uložené v prohlížeči pro daný účet/hosta.

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
- Historické preview používalo candidate banku a zmrazený kalendář od 21. října. Schválená produkční banka je `approved` a začíná 14. října. SQL politika vzniká vypnutá.
- Plné preview: <https://proplet-fhqnx09ix-pavel-prouzas-projects.vercel.app/>. Na prvním vstupu lze přeskočit trénink; na Dnes se bonus vybere přes **Extra**.
- Ověřený aplikační commit: `b292bfc2d1a67dab59281c2445a52d4ceffca4cf`, deployment `dpl_2KAphwgY1MegNhUsfEgRdbwxWMia`.
- PR: <https://github.com/prouza-hue/proplet/pull/193>. Navazuje na obsahové PR #192; všechny nové desky jsou součástí integrované větve.
- Finální browser QA: <https://github.com/prouza-hue/proplet/actions/runs/38221010704>. Souhrn a skutečné screenshoty jsou v `docs/daily-specials-preview/`.

## Schválený produkční kalendář

Začátek produkčního kalendáře je pondělí **12. října 2026**. První Extra je ve středu **14. října** (Mozkožrout). Poslední z 36 výzev vychází na neděli **3. ledna 2027**. Aktivní základní Daily banka pokrývá tento interval až do 14. ledna. Dosud nezveřejněný produkční kalendář byl při schválení posunut o týden dříve. Desky, puzzle ID a obsahové hashe se nezměnily. Kalendář je v privátní bance a SQL shodný; zveřejněná identita se později nesmí posunout ani znovu použít.

Další výroba musí zahrnout základní i Extra banku. Extra navázat bez mezery od týdne 4. ledna; základní Daily končí 14. ledna. Pracovní připomínka pro doplnění má vycházet z dřívějšího konce Extra, ideálně nejpozději 20. prosince.

## Postup schváleného nasazení

1. Ověřit aktuální produkční SHA a proti němu připravený PR, aktuální zálohu a shodu nových 36 bindingů v JSON/SQL. Pokud se termín schválení posune za první datum, před aktivací znovu sestavit celý dosud nezveřejněný kalendář; nesmějí se měnit už publikované bindingy.
2. Aplikovat `SUPABASE_MIGRATION_DAILY_SPECIALS_20261012.sql` (totožná CLI migrace `supabase/migrations/20261012000339_daily_specials.sql`). Je aditivní a sama feature nezapne. Základní atomické result/session funkce se nepřepisují.
3. Schválený privátní manifest je `approved`. Obsah a hashe desek zůstávají beze změn; před vydáním byly pouze přepočítány datumové bindingy na týden od 12. října. Dokončit release commit a přepnout `PROPLET_DAILY_SPECIALS_ENABLED=true` v produkčním prostředí.
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

Produkční `main` při dokončení preview stále ukazuje na `d1f5f7825e07d7e8a1751de7075914278d3de8bb`; produkční tabulka politiky speciálů dosud neexistuje. Uživatel 12. 10. 2026 schválil textaci a výslovně požádal o produkční nasazení. Dolní odstavec v týdenním přehledu je odstraněný; zbývající odstavec končí „dobrovolně a za 100 XP.“
