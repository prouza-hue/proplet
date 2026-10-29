# Obnovení schválených měsíčních odznaků

Ověřeno 28. 10. 2026. Schválené odznaky byly dohledány v chatu **Dokončení archivu a preview**, ID `6ace7db0-b2c8-83ed-bd7f-4a4f19714eb9`. Uživatel schválil mapování Král = zlato / Rytíř = stříbro / Kníže = bronz, samostatné postavy pro každý měsíc a následně živější situační humor. U prosincového rytíře výslovně opravil druhou větu na „Zatím chybí šest kousků.“

## Přesný zdroj

- Větev `preview/monthly-competition-20261014`.
- Commit `edca88a6a201890d31c779f0be824288809fc3aa`.
- Vercel deployment `dpl_8Cyyh1FVERiL2qPxBZinhJtsQFEW`, stav READY, preview.
- [Původní prosincová kolekce](https://proplet-23rhw4mgs-pavel-prouzas-projects.vercel.app/?open=monthly&panel=awards&collection=2026-12).
- Původní assety `public/rewards/monthly/2026-{11,12}/{king,knight,prince}-v1.webp` byly obnoveny bez změny jediného bajtu. Všech šest lokálních Git blob hashů odpovídá uvedenému zdrojovému commitu; všechny obrázky byly vizuálně prohlédnuty.
- Původní názvy a hlášky byly v `public/app/monthly/review.js`. Přesná kopie zdrojového souboru je uchována jako text v `release-evidence/monthly-approved-review-edca88.js.txt`; jeho staré skórování se neimportuje ani nepoužívá.
- Schválené názvy, hlášky a odkazy jsou samostatně vytaženy do `public/rewards/monthly/collections.json`. Tento katalog obsahuje pouze ocenění, nikoli pravidla nebo výsledky.
- Původní popisy výroby a prompty jsou zachovány v `monthly-badges-november-2026.md` a `monthly-collections-2026-10-14.md`. První dokument zachycuje dřívější listopadovou fázi; prosinec byl následně dokončen v druhém dokumentu a uvedeném commitu.

## Obnovený obsah

| Kolekce | Místo | Odznak | Hláška |
| --- | --- | --- | --- |
| Listopad 2026 | 1. | Král listopadu · kaštanový panovník | K čemu že máte ty špejle? Postavičky jdete dělat? Krále nechte na pokoji! |
| Listopad 2026 | 2. | Rytíř listopadu · stříbrné brnění s dubovým chocholem | To brnění je moc pěkné, ale mohlo být nepromokavé. |
| Listopad 2026 | 3. | Kníže listopadu · žaludový šlechtic | Veverka že mě sháněla? Řekněte jí, že jsem na dovolené. |
| Prosinec 2026 | 1. | Král prosince · perníkový král | Prosím vystavit. Neochutnávat. |
| Prosinec 2026 | 2. | Rytíř prosince · vykrajovátko se skořicovým mečem | Letos hlídám cukroví. Zatím chybí šest kousků. |
| Prosinec 2026 | 3. | Kníže prosince · zvoneček | Cinknu jen jednou. Doma už všichni spí. |

Historický chat obsahuje také tehdejší návrh skórování 80/20 a rozstřelů. Tyto části jsou překonané aktuálním zadáním: první platná základní Daily v den vydání, 100/120 bodů, nejlepší dvacítka a společná místa. Obnovení grafiky nemění soutěžní pravidla, backend ani databázi. Nevznikaly žádné nové ilustrace.

Listopadové hlášky upraveny přesně podle uživatelského znění schváleného 29. 10. 2026; prosincové texty a všechny ilustrace zachovány.
