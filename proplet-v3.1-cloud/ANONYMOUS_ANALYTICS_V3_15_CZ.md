# Anonymous Analytics v3.15 — metodika

## Identita

Klient vytvoří náhodné UUID a uloží ho v localStorage pod interním klíčem Propletu. Na server posílá UUID pouze u requestů, kdy není přihlášený hráč. Backend okamžitě převádí hodnotu na SHA-256 hash; pouze hash se ukládá do Supabase.

Neprovádí se fingerprinting. Do anonymní identity nevstupuje IP, user-agent, typ telefonu, rozlišení, lokalita ani jiné charakteristiky zařízení.

## Co se měří

### Puzzle telemetry
- start pokusu,
- dokončení,
- elapsed time,
- tahy,
- chybné pokusy,
- nápovědy a nejsilnější hint,
- Clean,
- první správné slovo,
- první hint,
- reset/resume a stav progresu.

### Feedback
- Lehčí / Akorát / Těžší,
- nahlášení divného slova.

### Produktový funnel
- app_open,
- onboarding_started,
- onboarding_completed,
- account_nudge_shown,
- account_nudge_create,
- account_nudge_login,
- account_nudge_dismissed,
- account_authenticated.

## Co se anonymně neměří / nevytváří

- žádné jméno,
- žádný e-mail,
- žádná IP uložená v telemetry tabulkách,
- žádný device fingerprint,
- žádné XP,
- žádný leaderboardový výsledek,
- žádná týmová identita.

## Přechod na účet

Po úspěšném přihlášení nebo vytvoření hráče zavolá klient `/api/anonymous/claim`.

Server převede anonymní:
- puzzle_attempts,
- helper_events,
- hint_events,
- product_events,
- puzzle_feedback

pod `player_id`. Pokud už hráč pro stejné puzzle odeslal feedback z jiného zařízení, duplicitní anonymní hlas se zahodí.

Po claimu klient vytvoří nové anonymní UUID pro případ budoucího odhlášení / jiného člověka na stejném zařízení.

## Quality model

První pokus je seskupován podle:

- `player_id`, pokud je hráč přihlášený,
- `anonymous_id`, pokud účet nemá.

Tím se různí anonymní hráči neslijí do jedné identity a replay stejného anonymního hráče nezkreslí kalibraci.
