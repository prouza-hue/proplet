# Měsíční soutěž jednotlivců — návaznost na nové Pořadí

Ověřeno 27. 10. 2026. V této UI iteraci se měsíční soutěž nespouští; jde o dohledání rozpracovaného návrhu pro další práci.

## Zachovaný zdroj

- Konverzace **Archiv zadání a preview**, ID `6ac222df-2838-83ed-a493-3e15a5431606`.
- [PR #188](https://github.com/prouza-hue/proplet/pull/188), otevřený draft, nesloučený. Větev `preview/archive-integrated-20261009`, SHA `20428b4d5a43a8ea2c4ac6099deb47592f2ef889`.
- [Vizuální prototyp](https://github.com/prouza-hue/proplet/blob/20428b4d5a43a8ea2c4ac6099deb47592f2ef889/public/app/archive/season-view.js) obsahuje ukázkové hráče a výsledky bez síťových nebo úložných zápisů. Připravené jsou scénáře první sezóny, minulého pódia, společných vítězství a předběžných výsledků.
- [Rozhodnutí o odděleném vydání](https://github.com/prouza-hue/proplet/blob/main/docs/design/archive-first-release-2026-10-13.md): Archiv a soutěž oddělit, soutěž plánovat na listopad. Historický plán není schválením produkčního spuštění.

## Již rozhodnutá pravidla

První platné dokončení základní Denní výzvy v den vydání: 100 bodů a dalších 20 bez nápovědy. Počítá se nejlepších 20 dnů, nejvýše 2 400 bodů. Rychlost ani celoživotní XP nerozhodují. Shody používají pořadí 1–1–3. Odměnou jsou odznaky, nikoli XP.

## Začlenění do nového UI

Vlastní pohled **Měsíční soutěž** vedle Výzva / XP / Týdenní soutěž. Zachovat významové odlišení: základní denní výkon, XP, týmový týden a individuální měsíc. Původní prototyp již používá návrat do Pořadí. Převzít rozhodnutá pravidla, odznaky a scénáře; přizpůsobit navigaci, plochy a typografii současné Tiskařské dílně.

Čtvrtou položku při realizaci ověřit také na 320 px a Foldu; nyní se nezobrazuje nefunkční záložka. Neslučovat historický PR jako celek: vychází ze staré verze aplikace a obsahuje tehdejší archivní práci.

## Nutné ověřit a dokončit před spuštěním

Samostatnou serverovou evidenci bodů, uzávěrku po 48 hodinách, shodná pořadí, přidělení odznaků, skutečná data pódia a produkční přepínač. Před implementací znovu ověřit aktuální backend a ostatní rozpracované větve, aby se neduplikovala mezitím dokončená práce. Při této kontrole na produkčním SHA `aabf24c76a37b6b89f4d2a050267dd0339f372cc` měsíční prezentační modul přítomen nebyl.

## Doplnění zdroje odměn — 28. 10. 2026

Výše uvedený PR #188 není úplným zdrojem posledního schváleného výtvarného zpracování. Navazující chat **Dokončení archivu a preview**, ID `6ace7db0-b2c8-83ed-bd7f-4a4f19714eb9`, dokončil vlastní ilustrace Krále, Rytíře a Knížete pro listopad i prosinec, upravené hlášky a rozklikávací kolekce. Poslední zdrojový commit je `edca88a6a201890d31c779f0be824288809fc3aa`, větev `preview/monthly-competition-20261014`. Přesné assety jsou obnovené v `public/rewards/monthly/2026-11` a `2026-12`; katalog a ověřená provenience jsou v `docs/design/monthly-awards-recovery-20261028.md`. Generické medaile nesmějí tyto schválené postavy nahrazovat. Pozdější současné zadání nadále určuje 100/120 bodů, nejlepší dvacítku a společná místa; historické výpočty se s výtvarnou obnovou nepřenášejí.
