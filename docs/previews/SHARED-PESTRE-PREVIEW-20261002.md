# Pestrá hra ve společném preview

Integrovaná větev: `work/free-refresh-300-20261002`. Veřejná adresa zůstává:
https://proplet-git-work-free-refresh-300-83f39d-pavel-prouzas-projects.vercel.app/

Požadavek Pavla z 2. října navazuje na společné pestré pořadí projednané v chatu „Nastavení pestré hry“. Dříve nasazený náhled předváděl jen novou stovku a číselný zbytek banky u prvních tří obtížností. Tato integrace přidává skutečný sdílený manifest, pestré pokračování starší bankou a přepínač také u Mozkožrouta. Pavel výslovně upřesnil, že Mozkomor a Mozkokalypsa nyní přepínač nepotřebují: každý je jedna obsahová řada. Jejich pořadí zůstává a podpora přepínání je připravená pro budoucí řadu. Produkční preference a migrace tím nejsou změněné.

| Obtížnost | Dostupné desky | Společná cesta |
|---|---:|---|
| Snadná | 400 | Původní nová stovka Gen6, pak pestré střídání Gen5/Gen4 |
| Střední | 400 | Původní nová stovka Gen6, pak pestré střídání Gen5/Gen4 |
| Těžká | 400 | Původní nová stovka Gen6, pak pestré střídání Gen5/Gen4 |
| Mozkožrout | 300 | Společné pestré střídání Gen5/Gen4 |
| Mozkomor | 150 | Současné pořadí, bez přepínače |
| Mozkokalypsa | 100 | Zachované redakční vlny 20/60/15/5, bez přepínače |

Pořadí v manifestu nečte hráčskou historii. Ta určuje pouze přeskočení dokončených ID a přednost uložené rozehrané hry. Míchání dosavadního obsahu navazuje na poměr jedné Gen5 desky ke dvěma starším deskám; v krátkém okně vybírá menší překryv cílových slov vůči posledním dvěma deskám. Nejde o nové desky ani doklad lidsky měřené obtížnosti. `variedDifficulties` v manifestu určuje, kde se přepínač skutečně nabízí; nyní obsahuje první čtyři obtížnosti. Budoucí redakčně připravená obsahová řada může tuto konfiguraci rozšířit, aniž by se měnily desky, XP nebo kód výběru.

Každá obtížnost má také úplný přímý katalog podle původních čísel. Rezervované dosud nevydané úrovně se nezveřejňují a mezery v číslování se nezaplňují. Opakování zůstává tréninkem bez další odměny za stejné ID.

Explicitní dosavadní volba z tohoto preview má přednost, potom dřívější místní `pestre-v1` volba. Bez volby náhled demonstruje Pestře v prvních čtyřech obtížnostech. Staré osobní plány se nemažou. Namespace uloženého postupu je stejný jako v předchozím preview, odvozený od nezměněného hashe banky; aktualizace tedy nepřipraví hráče o rozehranou ukázku. První povinná deska a její A/B assignment zůstávají v původním onboardingu.

Manifest `shared-pestre-preview-v2` obsahuje všech 1 750 aktivních ID, číselné katalogy, původní hash banky a hash kompletního vstupu. Je dostupný jako `online-preview/content/free-order/shared-pestre-preview-v2.json`; jeho reprodukce je `node tools/build_shared_pestre_preview.cjs`. Validace je `node tools/verify_shared_pestre_manifest.cjs`.

Náhled je stále statický. Účty, serverové žebříčky, synchronizace zařízení, produkční API a zápis do Supabase jsou vypnuté. Společná cesta může koncentrovat budoucí hráče na stejných deskách; náhled nevyrábí cizí výsledky ani nezaplňuje prázdné žebříčky. Main a produkční deployment zůstávají beze změny.

Ověření 2. října: Actions run 37022805780 SUCCESS. Původních 32 browserových kontrol (včetně renderu všech 300 nových desek, A/B onboardingu, skutečného pointer vstupu a XP při opakování) a dalších 33 kontrol integrace prošlo bez console/page/HTTP chyb. Nové kontroly zahrnují všechny katalogy 1 750 desek, přesný hash původních bank, zachování dřívější preference i rollback plánu, návrat k rozehrané desce po reloadu, dokončení/XP/next u vyšších obtížností a nepřítomnost endgame přepínačů. Lokální invarianty společného manifestu prošly pro všech šest katalogů. Veřejná branch adresa byla otevřena také ručně; Mozkožrout se po přepnutí Podle čísel/Pestře vrací z úrovně 1 k úrovni 217. Žádný požadavek na produkční API ani externí služby nebyl při browserovém ověření odeslán. Podrobný záznam je `SHARED-PESTRE-ONLINE-VERIFIED-20261002.json`.
