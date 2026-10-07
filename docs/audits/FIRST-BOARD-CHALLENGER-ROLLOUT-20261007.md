# První skutečná deska g4-e-009

Provozovatel 7. 10. zvolil g4-e-009 jako výchozí první Volnou hru po tréninku.
Jde o praktický produktový rollout, nikoli vyhlášení statistického vítěze.

- Nové identity ve všech prostředích dostanou challenger_e009 s policy
  challenger_rollout_20261007; původní identity_bucket zůstává zachovaný.
- Staré assignmenty v ledgeru nebo historických událostech zůstávají sticky.
  Žádná rozpracovaná hra, uložený výsledek, XP ani staré přiřazení se nepřepisuje.
- Nejsou změněné veřejné klientské soubory, SW, banka Daily, backend/content.py
  ani server.py. Dosavadní cached first-steps klient přijímá serverové přiřazení.
- Změna backend/measurement.py pouze přidává policy do povolené provenance.
- Nejprve nasadit tento kompatibilní backend z aktuálního mainu, teprve potom
  aplikovat migraci 20261007004734_first_board_challenger_rollout.sql.
  Vynechání první fáze by ztratilo policy na downstream eventech.
- Historický first-board-v1 test zůstává uzavřený k 6. 10. 00:00 Prague.
  Nová policy není randomizace 50/50 a nesmí vstoupit do původního SRM.
- PR180 Generování Daily desek nebyl mergován ani změněn; před tímto releasem
  ověřit znovu jeho head a produkční main. Rozšíření Daily může nadále použít
  vlastní navazující release.

Ověření: izolovaný API a cached-client kontrakt; kandidátní migrace a rollback
test na skutečném Postgresu s is_test=true (buckety0/49/50/99, sticky retry,
jedna assignment událost, zachování historické kontroly, RPC bez veřejných práv).
SQL test je FIRST-BOARD-CHALLENGER-VERIFY.sql. Celý runtime gate má známé
historické frozen-route digest problémy S04/S06; nepřepisovat jejich očekávání.
