# Pokračování hodností a XP úspěchů — návrh k posouzení

Datum: 13. října 2026. Ověřený obsah registrů: produkční main `f31c8959323b8edae75e01ccd6b04ded168cf982`, Proplet 4.07.3. Pracovní větev je kandidát Archivu z PR #197; tento dokument ani náhled neupravují produkční registry, nároky ani odměny.

## Stav a doporučení

Schválený problém: Archiv výrazně rozšiřuje dostupný obsah; dosavadní konce hodností a XP úspěchů přestanou být dlouhodobým cílem. Návrh ze zaseknutého vlákna: zachovat dosažené hodnosti i hranice, pokračovat kapitolami po 5 000 XP a přidat další velké XP úspěchy. Toto řešení **dosud není schválené k produkci**.

Doporučení: ponechat všech 51 hodností přesně beze změny. Legenda bez konce od 120 000 XP dostane vedle titulu vlastní číslo kapitoly. Navazující XP úspěchy začnou na 150 000 XP a pokračují po 50 000 XP. Získání kapitoly ani úspěchu nevyplácí další XP, nemění pořadí a nevytváří soutěžní body.

Předchozí podklad uváděl nanejvýš 38 000 historických, dosud nevyplacených XP z Archivu. Jde o odhad pro úplné nároky, nikoli automatický bonus každému hráči ani ověřený zůstatek konkrétního účtu. U již odehraných a odměněných historických slotů je další odměna nula. Ukázka 158 000 XP je čistě modelová, neodečítá žádný účet.

## Přesná pravidla kapitol

Zdroj je stejné autoritativní celoživotní `stats.points` jako nyní. Zahrnuje již platně připsaná XP všech podporovaných zdrojů včetně legitimních pozvánek a Archivu; nepřičítá budoucí nároky, samotné kapitoly ani odznaky. Pro žebříček se zachová jeho stávající zdroj `lifetimePoints`. Náhled nepřevádí hráče do nového bodového systému.

Pro nezáporné celé XP `p`:

- `p < 120000`: dosavadní `levelFor(p)` beze změny, kapitola neexistuje.
- `p >= 120000`: stále hodnost **51 · Legenda bez konce**, stejná ilustrace `legenda.svg`.
- `chapter = floor((p - 120000) / 5000) + 1`.
- `chapterStart = 120000 + (chapter - 1) * 5000`.
- `nextChapterAt = chapterStart + 5000`.
- Průběh kapitoly `(p - chapterStart) / 5000`, další kapitola začíná přesně při dosažení její hranice.
- Nové číslo kapitoly není číslo hodnosti. Nikdy zobrazit „hodnost 52“ ani měnit stávající roadmapu na kapitoly.

| XP celkem | Hodnost | Kapitola | Postup uvnitř kapitoly | Další cíl |
|---:|---|---:|---:|---:|
| 119 999 | Absolutní Propletač | — | — | Legenda bez konce při 120 000 |
| 120 000 | Legenda bez konce | 1 | 0 / 5 000 | Kapitola 2 při 125 000 |
| 124 999 | Legenda bez konce | 1 | 4 999 / 5 000 | Kapitola 2 při 125 000 |
| 125 000 | Legenda bez konce | 2 | 0 / 5 000 | Kapitola 3 při 130 000 |
| 149 999 | Legenda bez konce | 6 | 4 999 / 5 000 | Kapitola 7 při 150 000 |
| 150 000 | Legenda bez konce | 7 | 0 / 5 000 | Kapitola 8 při 155 000 |
| 158 000 | Legenda bez konce | 8 | 3 000 / 5 000 | Kapitola 9 při 160 000 |
| 250 000 | Legenda bez konce | 27 | 0 / 5 000 | Kapitola 28 při 255 000 |

Na přelomu se plný průběh předchozí kapitoly změní na nulu nové kapitoly, ale součet XP, titul a odznaky zůstanou. UI vždy ukáže také číslo kapitoly, takže reset pruhu není ztráta postupu. Při skoku přes více kapitol stačí jedna oslava nejvyšší dosažené; nikdy fronta mnoha modalů.

