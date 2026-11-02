# Sjednocení soutěží — 3. 11. 2026

## Zadání a stav

Uživatel schválil výraznější zjednodušení čtyř pohledů soutěží, odstranění nadbytečných textů, skrytí měsíčních šipek do druhého měsíce a doplnění historie týdnů / celkových týmových zlatých medailí.

Implementace je ve větvi `codex/competition-ui`. Produkční nasazení nebylo provedeno. Výchozí a znovu ověřený main: `8d66c6027ed17554f5f9f4691e417fb1d39ba971`, v4.10.15. Doména hrajproplet.cz byla při zahájení ověřena na deploymentu `dpl_EfrSKAt92d5ArCysQJZuaGMg3MHb`. GET health/config potvrdil produkční prostředí a dostupnou databázi. Žádné produkční zápisy ani změny schématu.

## Výsledek

- Společná horní navigace bez viditelného titulku Soutěže; zachovány Fraunces, papír, barevnost a významy ikon.
- Výzva a XP mají stejné jednoduché přepínače, ploché řádky a zvýraznění vlastního výsledku jako týdenní a měsíční pohled.
- Měsíční karta ukazuje stručné vlastní skóre a pořadí; rozpis soupeřových bodů je volitelný. Pravidla a vysvětlení shod zůstávají dostupné.
- Měsíční historie ani budoucí kolekce se neobjeví před začátkem příslušného měsíce v pražském čase. Listopad nemá šipky, prosinec už umožní návrat do listopadu.
- Týdenní soutěž nabízí Pořadí, Celková zlata a Vitrínu týmu. Šipky procházejí pouze skutečné uzavřené týdny a aktuální týden.
- Nový GET `/api/team-victories/competition` čte existující uzavřená pořadí a udělené medaile. Neprovádí finalizaci, změnu bodování ani migraci. Nevrací týmové kódy; respektuje současné soukromí týmů. Shodné počty medailí mají shodné pořadí.
- Cache nových prostředků a kandidátní PWA marker jsou sjednocené; veřejné číslo produkční verze zůstává 4.10.15. Pro případné vydání zvolit aktuální následující verzi a standardní release postup.

## Ověření

- Nové backendové testy: historie, veřejnost týmů, zmrazená jména, shody, hranice období, chyby a úplnost omezených dotazů.
- Nové frontendové testy: historie, návrat po chybě API, opožděné odpovědi, změna účtu, medaile, escapování a klávesnice. Registrace v aktuálním manifestu.
- `tools/competition_ui_visual_qa.cjs`: 24 pohledů pro hosta a syntetický účet při 390, 690 a 1440 px; šest interakčních sad. Bez horizontálního přetékání a chyb JS. Přidáno do refinements CI.
- `tools/test_rankings_navigation_browser.cjs`: 320, 390, 768 a 1000 px; přepínání, scroll, focus, retry, soukromí a závody odpovědí prošly.
- `tools/test_monthly_awards_browser.py`: sedm rozměrů, světlý/tmavý režim, listopad/prosinec, dialogy a návrat fokusu prošly.
- Vizuální důkazy jsou lokálně v `artifacts/competition-ui/`; používají označená syntetická data, nikoli skutečné výsledky hráčů.

- Kompletní aktuální regresní sada: **235 PASS / 0 FAIL**; kontroly prostředků: **191 PASS / 0 FAIL**. Release/cache kontrakt a instalace service workeru prošly.

## Otevřené body

Vizuální posouzení uživatelem a případné produkční vydání. Screenshoty představují emulované rozměry, nikoli test fyzického Foldu. Před vydáním znovu ověřit aktuální main, produkční SHA a prostředí.

## Online náhled se živými daty

3. 11. 2026 uživatel výslovně požádal o běžné přihlášení a živá data pro porovnání s produkcí. Větev `codex/competition-ui` proto používá stávající přísné podmínky live-player preview (příznak, přesná větev, preview prostředí a produkční databázová URL). Měsíční soutěž a zobrazení patronů jsou povoleny jen pro tuto konkrétní větev pomocí branch-scoped preview konfigurace. Produkční konfigurace ani nasazení se tím nemění. Samostatná preview doména vyžaduje přihlášení; hráčské akce používají skutečný účet. Ukázkové scénáře ani testovací hodiny se nepoužívají.
