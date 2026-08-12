# Proplet v3.8.1

Česká slovní logická PWA s Denní výzvou, 400 volnými úrovněmi, streakem, XP/hodnostmi, rodinnými účty, žebříčky konkrétních úrovní a nově i dobrovolnou **Ligou rodin**.

## Cloud stack

- Vercel — FastAPI + statická PWA
- Supabase — PostgreSQL

## Aktualizace z v3.7.1

Viz `UPDATE_V3_8_CZ.md`.

## Liga rodin

Globální týdenní soutěž je založená pouze na Denních výzvách. Veřejně se zobrazují jen agregované týmové výsledky a zvolené veřejné jméno rodiny; individuální jména členů, interní kód a PIN zůstávají soukromé.


## v3.8.1 — čistší herní logika

Herní tlačítko **↶ Zpět** bylo odstraněno. Proplet přijímá pouze trasu patřící do jediného řešení, takže přijaté slovo není potřeba vracet. Navigační šipka zpět a „Zpět do menu“ zůstávají beze změny.
