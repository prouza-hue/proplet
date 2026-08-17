# Proplet Free Generation 3 — progression audit

**Výsledek: PASS**

- 800/800 aktivních Free desek ověřeno širokým exact-cover solverem.
- 65 budoucích rolling desek ověřeno včetně anti-repeat přes hranici levelu 200.
- Hráčský model je pouze obtížnost + číslo úrovně; generace jsou interní implementační detail.
- Reportovaná nevhodná cílová slova byla odstraněna z target lexikonu.

| Obtížnost | Pásmo | políčka | slova | score | zatáčky/slovo | ≤1 zatáčka |
|---|---|---:|---:|---:|---:|---:|
| Snadná | 1-50 | 30.0 | 6.4 | 21.8 | 0.88 | 71 % |
| Snadná | 51-100 | 30.0 | 6.4 | 21.0 | 0.84 | 75 % |
| Snadná | 101-150 | 29.9 | 6.4 | 21.7 | 0.87 | 74 % |
| Snadná | 151-200 | 29.9 | 6.5 | 21.7 | 0.85 | 73 % |
| Střední | 1-50 | 48.6 | 8.4 | 51.7 | 1.12 | 57 % |
| Střední | 51-100 | 54.9 | 8.6 | 60.8 | 1.15 | 54 % |
| Střední | 101-150 | 60.6 | 9.5 | 70.1 | 1.18 | 52 % |
| Střední | 151-200 | 64.9 | 10.5 | 74.4 | 1.00 | 61 % |
| Těžká | 1-50 | 67.0 | 10.3 | 92.8 | 2.35 | 32 % |
| Těžká | 51-100 | 69.4 | 10.9 | 97.6 | 2.37 | 32 % |
| Těžká | 101-150 | 70.7 | 11.4 | 103.2 | 2.35 | 31 % |
| Těžká | 151-200 | 75.8 | 11.9 | 114.4 | 2.75 | 22 % |
| Mozkožrout | 1-50 | 76.6 | 11.4 | 118.5 | 3.56 | 11 % |
| Mozkožrout | 51-100 | 76.5 | 11.4 | 118.9 | 3.77 | 10 % |
| Mozkožrout | 101-150 | 76.2 | 11.3 | 118.4 | 3.59 | 11 % |
| Mozkožrout | 151-200 | 76.6 | 11.3 | 118.5 | 3.64 | 10 % |

## Most Střední → Těžká

Pozdní Střední: 64.9 políčka, 1.00 zatáčky/slovo.
První Těžká: 67.0 políčka, 2.35 zatáčky/slovo.
