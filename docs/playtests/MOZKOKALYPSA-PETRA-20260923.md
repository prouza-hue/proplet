# Rozšíření hodnotící skupiny

Na výslovné zadání vlastníka přidáváme hráčku Petra do role tester, nikoli observer. Výběr původní trojice se neopakuje a její přiřazení zůstává zachované. Petra používá existující pořadí 1; slot znamená pořadí desek, více hodnotitelů jej může sdílet. Účet je před zápisem jednoznačně ověřen podle player_id.

Primární report zahrnuje všechny participant_role='tester'; vedle celkového výsledku zachová i pohled na původní XP-vybranou trojici, protože Petra byla vybrána dodatečně. Pavel zůstává observer a vykazuje se odděleně.

Migrace odstraňuje pouze unikátnost slotu mezi hodnotiteli. Unikátní pozvánka hráče, omezení slotu 0–2, jedna observer role, RLS, granty a autentizace se nemění. Herní kód a deset desek zůstávají beze změny. Izolovaný test ověřuje přístup dalšího hodnotitele sdílejícího pořadí; žádné syntetické hraní na skutečném účtu.
