# Propletené stuhy — integrační preview 01

Základ: ux/warm-paper-refactor, 7a72d3018f050dead9b2be2e02a4a7185f777ea9.
Pracovní větev: ux/propletene-stuhy. Produkce a main nejsou cílem nasazení.

## Hotovo
- Schválená pilotní osmička: 32 SVG (světlá/tmavá, malá/běžná).
- Zapojení odpovídajících hodností, úspěchů, věrnosti, zlaté medaile a výsledkových odměn.
- Sémantické barvy profilových stavů, ovládání a výsledku; samostatné tmavé povrchy.
- Okamžitý aktivní tah, zachování barvy nalezené cesty, 420ms usazení slova s rozestupem 24ms (max72ms), lokální chyba a reduced-motion.
- Oprava neplatných SVG uvozovek a opakované výměny již hotových ikon při DOM observeru.

## Ověření
- 32 SVG: striktní XML, uzavřené interní reference, bez externích obrázků/písma.
- Regresní testy game interaction, daily progression, service-worker lifecycle a update handshake prošly.
- Živý desktopový browser: návrat do uložené Snadné1 po aktualizaci; sedm slov, sedm tahů; výsledek +15XP a tři úspěchy. Nováček, První Proplet a zlatá medaile vizuálně načteny.
- Mobil a Fold7 dosud NEMAJÍ dokončené browserové ověření. Responzivní CSS samo není důkaz testu.

## Otevřeno před komplexním přejímacím preview
- Ostatní ze 35 hodností, 90 achievementů a 10 věrnostních odznaků používají původní ilustrace. Pilotní osmička není kompletní kolekce.
- Stříbro/bronz a další reward kontexty vyžadují jednotné pokračování schválené konstrukce.
- Dokončit vizuální kontrolu všech obrazovek a stavů v obou tématech, skutečné šířky telefonu/Foldu/laptopu a změnu šířky během hry.
- Ověřit malé velikosti v reálných kontextech a kompletní práci se stavem zamčeno/splněno.
- Toto je funkční integrační preview, nikoli hotový komplexní redesign.

Neměnit avatary, názvy, ekonomiku, pravidla ani databázi.
