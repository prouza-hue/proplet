# Párování podpory — rozhodnutí a možnosti banky

31. 10. 2026. Patronství zůstává oddělené od listopadového vydání.

Schválený příjemce: 5531840001/5500. Zpráva: „NICKNAME podporuje Proplet“.
Zpráva slouží k orientaci, nikoli k identifikaci účtu. Rozhodující je unikátní
variabilní symbol navázaný na neměnnou identitu hráče a konkrétní požadavek.
Přezdívka v poznámce je snímek při vytvoření; pozdější přejmenování vazbu nemění.

Vygenerování QR není potvrzení převodu. Administrace má uvádět skutečnost
„Vygeneroval platební údaje“ a datum, nikoli odhad „Nejspíš zaplatil“.
Veřejná značka vzniká až po potvrzení přijaté platby a výslovné volbě hráče.
Jedinečný identifikátor bankovní transakce chrání před opakovaným zpracováním.
QR předané někomu jinému stále odkazuje na původního příjemce poděkování;
bankovní jméno plátce ani text poznámky nesmějí automaticky přepsat vlastníka.

První etapa: ruční ověření bankovního výpisu oprávněným správcem. Automatické
napojení banky není součást tohoto schváleného implementačního rozsahu.

RB Premium API podle oficiální dokumentace poskytuje seznam účtů, transakční
historii a výpisy: https://developers.rb.cz/premium . Dostupnost a podmínky pro
Pavlův konkrétní osobní účet nebyly ověřeny. Proto zatím netvrdíme, že je tato
varianta dostupná nebo nejlevnější. Je to první kandidát k prověření vzhledem
k již zvolenému účtu. Případná integrace má mít jen oprávnění ke čtení a párovat
zaúčtované příchozí platby podle reference, měny, částky a cílového účtu;
neshody předá správci. Žádné bankovní přihlašování ani certifikáty se nyní nepřidávají.

Formát QR ověřen proti https://qr-platba.cz/pro-vyvojare/specifikace-formatu/ :
SPAYD, měna CZK, částka nejvýše dvě desetinná místa, zpráva do 60 znaků,
variabilní symbol nejvýše 10 číslic. Vstup hráče nesmí vytvořit další pole QR.
Modelové preview nesmí generovat platitelný QR se smyšlenou vazbou na hráče.
