# Proplet v3.19.2 — záchrana série bez chyby

Malý klientský hotfix doplňuje funkci `maybeOfferRescue`, kterou předchozí verze volala, ale neobsahovala.

- čistý start aplikace už nevyhazuje `ReferenceError`,
- nabídka záchrany se ukáže pouze na obrazovce Dnes,
- nikdy nepřekryje onboarding ani jiný otevřený dialog,
- pro jeden vynechaný den a stav se automaticky ukáže nejvýš jednou,
- rozehraná záchrana může samostatně nabídnout pokračování,
- databáze, úrovně, XP a výsledky se nemění.
