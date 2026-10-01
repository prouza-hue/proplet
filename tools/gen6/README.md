# Gen6 – izolovaná kandidátní výroba

**Výroba pozastavena rozhodnutím [PR #148](https://github.com/prouza-hue/proplet/pull/148#issuecomment-5849652613).** Níže uvedený příkaz dokumentuje historický prototyp z první dávky a nyní se nespouští. Dokončený společný základ je v [content/lexicon-v3/working](../../content/lexicon-v3/working/README.md). Stávajících 12 desek není finální sada Mozkokalypsy III. Nejprve se nad plným základem stanoví náročný profil; původní důkaz se nepřenáší na rozšířené uznávání a délkový profil se automaticky nezměkčuje.

Stav 26. 9. 2026: tato nadstavba používá existující Gen5 katalog, exaktní
přidělování tierů, strukturální validátor a solver. Geometrie je původní
Hamiltonovská výroba `tools/mozkokalypsa_lab.py`. Produkční soubory ani DB
tento nástroj nezapisuje.

## Reprodukce

Z kořene ověřeného checkoutu:

```sh
python -m unittest discover -s tests/gen6 -v
python -m tools.gen6.round3 \
  --lexicon content/lexicon-v3/candidate-lexicon.json \
  --output lab-output/gen6/novy-reprodukcni-beh \
  --source-sha 6e076bccf2a89d99e003667aa2eed0f6f4e24d51 \
  --as-of 2026-09-26 --seed 2026092603 \
  --seconds-per-board 180 --pool-size 24
```

Výstupní adresář musí být nový. Pouze `--capacity-only` vyrobí kapacitní
report a datovaný inventář. Generování je přísné: chybějící vstup, nesoulad
Git blobu, důkazu hesla nebo otisku redakce znamená chybu. Při nedokončeném
běhu existuje pouze `checkpoint.json`; není publikovatelnou bankou.

## Co se mění

- Kandidátní dodatky musí mít jednotlivý zdrojový doklad, redakční stav
  `accepted`, `candidate_generation_allowed=true`, `runtime_approved=false`.
  Jejich obsah musí přesně odpovídat otiskem svázané redakční dávce.
- Historie zahrnuje běžnou banku, rezervované týdenní várky, starší denní
  banky, Tajenku a oba playtesty. Datum dostupnosti není důkazem, že daný
  člověk slovo viděl. Historická v1 Tajenka se stejnými ID má vlastní
  inventární jmenný prostor; aktivní kolize jsou chybou.
- Všech 12 desek používá novou výběrovou politiku. Nemají kontrolní polovinu.
  Žádné cílové slovo se neopakuje uvnitř nové série ani vůči oběma playtestům.
- Výběr zvýhodňuje doložené nové dodatky, rozmanitá témata a méně použitá
  hesla. Explicitní významové rodiny mají měkký postih; pravopisné varianty
  nesmějí být v sérii dvakrát. Automatické stemování se nepoužívá.
- Zůstává 10×10, 100 aktivních buněk a 14 slov. Délkový multiset je nejbližší
  proveditelný dosavadnímu rozložení s ohledem na dostupné délky a tiery.
  Povolené A/B/C; nejméně 3× A a 4× B, nejvýše 4× C. Není povinná kvóta
  rarit ani 100% nových slov. Geometrická pravidla zůstávají stejná.
- `generatorGeneration=6` je výrobní značka; runtime `contentGeneration=4`
  a existující hráčský postup se nemění. Balíček neautorizuje nasazení.

## Platnost a její hranice

Každý dokončený kandidát má platné cesty, úplné pokrytí, jediný úplný rozklad
a jediné cílové cesty nad explicitní zmraženou rozpoznávací množinou.
Ta obsahuje obě statické množiny, lexikon v2, lemmata Wikidat, serverový
overlay a nové přijaté dodatky. Dynamický `wordfreq` fallback není konečná
množina tohoto důkazu; izolované preview používá právě zmražený slovník.
Vyčerpaný solver budget není úspěšný důkaz.

Finální běh má 12 desek, 168 unikátních slov, z nich 81 nových dodatků.
Slovník validátoru má 26 190 položek, SHA-256
`d003ac2addd6d072298e4d556bd69eaba4862b9b1df903da374d2ac4700af7d6`.
Obsahový otisk banky je
`f8b0dcca08dce98df5adb31e752ca76f762a6c2d6b207460be7442ad1c6bf6f9`.

Přesná reprodukce první desky ze seedu `8190918187265313617` skutečně prošla
s totožným obsahem. Reprodukce platí pro dokončené pevné kandidátní pooly;
timeout na pomalejším prostředí může běh zastavit nebo změnit odmítací proud.
Geometrické a rozhodovací metriky nejsou změřená lidská obtížnost.
