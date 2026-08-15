# Proplet v3.23 — Launch checklist

Tento checklist je záměrně přísný. Veřejný LinkedIn launch znamená, že po nasazení už neděláme kosmetické změny „jen tak“.

## A. Před deployem — databáze

- [ ] Zkontrolovat, že existuje aktuální obnovitelná Supabase záloha / možnost point-in-time obnovy podle aktuálního projektu/plánu.
- [ ] Otevřít **Supabase → SQL Editor**.
- [ ] Spustit celý `SUPABASE_MIGRATION_V3_23.sql`.
- [ ] Migrace musí doběhnout bez chyby.
- [ ] Bezprostředně potom spustit celý `SUPABASE_VERIFY_V3_23.sql`.
- [ ] Výsledkem musí být JSON s `"verification": "PASS"`.
- [ ] Pokud verify selže: **nenasazovat aplikaci 3.23**. Opravit databázový stav, verify zopakovat.

Migrace nemaže výsledky, XP ani puzzle data. Housekeeping se týká pouze nových bezpečnostních/provozních tabulek.

## B. Deploy

- [ ] Rozbalit `proplet-v3.23-update.zip`.
- [ ] Obsah nahrát/přepsat **uvnitř GitHub adresáře `proplet-v3.1-cloud/`**, ne do rootu repozitáře.
- [ ] Zkontrolovat diff před commitem — žádné nečekané soubory.
- [ ] Commit + Vercel Production deployment.
- [ ] Počkat na dokončený deployment.

## C. Health gate

Otevřít `/api/health` a ověřit minimálně:

```json
{
  "version": "3.23.1",
  "launchReadinessSprint": "3.23",
  "publicErrorDetails": false,
  "apiDocsPublic": false,
  "requestBodyLimitKb": 64,
  "secondarySessionDays": 180,
  "securityHeaders": true,
  "accountExport": true,
  "accountDeletion": true,
  "supportChannel": true,
  "launchDashboard": true,
  "securityMigration": true,
  "starterMigration": true,
  "adminMigration": true,
  "ok": true
}
```

- [ ] `database: true`
- [ ] `securityMigration: true`
- [ ] `ok: true`
- [ ] Patička/PWA skutečně ukazuje v3.23.1.

## D. HTTP/security smoke

V DevTools/Network nebo přes běžný HTTP klient ověřit:

- [ ] CSP response header je přítomný.
- [ ] HSTS je přítomný na HTTPS produkci.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] `X-Frame-Options: DENY`.
- [ ] `/docs`, `/redoc`, `/openapi.json` neposkytují veřejnou API dokumentaci.
- [ ] Neočekávaná serverová chyba neukazuje traceback/SQL detail; pokud nastane, ukáže bezpečný request ID.

## E. Account/security smoke

Použít disposable test účet + existující účet.

- [ ] Nový účet lze vytvořit.
- [ ] Login funguje.
- [ ] Druhé zařízení/session funguje.
- [ ] Export mých dat stáhne JSON.
- [ ] Export neobsahuje password hash/token/session hash/push auth secret.
- [ ] Disposable účet lze smazat po potvrzení a heslu.
- [ ] Po smazání se nelze starým tokenem znovu přihlásit.
- [ ] Aktivní admin účet API odmítne smazat.
- [ ] Existující heslo nelze „nastavit znovu“ přes first-password flow.

## F. Privacy/team boundary smoke

Ideálně dva testovací účty ve dvou různých týmech.

- [ ] Člen týmu A vidí týmový leaderboard A.
- [ ] Člen týmu B nesmí získat leaderboard/jména týmu A — očekávat 403.
- [ ] Anonymní klient nesmí získat týmové jmenné leaderboardy.
- [ ] Veřejný seznam týmů nevrací členy ani počty členů.
- [ ] Globální leaderboard nevrací jména/avatar/team/player ID.

## G. Support/privacy smoke

- [ ] Anonymní hráč otevře `Nahlásit problém` a odešle testovací hlášení.
- [ ] Přihlášený hráč odešle hlášení.
- [ ] Admin → Launch radar vidí oba reporty bez raw IP/anonymního ID v UI.
- [ ] Admin může report označit reviewing/resolved.
- [ ] Privacy stránka se otevře v light i dark mode.
- [ ] Terms stránka se otevře v light i dark mode.
- [ ] Profil nabízí export + delete pouze přihlášenému hráči.

## H. Herní smoke

