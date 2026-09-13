# Nová cesta hodnostmi — preview

## Dva cíle

1. Uspořádat názvy: první kroky → mistrovství → velmistři a strážci → vesmírné hodnosti → legendy.
2. Zkrátit mezery: 35 → 51 hodností, 16 vložených mezistupňů, maximální rozestup 25 000 → 5 000 XP.

Kompletní staré a nové pořadí včetně XP a přiřazených kreseb je v `plan.json`. Pro uživatelskou kontrolu slouží `/design/rank-progression.html`: interaktivní přepočet podle XP, celé pořadí i původní název u každé zachované hranice. Herní `LEVELS` i katalog obrázků již obsahují novou řadu.

## Podklady pro tempo

Souhrn nad produkční tabulkou `results`, dokončení 7.–13. 9. 2026 podle Prahy. Skupiny podle součtu bodů ze všech výsledků. Nezahrnuje odměnu za účet ani bonusy za objevená slova. Jeden aktivní den znamená den hráče s alespoň jedním uloženým výsledkem. Nejde o medián všech účtů ani o kalendářní dobu.

| Skupina | Hráčů | Aktivních hráčských dnů | Medián XP / aktivní den |
|---|---:|---:|---:|
| Pod 10 000 XP | 40 | 95 | 225 |
| 10–30 tisíc XP | 11 | 59 | 800 |
| Nad 30 tisíc XP | 7 | 46 | 1 082,5 |

Poslední původní skok 95 000 → 120 000 představuje při tempu poslední skupiny asi 23 aktivních dnů. Nové kroky v této oblasti mají 5 000 XP, přibližně 5 aktivních dnů. Vzorek je malý a aktivita nerovnoměrná; tato úprava je návrh herního tempa, nikoli prokázané zlepšení retence.

Za samotnou Daily je 100 XP, za Tajenku 200 XP, za volné úrovně 15 / 25 / 50 / 100 / 150 XP podle obtížnosti. Pro člověka hrajícího jen Daily by i nový největší krok představoval 50 dokončení. Jeho kratší cíle jsou souběžné série a odznaky, nikoli stejně rychlé vysoké hodnosti jako u intenzivně hrajících lidí.

## Dopad na současné hráče

- Zachováno všech 35 existujících XP hranic. Žádnému hráči neklesne číselná úroveň ani se nevzdálí nejbližší XP hranice.
- Názvy se přepočítají podle nové řady. Starý Absolutní Propletač od 61 000 XP není zachován jako individuální titul. Nově je tento titul na 115 000 XP; Legenda Propletu na 110 000 XP a Legenda bez konce na 120 000 XP.
- Například při 67 352 XP: dříve úroveň 32, Absolutní Propletač, dalších 7 648 XP; nově úroveň 40, Mistr hvězdných cest, dalších 3 148 XP.
- XP, uložené výsledky, pořadí hráčů podle XP a dosažené odznaky se nemění. Žádná migrace ani zápis do databáze.
- U nových hodností použity existující ilustrace odznaků ze stejné kolekce. Návrh nepřidává soubory kreseb ani nové vykreslovací smyčky.

## Souběžné odměny

Odznaky za XP pokrývají např. 10 000, 25 000, 40 000, 50 000, 61 000, 75 000, 95 000 a 120 000 XP. Na konci se shodovaly s hranicemi hodností, takže mezeru 95–120 tisíc samy nevyplňovaly. Nová řada vkládá 100 / 105 / 110 / 115 tisíc XP. Ostatní odznaky závisí na režimu, čistotě řešení a sérii; nelze je garantovat každému hráči jen podle XP. Jejich pravidla tento návrh nemění.

## Ověření a nasazení

Test všech 51 hranic těsně před dosažením i při dosažení; úplnost katalogu, celé názvy po doplnění ikon, stabilita opakovaného vykreslení, zachování starých hranic a absence numerického propadu pro současné hráče. Nasazení pouze na preview větvi `feat/rank-progression`; produkční `main` zatím zachovává původních 35 hodností.
