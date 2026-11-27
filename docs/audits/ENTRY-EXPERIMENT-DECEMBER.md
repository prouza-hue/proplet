# Prosincový test prvního vstupu do Propletu

Varianta A vede přes trénink 3×3 s odměnou 10 XP na Volnou hru g4-e-009. Varianta B otevře tutéž desku přímo. Noví způsobilí hosté mají na serveru stejnou šanci na A i B. Stabilní hash používá odlišnou sůl pro prosinec a původní identitu. Navazující požadavky a převod na účet zachovají přiřazení. Měření odděluje prosinec politikou `december_hash50_v1`. Listopadové přiřazení, nastavení a odečet se zachovají. Existující klient používá stejný formát odpovědi i stejný herní tok.

Migrace připraví vypnutý nábor. Produkční přepínač aplikace `PROPLET_ENTRY_EXPERIMENT_ENABLED=1` musí být pro nábor aktivní. Zkontroluj ho po nasazení migrace před schváleným otevřením. Databázový příkaz pro operátora zachytí skutečný začátek nejdřív 1. prosince 2026 v 00:00 pražského času. Běží mimo migraci, po ověření nasazení a teprve po schválení spuštění.

```sql
WITH activation AS MATERIALIZED (SELECT clock_timestamp() AS at)
UPDATE proplet_experiment_internal.entry_december_control c
SET enabled=true, starts_at=a.at
FROM activation a
WHERE c.environment='production' AND c.starts_at IS NULL
  AND a.at>=timestamptz '2026-12-01 00:00 Europe/Prague' AND a.at<c.ends_at
RETURNING c.starts_at,c.ends_at;
```

Nábor končí automaticky na pražské půlnoci z 31. prosince na 1. ledna. Technické zastavení může operátor provést změnou `enabled=false` na produkčním řádku prosincové brány. Již vydaná přiřazení zůstávají v platnosti. QA lze zapnout vlastním řádkem `local` nebo `preview` v izolované testovací databázi.

## Vyhodnocení

Hlavní metrika je dokončení alespoň jedné skutečné hry do 24 hodin od přiřazení. Odečet počítá Volnou hru, Denní hru, Denní Extra a Tajenku, pro niž zachovává i stávající signál dokončení. Trénink se nepočítá. Samostatné Spojky zatím ukládají dokončení v klientovi a v tomto serverovém odečtu nejsou měřitelné. Jmenovatelem jsou všichni produkční netestovací přiřazení v prosincovém okně. U sdílených účtů se výsledek nepřičítá podle samotného účtu více instalacím. Takové případy, chybějící serverové záznamy o přiřazení a nesprávnou větev označuje sloupec `investigate`.

Používej `ENTRY-EXPERIMENT-DECEMBER-READOUT.sql`. Až do 2. ledna 2027 v 09:00 pražského času skrývá počty dokončení. Pro kontrolu technického stavu a finální srovnání lze CSV předat existujícímu `tools/entry_experiment_readout.py`. Parametr `--intact-final` patří jen k úplnému finálnímu odečtu bez nevyřešených problémů. Uveď X z Y pro obě varianty a rozdíl B minus A s 95% Newcombovým intervalem. Pro rozhodnutí platí nejméně 100 přiřazených na variantu, rozdíl alespoň 3 procentní body a celý interval na příslušné straně nuly. Jinak je výsledek nepřesvědčivý. Datum konce se podle průběžných čísel neposouvá.