- [ ] Čistý browser → onboarding → starter.
- [ ] Starter lze dokončit bez použití Nápovědy.
- [ ] Idle nabídka Nápovědy nic neblokuje.
- [ ] Daily start + finish + výsledek + globální pořadí.
- [ ] Free start + finish + výsledek.
- [ ] Replay Daily neudělí druhé XP.
- [ ] Rescue nabídka/flow funguje.
- [ ] Reset + VRÁTIT.
- [ ] Krátký 1–3písmenný tah nepoškodí statistiku.
- [ ] Tmavý i světlý režim.

## I. Zařízení — povinná matice

### Samsung Fold7
- [ ] Chrome složený portrait.
- [ ] Chrome složený landscape — hra je dostupná, žádný orientation blocker.
- [ ] Chrome rozložený portrait.
- [ ] Chrome rozložený landscape.
- [ ] PWA rozložený portrait.
- [ ] PWA rozložený landscape.
- [ ] Fold/unfold během rozehrané hry.
- [ ] Mozkožrout / 10×10 na systémovém zvětšení uživatele — žádný overflow.

### Další
- [ ] Běžný Android telefon.
- [ ] iPhone/Safari, pokud je fyzicky dostupný tester.
- [ ] Desktop Chrome/Edge/Safari alespoň v jednom běžném viewportu.

## J. PWA/update smoke

- [ ] Stávající instalovaná PWA přijme v3.23 service-worker bundle.
- [ ] Po úplném zavření/otevření stále ukazuje 3.23.1.
- [ ] Offline shell se otevře v rozsahu, který podporuje současná PWA.
- [ ] PWA theme-color respektuje light/dark.
- [ ] Push reminder test, pokud je push v produkci nakonfigurovaný.

## K. Admin Launch radar

- [ ] Admin `/admin` se načte.
- [ ] Launch je první záložka.
- [ ] Aktivní 24h / 7d vypadají realisticky.
- [ ] Funnel ukazuje onboarding / starter / Daily / account.
- [ ] D1 retention se načte bez chyby.
- [ ] App versions ukazují 3.23 po testovacím provozu.
- [ ] Errors/rate limits/support queue se načítají.

## L. Externí provozní monitoring — launch gate

Toto není implementované uvnitř repozitáře.

- [ ] Nastavit externí HTTP uptime kontrolu na `GET /api/health` (doporučení cca každých 5 minut).
- [ ] Alert při non-200 nebo `ok != true`.
- [ ] Ověřit si před launchi, že testovací výpadek/špatný check skutečně vyvolá upozornění.

## M. Veřejná identita

Aktuální metadata používají `https://proplet-nine.vercel.app/`.

Pokud bude vlastní doména před launchi:
- [ ] canonical URL,
- [ ] `og:url`,
- [ ] `og:image`,
- [ ] Twitter image,
- [ ] `robots.txt` sitemap URL,
- [ ] `sitemap.xml` URLs,
- [ ] Vercel domain/config.

- [ ] Ověřit LinkedIn preview share-cardu před publikací.
- [ ] Ověřit privacy/terms z veřejné URL.

## N. Feature freeze

- [ ] 24–48 hodin před LinkedIn postem žádná nová feature.
- [ ] Povolit pouze P0/P1 bugfixy.
- [ ] Každý hotfix znovu přes health + relevantní smoke.

## O. Launch day

Těsně před postem:
- [ ] `/api/health` zelený.
- [ ] homepage funguje z anonymního okna.
- [ ] starter/Daily krátký smoke.
- [ ] Launch radar se načítá.
- [ ] support report lze odeslat.

Po publikaci doporučená kontrola:
- [ ] ~15 minut: health + errors + support.
- [ ] ~1 hodina: funnel + errors + rate limits + support.
- [ ] ~3 hodiny: totéž + první hrubý completion obraz.
- [ ] večer: D0 rekapitulace, žádný impulzivní redesign podle malého vzorku.

Praktické trigger body k vyšetření (ne automatické product rozhodnutí):
- jakýkoli health výpadek → ihned,
- opakované server errors v krátkém okně → dohledat podle request ID,
- výrazná série 429 u legitimního flow → zkontrolovat rate scope,
- při dostatečném vzorku výrazný propad starter completion → reprodukovat před úpravou onboardingu.

## P. Incident mini-runbook

Pokud launch něco zásadního rozbije:
1. nezměnit puzzle data ani výsledky,
2. zjistit request ID / Launch radar / Vercel log,
3. rozhodnout, zda je chyba frontend-only nebo DB/backend,
4. frontend/backend hotfix nasadit forward-only,
5. databázovou změnu rollbackovat jen s přesným plánem a zálohou — ne improvizovaným SQL,
6. po opravě health + cílený smoke + monitor.
