# Propletené stuhy — kompletní kolekce / preview 02

Pracovní větev: ux/propletene-stuhy. Základ warm-paper: 7a72d3018f050dead9b2be2e02a4a7185f777ea9.
Schválený pilot: aff3cefe3e767d8df0e274e30be0b480ca57027e. Jeho SVG soubory jsou byte-identické.

## Implementováno
- Všech 35 hodností, 90 achievementů ve 14 rodinách, 10 věrnostních odznaků a 3 medaile.
- Čtyři samostatné herní symboly: dokončení, denní výzva, série, odhalená tajenka. Nejsou novými odměnami.
- 572 čistých SVG souborů: 142 motivů × dvě témata × dvě optické velikosti a čtyři schválené zamčené varianty Prvního Propletu.
- Malá kresba pro 24/32 px; běžná pro 40/64 px. Širší ploché pásy, odkryté otvory, lokální přehyby, bez bitmap, fontových závislostí, glow a filtru textury.
- Kategorie oddělují stejnojmenné odměny: achievement Blesk není streak Blesk.
- Profil, přehled úspěchů, věrnost, Dnes, medaile v denním i XP pořadí, hodnostní štítky v pořadí a výsledkové odměny používají společný katalog.
- Symbol série nepřebírá sedmičku z týdenního odznaku; neoznamuje nezasloužený milník.
- Zamčené motivy mají neutrální materiál a zámek, aktuální hodnost funkční zelený akcent. Obrysy karet netlumí důležité texty.
- Vzorník /design/rewards.html ukazuje celou kolekci, obě témata, zamčení a 24/32/40/64 px. Je jasně oddělený od skutečné hry.

## Ověření
- Striktní XML a interní SVG reference všech 572 souborů; úplné mapování všech názvů z aktuálního app.js; zachování schválených SVG.
- Regresní testy game interaction, daily progression, service-worker lifecycle a update handshake PASS.
- Živý desktop: v rozbaleném profilu 147 výskytů nových motivů a nula původních proplet-rank-art/proplet-ach-art.
- Živý desktop: 6 nových medailí ve dvou sekcích pořadí a 17 nových hodnostních štítků. Viditelné odměny se načítají; horizontálně vzdálené hodnosti se načítají odloženě.
- Světlé/tmavé motivy prohlédnuté v galerii a profil v živé hře; celá kolekce kontrolovaná v přímém SVG renderu.
- Mobil/Fold NEJSOU zatím označeny jako ověřené: ovládání browseru neposkytuje změnu viewportu, vložení hry do pomocného iframe server odmítá. Neúspěšný diagnostický rám odstraněn; ochranné hlavičky nezměněny.

## Přejímka na zařízeních
Na telefonu, rozloženém Foldu7 a laptopu v obou tématech: Dnes → Hrát → rozehraná hra → výsledek → Pořadí → Já (rozbalit všechny úspěchy) → Nastavení. Na Foldu změnit složení během rozehrané hry, zkontrolovat čitelnost, dotykové výběry a výsledek. Prohlédnout i barevné zamčené/odemčené protějšky ve vzorníku.

## Zachované hranice
Žádné změny avatarových assetů ani jejich rendereru. Beze změn app.js, pravidla, názvy, XP, databáze, Supabase, main a produkce. Nasazení pouze preview.
