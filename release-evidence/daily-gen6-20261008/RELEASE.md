# Daily Gen6 — nasazení od 8. 10. 2026

Schváleno uživatelem po playtestu ukázky; požadavek nasadit až zítra byl přijat 7. 10. Europe/Prague. Uchována produkční deska 7. 10. g4-d-045 včetně ID, těla a nároků na XP. Nová banka má 99 desek od 8. 10. do 14. 1. 2027. Datumový rozpis nebyl posunut; první nevyužitý kandidát pro 7. 10. je archivován ve výrobní větvi / PR #180.

Kvůli uchování MÁSLO z dnešní desky byla nově vyrobena pouze 12. 10. Easy: JETEL / OMÁČKA / VEČER / BZUKOT. AI redakční kontrola přijala tuto náhradu; ostatních 98 přijatých záznamů je ověřeno shodou contentHash. Uživatelský playtest této náhrady netvrdíme.

99 desek prošlo nezávislým ověřením cest, úplného pokrytí, jediného celkového řešení, kadence, variant podle původního ordinalu, cooldownu a lexikonu v3. Efektivní rozpoznávací množina je shodná se zmrazenou výrobní množinou 103836 tvarů. Runtime slovník navíc zachovává všech 507 dřívějších krátkých tvarů, které pravidla solveru nepoužívají. Historický pilot zůstává ověřován nad vlastním původním slovníkem; jeho hráčské desky nejsou upraveny.

Lokální current-runtime: 133 testů PASS, 148 asset kontrol PASS, 215 syntax kontrol PASS. Skutečné FastAPI/ASGI ověřilo všech 99 dat, pražskou půlnoc, 25hodinový den, konec bez modulo, historii a odmítnutí future/private obsahu. Chromium emulace 390×844 / 690×829 / 1280×900: skutečné tahy, všech 7 slov první desky dokončeno, výsledkový modal bez chyb a vodorovného overflow; snímky skutečně prohlédnuty. Není to test fyzického Foldu.

Přesná produkční atomic RPC byla zkopírována do privátního schématu na izolovaném test projektu. Syntetičtí hráči: souběh, opakování po ztracené odpovědi a přechod generace zachovaly jednu odměnu 100 XP. Podrobné omezení testu je v database-proof.json. Produkční hráčská data ani funkce nebyly upraveny. Testovací schéma bylo odstraněno a projekt vrácen do pauzy.

Aktivace vyžaduje approved privátní pack a atomic flag. Budoucí desky nejsou v public ani SW. Po 14. 1. chybějící návazný obsah vrací nedostupnou výzvu; stará banka se nezačne opakovat. Po cutoveru rollback nesmí obnovit starou modulo Daily ani změnit již vydané ID / hash. Zachovat vydaný resolver a historii, případně Daily dočasně nedostupná a opravit vpřed.

Připomínka je nastavena na 31. 12. 2026 09:00 Europe/Prague (14 dní před poslední deskou), s požadavkem zohlednit nejnovější schválený generátor a navázat od 15. 1.