## XP úspěchy bez nového stropu

Všech 13 dosavadních XP úspěchů zůstává. Nová série: 150 000, 200 000, 250 000, 300 000 XP a dál po 50 000. ID může navázat na současný vzor `xp-150000`, `xp-200000` atd., definice se odvozuje matematicky. Počet nových splněných úspěchů je `max(0, floor((p - 150000) / 50000) + 1)`.

Pro nový milník je splnění `p >= threshold` včetně přesné hranice. V náhledu používáme **číselné názvy** „150 000 XP“ atd. Jde o návrh, nikoli údajný existující registr. Nové vlastní ilustrace ani literární názvy nejsou vyrobené či schválené. Náhled používá číslo pro nové milníky a původní ilustrace pouze pro jejich původní významy.

Nekonečná řada se nesmí přidat do jmenovatele současného procenta úspěchů (`renderAchievementSummary`). U základní sbírky zachovat její konečný počet a získané položky. Pokračování má samostatný údaj „N získáno“, poslední splněný + dva následující cíle a vlastní rozbalení historie po dávkách, například 12. Nikdy „13 / ∞“ ani kilometrový seznam zamčených odznaků. V tomto jednoduchém preview se ukazují poslední splněný a dva následující, a v rozkliku všech 13 původních.

## Zpětné přiznání a souběh zařízení

Současný `achievementCard` odvozuje splnění přímo z `stats.points`; historické splnění se tedy může vykreslit okamžitě. Naproti tomu `completionAchievements` pro skupinu XP vrací pouze přechod `!test(before) && test(after)`. Pouhé přidání nových prahů do pole nezajistí oznámení dříve kvalifikovaným hráčům. Přiznání a oznámení proto oddělit:

1. **Výpočet nároku:** serverový snapshot skutečných celoživotních XP. Každý způsobilý účet ihned vidí správnou kapitolu a všechny dosažené nové úspěchy. Žádná další hra ani tlačítko „Vyzvednout“ jako podmínka. Po přihlášení jiného účtu se nesmí převzít cizí stav zařízení.
2. **Evidence přiznání:** není potřeba odměnová transakce. Pro audit lze přidat samostatný nepeněžní achievement ledger s unikátním `(user_id, achievement_id)`, `awarded_at` = čas přiznání a `source = progression_continuation_v1`. Neodhadovat historický okamžik překročení, není-li rekonstruován z autoritativní historie. Kandidát musí zvolit buď odvozené splnění, nebo tento ledger; oba nesmí vyplácet XP.
3. **Zpětný běh:** pro snapshot `p` pouze vložit kvalifikovaná ID pomocí `ON CONFLICT DO NOTHING`. Checkpoint po dávkách, bezpečné opakování, korektní resume. Tím stejný účet dostane jeden záznam i při opakování běhu nebo současné nové hře. Nevstupovat do result/reward/referral ledgeru; žádné přepsání `points`.
4. **Živá nová hra:** server po atomickém připsání výsledku vyhodnotí dosažená ID nad výsledným součtem a provede stejný idempotentní insert. Vždy respektovat autoritativní součet po transakci. Přeskočené milníky přiznat všechny, oslavit souhrnně.
5. **Oznámení účtu:** samostatný serverový klíč jednorázového seznámení `progression_continuation_v1`. Krátká neblokující zpráva na Já: „Tvoje cesta má pokračování. Rovnou pokračuješ v kapitole 8.“ Při více nových úspěších jeden souhrn. Neukazovat při hře, onboardingu ani přes jiné oznámení.
6. **Idempotence oznámení:** vázat na uživatele a kampaň, atomicky claimnout s krátkou platností; při kolizi zařízení druhý klient nic neotevírá. Po skutečném zobrazení serverově potvrdit. Expirace claimu umožní opakování při zavření před zobrazením. Absolutní „právě jednou“ při pádu klienta mezi zobrazením a potvrzením nelze garantovat — cíl je bez duplicit nároků/XP a bez běžného zdvojení oznámení.
7. **Offline a rollback:** cached XP může zobrazit známý postup, ale nemá potvrzovat nové serverové ocenění. Při chybě synchronizace zachovat poslední potvrzený stav. Rollback UI nic nemaže z přiznaných úspěchů; obnovení nesmí vytvořit bonus.

