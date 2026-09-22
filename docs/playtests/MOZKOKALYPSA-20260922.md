# Mozkokalypsa — pilot 22. 9. 2026

## Stav a rozhodnutí
Pavel schválil název a výrobu 10 desek: 2 nové kontrolní Mozkomory, 4 plné desky a 4 plné desky vybírané pro přetrvávající alternativy. Navrhl dobrovolnou pozvánku v ostré hře pro tři hráče s nejvyššími celkovými XP.

Implementace je připravena na větvi `feat/mozkokalypsa-playtest`, nikoli nasazena na produkci. Výchozí main i ověřená produkce: `6a3918f592698562943026203c5e6ce9869b9652`; Vercel `dpl_2Mh5jfoYtViNjXH7zsLLnpkhzYj9`. Produkční databáze `iopyhluayfszskyqqpuc` byla pouze čtena. Žádný hráč nebyl pozván, SQL migrace nebyla aplikována. Nová funkce je standardně vypnutá.

## Obsah a ověření
- `data/playtests/mozkokalypsa-v1.json`: 10 zmražených desek, 133 různých slov; tři stabilní prokládaná pořadí. Skupina experimentu se hráči neposílá.
- `docs/playtests/mozkokalypsa-verification.json`: nezávislá kontrola úplného pokrytí, pravopisu/cest, jediné cesty každého cílového slova a jediného úplného řešení vůči zmraženému slovníku 26 093 slov. Timeout není důkaz jednoznačnosti.
- Osm plných desek má přesně 100 obsazených polí, 14 slov, všechna pole patří právě jednomu slovu. Dvě kontrolní desky zachovávají současný profil Mozkomora.
- Plné skupiny mají shodnou délkovou a třídovou skladbu; cílená skupina vybírá z 24 ověřených kandidátů stejné slovní sady podle počátečních i reziduálních metrik po třech slovech a v polovině v sedmi modelových pořadích. Jde o pomocná skóre, ne prokázanou lidskou obtížnost ani násobek času.
- Ověření lidmi dosud neproběhlo. Kandidáti používají schválený slovník a výluky; další redakční připomínky hráčů jsou vítané.

Výroba proběhla nad zmraženým výchozím kódem, bez změny běžné banky:
```
PYTHONPATH=.:tools python tools/gen5_lab.py --output lab-output/gen5/mozkokalypsa-baseline-20260922 --count 2 --difficulties mozkomor --seed 2026092201 --seconds-per-board 90
python tools/mozkokalypsa_lab.py --baseline docs/playtests/mozkokalypsa-controls-source.json --output lab-output/mozkokalypsa/reproduction --seconds-per-board 120
```
Časově omezený generátor netvrdí identické výsledky na libovolném stroji. Uložená banka a její hash jsou kanonické; při nasazení se znovu negenerují.

## Hranice integrace
Používá existující desku a ovládání, nikoli druhou kopii hry. Přidána pouze karta Dnes, výběr desek a malá výsledkovka s dobrovolným hodnocením obtížnosti/zábavnosti a poznámkou. Nápovědy, Klidný režim, lupa, přerušení a návrat zůstávají dostupné.

Test nemění běžný postup, XP, odměny za vedlejší slova, série, odznaky ani výsledkové žebříčky. Samostatné tabulky a předpona localStorage. Metriky zahrnují aktivní čas, tahy, chyby, nápovědy a jejich úroveň, první/poslední nález, první nápovědu, postup každého nálezu, pauzy/návraty/reset a stav Klidného režimu. Žádný nový polling; existující fair-play lease se pro izolovaný test nepoužívá. Nejde o nový soutěžní žebříček.

Server ověřuje pozvánku podle autentizovaného player_id, přesné cílové cesty a konzistenci dokončení. RLS + odebrané přístupy anon/authenticated; RPC jsou security-invoker a pouze pro service_role. Idempotentní události, atomický zápis a revize chrání před duplikací/přepsáním mezi zařízeními. Při konfliktu se místní data zachovají a zápis se zastaví; automatické slučování různých průchodů není implementováno.

## Preview
Pouze přesná Vercel preview větev má read-only QA vstup `?mozkokalypsa=preview`. Na této větvi je připojení Supabase v konfiguraci vyprázdněno i při zdědění produkčních proměnných. Výsledky preview zůstávají v zařízení; neposílají se jako hráčská analytika. Query parametr neodemkne produkční API. Lokální test používá výslovně `PROPLET_PLAYTEST_LOCAL_QA=true`, nikoli tuto proměnnou na produkci.

## Před aktivací na produkci
1. Dokončit izolovaný SQL test a skutečný průchod nativní hrou v prohlížeči včetně mobilu/Fold emulace; uložit důkazy. Ověřit aktuální main před sloučením a potvrdit produkční nasazení s Pavlem.
2. Aplikovat samostatnou aditivní migraci `SUPABASE_MOZKOKALYPSA_PLAYTEST.sql`; nejprve na izolované DB. Normální tabulky se nepřepisují.
3. Jednorázově vybrat aktuální top 3 dle `proplet_rankings_xp_aggregate(null).lifetime_xp`, stabilní tie-break ID; uložit pevné invite sloty 0–2. Při kontrole 22. 9. kolem 21:56 CEST šlo o Michael, PiettraWal, Ave. Nepřepočítávat kohortu při každém otevření. UUID nejsou ve veřejném klientu.
4. Až po ověření zapnout `PROPLET_MOZKOKALYPSA_ENABLED=true` pouze pro produkci a ověřit pozvaného i nepozvaného hráče bez falšování skutečných výsledků. Bez přepínače je vše skryto; bez pozvánek není přístup.
5. Vyhodnocovat izolované tabulky podle experimentu, hráče, skryté skupiny a pořadí. Nedokončení není nula času. Čas posuzovat spolu s počtem slov, nápovědami a subjektivním hodnocením; tři hráči nejsou statistická studie.

Nouzové vypnutí: flag false (s odpovídajícím deployem), případně active=false na pozvánkách. Zachovat výsledky i místní data. Dosavadní produkční banky a pokrok se nevracejí ani nemažou.
