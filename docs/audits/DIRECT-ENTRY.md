# První vstup bez tréninku

Po zapnutí dostane každý způsobilý nový hráč při běžném online vstupu dosavadní variantu B. Otevře se první Volná hra g4-e-009 a po dohrání pokračuje obvyklá nabídka uložení výsledků. Trénink 3×3 a jeho odměna se při tomto vstupu přeskočí. Dosavadní přiřazení, rozehrané hry, běžné návraty a vlastní vstupy přes odkazy používají zavedená pravidla.

## Zapnutí při startu kampaně

Nasazení migrace připraví vypnutý produkční přepínač. Po nasazení ověř dostupnost aplikace, produkční `entryExperimentEnabled` z `/api/config` a vypnutý řádek v databázi. Produkční nastavení `PROPLET_ENTRY_EXPERIMENT_ENABLED=1` musí být aktivní pro dosavadní vstupní API. Operátor spustí následující příkaz při startu kampaně.

```sql
UPDATE proplet_experiment_internal.entry_direct_control
SET enabled=true, starts_at=coalesce(starts_at,clock_timestamp())
WHERE environment='production' AND NOT enabled
RETURNING starts_at,enabled;
```

Při potížích lze stejný produkční řádek přepnout na `enabled=false`. Tím se pro nové návštěvy po uzavřeném listopadovém náboru vrátí obvyklý vstup s tréninkem. Již přiřazený rozpracovaný vstup se dokončí v původní podobě. Opětovné zapnutí zachová první čas spuštění.

## Měření

`DIRECT-ENTRY-READOUT.sql` počítá produkční netestovací přiřazení tohoto spuštění, selhání načtení a dokončení skutečné hry do 24 hodin. Pro podíl používej `completed_24h / observed_24h`. Do jmenovatele patří všichni přiřazení, jimž už uplynulo celých 24 hodin. Počítají se Volná hra, Denní hra, Denní Extra a Tajenka. Spojky zatím ukládají dokončení jen v zařízení. Změny proti dřívějšímu provozu popisuj s ohledem na rozdílnou návštěvnost kampaně.
