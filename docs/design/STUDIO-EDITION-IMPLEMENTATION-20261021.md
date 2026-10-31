# Studio Edition — implementace k posouzení

21. října 2026. Uživatel vybral Studio Edition a autorizoval samostatnou implementační větev a funkční preview. Produkční nasazení neautorizoval. Zásadní doplnění: zachovat nynější herní desku a nepřidávat generické texty typu „Slova se skládají“.

## Základ a rozsah

- Větev `codex/studio-edition`, základ `9f8ae24bc4dc121e7e554f7aac370fada8c8b16d`, produkce v4.09.12. Před prací ověřen GitHub main i Vercel alias hrajproplet.cz.
- Skutečné `public/index.html`, `app.js` a současné komponenty; žádná náhrada aplikace návrhovým HTML.
- Dnes: hlavní Daily, samostatný sekundární vstup Extra, po Daily automaticky hlavní Extra, po dokončení obou výzev vstup do Volné hry. Výsledek Daily zůstává dostupný s aktuálním časem/tahy a stavem synchronizace.
- Pozvánky: odstraněna trvalá propagace z Dnes; příchozí pozvánka, průběh slíbené odměny a její potvrzení zůstávají. Profil a sdílení výsledku používají původní handlery.
- Dnes má jeden vlastník pořadí stabilních DOM uzlů, kompaktní vstup do Hrát a skutečný hráčský souhrn. Archiv zůstává na Hrát. Zůstávají platné pokračování hry, záchrana série a legitimní pozvánky do playtestu.
- `studio-edition.css` je ohraničená vrstva pro neherní obrazovky. Teplý tmavý podklad, Fraunces nadpisy, otevřené sekundární položky, desktopová navigace v hlavičce a mobilní navigace dole.
- Herní `board.js`, `input.js`, `hints.js`, `state.js`, `fair-play.js`, `game.css`, `game-release-polish.css` a `ribbon-ui.css` beze změny. Veškerá nová geometrie/písmo/povrchy jsou pod `body.studio-edition:not(.playing)`; při hraní platí původní vzhled včetně barev.
- Nové a změněné soubory mají koordinované cache URL a shell `proplet-v4.09.12-studio1`. Není to prohlášení o vydání nové produkční verze.

## Funkční izolované preview

```powershell
node tools/studio-preview/build.cjs
node tools/studio-preview/serve.cjs
```

Výstup se generuje mimo checkout do `../studio-preview-public`. Výchozí server běží na `http://127.0.0.1:8892/`. Ovládací proužek preview umožňuje přepínat téma, testovacího hráče, stav dne a typ Extra.

```text
?account=member&state=ready&extra=hardcore&theme=dark
?account=member&state=done&extra=hardcore&theme=light
?account=member&state=complete&extra=hardcore&theme=dark
?account=guest&state=ready&extra=none&theme=light
?account=incoming&state=ready&extra=hardcore&theme=dark
```

Adapter je pouze v generovaném preview, nikoli v produkčním indexu. Daily a Extra používají zveřejněné volné desky s označenou testovací identitou. Všechny API odpovědi jsou lokální, skutečné API/zápisy, externí fetch, XHR, beacon, sockety a service worker jsou blokované. Nativní hra vyhodnocuje skutečné tahy, nápovědy, postup i výsledkovku; cloudové a účetní služby jsou testovací model, nikoli skutečný účet. Neověřený čas je přiznaný jako neověřený. Storage je oddělený podle scénáře a účtu. Výchozí původní aplikaci pro srovnání připraví `node tools/studio-preview/baseline.cjs`.

## Ověření

- Aktuální runtime gate: **177 PASS / 0 FAIL**, assety **170 PASS / 0 FAIL**, syntaxe **515 PASS / 0 FAIL**. Běh v izolovaném LF snapshotu přesně odpovídajícím Git blobům a změnám. Windows CRLF nejprve způsobily kontrolní součty mimo očekávání; zdrojové banky ani migrace nebyly kvůli testu měněny. Jediné skutečně zastaralé očekávání o odstraněné domácí ranking cache nahrazeno ověřením aktuálních statistik po změně účtu a nulového dodatečného ranking fetch.
- `node tools/studio-preview/verify.cjs`: přijaté Daily/Extra deskriptory, testovací potvrzení dokončení i odmítnuté potvrzení, jednorázové seedování, oddělení účtů/storage a síťová izolace PASS.
- V browseru reálnými pointer tahy dohrána Daily (7 slov, +100 XP) a Extra (11 slov, +200 XP). Ověřen návrat a pokračování s jedním nalezeným slovem, skutečná výsledkovka, automatické povýšení Extra a finální akce Volná hra při celkem 300 XP.
- V browseru spuštěno všech šest obtížností z pravých tlačítek Hrát a návrat do katalogu; otevřen skutečný Archiv i profil.
- Dnes ověřeno v obou tématech při nominálních šířkách 1440/768/390/344/320 CSS px a navíc done/complete/guest/no-Extra/incoming scénáře; bez vodorovného přetečení. Windows scrollbar může odečíst 15 CSS px z vnitřní šířky.
- Herní geometrie porovnána proti původnímu základu se stejnou fixture: rozměry, písmo, padding, mezery a barvy shodné při 390/320/768/1440. Při snímání původního vstupního přechodu byl rozdíl svislé transformace menší než 1 px; žádný nový herní styl se neuplatnil. Nejde o test fyzického Foldu.
- Pozorovaná síťová kontrola: 117 GET/HEAD požadavků pouze na lokální assety, žádný HTTP API požadavek a žádný externí HTTP server. Backend ani produkční databáze nebyly spuštěny nebo připojeny.
- Existující browser CI scénáře aktualizovány podle schváleného vstupu přes Hrát a skutečné Extra hierarchie. Jejich standalone Playwright běh není vydáván za provedený; browser průchody výše proběhly přes ovládání prohlížeče.

## Před případným produkčním nasazením

Znovu ověřit aktuální main a produkční SHA, sladit případné souběžné změny a release verzi. Ověřit skutečný účetní/offline sync v určeném neprodukčním prostředí, cache update nainstalované PWA, fyzický Fold a rozsah screen-reader/zoom kontroly. Tato větev nemění pravidla XP, databázové schéma ani analytické události. Vyžaduje následné schválení produkčního nasazení.
