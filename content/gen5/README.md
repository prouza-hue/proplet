# Gen5 lab

Offline výrobní generátor. Návrh a limity: [DESIGN.md](DESIGN.md).
Spouštět z kořene repozitáře s Pythonem 3.11+; bez nových závislostí.

```sh
python -m unittest discover -s tests/gen5 -v
python tools/gen5_lab.py --output lab-output/gen5/my-pilot --count 3 --seconds-per-board 45
python tools/gen5_lab.py --output lab-output/gen5/my-pilot --count 3 --seconds-per-board 45 --resume
python tools/gen5_lab.py --output lab-output/gen5/my-pilot --validate-only
python tools/gen5_capacity.py --output lab-output/gen5/my-capacity
python tools/gen5_gallery.py lab-output/gen5/my-pilot/pilot.json
python tools/gen5_series.py --output lab-output/gen5/my-series
python tools/gen5_series.py --output lab-output/gen5/my-series --resume
python tools/gen5_series.py --output lab-output/gen5/my-series --validate-only
```

`--count` znamená počet desek na obtížnost; v prototypu nejvýše 10.
Lze zvolit `--difficulties easy medium hard hardcore mozkomor` nebo jejich podmnožinu.
Při obnově musí souhlasit vstupy, kód i původní parametry. Po změně kódu použijte
nový adresář. Nepřepisujte otisky ve starém checkpointu.

Výrobní příkaz používá `content/gen5/series-plan.json`: 4×100 + 50 desek,
tři pracovní procesy a omezený počet opakovaných pokusů. `--max-rounds 4`
umožní plánovaně zastavit po čtyřech dalších kolech. Následné `--resume`
naváže na stejný plán. Neúspěšná deska nepustí do checkpointu pozdější pozice.
Pro změnu plánované série použijte samostatný plán a nové `seriesId`.

Výstupy:

- `pilot.json`: přijaté desky, seedy, důkazy kontroly, otisky a diagnostika.
- `report.json`: souhrn pilotu a referenční banky, metriky počítané stejnou metodou.
- `capacity.json`: pouze tři simulace výběru slov pro plán 4×100 + 50, žádné desky.
- `index.html`: samostatná místní hratelná ukázka bez sítě a ukládání výsledků.
- `series.json`: checkpoint výroby s otisky, pořadím, pokusy a přijatými deskami.
- `candidate.json`: po dokončení soukromý balíček s manifestem a přehledem slov.

Otevřete HTML přímo v prohlížeči. Galerie slouží ke kalibraci desek; nenahrazuje
testování skutečného herního rozhraní. Výstupy v `lab-output/` jsou ignorované
Gitem a nejsou součástí produkčního webu. Před budoucím nasazením nového generátoru
je třeba rozhodnout, které review artefakty a schválené desky verzovat.
