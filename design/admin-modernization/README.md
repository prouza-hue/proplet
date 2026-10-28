# Návrh nové administrace Propletu

Připraveno 29. 10. 2026. Stav: **návrh a klikací prototyp, připravený k zahájení realizace**. Produkce ani hráčská data se touto přípravou nemění. Samostatná větev `codex/admin-modernization` vychází z produkčního `1de7389`.

## Doporučené rozhodnutí

Zahájit první etapu: přestavět admin jako provozní a podpůrný nástroj, opravit důvěryhodnost dat a přidat obnovu přístupu z PR 118 s nalezenými opravami. Vydání připravit na samostatné větvi a ověřeném preview. Samotné přijetí tohoto návrhu není pokyn k produkčnímu mergi nebo zásahu do konkrétního hráče.

## Co bude admin nabízet

| Sekce | K čemu slouží |
|---|---|
| Přehled | Co právě potřebuje vyřešit, s proklikem na konkrétní problém a časem aktualizace. |
| Hráči a týmy | Najít správný účet podle ID, aktivity a postupu; porovnat podobné účty; obnovit přístup; prohlédnout členství. |
| Hlášení | Technická podpora i slova se stavy, hledáním, poznámkami a dohledatelným archivem. |
| Obsah a kvalita | Aktuální výzvy, dostupnost obsahu, kvalita desek, nápovědy, vzorky a historie. |
| Provoz | Verze a zdroje dat, chyby, diagnostika push a omezená diagnostika integrity účtů. |
| Analytika | Skutečný současný první průchod a návraty, s jasnou metodikou a upozorněním na chybějící měření. |
| Historie | Dohledatelné zásahy s cílem, důvodem a výsledkem. |

## Proč nestačí nový vzhled

- Launch v kódu i skutečném produkčním RPC stále filtruje `board-v2`; dnešní hra používá `board-v3-short`. Historii zachovat, jako pohled na dnešní onboarding ji nahradit.
- Seznam hráčů sčítá jen body z výsledků, detail zahrnuje i další account rewards. Oba pohledy mají vycházet ze stejného správného souhrnu.
- Dnešní seznam bez stránkování nezpřístupňuje všechny odpovídající hráče. Support je schovaný v Launch a po vyřízení mizí z dostupné fronty.
- Existující push diagnostics, account-integrity a historie kvality nemají vlastní UI. Nejprve využít tyto schopnosti.

PR 118 je stále otevřený draft. Jeho funkci převzít na dnešní auth základ; před vydáním opravit možnost záměny cíle při rychlém přepínání hráčů a spolehlivou revokaci starých challenge. E-mail se stane ověřeným až skutečným ověřením schránky. Admin nebude ručně nastavovat hesla či přebírat ověřenou identitu jiného hráče.

## Co je připravené k prohlédnutí

- `prototype.html`: lokální klikací návrh všech sekcí. Hráči a případy jsou ukázkové; recovery končí náhledem. Síťová spojení a odesílání formulářů blokuje CSP. Při servírování z kořene repozitáře se načtou lokální fonty.
- `../../openspec/changes/modernize-admin-console/proposal.md`: rozsah a důvody.
- `../../openspec/changes/modernize-admin-console/design.md`: chování, datové kontrakty, architektura a postup vydání.
- `../../openspec/changes/modernize-admin-console/specs/`: tři ověřitelné specifikace.
- `../../openspec/changes/modernize-admin-console/tasks.md`: implementační checklist, všechny úkoly otevřené.
- `../../openspec/changes/modernize-admin-console/audit.md`: doložené nálezy, zdroje a omezení přístupu.

## Rozsah další etapy

Změna týmu konkrétního účtu, odpojení staré identity a přiřazení minulých týmových výsledků mají být samostatné transakční operace s náhledem dopadu, kontrolou kolizí, důvodem, potvrzením a auditem. V první etapě je dostupná diagnostika a porovnání. PR 118 tyto opravy sám nepřidává. Automatické slučování, mazání účtů a volný editor XP se nenavrhují.

## Ověření přípravy

Ověřeno produkční SHA/deployment, veřejný health/config, přihlašovací brána adminu, relevantní chat a PR, aktuální kód a metadata produkčních RPC. Za přihlašovací branou nebyl v této relaci dostupný skutečný přihlášený admin; to nenahrazujeme tvrzením o vizuální kontrole živých metrik.

Klikací návrh byl prohlédnut v prohlížeči ve světle na desktopu a ve tmě na mobilu. Šířky 320/390/690/1440 jsou browser emulace, nikoli test fyzického Foldu. Ověřeny navigace, hledání, detail, maskovaný recovery náhled, Escape a návrat fokusu; bez page-wide horizontálního přetečení nebo konzolových chyb. JS syntax a kontrola diffu prošly. Přípravou se nespouštěl celý herní gate; žádný runtime kód se neměnil.

Otevřené technické body před realizací: skutečné pokrytí současné telemetrie, zdroj posledních běhů plánovačů, vyhrazená testovací schránka a opětovné potvrzení prostředí. Tyto body nebrání zahájení realizace základního adminu a recovery v izolaci.
