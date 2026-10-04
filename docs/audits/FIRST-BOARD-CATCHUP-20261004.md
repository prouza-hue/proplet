# Dorovnávání první desky — 4. 10. 2026

Požadavek: dorovnat počet skutečných přiřazení větví, zachovat dřívější hráče.
Výchozí production/non-test stav: control_e001 11, challenger_e009 29.
Bez dalšího provozu nelze dorovnání garantovat; potřeba alespoň 18 nových identit.

Serverová transakce se zámkem přiděluje menší větev, při rovnosti původní hash.
Identity, runy a testovací provoz mají oddělené stabilní přiřazení. Do organické
bilance nevstupují is_test=true ani jiné prostředí. Každý nový assignment a jeho
autoritativní event vzniknou atomicky; klient assignment znovu neposílá.
Nové účty a navazující kroky zůstávají propojeny přes first_steps_run_id.

Expirace: 2026-10-04T22:00:00Z (5. 10. 00:00 Europe/Prague).
Po expiraci se pouze novým identitám vrátí hash50_v1. Starší přiřazení neměnit.
Catch-up není randomizovaná fáze: zítřejší výstup oddělí policy kohorty.

Ověřeno před nasazením:

- izolovaný HTTP kontrakt a klientský regresní test;
- skutečná produkční RPC v transakci s ROLLBACK: 18 přiřazení do control,
  stabilní retry, chování při rovnosti a další dorovnání;
- stejná implementace s testovací hodinou přesně o půlnoci: návrat hash50_v1;
- EXECUTE pouze service_role; browser role bez přístupu, RLS privátního ledgeru;
- původní i nový read-only readout spustitelný, organická historie nezměněna.

Celý current gate: 129 aktuálních testů PASS, 147 asset checks PASS, 404 syntax
checks PASS. Dva historické charakterizační snapshoty S04/S06 mají odlišný
route digest už bez nové /api/first-board/assignment; nejsou zelené a nesmějí
být vydávány za úspěšný kompletní gate. Jejich původní API digest zachováváme,
nový endpoint má samostatný HTTP kontrakt.

Browser na izolovaném fixture: dokončení PES/LES/ČAJ → Hrát dál → skutečná
přiřazená deska. Právě jeden serverový assignment, žádný duplicitní klientský
assignment, started používá stejný first_steps_run_id/variant/bucket/policy.

Produkční deployment a následné ověření budou zapsány do paměti automatizace.
