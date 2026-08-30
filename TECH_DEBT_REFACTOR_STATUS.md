# Technical debt refactor status

- Sprint: 07A — Čistý progress/stats výpočet
- Branch: `refactor/s07a-progress-pure-core`
- Base SHA: `d826ff9` (`origin/main`, konsolidované a uživatelem ověřené Sprinty 00–06)
- Current code checkpoint: `2548ffc` (`fix: preserve sprint 07A progress contracts`)
- Stav: hotovo; povinný STOP po samostatném Sprintu 07A
- Zamýšlená změna chování: Žádná. `backend.progress.calculate_stats()` je čistá funkce s explicitním `today`; server nadále načítá data, provádí `reconcile_gen4_free_rewards` včetně DB update/mutace řádků, zachovává fallbacky a předává kompatibilní payload. Reward classification/summing a rescue filtering jsou deterministicky v core. Malformed Daily warningy zůstávají v server adapteru.
- Změněné soubory: `backend/progress.py`, `backend/content.py`, `server.py`, `tests/current/test_s07a_progress_pure_core.py`, `tests/current/manifest.json`, tento statusový dokument.
- Hotové kroky: Přidán pure progress core pro výsledky, Daily/Free/Tajenka metriky, historie/slot projekce, streaky, badges, reward breakdown a rescue union. `backend.content` re-exportuje stejnou kanonickou streak implementaci, takže nevznikla druhá pravidlová kopie. Characterization pokrývá guest/empty, account/historické výsledky, rescue/rewards, všechny Free obtížnosti, rolling-deploy fallbacky, malformed Daily warningy, úplný pre-refactor response snapshot a přesné pořadí repair mutation/clock/unlock. Bounded invariant pokrývá 0–10 po sobě jdoucích Daily dnů.
- API/serializační kontrakt: Veřejné klíče a typy `player_stats()` zůstaly zachované; `freePlayedGen2` zůstává aliasem current slot projekce. Route i OpenAPI snapshot zůstaly beze změny. Žádné DB/schema/content/gameplay/UI změny.
- Testy PASS: Finální current gate 26/26; assety 72/72; syntax 199/199; Python/Node domain golden kontrakty PASS; Sprint 04/06/07A charakterizace PASS; pre-refactor `player_stats()` snapshot `3688983c…` je před/po identický; `git diff --check` PASS.
- Testy FAIL / nespouštěné: Žádné v lokálním ověření. Produkční DB ani Supabase schema verification SQL se nespouštěly; Sprint 07A databázi ani schema nemění.
- Nově nalezená rizika: Core nepřidává žádné repair writes; `reconcile_gen4_free_rewards` zůstává záměrně v read path až do Sprintu 07B. `free_slot_summary` a Mozkomor unlock zůstávají v server adapteru, protože stále závisí na současném content loaderu/compatibility vrstvě.
- Bezpečný bod pokračování: Ověřený code checkpoint `2548ffc`; runtime response, repair side effecty, API, databáze, content i gameplay se proti povolenému rozsahu behaviorálně nemění.
- Další povolený sprint: 07B — pouze po novém explicitním pokynu uživatele a schválení Sprintu 07A preview.
