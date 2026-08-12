# Proplet v3.14 — Pomocník & měření nápověd

V3.14 zavádí hráčskou **Úroveň podpory**, proaktivního **Pomocníka** a kompletní telemetry nápověd. Nápovědy zatím zůstávají bez limitu a bez monetizace; cílem releasu je získat data pro pozdější ekonomiku nápověd.

## Úroveň podpory

Přihlášený hráč si v profilu vybere:

- 🐣 Začínající čtenář — nabídka Pomocníka po 45 s bez nového správného slova.
- 🧒 Mladší školák — po 70 s.
- 🎒 Starší školák — po 100 s.
- 🧠 Bez asistence — Pomocník se sám neozývá.

Nastavení nemění puzzle, XP ani žebříčky.

## Pomocník

- reaguje na dobu od posledního správně nalezeného slova,
- nabídne se maximálně jednou za pokus,
- neobjeví se při Rescue,
- při obnovení rozehrané hry dostane hráč nový časový prostor a modal nevyskočí okamžitě,
- po přijetí použije pouze **lehkou nápovědu**: začátek + délku jednoho cílového slova,
- přijatá pomoc se vždy počítá jako nápověda a ruší ✨ čisté řešení,
- silnější nápovědy zůstávají pouze v ručním menu Nápověda.

U začínajícího čtenáře a mladšího školáka se první lehká nápověda v prvním pokusu interně označí jako `complimentary`. V3.14 to ještě nemá žádný herní ani platební dopad; je to příprava pro datové rozhodnutí o budoucí ekonomice nápověd.

## Telemetry nápověd

Každé použití ukládá agregovatelná data:

- úroveň 1 / 2 / 3,
- ruční vs. Pomocník,
- úroveň podpory hráče,
- `complimentary` ano/ne,
- čas použití,
- počet nalezených slov v okamžiku použití.

Pokus navíc ukládá první správné slovo, první nápovědu, počet resetů, návratů k rozehrané hře a poslední počet nalezených slov.

## Quality Analytics v2 — dokončení

V3.14 dokončuje infrastrukturu zahájenou v3.13:

- hlavní kalibrace používá jen první pokus hráče na aktivním puzzle,
- retired/historické puzzle se nezapočítávají do benchmarku,
- replaye zůstávají telemetry, ale neulehčují Difficulty Index,
- Pomocník se vyhodnocuje na prvních pokusech,
- nápovědy mají distribuci 0 / 1 / 2 / 3+ a medián času první nápovědy,
- v pondělí se automaticky uloží agregovaný QA snapshot.

Skrytý dashboard:

`/?qa=1`

Je dostupný přihlášenému hráči a zobrazuje pouze agregovaná data.

## Obsah

Puzzle banka se proti v3.13/v3.12 **nemění**.
