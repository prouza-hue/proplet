# Aktualizace playtestu Nový vzhled — 31. 10. 2026

Na přání Pavla přeneseny schválené opravy z listopadového kandidáta 2f6c695 do větve codex/today-one-screen: stabilní první zobrazení bez mezilehlé kompozice, čistá výsledkovka a bonus ve stickeru, Fraunces na nadpisech, zarovnaná kompaktní akce Hrát. Přeneseny i odpovídající cílené regresní testy a aktualizovány verze souborů pro offline cache (ui-pilot2).

Pouze existující preview. Produkční nasazení ani databáze se nemění, stávající přihlášení a propojení reálných hráčských účtů zůstávají. Měsíční soutěž a jednorázové oznámení jsou nadále součástí samostatného listopadového kandidáta.

Ověření před push: test_marketing_diagnostics.cjs, test_result_action_dock.js, test_result_summary_visibility.cjs, test_release_contract.py, syntaxe dotčených JS a diff check prošly. Stejné vzhledové změny byly již vizuálně ověřeny v kandidátu na 320–1440 px; po deploy ověřit skutečný preview release marker a načtené styly. Nebyly synteticky hrané hry na skutečných účtech.
