# Mozkokalypsa — sedm stupňů nezlomnosti

Implementováno na žádost Pavla ze 4. 10. 2026. Výchozí main 5ac8210; souběžná oprava výkonu a Android Back 9824916 byla zachována.

| Různé dokončené desky | Název | Motiv |
| --- | --- | --- |
| 1 | První trhlina | Rozlomený měděný monolit, světlo v prasklině |
| 5 | Za bodem zlomu | Rozbitá brána, cesta skrz |
| 10 | Oko bouře | Klidné oko uvnitř rotující bouře |
| 25 | Krotitel pohromy | Vír sevřený čtyřmi svorkami |
| 50 | Nezlomná mysl | Zlacený štít s chráněným mozkem |
| 75 | Vládce epicentra | Vír pod kontrolou v orbitálním prstenci |
| 100 | Poslední slovo | Koruna, vavříny a zkrocený vír |

Měď, tmavý inkoust, zlatá a papírová světla navazují na ilustrace Propletu. Každý stupeň má samostatnou siluetu. Ilustrace jsou původní SVG vytvořená v kódu, bez bitmap, filtrů, skriptů a animací. Sedm aktiv celkem zabírá přibližně 31 KB bez komprese. Generátor je tools/generate_mozkokalypsa_achievements.py.

Odemykání používá existující effectiveStats().freeCompleted.mozkokalypsa a původní mechanismus achievementů. Již dohrané desky se započítají automaticky, bez zápisu bonusových XP a bez migrace. Nápovědy ani klidný režim neznevýhodňují. Playtest není mode=free a do této série nepatří; opakování stejného slotu počet nezvyšuje. Terminální podmínka je pevně 100 různých desek, nikoli proměnlivé „všechno“, takže přidání obsahu odznak neodebere.

Integrace: profil, souhrn achievementů, oznámení po dohrání a offline shell. Nová série používá 58px ilustrace v profilu, ostatní odznaky zůstávají ve svých velikostech. Žádný nový polling ani observer.

Interaktivní galerie: /design/mozkokalypsa-achievements.html. Má vlastní simulovaný počet, světlý/tmavý režim a skutečné malé velikosti 24/34/58 px; nečte ani nepřepisuje herní postup.

Ověření: tests/current/test_mozkokalypsa_achievements.js a tools/verify_mozkokalypsa_achievements.cjs. Prohlížeč běží nad izolovaným serverem bez produkčních credentials a pořizuje důkazy pro 320, 390, 840 a 1440 px. Emulace není testem fyzického Samsungu Fold.
