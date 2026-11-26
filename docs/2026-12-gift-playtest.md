# Ještě jeden plech · nezávislé odehrání

26. 11. 2026. Druhý řešič dostal z prosincové sady jen názvy, rozměry, masky, písmena a požadované délky. Cílová slova ani uložené trasy při hledání nepoužil. Vyjmenoval ortogonální tahy bez opakování polí a sestavil úplná pokrytí podle počtů jednotlivých délek. Pro tento druhý průchod použil sjednocení herního souboru `data/words.txt` a binárního rozpoznávače `public/recognition/bonus-cs-v1.dawg`.

| Kapitola | Rozpoznané slovní trasy platné délky | Úplná pokrytí | Nalezená slova s právě jednou trasou |
|---|---:|---:|---:|
| Váleček | 18 | 1 | 5/5 |
| Formička | 11 | 1 | 4/4 |
| První plech | 51 | 1 | 5/5 |
| Linecké | 57 | 1 | 5/5 |
| Poslední kousek | 15 | 1 | 5/5 |

Nejčitelnějším vstupem do Válečku je máslo na levém držadle. Ve třetí kapitole je snadný PAPÍR v řádku, pak přijde hledání zatáček TROUBY. U Lineckého se dá začít krátkým CUKR nebo DŽEM na okraji. Devítipísmenná MARMELÁDA vede po třech stranách skutečného otvoru 2 × 2. Finále má krabici po obvodu a uprostřed zůstává právě SOUSTO.

Nalezené cesty prošly skutečným ovládáním hry v lokálním náhledu v Chromiu. Ve čtyřech čistých profilech (360 × 740 a 690 × 829 CSS px, každý světlý a tmavý) prošlo všech pět kapitol, výběr lehké nápovědy v první kapitole i opakování první desky. Všech 20 prvních dohrání zobrazilo 300 osobních XP, všechna čtyři opakování zobrazila dohrání bez dalších XP. Nikde se neobjevil vodorovný posuv. Rozložený Fold umístil ovládání vedle mřížky a udržel ji celou viditelnou. Test proběhl v prohlížečové emulaci s náhledovým účtováním XP. Kontrola skutečné databázové transakce patří do samostatného integračního testu.

V náhledu prosby se zobrazila testovací částka 420 Kč na úzkém mobilu i Foldu. Klepnutí otevřelo další krok náhledu bez skutečné platby.

Na displeji 320 × 700 byla první verze Válečku stísněná (26,8 px na políčko). Po zmenšení mezer a okraje mají políčka 28,9 × 28,9 px. Všechny zatáčky a konce držadel prošly i emulovaným dotykem přes Chromium DevTools Protocol; odměna se po tahovém odehrání s nápovědou zobrazila.
