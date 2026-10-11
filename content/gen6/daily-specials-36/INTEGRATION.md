# Předání pro integraci Daily speciálů

Stav 11. 10. 2026, nad mainem `d1f5f7825e07d7e8a1751de7075914278d3de8bb`. **Návrh implementace; v tomto PR není zapnutý nový herní režim ani provedena migrace.** Banka a izolovaný playtest jsou hotové, lidský playtest čeká. Produkční Supabase `iopyhluayfszskyqqpuc` byla pouze čtena pro kontrolu schématu/definic; žádní hráči či výsledky se neměnili.

## Nejmenší spolehlivé oddělení

Naivní přidání druhé desky pod `daily:<datum>` by bylo chybné. Zachovat starou základní Daily úplně a zavést nový režim **`daily_special`**, nový klíč a samostatné datumové bindingy. `challengeKind=special` ve vstupním descriptoru je pro UI; server odvozuje autoritativní typ z kalendáře a validovaného režimu, nikdy z libovolného příznaku klienta.

Pro kalendářové bindingy použít **`contentHash` z `schedule.json` / `runtimeContentHash` z validačního reportu**: je vypočten přímo současným `backend.dated_daily.puzzle_digest` nad rows/cols/letters/mask/answers/lengths. Interní `contentHash` validačního reportu a preview zahrnuje navíc difficulty a slouží k výrobní identitě/lokální cache; není zaměnitelný s runtime binding hashem. ID a obtížnost se v resolveru ověřují samostatně. Tím není třeba měnit stávající hashing algoritmus základní Daily.

| Vlastnost | Základní Daily | Speciál |
|---|---|---|
| mode | `daily` (beze změny) | `daily_special` |
| challengeKey / výsledková identita | `daily:YYYY-MM-DD` | `daily-special:YYYY-MM-DD:hardcore` (analogicky MM/MK) |
| puzzleId | existující `g6-d-...` | stabilní ID z této banky `g6-ds-...-wNN` |
| datum | `daily_date` | `daily_date`, povolit novému režimu |
| obsah | ověřený ID + hash binding | samostatný ověřený ID + hash + obtížnost binding |
| série / záchrana série | současná pravidla `mode=daily` | nikdy |
| oficiální pořadí | stávající základní klíč | pouze přesný speciální klíč |
| rozehrání a lokální stav | stávající klíče | nový challengeKey + puzzleId/hash |
| odměnová jedinečnost | současný první výsledek | samostatný první výsledek; žádný free slot |

Oproti variantě „všechno mode=daily a přidat boolean“ vlastní režim ponechává existující ochranné `mode=daily` filtry série, záchran a základních soutěží správné. Úpravy vyžadují API/SQL enumy a inkluzivní agregace statistik, ale nehrozí náhodné vtažení do série každým starým čtenářem. Historické řádky, klíče, ID a body se **nepřepisují**. Nepřidávat unikátní omezení `(player_id,daily_date)`.

## Co současný kód opravdu dělá

