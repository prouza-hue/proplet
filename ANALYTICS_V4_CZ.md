# Proplet v4 — datová analytika a rozhodovací systém

## Cíl

Analytika má každý den odpovědět na pět otázek: kolik lidí přišlo, kolik z nich opravdu začalo hrát, zda se vracejí, kde odpadají a zda hra funguje rychle a spolehlivě. Nesbíráme data jen proto, že je sbírat lze.

Hlavní produktová metrika je **týdenní počet aktivovaných hráčů**: unikátní hráči nebo anonymní instalace, kteří za posledních 7 dní dokončili alespoň jednu skutečnou Denní výzvu nebo Volnou hru. Starter se do této metriky nepočítá.

## Zdroje pravdy

| Vrstva | Zdroj | Co z ní rozhodujeme |
| --- | --- | --- |
| Akvizice | Vercel Web Analytics | návštěvy, unikátní návštěvníci, zdroje, země, typ zařízení a prohlížeč |
| Výkon | Vercel Speed Insights | LCP, INP, CLS, FCP a TTFB na skutečných zařízeních |
| Cesta hráče | `product_events` | onboarding, účet, PWA, push, sdílení, doporučení obtížnosti a navigace |
| Hraní | `puzzle_attempts`, `hint_events`, `helper_events` | start, dokončení, odpadnutí, čas, tahy, nápovědy, klidný režim a kvalita jednotlivých desek |
| Ekonomika | `results`, `puzzle_runs`, `account_rewards` | XP, postup, návraty k nové desce a soutěžní aktivita |
| Spolehlivost | `operational_events`, support a Vercel runtime logs | chyby, pomalé nebo selhané synchronizace, rate limiting a hlášení hráčů |

Vlastní herní identita je pseudonymní. Vercelová návštěvnost je agregovaná a bez cookies. Obě vrstvy se záměrně nespojují do osobního profilu.

## Kdy se co měří

- Každé načtení: `app_open`; jednou za životnost otevřené záložky/PWA: `app_session_started`.
- Přechod na hlavní obrazovku: `screen_*_viewed`; samotná hra se měří přes pokus, ne duplicitní screen event.
- Onboarding: zobrazení, pochopení principu, volba Pomocníka, dokončení nebo rozpoznání vracejícího se hráče.
- Hra: serverový start pokusu, checkpointy po správném slovu, nápovědě, odchodu, návratu a dokončení.
- Konverze: rozlišujeme vytvoření účtu od přihlášení; měříme nabídku, kliknutí i úspěch.
- Retence: nabídka a volba push notifikace, PWA instalace a každé další aktivní datum.
- Virální smyčka: vytvoření odkazu, otevření, start, dokončení a překonání sdílené úrovně.
- UX: zapnutí Klidného režimu, doporučení vyšší obtížnosti a ochrana anonymního postupu.

## Denní manažerské vyhodnocení v 9:00

Report porovnává včerejšek s předchozím dnem a s klouzavým 7denním průměrem. Má být krátký a rozhodovací:

1. **Verdikt dne** — jedna věta: růst / stabilita / problém a proč.
2. **Akvizice** — návštěvníci, nové instalace/účty, známý zdroj návštěvnosti.
3. **Aktivace** — onboarding → starter → první skutečná hra; největší propad ve funnelu.
4. **Engagement** — aktivovaní hráči, dokončené hry na hráče, Daily start a dokončení.
5. **Retence** — D1 a D7 pouze z již způsobilých cohort; velikost vzorku musí být vždy uvedena.
6. **Konverze** — vytvoření účtu, PWA, push a sdílené výzvy; konverze se počítá z unikátních aktérů, ne z počtu kliknutí.
7. **Kvalita a provoz** — nejhorší deska s použitelným vzorkem, Core Web Vitals, chyby a otevřená hlášení.
8. **Doporučená akce** — nejvýše tři konkrétní kroky seřazené podle dopadu.

## Prahy pro upozornění

- P0: synchronizace výsledků selhává, server vrací 5xx, Daily není shodná nebo se nedá dokončit.
- P1: dokončení Daily klesne o více než 20 procentních bodů proti 7dennímu průměru; D1 retence klesne o více než 30 % relativně; LCP přesáhne 4 s nebo INP 500 ms při alespoň 20 měřeních.
- Pozor: funnel nebo konverze se zhorší o více než 15 % relativně při alespoň 20 lidech v jmenovateli.
- Bez závěru: menší vzorek než 10; report ukáže čísla, ale nevydává doporučení založené na procentu.

## Retence a historická srovnatelnost

- Pseudonymní produktová a herní telemetrie může zůstat dlouhodobě pro srovnávání verzí a kvality; data navázaná na účet se smažou spolu s účtem. Pokud objem výrazně naroste, zavedeme časově omezenou surovou vrstvu a dlouhodobé anonymní agregace.
- Provozní chyby: 30 dní. Rate-limit data: přibližně 2 dny. Vyřešený support: nejvýše 12 měsíců.
- Události doplněné ve v4.01.6 nemají spolehlivou historii před tímto releasem. Starší aktivitu proto měříme z `puzzle_attempts` a `results`, ne zpětným dopočtem chybějících eventů.

## Náklady a škálování

Při současném objemu (řádově tisíce událostí týdně) jsou denní agregace zanedbatelné. `product_events` a `puzzle_attempts` už mají indexy podle času, typu a pseudonymní identity. Speed Insights vytváří přibližně 3–6 technických bodů na návštěvu; pokud by návštěvnost výrazně vzrostla, sníží se vzorek výkonu dříve, než se omezí produktová data.

Reklamní pixely se přidají teprve při placené kampani, s konkrétní atribuční otázkou a samostatným souhlasem. Bez kampaně by nyní pouze rozšířily právní stopu a nezlepšily produktové rozhodování.