Toto je implementační kontrakt pro příští schválenou změnu; v této větvi nevzniká migrace, ledger ani produkční oznámení.

## UX v existující hře

- **Já:** zůstává současná karta, titul, číslo hodnosti a původní ilustrace. Pod titul přibude malý údaj „Kapitola 8“ s rozklikem. Stávající pruh nahradí po dosažení poslední hodnosti postup kapitoly a konkrétní další cíl.
- **Dnes:** v již existujícím shrnutí postupu stačí „Legenda bez konce · 8. kapitola“; žádná nová velká karta ani promo při každém návratu.
- **Po dokončení:** běžně aktualizovat XP a průběh, při překročení prahu jedna stručná oslava. Při současné kapitole i XP úspěchu spojit do jedné výsledkovky.
- **Žebříček:** pořadí, dosavadní XP a titul zůstávají. Kapitolu případně zobrazit jako malé doplnění u titulu, ne jako nový veřejný skórovací systém.
- **Hodnosti:** konečných 51 položek zůstává. Za poslední přidat oddělené pokračování kapitol; nevyrobit stovky nových pseudo-hodností.
- **Přístupnost:** textový zbývající počet XP, dostupný detail klávesnicí, popsaný progressbar; splnění nespoléhá pouze na barvu. Žádné eyebrow nadpisy. Outfit pro UI, Fraunces pro wordmark a úvod/detail.

## Co má Pavel rozhodnout

1. Zachovat všech 51 hodností a otevřít kapitoly po 5 000 XP; kapitola 1 začíná na 120 000 XP.
2. Velké milníky 150 000 XP a dále po 50 000 XP bez dalšího bonusu XP.
3. Ponechat pokračování jako vlastní sbírku bez konečného procenta splnění.
4. Přiznat již dosažené kapitoly a milníky automaticky, jednorázově oznámit souhrn bez modalové fronty.
5. Pro nové XP úspěchy schválit číselná jména, nebo zadat novou sadu názvů/ilustrací Tiskařské dílny. Preview pro ně neslibuje hotové odznaky.

Není důvod čekáním na tuto volbu blokovat technicky samostatný release Archivu. Před samotným zavedením pokračování změřit anonymní agregáty počtu účtů v pásmech 110–120k, 120–150k, 150–200k, 200k+ a maximální XP; podle nich ověřit tempo +5k/+50k. Bez tohoto měření netvrdit, kolika hráčů se změna týká.

## Společná push zpráva Extra + Archiv — pouze návrh

Nic se neodesílá ani neplánuje. Extra podle schváleného plánu začíná ve středu 14. října 2026; dostupnost Archivu závisí na samostatně schváleném nasazení. Společnou launch push odeslat až po ověření obou funkcí v produkci a samostatném pokynu k odeslání. Samotný preview ani zítřejší start Extra takové podmínky nesplňují.

**Finální text pro chvíli, kdy jsou obě funkce venku:**

- Titulek: **Dnes jednu navíc?**
- Text: **Extra výzvy třikrát týdně. A v Archivu desky, ke kterým ses ještě nedostal. Kolik jich rozpleteš?**

Text neříká, že je Extra právě dnes, takže obstojí i v jiný den než středa/pátek/neděle. Před spuštěním Archivu tento text nepoužít. Pokud bude zapotřebí samostatná předpremiérová informace 13. října: „První Extra výzva přijde zítra. Archiv starších desek chystáme.“ — není to náhrada společné launch kampaně a bez pokynu se neposílá.

