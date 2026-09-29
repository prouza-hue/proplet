# Vyhodnocení experimentu `first-board-v1`

Stav plánu: platný od 29. 9. 2026 pro experiment nasazený mergem PR #159,
commit `712b33a81da267a21ab264f41b49ee23ad7acff4`.

## Hypotéza a rozsah

Experiment ověřuje pouze první povinnou skutečnou desku po dokončeném tréninku:

- `control_e001`: `g4-e-001`, buckety 0–49;
- `challenger_e009`: `g4-e-009`, buckety 50–99.

Přiřazení vzniká až po kliknutí na pokračování z výsledku tréninku. Experiment proto
nemůže dokazovat změnu dokončení samotného tréninku ani chování před přiřazením.

Jednotkou analýzy je jeden validní `first_steps_run_id` s právě jednou událostí
`first_board_experiment_assigned`. Randomizace vzniká z anonymní first-party
identity, ale claim následně změní současné vlastnictví historických eventů.
Kohorta se proto nesmí filtrovat podle aktuálního `player_id`/`anonymous_id`;
neměnným důkazem stavu při přiřazení je `context.auth_at_event='anonymous'`.

## Funnel a metriky

Pořadí měřených hranic:

`assigned → started → completed → account_created → saved_after_new_account`

`account_created` se přiřazuje výhradně přes shodný `first_steps_run_id`. Čas,
`player_id` ani ID desky se k domýšlení vazby nepoužívají.

Primární produktová metrika je `completed / started`: přímo měří, zda hráč
přiřazenou první desku dokončil. Povinné sekundární metriky:

- `started / assigned` a `completed / assigned` pro end-to-end dopad;
- `account_created / completed` a `account_created / assigned`;
- `saved_any_account / completed` a `saved_any_account / assigned`;
- `saved_after_new_account / account_created` pro přísnou novou registrační větev.

`saved_any_account` může být vyšší než počet nových účtů: přihlášení do již
existujícího účtu může legitimně uložit výsledek bez nové `account_created`.
Proto se tato metrika nesmí vydávat za poslední krok čistě registračního funnelu.

## Kohorta a čas

Vždy platí `environment='production' AND is_test=false`. Kohortu určuje
`experiment_key='first-board-v1'`, nikoli odhad z releasu, hráče nebo desky.
`client_release` se uchovává pro rozklad a kontrolu, aby pozdější release nebyl
potichu smíchán s jednostranným či poškozeným rolloutem.

Readout vrací dvě kohorty:

- `live_diagnostic`: průběžná kontrola doručování a instrumentace; nikdy podklad
  pro vyhlášení upliftu;
- `mature_24h`: pouze přiřazení alespoň 24 hodin před připnutým cutoffem, tedy se
  zavřeným oknem pro vytvoření účtu a potvrzené uložení.

Při finálním běhu musí být jeden UTC cutoff vložen stejně do všech statementů.
Počty, poměry a sample-ratio check se archivují společně.

## Quality gates

Výsledek podle variant se neinterpretuje, pokud neplatí všechno níže:

1. žádný z invariantů v `FIRST-BOARD-V1-READOUT.sql` neselže;
2. 50/50 sample-ratio check nemá při dostatečném vzorku `WARNING_SRM`;
3. obě varianty běžely souběžně a ve stejných způsobilých časových oknech;
4. pro účtové metriky se používá pouze `mature_24h`;
5. jsou uvedeny absolutní počty i jmenovatele, nejen procenta.

Kontrola SRM používá chi-square test s jedním stupněm volnosti a hranicí 0,05.
Při méně než 20 validních přiřazeních hlásí `TOO_EARLY`. SRM test kontroluje
randomizaci; není testem produktového efektu.

## Rozhodovací pravidlo

První plný den slouží pouze ke kontrole integrity. Produktové srovnání se dělá
nejdříve po sedmi plných dnech na uzavřených 24h kohortách. Průběžné nahlížení
nesmí vést k předčasnému zastavení podle právě příznivého čísla.

Dosavadní dokumentace neurčila minimální smysluplný efekt ani finální velikost
vzorku. Tento readout je proto záměrně nevyhlašuje za pochodu a sám nevrací
„vítěze“. Před finální produktovou volbou je nutné jednorázově zamknout:

- minimální prakticky významný rozdíl v `completed / started`;
- cílovou sílu testu a z ní odvozený vzorek na variantu;
- finální cutoff nebo maximální délku testu.

Do té doby jsou rozdíly mezi variantami deskriptivní, i kdyby vypadaly hezky.

## Vztah ke staršímu plánu

Zůstává zachováno: produkční non-test filtr, uzavřená 24h okna, nejméně sedm
plných dní pro produktové porovnání, absolutní počty, flow UUID korelace a zákaz
vydávat průběžná data za uplift.

Upřesnění proti `ONBOARDING-ACTIVATION-20260924.md`,
`FUNNEL-CONTEXT-20260926.md` a `FUNNEL-PRODUCTION-VERIFY.sql`:

- hranice 30 nových runů je pouze gate správnosti instrumentace, nikoli vzorek
  pro rozhodnutí A/B testu;
- starý SQL je připnutý ke staršímu releasu a pouze k `g4-e-001`, takže tento
  experiment nevyhodnocuje;
- `account_created` se nově koreluje přes `first_steps_run_id` a arm se přebírá
  z validního assignmentu;
- uložený výsledek existujícího účtu se odděluje od striktní větve nového účtu;
- přibyly SRM, bucket/board, pořadí, duplicita, provenance a uložené-result
  invarianty.

Kanonický read-only dotaz: `docs/audits/FIRST-BOARD-V1-READOUT.sql`.
