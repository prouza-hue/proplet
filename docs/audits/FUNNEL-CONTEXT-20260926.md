# Onboarding provenance — 26. 9. 2026

## Výchozí stav a reprodukce
Aktuální main/produkce 6e076bccf2a89d99e003667aa2eed0f6f4e24d51, deployment dpl_FX9D1aQ9cT2VekuS6G2oQNGqs1uf, app i SW proplet-v4.02.2-mkinvite2. Pozvánka playtestu zůstává zachována.

Původní createStarterTrace nesl pouze ID/čas/seen; analyticsHeaders znovu volal analyticsVersion. Po dokončení nebo změně identity mohlo stejné ID dostat board-v2. Nový test skutečných funkcí mění stav aplikace i release mezi fázemi a požaduje původní hodnoty pro v3 i v2.

Účtové flow nemělo korelační UUID a Google používal vlastní fetch bez analytických hlaviček. Signup trigger měl pouze origin=players_insert. Return intent mohl být zastíněn lokálním stavem jiné anonymní identity. Nyní se celý flow připne před přijetím profilu, má prioritu během návratu a udržuje owner hranici. Cancel odstraní auth intent, aby pozdější registrace z profilu nebyla připsána tomuto funnelu.

Read-only audit 26. 9. ~21:22 CEST: 9 smíšených runů / 10 chybných pozdějších fází, časový rozsah zasažených řádků 25. 9. 15:40:49.911 UTC až 26. 9. 18:33:12.386777 UTC. Přesný aktuální počet před skutečným backfillem je nutné zopakovat. Uniformní board-v2 a testovací runy se nemění. Legacy pravidlo prvních dvou releasů zůstává v samostatném původním návrhu; tato oprava nerozšiřuje jeho predikát.

Důvody left/hidden v aktuálním vzorku nejsou prázdné ve starším context.starter_reason; chybělo jednotné context.reason. Obě jména se teď ukládají společně. Unknown je pouze bezpečný fallback pro chybějící/neplatnou starší hlavičku.

## Změny a bezpečnost
- public/app.js: neměnná provenance trace, předání explicitního auth kontextu pro manuální signup, zachycení výsledné identity před claimem.
- public/app/engagement/first-steps.js: UUID nabídky, deduplikované fáze, return intent přes claim/OAuth, omezené diagnostické výsledky; saved až po potvrzení obou výsledků v /api/progress.
- public/account-auth.js: předání kontextu Google completion, pin identity a bounded failure/cancel.
- backend/measurement.py a backend/db.py: validace UUID/reason/source a omezený serverový transport k triggeru.
- supabase/migrations/20260926192346_first_steps_provenance.sql: atomický INSERT účtu + account_created, nová provenance; guard a unikátnost zachovány. Žádná nová práva, žádný SECURITY DEFINER.
- Registry, SW/app/změněné asset URL a release fixtures používají flowcontext1. UX/texty/desky/auth poskytovatel se nemění.

## Testy
- node tests/current/test_funnel_context.cjs
- node tests/current/test_starter_capture.cjs
- node tests/current/test_first_steps.cjs
- PYTHONPATH=. python tests/current/test_onboarding_provenance.py
- PYTHONPATH=. python tests/current/test_account_created_authority.py
- python tools/test_current.py
- CI isolated-result-database: skutečné signup HTTP routy, PostgreSQL trigger, retry/login/failed signup, kontext a test flag; tools/test_funnel_sql.py vykoná přesný opravný SQL dvakrát v nové lokální DB.
- node tools/test_first_steps_browser.cjs: tap/drag/touch/mixed, manual/Google vytvoření, continue, cancel, auth failure, save failure/retry, claim, test run. Fixture je jen loopback, neposílá OAuth ani DB zápisy ven. Samostatná původní browser sada ověřuje legacy board-v2 a SW upgrade.

První CI prokázalo SQL/HTTP nové kontrakty; odhalilo dvě zastaralé fixture (asset URL a registry snapshot) a kolizi pevného portu v nesouvisejícím testu Mozkokalypsy. Fixture aktualizovány, jeho gateway používá OS přidělený port a uzavírá socket; testovací izolace je zachována. Finální výsledky, SHA/deployment/čas a provedený backfill jsou zaznamenány v PR.

## Produkční akceptace a rollback
SQL: FUNNEL-PRODUCTION-VERIFY.sql; použít environment=production AND is_test=false. Vyhodnocovat alespoň 30 nových requested runů nového releasu. Ukončení starteru je jedna hranice ve třech kompatibilních eventech; hidden není opuštění. Korelace účtů přes flow UUID, žádná inference podle času/aktéra. Saved musí odpovídat skutečně uloženým výsledkům. Aktuální produkční výsledky nejsou uplift analýza.

Do splnění organického gate je stav výhradně „nasazeno, čeká na produkční ověření“. Reálný externí Google účet ani fyzický telefon/Fold nejsou tímto testováním ověřeny. Syntetické účty existují jen v izolovaném PostgreSQL. Produkční smoke používá tutorial=1.

Rollback aplikace na předchozí deployment; nový trigger je zpětně kompatibilní se starými chybějícími hlavičkami (source=other, onboarding=legacy). Není důvod vracet deterministicky opravené historické štítky. Hráčská data, XP, výsledky a local storage se nemažou.

Security advisor před změnou: 35 INFO RLS bez veřejných policies (server-only přístup), 1 existující WARN leaked-password protection disabled. Tato práce nemění auth konfiguraci; odkaz k tomuto nezávislému nálezu: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
