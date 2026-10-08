# Supabase usage — navázání a ověření, 8. 10. 2026

Ověřený výchozí stav: produkční main `c65ac5f76536959c23ee96280b4ab39963460488`,
Vercel `dpl_AHuCuxWTyxNvky2sYi7rufUDJFNc`, projekt
`prj_0XHgnCQhdPS3pPETrxIpoXn0McMG`, Supabase
`iopyhluayfszskyqqpuc`. Organizace je stále Free.

## Co již bylo nasazeno

PR [184](https://github.com/prouza-hue/proplet/pull/184) omezuje historii a
počet databázových požadavků, agreguje statistiky v SQL, slučuje kontroly
požadavků a dávkuje analytiku. PR
[185](https://github.com/prouza-hue/proplet/pull/185) opravuje přijetí metadat
integračního POSTGRES_URL a aktivuje serverový PostgreSQL RPC transport.
Změny byly nasazené před zahájením tohoto navázání; nejsou zde vydávány za
novou implementaci. Živý /api/health při kontrole v 18:19 UTC potvrzuje
`rpcTransport=postgres`, `database=true`, verzi 4.05.1.

## Naměřený účinek

Read-only ClickHouse query_logs, shodná okna 09:35–18:20 UTC (8 h 45 min):

| Metrika | 7. 10. | 8. 10. | Změna |
| --- | ---: | ---: | ---: |
| Edge/API události | 43 825 | 8 669 | −80,22 % |
| Gateway RPC proplet* | 28 200 | 2 | −99,993 % |
| Všechny log streamy | 44 303 | 10 789 | −75,65 % |

Root nezávisle zopakoval první dvě agregace. Součet všech streamů pochází
z delegované read-only diagnostiky. Dvě RPC v 13:43:54 UTC vrátila HTTP 200.
Supavisor nově generuje 1 694 informačních logů; to není chybový flood.
Počty nejsou účtovaný Logs Ingest ani Egress a rozdílná návštěvnost může
ovlivnit mezi-denní srovnání.

Použitá agregace:

```sql
select count() as edge_requests,
       countIf(log_attributes['request.path'] like '/rest/v1/rpc/proplet%') as proplet_rpc
from logs where source = 'edge_logs'
```

## Doložená zbývající závada a ochrana

Vercel eviduje šest serverových REST odmítnutí `JWT issued at future`
od nasazení do 18:22 UTC, na čtení account_rewards, push_subscriptions,
puzzle_attempts, results a result_commands. Poslední odmítnutí v
15:27:17 UTC způsobilo /api/result HTTP 503. Chybové odpovědi nejsou
automaticky klasifikované jako provoz botů.

Proplet v této cestě JWT nevytváří. Supabase
[popisuje](https://supabase.com/docs/guides/auth/signing-keys) výměnu opaque
secret API key za krátkodobý JWT v gateway. PostgREST
[5196](https://github.com/PostgREST/postgrest/issues/5196) a
[5208](https://github.com/PostgREST/postgrest/pull/5208) dokumentují a opravují
sporadické odmítání platných JWT kvůli uloženému času. To je odpovídající
upstream vysvětlení, nikoli důkaz přesné interní příčiny této managed instance:
neznáme její aktuální PostgREST verzi ani interní časová měření.

Tato změna přidává jediný retry databázového GET po jedné sekundě, jen pro
HTTP 401 + PGRST301/PGRST303 + přesnou zprávu JWT issued at future.
Používá stejného klienta a původní credentials. Společný limit je nejvýše
dva pokusy celkem, včetně stávajících transportních a 5xx retry.
Zápisy ani jiné chyby autorizace tuto novou cestu nepoužívají. Trvalé
odmítnutí zůstane chybou a je logované. Jde o ochranu proti přechodnému
odmítnutí, nikoli o opravu infrastruktury Supabase.

## Ověření a otevřené body

Nové případy jsou v již spouštěném test_runtime_resilience.py:
úspěšný retry, trvalé odmítnutí, odlišná či neplatná chybová odpověď,
žádný retry POST/PATCH/DELETE, původní 5xx chování a společný limit při
kombinaci chyb. Aktuální runtime gate a izolovaná SQL kontrola se spustí
v existujícím workflow při otevření PR; skutečný výsledek, finální SHA a
produkční ověření jsou evidované v PR tohoto navázání.

Billing dashboard není v tomto běhu dostupný; nelze potvrdit současné GB,
denní Egress ani návrat pod Free kvótu. Předchozí doložený odečet z 28. 9.
byl 6,488 GB za cyklus 11. 9.–11. 10.; není aktuálním odečtem.
[Dokumentace Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
potvrzuje, že pooler přenos se započítává jako Shared Pooler Egress a již
spotřebovaný přenos se zpětně nesnižuje. Po novém cyklu je třeba sledovat
skutečné denní hodnoty; provozní cíl zůstává přibližně 140 MB/den.
[Log grace period](https://supabase.com/changelog/logs-usage-based-pricing)
pro tuto existující organizaci běží do začátku 2027; log upozornění samo
nyní není důvodem pro placený upgrade.

Placený plán se neaktivuje. Původní sledování zůstává aktivní.
