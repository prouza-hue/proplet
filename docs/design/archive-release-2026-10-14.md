# Schválené vydání 4.08.0 — 14. října 2026

Pavel schválil finální preview a produkční vydání zprávou „Schváleno!“ 13. 10. 2026 ve 23:05 Europe/Prague. Tento záznam aktualizuje předchozí návrhy a předání; jejich výroky „SQL neaplikováno“ a „XP pouze návrh“ popisují starší stav.

## Obsah

- Kompaktní Archiv 800 historických desek, původní serverové ověřování 879 schválených úplných řešení, autoritativní jednorázové historické odměny.
- Společné oznámení se dvěma rovnocennými kartami a samostatným CTA pro Extra. Jediná fronta oznámení.
- Sedm schválených ilustrací Mozkokalypsy.
- Skutečný profil: ilustrované kapitoly od 120 000 XP, po 5 000 XP; XP úspěchy od 150 000, po 50 000. Pět optimalizovaných ilustrací, detail, postup, stránkovaná sbírka a oslava potvrzeného postupu při dokončení hry.
- Kapitoly a nové úspěchy se odvozují výhradně z potvrzených `profile.stats.points`. Nepřidávají žádné XP. Stejný účet se stejným serverovým součtem má stejnou sbírku na všech zařízeních. Lokální snapshot slouží pouze k nabídce oslavy; není autoritou nároku ani příslibem globální jednorázové notifikace. Dosavadních 51 hodností a registry starých úspěchů zůstávají beze změny.
- Měsíční soutěž / listopadový obsah sem nepatří.

## Provedená databázová příprava

Projekt `iopyhluayfszskyqqpuc`; aplikovaná migrace `20261013210718_archive_historical_free_rewards`, 13. 10. 2026 21:07:18 UTC. Přesný soubor `supabase/prepared/historical_free_rewards.sql`, SHA-256 `59c8d4fddb4466181463e32fce585b405d289cd146704719bbd1332c5bee3295`.

Živá původní definice `proplet_submit_result_v1` odpovídala očekávanému základu z `20261001235400_mozkokalypsa_production.sql`, normalizovaný MD5 `48dc1540c5e39055a60fac5e7f2d5424`. Zachovány triggery pro content lineage, Extra identitu/čas, referral a timing guard.

Celý SQL artefakt proběhl jako jedna transakce s původními zámky, timeouty a invarianty. Invarianty před commit ověřily nezměněné výsledky, XP i původní ledger. Následně potvrzeno: 2 129 historických nároků, původních 1 916 free-slot záznamů se stejným otiskem `3d4d3611929d6796dd75e6da2f7f0441`. Dva vnější odečty výsledků nejsou atomická baseline: mezi nimi přibyla jedna skutečná hra (+150 XP); nebyla vytvořena migrací.

RLS aktivní; anon/authenticated nemají SELECT ani EXECUTE nového RPC, service_role ano. Prázdný servisní dotaz vrací prázdné claims/completed. Security advisor u nové tabulky uvádí pouze informační „RLS enabled, no policy“: záměrná service-only tabulka, nikoli chybějící klientský přístup. SQL neopakovat zbytečně. Dosavadní výsledky při rollbacku nemazat.

## Jedna společná push

Titulek: **Extra výzvy a Archiv jsou tady**

Text: **Třikrát týdně těžší výzva navíc. A 800 původních desek v Archivu. Co rozpleteš jako první?**

Cíl `https://hrajproplet.cz/?open=daily&via=push-content`, kampaň `content:extra-archive-launch-v1`. Vercel cron 14. 10. v 06:00 UTC = 08:00 Europe/Prague. Kód dovolí pouze okno 08:00–09:00 tohoto konkrétního dne a pouze production. Před odesláním validuje publikovaný Archiv a dnešní skutečnou Extra desku. Při nedostupnosti neposílá.

Pouze současné `content_enabled=true`, skutečná herní aktivita vlastníka (výsledek účtu nebo dokončený pokus hosta), HTTPS endpoint mimo lokální/testovací hosty. Souhlas i vlastník se znovu čtou těsně před rezervací. Jakýkoli dřívější pokus této kampaně nebo jiná dnešní zpráva subscription vyloučí; rezervace je atomická. Pending/failed se neopakují. Běžná ranní zpráva 14. 10. přeskočí již rezervované příjemce této kampaně. Preview, dry-run a opožděný běh nic neodesílají. Nejde o noční push.

## Ověření a nasazení

Nové browser scénáře ve 320/390/690/1440 px ověřují skutečný profil: hranice 119999/120000/124999/125000/150000/250000/300000, autoritu potvrzených XP, ilustrace, focus/Escape, stránkování, oslavu potvrzeného postupu, úklid po dialogu a jiný účet/hosta. Součástí je dřívější kontrola oznámení, katalogu a samostatného designu. Bez produkčních zápisů. Push testy pokrývají čas/rok, prostředí, autentizaci, souhlas, aktivitu, dostupnost obsahu, souběžnou rezervaci, opakování, selhání poskytovatele a suppression ranní zprávy.

Před sloučením musí být zelené current runtime + PostgreSQL, Archive/design browser review a relevantní klientské CI. Finální SHA a odkazy se připnou v PR #197 a naplánovaném úkolu. Do půlnoci se main neposouvá. Ve 00:00 zahájit squash merge schváleného kandidáta, počkat na nový **production build** a READY. Preview deployment nepromovat: obsahuje izolovaný testovací adaptér.

Baseline produkce před vydáním: `f31c8959323b8edae75e01ccd6b04ded168cf982`, Vercel `dpl_GgHHKDidThE2WYL573mvQF3ZD432`, verze 4.07.3. Nový build musí mít 4.08.0, odpovídající app/SW marker `proplet-v4.08.0-archive-release2`, archive/historical/atomic flagy true, Extra enabled. Produkční projekt neměl vlastní archive/historical env override; Extra už měl true. Zkontrolovat znovu při vydání.

Po READY ověřit skutečnou doménu: `/api/health`, `/api/config`, `/api/archive` (800 desek), `/api/archive/puzzle?puzzle_id=g3-e-088`, `/api/daily-special` (14. 10. oficiální deska), runtime metadata/SW a absenci preview-isolation skriptu v HTML. Žádné syntetické výsledky za skutečné hráče. Při selhání zastavit aktivaci / vrátit ověřený deployment; migraci ani hráčské nároky neodstraňovat. Odeslání push potvrzovat až podle skutečného ledgeru, ne podle existence cronu.
