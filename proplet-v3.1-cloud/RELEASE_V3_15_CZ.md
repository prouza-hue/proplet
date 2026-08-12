# Proplet v3.15 — Anonymous Analytics + Instant Results

## Anonymní Quality Analytics

Nepřihlášený browser si při prvním použití vytvoří náhodné UUID. Server z něj spočítá SHA-256 hash s namespacem Propletu a ukládá pouze tento hash. ID není odvozené z IP adresy, user-agentu, modelu telefonu ani jiného fingerprintu.

Anonymní hráči se nově započítávají do:

- startů a dokončení puzzle,
- času, tahů, chyb a resetů,
- nápověd a jejich úrovně,
- ratingu Lehčí / Akorát / Těžší,
- hlášení problematických slov,
- základního funnelu: otevření aplikace → tutorial → nabídka účtu → přihlášení/vytvoření účtu.

Oficiální XP, série a žebříčky zůstávají pouze pro hráčské účty. Anonymní telemetry tedy neotevírá žádnou cestu k podvádění.

Pokud se anonymní uživatel později přihlásí nebo vytvoří hráče na stejném zařízení, jeho QA data se serverově připíšou danému profilu. Díky tomu jeden člověk není po registraci v kalibraci započítán dvakrát.

## Výsledkovka / žebříček

Po dokončení Free úrovně se starý obsah žebříčku okamžitě odstraní. Zobrazuje se:

`Aktualizuji pořadí… Započítávám právě dohraný výsledek.`

Teprve po úspěšné synchronizaci serveru se načte nové pořadí. Při problému se synchronizací se místo zastaralých dat zobrazí stav, že výsledek čeká na synchronizaci.

## QA dashboard

`/?qa=1` nově ukazuje zvlášť počet prvních pokusů přihlášených a dosud anonymních hráčů a přidává funnel prvního kontaktu s Propletem.

## Herní obsah

Puzzle banka, pravidla, XP a systém nápověd se v3.15 nemění.
