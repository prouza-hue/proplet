# Produkční nasazení nové administrace

Datum: 29. 10. 2026, Europe/Prague. Uživatel po prohlédnutí a ověření izolovaného preview výslovně požádal o ostré nasazení, pokud závěrečná kontrola neodhalí překážku. Tento pokyn nahradil původní omezení na preview.

## Nasazený výsledek

- Produkční admin: https://hrajproplet.cz/admin.html
- [PR 222](https://github.com/prouza-hue/proplet/pull/222) sloučen jako `12fd1451be725c4d9f18e0f4877c4893c8ff5902`.
- [PR 223](https://github.com/prouza-hue/proplet/pull/223), oprava produkčního timeoutu kvality, sloučen jako `84e64aa97928c67e580679090e831c9007b7e5a6`.
- Konečný produkční deployment: `dpl_Ec8GjsA5FVyiWqmDzVLT7EtxKnhT`, READY, main, SHA `84e64aa97928c67e580679090e831c9007b7e5a6`.
- Release metadata 4.09.15; zdrojový strom merge odpovídá otestované větvi. Cache adminu má samostatný no-store režim a obchází herní SW cache.

## Databázový přechod

Potvrzený cílový Supabase projekt `proplet`, `iopyhluayfszskyqqpuc`. Použity migrace v pořadí:

1. `admin_workspace_reads` — nové čtecí souhrny a společný výpočet XP.
2. `admin_atomic_recovery` — revize identity a transakční lifecycle odkazů.
3. `admin_case_audit_transaction` — změna případu a audit v jedné transakci.
4. `quality_dataset_single_read` — jediný úplný čtecí snapshot pro kvalitu.

První migrace proběhla v repeatable-read transakci: statistiky všech existujících hráčů byly uložené do dočasného srovnání a po nahrazení funkce znovu přesně porovnané. Jakákoliv odchylka by celou migraci odmítla; porovnání prošlo. Výsledky, XP, odměny, týmy, hesla a relace nebyly migračním zásahem přepsané či odstraněné.

Před přechodem nebyl žádný platný nedokončený legacy odkaz. Nové RPC nemají EXECUTE pro anon/authenticated; service_role oprávnění ověřeno. Nové identity a nové testovací účty se v produkci nevytvářely. Testovací e-maily zůstaly výhradně v odděleném projektu.

## Nález při ostré kontrole a oprava

Po prvním nasazení fungovaly hráči, hlášení, obsahový program, historie kvality, provoz a analytika. Samotná kvalita však na skutečných datech překročila dvacetisekundový klientský limit. Logy a počty doložily 59 sériových REST GETů a opakovaný výpočet view s prvními celoživotními pokusy.

PR 223 změnil pouze transport datasetu: pět úplných projekcí a event counts získává jediným service-only RPC. Python kalibrace, mediány, flags, calm mode a výběr prvního celoživotního pokusu před časovým filtrem se nezměnily. Kompaktní přenos ověřuje schéma, počty a časové hranice; při neúplnosti vrátí 503, nikoli oříznutá nebo nulová data. Zachované jsou pražské kalendářní hranice přes DST i oba podzimní foldy.

V produkci změřeno: nový databázový snapshot přibližně 6,9 s, celý autorizovaný HTTP report 14,606 s, HTTP 200. UI načetlo všech 1 812 reportových řádků bez chybové hlášky. Jde o náročný úplný 90denní analytický report; není vydáván za okamžitý výpočet. Případná další agregace/cache/paginace je samostatné budoucí zrychlení, nikoli změna dokončené metodiky.

## Doložené ověření

- Před merge: aktuální gate 193 testů PASS a 539 syntax kontrol PASS.
- Golden report před a po změně přesně shodný; osm testů nového datasource, SQL scénáře přes 1 000 řádků, první lifetime mimo okno, calm, tie-break, completeness, ACL a DST prošly.
- CI PR 223 dokončeno bez selhání; current-runtime, izolovaná skutečná databáze, printshop-ui a gen4-contract prošly. Původní PR 222 měl rovněž dokončené úspěšné kontroly.
- `/api/config`: production, `adminPreview=false`. `/api/health`: HTTP 200, ok=true, database=true.
- `/admin` a `/admin/`: 307 na `/admin.html`. Shell i moduly 200 a no-store.
- Nepřihlášené admin API a historické quality aliasy: 401 a no-store.
- Produkční relace vlastníka: všech sedm sekcí ověřeno pouze čtením, včetně úplné kvality po opravě.
- Logy konečného deploymentu: v kontrolovaném patnáctiminutovém okně žádné error/fatal záznamy.
- Výsledek celého recovery e-mailu a resetu byl před vydáním skutečně dokončen uživatelem v izolaci; v produkci se syntetické hraní ani reset skutečného hráče neprováděly.

## Hranice a následná práce

První etapa a všechny její implementační i release úkoly jsou dokončené. Původní PR 118 se samostatně nemergoval; jeho funkce je obsažená v nasazené změně. Citlivé přesuny týmů, odpojování identit, slučování účtů a historické korekce bodů zůstávají samostatnou druhou etapou.

Při případném řešení problému zachovat nové zabezpečené auth/API a aditivní migrace. Nevracet celý backend na předchozí `1de7389`, který by obnovil staré neatomické operace. Volit opravu vpřed nebo kompatibilní návrat samotného UI.
