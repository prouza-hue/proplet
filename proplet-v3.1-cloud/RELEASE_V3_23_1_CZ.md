# Proplet v3.23.1 — Launch Ready + jednočlenné týmy

Malý produktový doplněk nad v3.23 Launch Readiness. v3.23.1 **nahrazuje dosud nenasazenou v3.23.0**; není potřeba nasazovat obě verze.

## Co se mění

- Veřejná Liga týmů přijímá i tým s **jediným členem**.
- Jednočlenný tým se může ihned zapojit, získat běžné denní/týdenní skóre a porovnávat se s ostatními týmy.
- Skórovací model se nemění: denní týmové skóre je průměr až tří nejlepších oprávněných členů. U jednoho člena je tedy jmenovatel 1.
- Žádný handicap ani bonus za velikost týmu se nepřidává.
- Privacy hardening z v3.23 zůstává: veřejné standings nevracejí interní `familyCode` ani jména jednotlivých členů.

## Co se nemění

- žádné puzzle ani jejich ID,
- XP, streaky, nápovědy ani leaderboard jednotlivců,
- SQL schéma — používá se stejná `SUPABASE_MIGRATION_V3_23.sql`,
- security/rate limiting/privacy/account controls z v3.23.
