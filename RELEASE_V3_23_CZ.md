# Proplet v3.23 — Launch Ready 🚀

v3.23 je poslední velký předlaunchový sprint. Nepřidává nový herní mód ani nemění puzzle. Převádí Proplet z kvalitního produktu pro testery na aplikaci připravenou na veřejnou návštěvnost.

## Security hardening

- atomický Postgres rate limiter pro login, registraci, mutace, telemetry i nákladnější reads,
- raw IP se do rate-limit tabulky neukládá,
- generické serverové chyby + request ID,
- 64KB request body limit,
- veřejná FastAPI dokumentace vypnutá,
- CSP + HSTS + no-sniff + anti-frame + referrer/permissions policy,
- secondary session expiry 180 dní,
- attempt/result konzistence + sanity kontrola,
- existující heslo nelze přepsat first-password endpointem.

## Privacy a řízení účtu

Nově v `Já → Účet a soukromí`:
- Nahlásit problém,
- Export mých dat,
- Smazat účet,
- Ochrana soukromí,
- Podmínky používání.

Týmové jmenné leaderboardy jsou nově přístupné pouze přihlášenému členovi stejného týmu. Veřejný team discovery je minimalizovaný.

## Launch radar

Admin má novou první záložku Launch:
- aktivní 24h / 7d,
- onboarding→starter→Daily→account funnel,
- starter→account conversion,
- D1 retention,
- verze klientů,
- server/client errors,
- rate-limit zásahy,
- support queue.

## Support / provoz

- anonymní i přihlášené support reporty,
- sanitizované operational events,
- request correlation ID v chybové hlášce,
- housekeeping technických tabulek,
- privacy retention odpovídá implementaci.

## Launch metadata

- OpenGraph/Twitter metadata,
- 1200×630 share card,
- canonical,
- robots + sitemap,
- PWA ikony/theme zkontrolované.

Aktuální veřejná URL metadata je stále Vercel hostname. Při přechodu na custom doménu je potřeba před sdílením přepsat canonical/OG/sitemap.

## Co se nemění

- puzzle obsah,
- XP a ekonomika,
- Daily/Free/Rescue pravidla,
- starter,
- dark mode,
- Fold layout z v3.22.4,
- orientation blocker se nevrací.

## Release filozofie

Po 3.23 následuje feature freeze. Před LinkedIn launchi pouze skutečné P0/P1 opravy, žádné nové herní funkce.