**Cíl:** `https://hrajproplet.cz/?open=daily&via=push-content` — známá vstupní stránka Dnes s Extra v kartě Denní výzvy a vstupem do Archivu. Neukazovat automatickou hru; uživatel si vybere. Před odesláním ověřit start z běžící PWA i nové relace a zavření promo nepřebíjejícího onboarding. Způsob `open=daily` již používá push fallback v `public/sw.js`; nevolit dosud neověřenou novou deep route.

**Audience:** platné push odběry s `content_enabled=true`, s předchozí skutečnou herní aktivitou; pro propojené účty jen aktivní vlastník odběru. Zahrnout vracející se hosty s doloženou aktivitou, pokud jejich současný souhlas platí. Nenahrazovat souhlas novinkám pouhým `daily_enabled`. Vyřadit testovací odběry a neplatné endpointy. Jedna kampaň, bez opakování podle toho, že hráč ještě neklikl.

**Deduplikace:** samostatný event key `content:extra-archive-launch-v1`, atomická rezervace podle existujícího mechanismu `_reserve_push_delivery`, bez využití klíče pondělní dávky či Denní výzvy. Respectovat existující frekvenční limity a nevyslat ve stejný okamžik běžnou content push. Přesný den/čas a velikost audience se doloží před odesláním.

## Ověřené registry

Zdroj: `public/app.js`, `public/ribbon-catalog.js`. Hranice jsou současné hodnoty, ne nový návrh. Názvy a přiřazení ilustrací se zachovávají.

### Hodnosti

| # | XP od | Název | Ilustrace |
|---:|---:|---|---|
| 1 | 0 | Nováček | `novacek.svg` |
| 2 | 100 | Písmenkář | `rank-02.svg` |
| 3 | 250 | Hledač nití | `rank-04.svg` |
| 4 | 400 | Slovolovec | `rank-03.svg` |
| 5 | 600 | Propletač | `rank-05.svg` |
| 6 | 850 | Kličkař | `rank-06.svg` |
| 7 | 1 100 | Uzlovač | `rank-10.svg` |
| 8 | 1 450 | Cestář | `rank-12.svg` |
| 9 | 1 800 | Stopař slov | `achievement-discovery-10.svg` |
| 10 | 2 200 | Průzkumník mřížky | `achievement-discovery-50.svg` |
| 11 | 2 700 | Labyrintník | `rank-15.svg` |
| 12 | 3 250 | Slovní taktik | `rank-08.svg` |
| 13 | 3 850 | Krotitel zákrut | `rank-13.svg` |
| 14 | 4 500 | Mistr cest | `rank-07.svg` |
| 15 | 5 200 | Mistr zákrut | `rank-14.svg` |
| 16 | 6 000 | Mistr šneků | `rank-19.svg` |
| 17 | 6 800 | Propletový ninja | `rank-17.svg` |
| 18 | 7 700 | Slovní alchymista | `alchymista.svg` |
| 19 | 8 700 | Slovní mág | `rank-09.svg` |
| 20 | 9 700 | Mřížkový mág | `rank-20.svg` |
| 21 | 11 000 | Slovočaroděj | `rank-25.svg` |
| 22 | 12 500 | Krotitel Mozkožroutů | `rank-22.svg` |
| 23 | 14 000 | Strážce mřížky | `achievement-hard-50.svg` |
| 24 | 15 800 | Architekt labyrintu | `rank-34.svg` |
| 25 | 18 300 | Mistr skrytých cest | `achievement-tajenka-10.svg` |
| 26 | 20 000 | Mistr nekonečna | `rank-27.svg` |
| 27 | 21 500 | Velmistr Propletu | `rank-16.svg` |
| 28 | 25 000 | Arcimistr Propletu | `rank-24.svg` |
| 29 | 27 500 | Strážce tajných cest | `rank-33.svg` |
| 30 | 30 000 | Strážce všech cest | `rank-31.svg` |
| 31 | 32 500 | Král mřížky | `rank-23.svg` |
| 32 | 35 000 | Propletový titán | `rank-26.svg` |
| 33 | 38 500 | Nadslovník | `rank-21.svg` |
| 34 | 42 000 | Hvězdný propletač | `rank-28.svg` |
| 35 | 46 000 | Orbitální luštitel | `rank-29.svg` |
| 36 | 50 500 | Galaktický slovolovec | `rank-30.svg` |
| 37 | 55 500 | Hvězdný navigátor | `achievement-daily-200.svg` |
| 38 | 58 000 | Čtenář souhvězdí | `achievement-medium-100.svg` |
| 39 | 61 000 | Strážce souhvězdí | `achievement-xp-61000.svg` |
| 40 | 66 000 | Mistr hvězdných cest | `achievement-xp-75000.svg` |
| 41 | 70 500 | Architekt souhvězdí | `achievement-xp-95000.svg` |
| 42 | 75 000 | Strážce slovního vesmíru | `achievement-cd-100.svg` |
| 43 | 80 000 | Mistr slovního vesmíru | `achievement-daily-365.svg` |
| 44 | 85 000 | Architekt slovního vesmíru | `achievement-all-800.svg` |
| 45 | 90 000 | Vládce slovního vesmíru | `achievement-hc-100.svg` |
| 46 | 95 000 | Strážce nekonečna | `achievement-clean-250.svg` |
| 47 | 100 000 | Velmistr nekonečna | `achievement-xp-50000.svg` |
| 48 | 105 000 | Arcimistr nekonečna | `achievement-xp-120000.svg` |
| 49 | 110 000 | Legenda Propletu | `rank-11.svg` |
| 50 | 115 000 | Absolutní Propletač | `rank-32.svg` |
| 51 | 120 000 | Legenda bez konce | `legenda.svg` |

