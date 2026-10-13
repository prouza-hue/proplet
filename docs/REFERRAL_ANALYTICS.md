# Pozvánky: měření a čtení výsledků

Začátek sběru: produkční nasazení **4.07.2** dne 13. 10. 2026; přesné UTC a commit potvrdí release záznam.
Před tímto nasazením nové klientské události neexistují. Historické SQL pozvánky z verze 4.07.0 tím nezmizí.

## Přesné významy
| Event | Co skutečně potvrzuje |
| --- | --- |
| referral_invite_dialog_opened | Úspěšné zobrazení finálního vysvětlení bonusové pozvánky. Výběr deska/nový hráč se nepočítá. |
| referral_share_requested | Kliknutí na hlavní sdílecí tlačítko pozvánky. Přímé „Kopírovat“ se sem nepočítá. |
| referral_share_native_resolved | navigator.share() skončil úspěšným resolve; prohlížeč předal obsah nativnímu sdílení. |
| referral_share_native_cancelled | navigator.share() skončil AbortError. |
| referral_share_native_failed | Jiná chyba navigator.share(); může následovat kopírovací fallback. |
| referral_copy_succeeded | Clipboard write skutečně uspěl. |
| referral_copy_failed | Clipboard write selhal; ruční označení odkazu není úspěšné kopírování. |
| referral_landing_validated | První načtení platné pozvánky po OK veřejné serverové validaci v dané relaci prohlížeče a kód. |

**Úspěšný share ani copy neznamená doručení zprávy.** Stejné gesto může mít native_failed a následně copy_succeeded;
součet těchto eventů není počet odeslaných zpráv ani pozvaných lidí.
Bez native API hlavní gesto vytvoří share_requested a copy outcome s metodou no_native.
Přímé Kopírovat vytvoří jen copy outcome s copy_button. Po selhání native API je metoda share_fallback.
Události sdílení konkrétní desky zůstávají v dosavadním daily/level/tajenka funnelu.

## Provenance a pokrytí
Tělo product event API zůstává pouze event_type; offline batch zachovává ID a čas.
Dvě konečné množiny headerů zapisují context.referral_entry_source
(daily/tajenka/win/home/profile/announcement/landing) a context.referral_copy_method
(copy_button/share_fallback/no_native, jen copy outcomes).
Neznámé hodnoty server zahodí. Kód pozvánky, její URL, nick a identifikátory pozvaných se neposílají.
Referral events nezdědí právě otevřenou herní desku. Server environment a is_test zůstávají stávající provenance.

Nové eventy používají stávající produktovou frontu a její politiku. Interní ne-marketingové herní eventy
jsou v současné aplikaci povolené nezávisle na marketing consent; marketing_* a třetí strany dál respektují svůj consent.
Nevzniká druhý přímý analytics sender ani marketing-consent bypass. Preview analytiku neodesílá.
Offline/síťové ztráty, více zařízení a relace mohou ovlivnit počty. „Unique actor“ není počet osob.
Po přiřazení anonymní historie účtu používá report jeho stávající player_id; samotný landing se nezúčtuje jako přijetí.

## Read-only report
Následující SQL čte aktuální český den. Pro jiné období nahraď bounds dvěma explicitními UTC timestamptz.
Vždy production AND is_test=false. Nepočítá se operational_events.

```sql
WITH bounds AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Prague')
           AT TIME ZONE 'Europe/Prague' AS from_utc, now() AS until_utc
)
SELECT e.event_type,
       coalesce(e.context->>'referral_entry_source','unknown') AS entry_source,
       coalesce(e.context->>'referral_copy_method','none') AS copy_method,
       count(*) AS events,
       count(DISTINCT coalesce('p:'||e.player_id::text,'a:'||e.anonymous_id)) AS unique_actors
FROM public.product_events e CROSS JOIN bounds b
WHERE e.environment='production' AND e.is_test=false
  AND e.created_at>=b.from_utc AND e.created_at<b.until_utc
  AND e.event_type IN (
    'referral_invite_dialog_opened','referral_share_requested',
    'referral_share_native_resolved','referral_share_native_cancelled','referral_share_native_failed',
    'referral_copy_succeeded','referral_copy_failed','referral_landing_validated'
  )
GROUP BY 1,2,3 ORDER BY 1,2,3;
```

Přijetí a výplata jsou **serverová data**, nikoli klientské eventy.
referral_claims nemá vlastní environment/is_test; produkční kohortu určuje autoritativní account_created
vzniklý triggerem players_insert. Neznámá nebo testovací signup provenance se do této kohorty nezapočítá; jejich počty report ukazuje samostatně, nikoli potichu.

```sql
WITH bounds AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Prague')
           AT TIME ZONE 'Europe/Prague' AS from_utc, now() AS until_utc
), production_invitees AS (
  SELECT DISTINCT player_id FROM public.product_events
  WHERE event_type='account_created' AND environment='production' AND is_test=false
    AND context->>'origin'='players_insert'
), cohort AS (
  SELECT c.* FROM public.referral_claims c
  JOIN production_invitees p ON p.player_id=c.invitee_id
)
SELECT count(*) FILTER (WHERE c.accepted_at>=b.from_utc AND c.accepted_at<b.until_utc) AS new_acceptances,
       count(DISTINCT c.inviter_id) FILTER (WHERE c.accepted_at>=b.from_utc AND c.accepted_at<b.until_utc) AS inviters,
       count(*) FILTER (WHERE c.paid_at>=b.from_utc AND c.paid_at<b.until_utc) AS paid_pairs,
       (SELECT count(*) FROM public.referral_claims x
        WHERE x.accepted_at>=b.from_utc AND x.accepted_at<b.until_utc
          AND NOT EXISTS (SELECT 1 FROM public.product_events a WHERE a.player_id=x.invitee_id
                          AND a.event_type='account_created' AND a.context->>'origin'='players_insert')) AS unknown_signup_provenance,
       (SELECT count(*) FROM public.referral_claims x
        WHERE x.accepted_at>=b.from_utc AND x.accepted_at<b.until_utc
          AND EXISTS (SELECT 1 FROM public.product_events a WHERE a.player_id=x.invitee_id
                      AND a.event_type='account_created' AND a.context->>'origin'='players_insert')
          AND NOT EXISTS (SELECT 1 FROM production_invitees p WHERE p.player_id=x.invitee_id)) AS excluded_test_or_nonproduction
FROM bounds b LEFT JOIN cohort c ON true
GROUP BY b.from_utc,b.until_utc;
```

accepted_at je neměnné přiřazení nového účtu. paid_at znamená dokončených pět unikátních desek a
atomické připsání 1 000 XP každému; do týdenního osobního/týmového XP bonus nejde.
Paid dnes může patřit pozvánce přijaté dříve. Nelze z dnešních paid/dnešních opens vyvozovat konverzi.
Pro konverzi musí být uzavřená stejná accepted_at kohorta a čas na dohrání; bez ID pozvánky v klientských eventech
nelze poctivě přiřadit každý landing k konkrétnímu pozývajícímu.