| Vrstva / soubory | Ověřený předpoklad / nutná úprava |
|---|---|
| `backend/dated_daily.py`, `daily_runtime.py`, `server.py` | Datum resolver vrací jednu desku; `daily_puzzle_matches_date`, `puzzle_exists`, `resolved_puzzle`, výsledková validace přijímají jednu oficiální základní vazbu. Přidat samostatný special resolver; vrací base i optional special descriptor. Písmena/odpovědi speciálu dostupné teprve v den vydání, metadata názvů/dnů v týdnu mohou být předem. Staré `/api/daily` odpovědi zachovat kompatibilní; nový `/api/daily-special` nebo kompatibilní `/api/today` endpoint. |
| `public/app/content/daily-dated.js`, `daily.js`, `progression.js` | Cache je date→jedna puzzle; `dailyResultState` sahá na `state.completed[daily:date]`. Nový cache/descriptor a samostatná completion lookup funkce; nezastrčit druhou desku do existující cache podle samotného data. |
| `app.js`, `public/app/game/state.js` | Výchozí challengeKey rozlišuje daily/date a free/puzzle. Přidat explicitní special větev, pustit ji nezávisle na baseDone, obnovovat podle plného klíče + immutable obsahu. Uložení, odchod, dialog návratu, hints/telemetry a dokončení musí nést descriptor, ne globální dnešní desku. |
| `public/app/core/storage.js`, `result-queue.js`, `completion-pipeline.js`, `public/app/account/session.js` | Lokální historie, queue a merge používají challengeKey/puzzleId; `mode=daily` queue má speciální náhradu desky. Nový režim nesmí převzít replacement chování. Všechny whitelisty a server snapshot mappingy rozšířit. Respektovat oddělené attemptId a idempotency keys v offline claimech, concurrent tabs a souběžných zařízeních. |
| `public/app/account/statistics.js` (PR #191) | Bere jen daily/free a daily deduplikuje podle `dailyDate || challengeKey`. Zahrnout nový režim do kategorie Denní výzvy; základní historické výměny stále jednou podle `daily:date`, speciály jednou podle plného challengeKey. Text „počítáme podle dnů“ upravit na „každou výzvu jednou; série jen základní“. Spodní profilový počet výzev zobrazit z combined counteru, základní dny/series badge dál z původního pole. Nejrychlejší čas pro šest obtížností z prvních dokončení zachovat s timing_verified/assistance filtry. |
| `backend/contracts.py`, `play_sessions.py`, `server.py` | Result/Attempt/anonymous claim/play-session white-listy musí znát `daily_special`; server kontroluje přesný klíč↔datum↔obtížnost↔ID↔hash a vydání, normální časy/moves/hints/clean/calm. Zadané points, obtížnost ani reward eligibility nesmí být důvěřované klientovi. |
| `backend/progress.py`, agregace v `server.py` | `dailyCompleted` jsou jedinečné základní dny; `totalCompleted` nyní daily+free, `cleanDaily` mode daily, odznaky obtížností čtou freeCompleted. Přidat explicitní special a combined challenge counters, zachovat existující streak, rescue a badge vstupy. |
| `backend/rankings.py`, server leaderboard endpointy/RPC | Filtr dne používá `challenge_key=eq.daily:<datum>`. Speciál musí mít vlastní filtr/nový explicitní challengeKey argument, vlastní pořadí i tie-breaky a timing trust. Základní denní leaderboard zůstává beze změny; nikdy nesčítat různé desky podle dne. |

Zkontrolovat také sdílecí odkazy, hráčské reporty, admin lookup, upozornění „dnes ještě neodehráno“, týdenní základní výsledkový přehled, content_archive a budoucí Service Worker cache. Neřešit to globální výměnou řetězce `daily`.

## Databáze a atomická odměna

Ověřené produkční schéma už má správný unikátní klíč `results(player_id,challenge_key)`, nikoli zákaz dvou výsledků za datum. `result_commands(player_id,idempotency_key)` chrání opakovanou operaci. Několik CHECKů přijímá pouze daily/free/starter/tajenka; constraints na výsledcích, puzzle_attempts a souvisejících bězích je nutno rozšířit **cílenou migrací**. Před migrací znovu vypsat skutečné CHECKy všech dotčených tabulek z pg_catalog, neboť měsíční soutěž může mezitím změnit main.

Skutečná funkce `proplet_submit_result_v1` kontroluje mode whitelist a vyžaduje daily_date výlučně pro mode daily; ukládá `content_bank=v_mode`, používá `ON CONFLICT(player_id,challenge_key) DO NOTHING`, uzamyká idempotency command a vydává points pouze při firstCompletion. Zvláštní větev **daily generation upgrade** přepíše původní desku při novější generaci pod stejným klíčem. Nový special klíč se této větve nesmí účastnit.

Navržená migrace: povolit mode daily_special a daily_date pro oba datované režimy, ostatním datum stále zakázat; uchovat unique keys, doplnit special kalendář/immutable bindings (unikátní challengeKey i puzzleId, již vydanou vazbu nelze přehazovat na další den) a index pro `(mode,daily_date,challenge_key)` dle skutečného query plánu. Server před RPC vytvoří autorizovaný command s body a fingerprintem. Speciál nemá `freeLevel`/`legacyRewardSlot` a neovlivňuje `free_slot_rewards` ani katalogové pořadí. První výsledek na jednom speciálu vyplatí schválenou částku jednou; replay může doplnit puzzle_runs bez bodů. Výsledkový konflikt s jiným puzzleId/hash pod existujícím special klíčem je chyba, ne nárok na druhou odměnu.

Zachovat existující pravidlo prvního dokončení: opožděný skutečně dřívější offline výsledek může opravit uložený první běh podle stávajícího důvěryhodnostního kontraktu, ale záměrný replay nezlepšuje oficiální první výsledek. Důkazem odměny je atomický server receipt, nikoli lokální počet dokončení. Neimportovat preview výsledky do ostrých results.

## Doporučené produktové volby (zatím neimplementované)

| Oblast | Doporučení | Důvod / současný stav |
|---|---|---|
| Série | Jen základní Daily + současná rescue pravidla. Speciál ani jeho archiv nikdy nezachrání/založí den. | Schválený směr; staré mode=daily filtry zachovat. |
| Počty | `dailyCompleted`=základní dokončené dny; nové `dailySpecialCompleted`=unikátní speciály; `dailyChallengeCompleted`=součet. Šest obtížností v přepínači Denní výzvy zahrne oba typy. | Rozlišení dnů a výzev; stejné datum může přidat dvě výzvy, ale jediný den série. Legacy `totalCompleted` vstup pro obecné odznaky zprvu zachovat, kombinovaný počet UI oddělit. Jeho rozšíření pro odznaky vyžaduje explicitní volbu. |
| XP | Doporučuji **100 XP za první platné dokončení speciálu**, stejně jako základní Daily, bez bonusu za oba typy v jednom dni. | Dnešní Daily má 100, volná HC/MM/MK 100/150/200. Nepřejímat vyšší free sazby jen podle labelu. Volba 100 přidá maximálně 300 týdně a musí být schválena; tento PR žádné body nemění. Hints/calm zachovat dle současného kontraktu. |
| Replay | Bez dalšího XP a bez nahrazování prvního oficiálního výsledku; samostatná neoficiální historie běhů je možná. | Zachování atomického once-only chování. |
| Odznaky | Série a čisté Daily zůstávají základní; obtížnostní odznaky nadále za volné úrovně. Žádné automatické nové odznaky či přepočet historických nároků. | `ACHIEVEMENTS` dnes čtou freeCompleted/cleanDaily/totalCompleted. Rozšíření obecných dokončení nebo čistých řešení je samostatné rozhodnutí, nikoli vedlejší účinek nového režimu. |
| Tým a osobní XP soutěž | Použít stávající pravidla eligible běžných `results.points`, včetně současného vyloučení calm z periodického skóre a team_code_at_completion. Žádný zvláštní násobič. Potvrdit, že nový běžný výsledek má být započten do týmového XP. | Produkční `proplet_rankings_xp_aggregate` osobně sčítá results + account_rewards, týmově results.points. Playtest account_rewards jsou jiná větev; do týmu se automaticky nesčítají. |
| Základní Daily soutěž | Speciál má vlastní board pořadí. Základní denní/týdenní Daily výkon nepřičítat ani nezastupovat speciálem. | Zabránit povinnosti tří mimořádných deskách pro běžné Daily pořadí. |
| Měsíční soutěž | Pokud finální kontrakt sčítá osobní XP, doporučuji započíst už jednou schválené special XP podle stejných pravidel, bez zvláštního násobiče nebo nové podmínky odehrát všechny speciály. Pokud soutěž měří základní Daily výkon, zachovat base-only filtr. | Na ověřeném mainu není samostatný měsíční soutěžní kontrakt. Otevřený, nesloučený PR #188 `preview/archive-integrated-20261009` obsahuje ukázkové měsíční pódium; nebyl upraven. Před integrací ověřit jeho finální backendová pravidla a potvrdit účast speciálů. |
| Expirace a offline | Speciál otevírat v den vydání 00:00–24:00 Praha. Po dni přesunout do archivu; rozehranou desku zachovat pro dohrání v praxi. Doporučená grace 24h pro přijetí dříve dokončeného ověřeného offline běhu do původního pořadí, bez možnosti začít nový oficiální pokus zpětně. | Vyžaduje serverem doložený start/session a timing-verified pravidla; samotné klientské completedAt nestačí pro „hotovo včera“. Schválit grace před implementací. Budoucí desku nelze získat přes ID odhad. |
| Archiv | Po expiraci volná praxe bez XP, nové oficiálního pořadí a série; již získané XP/výsledek nikdy nemazat. Znovu získat stejné slovo není nová odměnová identita. | Jednoduchý režim bez FOMO a bez dodatečných odměn celé historické banky. Produkt může povolit jiný režim, ale vyžaduje explicitní rewardEligible a distinct practice identity. |
| Přístup / odemčení | Denní speciály otevřené všem, nezávisle na základní Daily. Výstraha obtížnosti a nápověda, žádná brána baseDone. | Current main má `MOZKOMOR_UNLOCK_BASE_LEVELS=0` a `mozkomorUnlocked=true`. Historických 200 úrovní v profilech není aktuální gate. Pokud se free gate někdy vrátí, neaplikovat jej automaticky na kalendářové speciály. |

## Rozvrh, datum a budoucí UI

Použít pevné St/Pá/Ne a současné Po–Út easy, St–Pá medium, So–Ne hard. `schedule.json` je relativní week-1 až week-12, **ne datumová migrace**. Po playtestu schválit první týden, zkontrolovat základní pokrytí do 14. 1. 2027, vygenerovat přesné Prague bindings a teprve po samostatném approval aktivovat. Minulá a právě probíhající základní Daily zůstávají immutable. Plánovanou obnovu banky počítat 14 dní před koncem až ze skutečně schváleného kalendáře; nepřenastavovat starou produkční banku kvůli této přípravě.

Na Dnes zachovat dominantní základní kartu. Menší druhá karta s původní ikonou: „Dnes navíc: Mozkomor“, „Dobrovolné · sérii neovlivní“, „Zkusit Mozkomora“. Tlačítko funkční i před baseDone; stav dokončení/speciální pořadí nezávislé. Kompaktní sedmidenní pás otevírá přehled obtížností a speciálů; data dopředu pouze metadata. Stávající Tiskařská dílna, typografie a ikony, bez nových eyebrow nadpisů či velkých čísel. Toto preview je výběr desek pro test; **není redesign Dnes ani hotová integrace této karty**.

## Akceptační scénáře pro integrační PR

1. Tentýž hráč dokončí base a special téhož dne v obou pořadích: dva immutable výsledky, jediný den série, dvě oddělená pořadí a přesně dvě schválené první odměny. Jen special: série ani rescue se nepohnou. Oba entrypointy fungují nezávisle.
2. Oba rozehrané naráz; přepnutí, reload, odhlášení/přihlášení, anonymous claim a merge ze dvou zařízení. Žádná desková záměna, přepsání queue/časů/cest nebo spojení statistik podle data.
3. Dvě souběžná dokončení stejného speciálu, retries stejného i jiného command ID, offline sync, replay, poškozené klíče/ID/obtížnosti/hashy, odhad budoucího ID. Jedna odměna a původní výsledek, chyby fail-closed.
4. Historická Daily všech generací + původní první dokončení/XP/odznaky/záchrany jsou zachované. Nové stats nevydávají dva stejné dny za dva dny série; Ja počítá dvě výzvy v odpovídajících obtížnostech.
5. Praha půlnoc, přechod letního času, časové pásmo zařízení, offline grace, poslední den banky, po expiraci rozehraná a dokončená deska, archive replay a nedostupná budoucí deska. Žádný modulo fallback.
6. Team XP a weekly finalize, calm/clean/hints/timing flags, sdílení, admin/support výsledky a měsíční soutěž odpovídají **schváleným**, nikoli náhodně zděděným pravidlům.

Před integrací zbývá rozhodnout především **datum po playtestu, XP a započtení do soutěží/obecných odznaků, offline grace/archiv**. Identitní oddělení a base-only série už vyplývají ze schváleného směru a nevyžadují další produktovou diskusi.
