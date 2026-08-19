# Proplet v3.34.0 — Difficulty Calibration / Free Generation 4

## Proč je to priorita

Produkční data Gen3 potvrzují strukturální problém difficulty ladderu: Střední je pro velkou část hráčů příliš průchozí, zatímco první Těžké dělají skok téměř rovnou k Mozkožroutu. Jádro zážitku Propletu je samotné hledání slov na desce, proto má tento sprint přednost před dalšími feature sprinty.

Aktuální raná behaviorální baseline (levely 1–10, produkce 2026-08-20):
- Snadná: medián ~21 s, completion ~94 %, medián prvního slova ~3,4 s
- Střední: medián ~36 s, completion ~92 %, medián prvního slova ~2,8 s
- Těžká: medián ~330 s, completion ~75 %, medián prvního slova ~34 s
- Mozkožrout: medián ~378 s, completion ~80 %, medián prvního slova ~32 s

To není plynulý ladder. Cílem v3.34.0 je vytvořit čtyři jasně odlišné, ale navazující herní identity.

## Root cause

Současný generátor postaví jednu dlouhou cestu přes desku a cílová slova jsou po sobě jdoucí segmenty této cesty. Konec jednoho cílového slova je tedy konstrukčně sousední se začátkem následujícího. U Střední je navíc aktivní `dense` geometrie bez povinné křivosti; u Těžké se současně skokově mění geometrie na `winding` a zpřísňuje slovní mix.

V3.34 proto nesmí být jen retuning tier weights. Musí oddělit dvě osy obtížnosti:
1. slovní náročnost,
2. geometrickou / vyhledávací náročnost.

## Cílový herní pocit

Časy jsou kalibrační hypotéza z reálných hráčů, nikoli tvrdý generátorový constraint.

### Snadná
- zůstává rychlá a čitelná
- orientačně 20–35 s na raných levelech
- může mít vyšší podíl rovných slov a lokální návaznost
- primárně Tier A

### Střední
- už nesmí být „začni vlevo nahoře a projeď hada“
- rané levely orientačně 55–90 s, s přirozenou variabilitou
- více oddělených začátků slov a menší chainability
- více zatáček než dnes, ale bez hard-level frustrace
- slovně převážně A/B; obtížnost má růst hlavně geometrií a hledáním

### Těžká
- začátek kalibrovat přibližně kolem 120 s, ne 150+ s jako pevné minimum
- povolená variabilita v prvních levelech zhruba 90–150 s; poté plynulý náběh
- výrazně menší skok ze Střední než dnes
- geometrie náročná, ale ne téměř Mozkožrout od levelu 1
- první prototyp slovního mixu: cca 10–15 % A, 55–65 % B, 25–35 % C; později A ubírat a C přidávat
- přesný mix bude potvrzen playtestem, nikoli nasazen naslepo

### Mozkožrout
- zachovat jako skutečný extrém
- orientačně 300+ s pro rané levely, s vysokou variabilitou
- výrazně winding geometrie
- C/D slovník, ale po novém editorial review nevhodných slov

## Generation 4 — geometrický směr

První prototyp nebude generovat celou produkční banku.

Preferovaná cesta:
- přestat segmentovat jednu jedinou Hamiltonovskou cestu do všech řešení;
- generovat několik nezávislejších word-path řetězců / path packing tak, aby slova byla prostorově propletená;
- exact-cover solver zůstává finální bezpečnostní brána: board přijmout pouze při jediném úplném řešení;
- každý target musí mít právě jednu legitimní cestu stejně jako dnes.

Bezpečný mezikrok pro prototyp: 2–3 samostatné řetězce místo jediného globálního hada. Pokud generování a uniqueness zůstanou stabilní, pokračovat k plně nezávislejšímu path packingu.

## Nové audit metriky

`tools/audit_v334_difficulty.py` měří mimo jiné:
- mean turns / word
- zero-turn share
- <=1-turn share
- longest straight run share
- sequential answer-boundary adjacency
- endpoint → other word start adjacency
- tier mix
- must-review lexical hits

