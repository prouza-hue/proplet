# Navazující UI plán — 27. 10. 2026

Platí pro `codex/today-one-screen` a samostatné Vercel preview. Produkční nasazení není schválené. P1/P2 jsou priority původního auditu, ne povinnost znovu navrhovat již fungující obrazovky.

## P1 — implementováno, nyní posoudit v preview

- Přihlášení, registrace, navigace Pořadí, přehled Já a návraty z Nastavení jsou hotové z předchozích iterací.
- Výsledkovka zachovává odstranění duplicit i obnovenou bonusovou pozvánku. Od šířky 600 px využívá dostupnou šířku až do 880 px, větší nadpis, řádky pořadí a hlavní tlačítko. Mobilní rozměry zůstávají zachované.
- Dnes od 600 px používá nižší hlavní panel s týdenním rytmem vedle něj a čtyřmi herními vstupy pod ním. Dokončená výzva už není roztažená do výšky dvou řad. Krátký Fold používá kompaktní vodorovné vstupy, aby zůstala viditelná i patička. Pod 600 px se schválená mobilní kompozice nemění.

## P2 — připravené pořadí pokračování

1. **Více úspěchů získaných současně.** Nejprve izolovaně zobrazit skutečné komponenty pro jeden, tři a více nových úspěchů. Pokud dlouhý seznam zastiňuje pokračování hry, vyzkoušet jeden hlavní artefakt a kompaktní dostupný přehled ostatních. Zachovat všechny získané položky, jejich detail, odměny a evidenci zobrazení. Přijímací kontrola: další herní akce dostupná na 320 px a krátkém Foldu, žádný úspěch nezmizí.
2. **Krátké vysvětlení důsledku nápovědy.** Ověřit současné texty pro soutěžní, klidný a tréninkový režim. Upravit jen případné chybějící vysvětlení. Zachovat současné tři možnosti, potvrzení a kreslení cesty; neplánuje se redesign herní desky ani změna pravidel.
3. **Cílené finální detaily.** Opravit pouze konkrétní prokázané nedostatky v kontrastu, fokusu, zarovnání či omezeném pohybu. Nevytvářet další komponenty nebo kosmetické změny jen kvůli vyčerpání seznamu.

Každý bod nejprve dostane reprezentativní funkční stav v izolovaném preview, potom úzkou implementaci na stejné preview větvi a odpovídající ověření. Pořadí je 1 → 2 → 3; další produkční krok vyžaduje výslovné schválení.

## Samostatné prověření, nikoli automatická změna

Četnost a návaznosti pobídek (účet, push, instalace, pozvánka) nejprve porovnat s platným onboardingem, cooldowny a návraty do hry. Původní audit tento okruh oddělil od vizuálního dotažení. Bez takového ověření se časování, preference ani podmínky zobrazení nepřepisují.

## Již dokončené P2

Hlášení chyby a slova, přímé stavové texty pořadí, funkční prázdný přehled úrovní, katalog trofejí a vysvětlení archivních odměn jsou hotové. Není důvod je znovu otevírat bez konkrétního nálezu.

## P2 — dokončeno v ui-refinement4

- **Více současných úspěchů:** jedna hlavní získaná odměna, ostatní původní položky v rozbalovacím přehledu s počtem. Zachovány skutečné ilustrace, detaily, klávesnicové ovládání a vzácná oslava Mozkokalypsy. Hlavní pokračování zůstává nad odměnami. Ověřeny stavy 0, 1, 3 a 10; pouze modelové vykreslení v izolovaném preview, bez přidělení XP či změny hráčského postupu.
- **Důsledek nápovědy:** krátká věta pro běžnou hru, Denní a Extra. Trénink a Tajenka ji nezobrazují. Nezměněny volby, cílení, čítače, nárok na odměny ani herní deska.
- **Konkrétní vizuální detail:** přepínače Výzva / XP / Týdenní soutěž mají zřetelný tvar tlačítek, vybraný stav, hover a fokus. Pořadí používá stejnou šířku jako soutěž, takže přepínač při změně pohledu neposkakuje do stran.

Plný gate 191 testů, 172 kontrol assetů a 522 kontrol syntaxe prošel. Poslední kosmetická úprava mezery u textu nápovědy ověřena v prohlížeči, následně release kontrakt a assety znovu cíleně. Produkce v této iteraci beze změny; výchozí ověřený produkční SHA je nyní `aabf24c76a37b6b89f4d2a050267dd0339f372cc` z nezávislé práce mimo tuto preview větev.

Měsíční soutěž jednotlivců byla dohledána jako rozpracovaný vizuální prototyp; její přesné zdroje, pravidla a zbývající produkční kroky jsou v [předání měsíční soutěže](monthly-competition-ui-handoff-20261027.md). Časování pobídek zůstává samostatným prověřením, nikoli automatickou úpravou tohoto UI vydání.
