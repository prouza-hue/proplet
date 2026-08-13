# Proplet v3.18.0 — každá úroveň má svůj svět

## Globální pořadí Free úrovní

- každá z 400 aktivních Gen2 Free úrovní má vlastní globální žebříček;
- výsledkovka i detail odehrané úrovně nabízejí přepínač **🌍 Globálně / 👥 Můj tým**;
- globální část ukazuje přesné místo, počet hráčů a tři sousední výsledky;
- od deseti hráčů se přidá také umístění v procentech;
- ostatní hráči zůstávají anonymní jako v globálním pořadí Daily;
- týmová záložka zachovává jména členů týmu a původní osobní soutěžení.

## Férovost

- do obou pořadí se počítá pouze první dokončený pokus hráče;
- pozdější tréninkový replay nemůže zlepšit čas, nápovědy ani pořadí;
- pořadí používá pravidla **Čisté vyřešení → méně nápověd → čas → tahy**;
- aktivní Gen2 desky se nikdy nemíchají s archivními Gen1 výsledky;
- převedený slot získá globální místo až po skutečném odehrání nové Gen2 desky a dál nedává druhé XP.

## Jazyk a sdílení

- anglické označení **Clean** zmizelo z vysvětlení pořadí i administrace;
- hráčské rozhraní jednotně používá **Čistě** a **Čisté vyřešení**;
- sdílení Free výsledku nově přednostně přidá globální pozici, případně místo v týmu.

## Soukromí

Globální API neposílá jména, avatary, názvy týmů ani interní ID hráčů. Přesné vlastní místo se spojí s přihlášeným účtem pouze na serveru; ostatní řádky se zobrazují jako **Soupeř**.

## Testy

- první pokus zůstává soutěžní i po výrazně lepším replayi;
- řazení respektuje čisté vyřešení a počet nápověd;
- odpověď globálního API neobsahuje identitu hráčů;
- anonymní návštěvník vidí pouze anonymní špičku pořadí;
- archivní Free puzzle je z aktivního globálního žebříčku odmítnuto;
- zachované regresní testy administrace, Gen2 migrace, Daily replaye, sdílení a výsledkových pochval.
