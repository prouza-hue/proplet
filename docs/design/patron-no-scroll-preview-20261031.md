# Patronství — izolované no-scroll preview

31. 10. 2026. Samostatná větev `codex/patron-no-scroll-preview`, základ `5901a3626cea6d171d9b938080e74a5f7310e5bc`. Není součástí listopadového vydání ani jeho automatizace.

## Rozsah

Skutečný současný shell Propletu, styly, profil, navigace a výsledkovka jsou doplněné o kompaktní vstup v profilu, jednorázový QR průchod, poděkování a dobrovolnou inkoustovou značku v pořadí. Žádný nový finanční ukazatel na Dnes ani v hlavičce. Částky 99/199 Kč jsou pracovní návrh; vlastní částka 1–100000 Kč je pouze lokální ukázka. Bez karetního předplatného, provozních rozpočtů, finančních cílů a vymyšlených nákladů.

Značka je stejná pro všechny částky a veřejně se zobrazí až po výslovném zapnutí. Nenabízí XP ani jiné herní výhody. Přijetí příspěvku lze simulovat pouze v odděleném ovládání náhledu. Hráčské rozhraní nemá tlačítko, které by potvrzovalo vlastní platbu.

## Izolace

`vercel.json` sestavuje výhradně `public/**` pomocí `@vercel/static`. Neobsahuje backend, proměnné ani crony. `/api/*` a `/sw.js` vracejí 404. Kořen odkazuje na `patron-preview.html`; `index.html` hry zůstává zdrojovým podkladem beze změny.

První dva skripty stránky jsou původní izolátor a fixture adaptér z no-scroll návrhu. Adaptér má samostatný storage prefix, modelový účet a lokální API odpovědi. Izolátor blokuje odchozí API/externí požadavky, analytické beacony, service worker, sdílení a další externí transporty. CSP dovoluje pouze vlastní statické zdroje; formuláře nesmí odesílat data. Tato větev nesmí být sloučena celá do produkce: její statická hostingová konfigurace je určená jen k posouzení.

QR je znovu vytvořený standardním generátorem z explicitního neplatebního textu původního preview. Vstupní payload byl ověřen. Obsahuje pouze `PROPLET-PREVIEW-NEPLATIT`; nejsou přítomné bankovní údaje. Zkopírovaný text je rovněž výslovně ukázkový. Skutečné platby, párování a entitlements nejsou implementované.

## Náhledy

- `/patron-preview.html?state=complete&theme=light&view=offer`
- `?state=complete&theme=dark&view=result`
- `?state=complete&theme=light&view=ranking`
- `?state=complete&theme=light&view=profile`

Tlačítko „Náhled patronství“ otevírá oddělené scénáře, potvrzení příspěvku, návrat do výchozího stavu a změnu motivu. Poděkování a volba veřejné značky se uchovávají pouze v izolovaném lokálním úložišti náhledu.

## Kontroly

Syntaxe modulu a fixture, validita JSON, guard před všemi nativními skripty, zákaz API/SW/cronů, nulové fetch volání samotného patron modulu, neplatební kopírované údaje a zachované runtime soubory jsou ověřené. Vizuální a interakční kontrolu provádí rodičovský úkol v browseru na mobilu, Foldu a desktopu; nepředstavuje test fyzického telefonu. Herní ekonomika, serverové funkce a produkční data se nemění.

Ilustrace `/assets/support/patron-letterpress-v1.webp` vznikla přes imagegen v rodičovském úkolu; nový inkoustový otisk srdce je oddělený od získaných herních odznaků.


Rodičovský browser QC: 390 px nabídka, vlastní částka 150 Kč → QR → kopírování → návrat; 320 px tmavý QR bez vodorovného přetékání (svislý obsah dostupný scrollováním); 768 px tmavé pořadí po výslovném zapnutí veřejné značky; profil; 1440 px tmavá nabídka. Opraven předčasný text poděkování v QR kroku, fokus při otevření a změně kroku, individuální poděkování konkrétnímu podporovateli a fixture avatar Matěje. Veřejná značka je výchozí vypnutá. Jde o emulované viewporty a lokální syntetická data, žádné skutečné přijetí platby.