Důležitá nová metrika je chainability. Deska může být matematicky korektní a přesto herně špatná, pokud jedno nalezené slovo příliš přímo ukazuje na další.

## Prvních 10 levelů má přednost před dlouhou rampou

Současná data ukazují, že jen malá část hráčů vůbec dosáhne levelu 25 a prakticky nikdo zatím nezažil plánované 50-level fáze. Proto:
- levely 1–10 každé obtížnosti musí samy o sobě perfektně reprezentovat její identitu;
- potom plynulá, spíš kontinuální rampa;
- nečekat 50 levelů na pocitovou změnu.

## Lexicon editorial review — povinný krok před full generation

Než vznikne finální Generation 4, společně projít kandidáty na vyřazení / přesun mezi tiery. Nic dalšího se nebude automaticky mazat jen podle frekvence nebo modelového názoru.

### Must-review seed od product ownera
- ČERVODÍRA
- BLOCKCHAIN
- PULSAR
- TENSOR

Tyto výrazy jsou kandidáti k odstranění z target lexikonu, nikoli automaticky z recognition lexikonu. Recognition má zůstat široký.

Audit má připravit širší shortlist zejména z C/D, nízkého `fun`, odborných výrazů a slov, která se reálně objevují v aktivních / budoucích deskách. Shortlist se projde společně před regenerací.

## Feedback a telemetry

UI copy obtížnostního feedbacku už bylo po launchi opraveno hotfixem na jednoznačné „moc lehké / akorát / moc těžké“. V3.34 toto nemá znovu předělávat.

Co ale chybí a v3.34 musí doplnit: feedback a attempt telemetry musí být snadno segmentovatelná podle konkrétní obsahové verze. Ukládat / reportovat přímo:
- app_version
- content_generation
- difficulty
- level
- generation profile / geometry profile
- základní geometry metrics boardu

Tím půjde oddělit Gen3 vs Gen4 a konkrétní variantu bez zpětného hádání podle puzzle ID.

## Migration / leaderboard invariants

Generation 4 musí zachovat současný hráčský model `difficulty + level`:
- dokončený slot zůstává dokončený;
- XP se neodebírá;
- stejný slot nedá druhé XP;
- starý Gen3 výsledek zůstává historicky dostupný;
- Gen4 board má vlastní srovnání, protože je to jiná deska;
- rozehraný legacy board lze bezpečně dokončit;
- v3.33.1 challenge odkazy na staré puzzle ID dál fungují přes archive fallback;
- hráč nemusí vidět technický pojem generace.

## Playtest gate před masovou regenerací

Nejdřív vytvořit malou kalibrační banku, ne 800 boardů:
- 5–8 Snadných
- 10–15 Středních
- 10–15 Těžkých
- 5–8 Mozkožroutů

Z ní vybrat reprezentativní blind-playtest s product ownerem. Až po odsouhlasení pocitu:
1. zmrazit geometry/vocabulary profiles,
2. vygenerovat celou aktivní banku,
3. exact-cover audit 100 % boardů,
4. migration QA,
5. preview,
6. production release.

## Release notes / modal v3.34.0

Difficulty redesign je dost velká změna na vlastní krátké release sdělení. V3.34 nahradí starý release modal aktuálním.

Pracovní messaging:

**🎯 Obtížnosti jsme pořádně překopali**
Střední už není jen rozcvička a Těžká tě nehodí rovnou do Mozkožrouta. Zkus je znovu — každá má teď vlastní rytmus.

CTA / doprovodný text se doladí až podle finálního výsledku playtestu. Nepoužívat tvrzení, která nebudou potvrzená daty.

## Definition of done

V3.34.0 není hotová, dokud:
- Střední/Těžká nemají subjektivně odsouhlasený playtestový profil;
- rané levely mají plynulejší behaviorální ladder;
- Těžká nezačíná kolem dnešních ~330 s, cílový střed je přibližně 120 s;
- Těžká se jasně liší od Mozkožrouta;
- editorial word review je uzavřený;
- Gen3 progres, XP, history a challenge links jsou zachované;
- feedback lze čistě segmentovat Gen3 vs Gen4;
- produkční rollout projde standardním safe-release flow.
