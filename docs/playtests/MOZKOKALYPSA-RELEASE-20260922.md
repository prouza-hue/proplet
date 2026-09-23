# Mozkokalypsa — ověřený preview kandidát, 22. 9. 2026

## Stav
Pavel schválil název, desetideskový pilot, vlastní identitu ve směru Tiskařské dílny a nasazení pozvánky pro jednorázově vybranou trojici s nejvíce celoživotními XP. Implementace a skutečné Vercel preview jsou hotové. Produkční aktivace NEPROBĚHLA: bezpečnostní kontrola konektoru OpenAI odmítla aplikaci databázové migrace. Tento blok nebyl obcházen jiným nástrojem ani kanálem.

Produkční main při ověření: 6a3918f592698562943026203c5e6ce9869b9652, Vercel dpl_2Mh5jfoYtViNjXH7zsLLnpkhzYj9. Žádný běžný hráčský výsledek, XP ani pokrok se při této práci nezměnil. Produkční přepínač je v kandidátovi výslovně false.

## Ověřený kód a preview
- Větev: feat/mozkokalypsa-playtest.
- Kód kompletně otestovaný v čistém CI: 55283ada5f21f565fdd4edcc73c089fe6d914646.
- Vercel preview: dpl_sijTpo2CHUC96t1ZFSZtjnvgWaHp, READY, stejný SHA.
- Neměnný odkaz: https://proplet-35ov0ohbh-pavel-prouzas-projects.vercel.app/?mozkokalypsa=preview
- Větevní odkaz: https://proplet-git-feat-mozkokalypsa-playtest-pavel-prouzas-projects.vercel.app/?mozkokalypsa=preview
- Preview API status?qa=true ověřeno HTTP 200 dne 22. 9. v 21:36 UTC. Preview nepoužívá produkční Supabase; hraní a hodnocení zůstávají v zařízení.
- Navazující úklid mění jen tento report a CI: odstraňuje jednorázové samomodifikující authoring workflow, nahrazuje je read-only acceptance workflow. Herní kód po úspěšném běhu nemění.

## Obsah a vlastní vizuální identita
Deset zmražených desek: 2 nové kontrolní Mozkomory, 4 plné desky 10×10, 4 plné desky vybrané pro přetrvávající věrohodné odbočky. 133 různých slov bez opakování; kontrolní slovník 26 093 slov. Osm plných desek má 100 polí a 14 slov. Žádná běžná banka nebyla změněna. Obtížnost vůči lidem zatím není ověřena.

Nová ikona public/difficulty/printshop/mozkokalypsa.svg: roztržený vír s malovaným švestkovým jádrem, měděnými úlomky a světlým středem. Vychází z textury schválené ilustrace Mozkomora, nejde o výstup nové služby generování obrázků. Vlastní barevnost je omezena na pozvánku a pilot; ostatní ikony, Fraunces a herní deska zůstávají původní.

Pozvánka na Dnes: „Psst… Mozkomor ti nestačí?“ / „Tobě hlavu jen tak něco nezaplete. Zkus 10 exkluzivních desek a pomoz nám vyladit Mozkokalypsu.“ / „Troufám si“. Po začátku ukazuje pokračování a dokončený počet. Hub nabízí všech deset desek; výsledkovka dobrovolnou náročnost, zábavnost a poznámku.

## Opravené integrační chyby
Zachování QA parametru při přesměrování kořenové URL; prvotní načtení pozvánky; kompatibilita registrace rout; validace barev 14 slov; ignorování událostí po dokončení kromě hodnocení; zachování novějšího místního času; ochrana před dvojím otevřením a změnou účtu během požadavku; výslovné řešení konfliktu dvou zařízení bez tichého přepsání; zachování Klidného režimu při návratu i jeho tlačítka na další desce; synchronní cache verze mkpilot4.

## Důkazy
GitHub Actions run https://github.com/prouza-hue/proplet/actions/runs/35787214264, job 106946821527: všechny kroky success. SOURCE_SHA.txt v artefaktu potvrzuje výše uvedený kód; workflow commit c242b08babdfb607dd54151554fc7fd592e44550 je pouze spouštěcí autorovací commit.

- tools/test_current.py: 99 testů PASS, 123 kontrol assetů PASS, 349 kontrol syntaxe PASS.
- Skutečný izolovaný PostgreSQL 17.11: oprávnění/RLS, pozvánka, idempotentní otevření a událost, kontrola revize při souběhu, neměnnost dokončení, odebrání pozvánky — PASS.
- Skutečný Chromium: první slovo přes pointer gesta, nápověda, Klidný režim, reload/obnova, dokončení všech 10 přes nativní submitPath, hodnocení, první nález, nulové změny běžného postupu/XP/fronty výsledků a žádné QA zápisy na server — PASS; žádná pageerror.
- Tlačítko Klidný režim na následující desce — PASS.
- Mobil 390×844, desktop 1440×1000; samostatný dotykový kontext 768×1024 s is_mobile a has_touch potvrdil pravý ovládací panel a absenci vodorovného přetečení. Není to test fyzického Samsungu Fold.
- Vizuálně prohlédnuty skutečné screenshoty světlé a tmavé pozvánky, mobilní desky, dotykového Foldu a výsledkovky.

Artefakt 10720603531 (mozkokalypsa-acceptance, cca 897 kB) obsahuje runtime.txt, database.txt, browser-report.json, SOURCE_SHA.txt a screenshoty. Testovací výsledky jsou syntetické, nejsou hodnocením hráčů. Plný produkční přihlášený tok se skutečnými tabulkami nebyl otestován, protože migrace nebyla povolena; izolované vrstvy nejsou za tento test vydávány.

## Produkční blokace a otevřené kroky
Supabase projekt iopyhluayfszskyqqpuc. apply_migration(mozkokalypsa_playtest_v1) dne 22. 9. odmítla bezpečnostní kontrola OpenAI. Následný read-only dotaz v 21:20:11 UTC potvrdil, že mozkokalypsa_invites, mozkokalypsa_attempts i mozkokalypsa_events stále neexistují. Žádné pozvánky nebyly vloženy.

Po vyřešení tohoto blokování zbývá řádně aplikovat a ověřit již izolovaně otestovanou aditivní migraci, jednorázově zaznamenat tehdejší top 3 hráče, bezpečně ověřit skutečné oprávnění a zápisový tok, teprve potom aktivovat flag a vydat produkční deployment. Kontrola top 3 v 21:03 UTC: Michael, PiettraWal, Ave. Jde o návrh kohorty, nikoli o aktivní pozvánky. Při změně pořadí během samotného playtestu se přístup přepočítávat nemá.

Nezapínat funkci před existencí tabulek; neposílat testerům read-only preview jako náhradu ostrého měření. Test neuděluje běžná XP ani odměny za vedlejší slova a nevstupuje do žebříčků. Existující provozní banky a výsledky nemažte. Nouzové vypnutí po pozdější aktivaci: feature flag false / active=false u pozvánek; výsledky ponechat.