### XP úspěchy

| ID | XP od | Název |
|---|---:|---|
| `xp-100` | 100 | První stovka XP |
| `xp-500` | 500 | Sběrač XP |
| `xp-1000` | 1 000 | Tisícovka |
| `xp-2500` | 2 500 | Pokladnice |
| `xp-5000` | 5 000 | Pět tisíc |
| `xp-10000` | 10 000 | Pěticiferný |
| `xp-25000` | 25 000 | XP magnát |
| `xp-40000` | 40 000 | Čtyřicet tisíc cest |
| `xp-50000` | 50 000 | Padesátitisícový let |
| `xp-61000` | 61 000 | Absolutní sběratel |
| `xp-75000` | 75 000 | Klíč ke všem cestám |
| `xp-95000` | 95 000 | Architekt XP |
| `xp-120000` | 120 000 | Za hranicí mřížky |

## Provedené ověření náhledu

- `node --check public/design/progression-continuation.js`: bez syntaktické chyby.
- Chromium / Playwright: ověřeno zobrazení při šířkách 320, 390, 690 a 1440 px; žádný vodorovný přesah ani chybějící obrázek. Jde o emulaci rozměrů, nikoli fyzický test Fold 7.
- Ověřeny hranice 119 999 / 120 000 / 124 999 / 125 000 / 149 999 / 150 000 / 158 000 / 250 000 XP: správná kapitola, zbývající XP i počet přiznaných XP úspěchů.
- Funkční porovnání dnešních pravidel s návrhem, detail kapitoly, 13 původních XP úspěchů a vysvětlení zpětného přiznání. Dialogy lze zavřít tlačítkem i Escape.
- Žádné JS chyby ani HTTP chyby zdrojů. Nula volání `/api/`, nula zápisů, nula localStorage položek, nula registrovaných service workerů v čistém kontextu.
- Písma Outfit a Fraunces jsou pro izolovaný náhled přibalena do `public/design/fonts/` z již existujícího `preview/daily-specials/public/assets/`. Odpadá závislost na načtení Google Fonts během review.
- Desktopové porovnání i mobilní návrh vizuálně zkontrolovány. Trvalé testy produkčních pravidel nepřibývají: jde o vratný návrh, nikoli schválenou změnu ekonomiky.

Soubory: `public/design/progression-continuation.html`, `.css`, `.js` a lokální písma. Náhled je dostupný pod `/design/progression-continuation.html`; do produkční navigace ani aplikačního bundle se nezapojuje.
