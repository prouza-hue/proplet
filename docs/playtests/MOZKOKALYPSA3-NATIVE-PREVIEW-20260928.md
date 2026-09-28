# Mozkokalypsa III — soukromý náhled modulu v běžném Propletu

28. 9. 2026. Pavel schválil osm desek propletené revize a požádal o jejich připojení do běžného rozhraní pro vyladění modulu. Není to souhlas s ostrým spuštěním.

## Základ a obsah

Main i produkce při zahájení: `0e06a56ff0beb64dda6c3ee172324b8f105c1f19`, včetně týmových ocenění a oprav PR153. Větev `preview/mozkokalypsa3-in-game-20260928` vychází z tohoto main, ne ze statické konfigurace PR148/150.

Schválená banka je převzata z `553fb3578c958004b831068dfd268dbcb2a423ab`, `content/gen6/round3-interwoven/bank.json`, do `data/playtests/mozkokalypsa-v3-preview.json` s totožnými bajty. SHA-256 `c412ad3ccb8dc0a651387046389aff055c34ada15c5cf75398c8440c1ce22410`; obsahový hash `b6bfe8034861ad3cad0d3d9057658b046ea85ef172579229da60ab5dd7cdc42f`. ID `mk3w2-01` až `mk3w2-08`. Žádné generování desek nebo změna Lexikonu v3.

## Náhled modulu

Otevřít `/?mozkokalypsa=preview` na deploymentu nové větve. Jde o běžnou stránku Dnes, nativní herní moduly, nápovědy a původní playtestový adaptér. Žádná další paralelní aplikace.

Pozvánka navazuje na schválené druhé kolo: stejná ilustrace a inkoustově švestková karta, měděný sticker odměny, běžící odpočet, osm značek postupu. Nová textace „Mozkokalypsa potřetí.“ mluví o pestřejší češtině a propletených cestách. Bez eyebrow a dříve odstraněných spodních poznámek. Drobná samostatná informace o soukromém náhledu je nad kartami na Dnes. Reklamní banner se v tomto explicitním prostředí bez reklam nezobrazuje; nastavení souhlasu se nepřepisuje.

Odměna 200 XP za desku / 1 600 za osmičku i konec 4. října ve 24:00 českého času jsou **ukázkové hodnoty**, nikoli schválené provozní parametry. API to označuje a UI píše „Ukázkový konec“. Odpočet používá serverový čas, nepolluje API; nejde o ostrou uzávěrku.

Přehled osmi desek rozlišuje rozehráno/dokončeno/chybějící hodnocení. Po dohrání je hodnocení náročnosti, zábavnosti a volná poznámka. Nové tlačítko „Prohlédnout dohranou desku“ odkryje skutečně vyřešenou desku; „Zpět k hodnocení“ zachová rozepsaný formulář. Kontrola ověřuje, že tím nevzniká opakované dokončení. Hotová hodnocení lze v náhledu znovu otevřít.

Postup a hodnocení jsou jen v místním úložišti dané preview domény. Nesbírají se jako výzkumná data na serveru a nepřipisují skutečné XP. Původní statické preview zůstává dostupné odděleně; jeho místní postup se automaticky nepřenáší do této domény.

## Izolace

Přesná větev smí běžet pouze v prostředí preview. Před vytvořením databázového klienta se pro tuto větev odstraní Supabase URL/klíč, VAPID i cron secret. Vnější middleware vrací 403 na mutující metody a credentialed cron/auth/admin cesty. CSP nepovoluje připojení k ostré doméně, Supabase nebo marketingovým službám. Případné původní pokusy o produktovou analytiku končí 403 bez zápisu; test neprohlašuje, že aplikace nevyšle žádný požadavek.

Produkční kolo II, jeho datum/banka, účty, XP a odměny se nemění. Žádné SQL migrace, dotazy na hráčská data nebo databázové zápisy. Účty a serverové odměny jsou v náhledu nedostupné. Tato větev se nesmí bez oddělené integrační práce sloučit nebo propagovat na produkci.

## Skutečné ověření

CI https://github.com/prouza-hue/proplet/actions/runs/36393595284 prošlo, aplikační commit `fff10104608354c2867a245e9b9090c51ac7f6b8`. Původní adaptér a odpočet, původní API/banka II, kontrola osmi nových QA cest, nezměněných bajtů banky, odstranění zděděných přístupů a odmítnutí mutací před účtovou middleware: PASS.

Browser: skutečný první tah myší a dotykové tahy na emulovaném telefonu/Foldu, nápověda, Klid a obnovení; všech osm desek dokončeno přes nativní submitPath s uložením místních hodnocení, nikoli ručním přepsáním finished. Náhled hotové desky zachoval rozepsané hodnocení i počet událostí. Po osmi dokončeních zůstaly běžné herní výsledky, rozehraný postup a výsledková fronta beze změny. Žádný POST playtestového výsledku/XP. Odpočet skutečně tiká bez dodatečných status requestů. Karta ve světlém/tmavém režimu na 320/390/768/1440 px bez horizontálního přetečení. Reálné screenshoty byly prohlédnuty; emulace není fyzický Fold. Report `MOZKOKALYPSA3-NATIVE-QA-20260928.json`.

První browser běh odhalil, že zděděná reklamní lišta zakrývá mobilní tlačítka; v izolovaném náhledu bez reklam je nyní skrytá a celý relevantní průchod poté prošel. Žádné testy se kvůli tomu nevypínaly. Obecný produkční gate není tímto označen za ověřený. Dočasné přenosové patche byly odstraněny; finální QA workflow má pouze read oprávnění.

## Další rozhodnutí

Pavel posoudí vzhled pozvánky, přehledu a hodnocení. Před ostrým třetím kolem potvrdit termín, kohortu a odměny; zapojit oddělenou experimentovou evidenci do stávajících serverových odměn a ověřit aktuální hlavní větev/produkci. Nic se automaticky nezapne skončením II. Nový obsah pro ostatní obtížnosti a společná pestrá cesta zůstávají etapou po vyhodnocení.
