# Proplet v3.23 — bezpečnostní audit před veřejným spuštěním

**Stav:** release candidate po lokální regresi.  
**Cíl:** odstranit jednoduché cesty k úniku dat, zneužití API, triviálnímu cheatu a provoznímu oslepnutí před veřejným LinkedIn launchi.

## Shrnutí

v3.23 nemění puzzle banku ani herní ekonomiku. Přestavuje bezpečnostní a provozní okraje aplikace: session, rate limiting, veřejné API, chybové odpovědi, týmová data, výsledky, support, export/smazání účtu, security headers a admin launch monitoring.

Lokální audit a abuse testy jsou **PASS**. To ale není totéž jako produkční bezpečnostní certifikace. Dva povinné externí gate zůstávají: skutečné spuštění SQL v produkčním Supabase + production smoke test po Vercel deployi.

## P0/P1 nálezy opravené ve v3.23

### 1. Interní chyby už neunikají do klienta
Dříve mohl neočekávaný backendový error vrátit typ/text interní výjimky. Podobný leak existoval i v `statsWarning` po uložení výsledku.

Nově:
- klient dostane pouze bezpečný produktový text,
- každý serverový problém má `request ID`,
- interní traceback zůstává pouze v serverovém logu,
- operational telemetry je sanitizovaná a neukládá tokeny, hesla ani surovou IP.

### 2. Aplikační rate limiting
Před v3.23 chyběl robustní aplikační rate limit pro login/registraci a řadu veřejných/mutačních endpointů.

Nově:
- atomický fixed-window limiter běží v Postgresu,
- funguje napříč serverless instancemi,
- surová IP se neukládá; používá se HMAC hash,
- limiter failuje bezpečně: při nedostupné limiter infrastruktuře chráněný endpoint nepokračuje bez kontroly,
- vlastní limity mají login, registrace, account/team operace, výsledky, telemetry, support, push a nákladnější read endpointy.

### 3. Týmové leaderboardy už nejsou veřejná PII cesta
Dříve znalost `family_code` stačila k získání jmen členů a týmových výsledků přes API.

Nově:
- týmový leaderboard vyžaduje přihlášení,
- hráč musí být členem stejného týmu,
- cizí/solo hráč dostane 403,
- globální leaderboardy zůstávají veřejné, ale nevracejí jména, avatar, tým ani player ID.

### 4. Veřejný seznam týmů je minimalizovaný
Dříve discovery endpoint kvůli počtu členů načítal široká data z tabulky hráčů.

Nově vrací pouze:
- kód,
- název,
- zda je tým chráněn PINem.

Nevrací počty členů, hráče ani hash PINu.

### 5. Výsledky mají serverovou sanity kontrolu
Browserovou hru nelze bez zásadně jiné architektury udělat dokonale server-authoritative, protože klient musí puzzle znát. v3.23 ale blokuje triviální API podvody:
- puzzle/challenge musí existovat,
- `attempt_id` je vázán na stejné puzzle/challenge/mode/difficulty,
- počet tahů musí být konzistentní s nalezenými odpověďmi a chybami,
- hint metadata musí být konzistentní,
- extrémně nemožné minimální časy se odmítnou.

### 6. `attempt_id` nelze přenášet mezi puzzle
Existující attempt se při start/finish/result kontroluje proti puzzle ID, challenge key, mode a difficulty.

### 7. Sekundární sessions expirují
Nové sekundární sessions mají 180denní lifetime a `last_used_at`. Expirované sessions se odmítají a odstraňují.

Legacy hlavní token zůstává kvůli backward compatibility dlouhodobý — viz reziduální rizika.

### 8. Heslo nelze přes raw API přepsat bearer tokenem
`POST /api/password` je nyní pouze „nastavit první heslo“. Pokud heslo už existuje, endpoint vrátí 409. Změna hesla vyžaduje budoucí explicitní change-password flow nebo support.

