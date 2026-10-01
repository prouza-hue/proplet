# Dokončení společného lexikálního základu — 26. 9. 2026

Závazné upřesnění: https://github.com/prouza-hue/proplet/pull/148#issuecomment-5849652613.
Aktuální hlavní výstup: [úplný pracovní Lexikon v3](../../content/lexicon-v3/working/README.md).

## Uzavření zásoby

- 1 143 / 1 143 původních ID posouzeno a zapracováno: 1 142 přijetí + 1 oprava; 0 vyřazení a 0 odložení.
- 155 hotových posudků zachováno ve všech původních polích. Dalších 988 uzavřeno v šesti nepřekrývajících se dávkách, včetně moderního významu PLYŠÁKU.
- ZÁKRUTA → ZÁKRUT: doložený český mužský základ, stejné původní ID i význam; protievidence a omezení závěru zůstávají v posudku. Nejde o tvrzení absolutní neexistence vzácné české feminina.
- ZÁŠEVEK má samostatně přiznanou mezeru v nezávislém dokladu. Je zapracován na základě výslovného AI jazykového posudku k už schválené zásobě. Slabší doklady ostatních slov jsou jednotlivě v `source-limitations.json`; pravopis či rodinný vztah se nevydává za externí definici.
- Plná v3: 3 147 zachovaných v2 + 1 143 nových = 4 290 hesel. Předchozích 42 výluk zůstává: pro nové cíle 4 248 hesel. Historické štítky v2 nebyly nově auditovány.
- Uživatel schválil zásobu; jazyková revize a vhodnost pro profil jsou oddělené od produkčního schválení. `runtime_approved=false` znamená nevydáno.

## Kapacita a rozpoznávání

| Profil | Délka | Způsobilých | Z nové zásoby | Po původním filtru legacy fun≥3 |
|---|---|---:|---:|---:|
| easy | 4–6 | 805 | 350 | 805 |
| medium | 4–7 | 1 970 | 849 | 1 967 |
| hard | 4–9 | 3 835 | 1 120 | 3 760 |
| hardcore | 4–10 | 4 248 | 1 143 | 4 127 |
| mozkomor | 5–10 | 3 772 | 1 057 | 3 651 |

Jde o způsobilost podle původních délek a tierů, ne důkaz geometrické proveditelnosti či lidské obtížnosti. Kvóty i ostatní parametry existujících profilů zůstávají zachované v kapacitním souboru. Nová slova nemají vymyšlené skóre zábavnosti. Přehled uvádí délky, tiery, slovní druhy, původní témata i 21 sjednocených makrotémat. Neurčité historické skupiny zůstávají přiznaně smíšené.

Pro budoucí Mozkokalypsu III má rozsah 5–10 znaků 3 503 hesel bez přesných cílových slov prvních dvou kol; 1 390 z něj nebylo nalezeno v žádné zahrnuté historické bance. To není informace o osobní expozici hráčů. Náročný finální profil ani počet desek nyní nebyl vybrán.

Pracovní offline uznávání má 26 893 hesel, o 703 více než zmražená sada prototypu. Nic se nezapisuje do produkčního rozpoznávání. Staré solverové důkazy nejsou automatickým důkazem nad širší sadou.

## Ověření a prostředí

- `python tools/build_lexicon_v3_working.py --check`: deterministická reprodukce.
- `python -m unittest discover -s tests/lexicon_v3 -v`: 8/8 PASS. Kontroly pokrývají úplnost, zachování práce, výluky, schválení, typ tieru, profilové počty, rozšíření uznávání a absenci zápisu do chráněných vstupů.
- Nezávislá kontrola kódu odhalila neplatnou kontrolu víceznakového tieru; opraveno a kryto negativním testem. V datových výstupech takový tier nebyl.
- [Živá baseline](LEXICON-FULL-BASELINE-20260926.json): main i produkce stále `f04c99e2477c738a1de1880abcb7eb63388f9d71`, produkce READY. Změny navazují na pracovní SHA `10a1be264f19653777e49a74d6eceb5f8ccffce4`.
- Pouze soubory lexikálního základu, offline kompilátor, testy a dokumentace. Žádná nová deska, změna UI, DB dotaz či zápis, změna hráčského postupu, produkčního banku nebo runtime. Statické datové prostředí preview zůstává stejné; původní banka a důkazy beze změny.
- Základní produkční CI této preview větve má již dříve dokumentovanou nekompatibilitu statické Vercel konfigurace (SW hlavičky/cron); tato práce ji nemění ani nevydává PR za připravený k merge. Viz `CI-20260926.md`.

## Konkrétní selhání přístupů

Automatická kontrola oprávnění odmítla další jednotlivé dotazy do veřejného slovníku, protože by odesílaly kandidátní slova ze soukromého repozitáře. Dotazy byly zastaveny. Následovaly obecné veřejné slovníkové soubory bez odeslání slov či ID; porovnání a čtení proběhlo místně. Dříve dokončené odpovědi se používají jen se skutečným časem a rozsahem kontroly. Chybné/nenačtené odpovědi nejsou vydávány za důkaz.

Vercel `get_project(projectId=...)` selhal na nesouladu schématu konektoru: backend vyžadoval `idOrName`. Čtení aktuálního deploymentu přes alias `hrajproplet.cz` uspělo. Podrobnosti jsou v živé baseline. Žádné nastavení projektu se neměnilo.

## Otisk

SHA-256 úplného `content/lexicon-v3/working/lexicon.json`:

`7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277`

Další vstupní a výstupní otisky: `content/lexicon-v3/working/manifest.json`. PR #148 zůstává draftem; tento výsledek není merge ani souhlas s produkčním nasazením.
