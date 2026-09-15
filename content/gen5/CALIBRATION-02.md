# Druhá kalibrace: snadná a střední

Podnět: hráč ocenil pestrost, ale snadnou řešil přibližně dvě minuty a střední
vnímal téměř jako současnou těžkou. Těžká, Mozkožrout a Mozkomor byly hodnoceny
jako vhodné. Jejich profily ani původní pilotní desky se v této úpravě nemění.

| Parametr | Snadná před → nyní | Střední před → nyní |
|---|---|---|
| Rozměry | 6×6 → 5×5 | 8×8 → 7×7 |
| Aktivní políčka | 29–34 → 20–24 | 38–43 → 30–35 |
| Počet slov | 5–6 → 4–5 | 7–8 → 6–7 |
| Délky slov | 4–7 → 4–6 | 4–8 → 4–7 |
| Maximum zatáček na slovo | 2 → 1 | 8 → 2 |
| Maximum průměru zatáček | 1,35 → 0,85 | 2,35 → 1,5 |
| Maximum skóre lokálních alternativ | 20 → 9 | 14 → 10 |
| Podíl třídy B | žádná, pouze A | 45–75 % → 25–50 % |

Limity celkového opakování a odstupy slov zůstávají. Snadná může použít až tři
čtyřpísmenná slova místo dvou, ale není povinné je přidávat; pestrost má zajišťovat
evidence používání, nikoli vynucování delších slov na úkor přívětivosti.

Nový pilot obsahuje tři snadné a tři střední desky. Všech šest prošlo nezávislou
kontrolou. Snadné mají 20–21 políček, čtyři slova a průměrně 0,5–0,75 zatáčky;
střední 30–32 políček, šest slov a průměrně 1,17–1,5 zatáčky. Jde o nový návrh
k lidské kalibraci, nikoli doložené časy dohrání.

Znovu prošlo 27 unit testů i všechny tři slovníkové simulace 450 sad. Vyšší profily
byly porovnány s předchozí verzí a jsou shodné. Produkční obsah se neměnil.

Galerie nyní měří čas od prvního výběru písmene, pozastavuje jej při skrytí
stránky a zastavuje po dohrání. Reset či změna desky čas vynuluje. Odhalení
řešení označí čas jako nesrovnatelný se samostatným hraním. Čas se neposílá ani
neukládá na server. JavaScript prošel syntaktickou kontrolou; vizuální kontrola
v integrovaném prohlížeči zůstává neprovedená kvůli blokování místních souborů.

Ukázka: `lab-output/gen5/calibration-02/index.html`.
Verzované důkazy: `evidence/calibration-02-pilot.json`,
`evidence/calibration-02-report.json`, `evidence/calibration-02-capacity.json`.
Předchozí pilot zůstává dostupný pro srovnání. Další rozhodnutí má vycházet
z hraní těchto šesti nových desek.