### 9. Smazání účtu je skutečně bezpečné a proveditelné
- vyžaduje text `SMAZAT`,
- účet s heslem vyžaduje heslo,
- aktivního admina nelze smazat,
- kontrola admin stavu failuje bezpečně,
- bývalý admin účet lze smazat: historický audit zůstane, ale jeho FK je `ON DELETE SET NULL`,
- klient odstraní player-scoped lokální data a best-effort odhlásí browser push subscription.

### 10. Fresh-install admin bootstrap už není předvídatelný
Clean setup už neuděluje admina automaticky podle kombinace veřejně uhodnutelného jména/týmu. Nová instalace vyžaduje explicitní trusted `player_id` grant.

### 11. Security headers + CSP
Vercel konfigurace přidává:
- Content-Security-Policy,
- HSTS,
- `X-Content-Type-Options: nosniff`,
- `X-Frame-Options: DENY`,
- `Referrer-Policy`,
- restriktivní `Permissions-Policy`.

Veřejné FastAPI Swagger/ReDoc/OpenAPI endpointy jsou vypnuté.

CSP nepovoluje inline JavaScript ani HTML event handlery. `style-src 'unsafe-inline'` zůstává záměrně kvůli současným runtime inline stylům.

### 12. Request body limit
POST/PUT/PATCH/DELETE mají aplikační limit 64 KB podle skutečného body, ne pouze deklarovaného `Content-Length`.

## Privacy-by-design změny

- anonymní identity se dál nezakládají na fingerprintingu,
- rate-limit tabulka neukládá raw IP,
- operations tabulka neukládá raw exception text,
- Launch radar nevrací raw anonymní identifikátory,
- account export neobsahuje password hash, auth/session hash ani push kryptografická tajemství,
- veřejná týmová data byla minimalizována.

## Provozní observabilita

Nově existují:
- `operational_events` pro sanitizované server/client/rate-limit události,
- request correlation ID,
- `support_reports`,
- admin Launch radar,
- housekeeping retention:
  - rate limit counters ~2 dny,
  - operational events max 30 dní,
  - resolved/dismissed support reporty max 12 měsíců od vyřízení.

## Reziduální rizika / co audit netvrdí

1. **Browser anti-cheat není absolutní.** Odhodlaný útočník může vytvořit plausibilní klientská data. Odstranili jsme jednoduché nekonzistentní/absurdní podvody, ne matematickou možnost podvodu.
2. **Legacy main-device token je dlouhodobý.** Sekundární sessions expirují; úplné sjednocení session modelu by bylo samostatný pozdější auth sprint.
3. **Chybí samoobslužný change-password/password-recovery flow.** Existující heslo nelze raw API přepsat; ztráta hesla je zatím support scénář.
4. **Transitivní dependency tree není plně hash-locknutý.** Připínáme přímé runtime závislosti a explicitně Starlette, ale není to kompletní lockfile se všemi transitivními hashi.
5. **Externí uptime monitor není součástí repozitáře.** Musí být nakonfigurován mimo aplikaci před veřejným launchi.
6. **SQL migrace nebyla v lokálním prostředí spuštěna proti PostgreSQL/Supabase.** Lokální prostředí PostgreSQL nemá. Migrace prošla statickým/idempotence auditem; produkční run + `SUPABASE_VERIFY_V3_23.sql` je povinný gate.
7. **Automatický live-browser E2E proti localhostu byl blokován enterprise policy prostředí.** Použit byl izolovaný Chromium render reálného HTML/CSS; skutečný production E2E je povinný po deployi.
8. **Custom doména zatím není známá.** OpenGraph/canonical/sitemap míří na současný Vercel hostname. Pokud bude před launchi vlastní doména, metadata se musí přepsat před veřejným sdílením.

## Verdikt

**Lokální kódový security gate: PASS.**  
**Production GO:** až po úspěšném SQL migration+verify, `/api/health`, produkčním smoke testu a zapnutí externího uptime monitoru.
