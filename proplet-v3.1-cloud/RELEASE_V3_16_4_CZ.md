# Proplet v3.16.4 — krásné sdílení a světové Daily pořadí

## Odkaz už nevypadá jako sirotek

Sdílená adresa Propletu dostala kompletní vizuální identitu:

- nový náhled odkazu 1200×630 px v barvách hry,
- Open Graph metadata pro Messenger, WhatsApp, iMessage a sociální sítě,
- velký náhled pro platformy používající Twitter Cards,
- SVG favicon a PNG zálohu 32×32,
- ikonu 180×180 pro iOS,
- PWA ikony 192×192 a 512×512 pro Android a instalaci na plochu.

Web Share API nyní předává adresu jako skutečnou URL, nikoli pouze jako kus textu. Aplikace tak příjemci nabídne klikací odkaz a podporované služby mohou korektně načíst obrázkový náhled. Při kopírování do schránky zůstává text i URL pohromadě.

## Globální Daily přímo na výsledkovce

Po dokončení nebo znovuotevření výsledku Daily se zobrazí:

- přesné globální pořadí hráče,
- počet lidí, kteří dnes dokončili aktivní Daily,
- zařazení mezi nejlepších X %,
- jedno sousední místo nad hráčem a jedno pod ním,
- férové pořadí **Clean → méně nápověd → čas → tahy**.

Výsledek se nejdřív synchronizuje a až potom se načte globální pozice. Pokud je telefon offline, hra výsledek neztratí a karta pouze počká na pozdější synchronizaci.

### Soukromí

Globální API neposílá jména, avatary, tým, interní ID ani jiný identifikátor. U okolních míst je vidět pouze anonymní výkon. Přihlášený hráč pozná vlastní řádek jako **Ty**. Nepřihlášený hráč vidí počet dnešních účastníků, ale přesnou pozici dostane až po připojení profilu.

Do sdíleného textu Daily se po načtení doplní také například `🌍 12. z 148`.

## Databáze a ekonomika

- žádná nová SQL migrace,
- žádná změna XP,
- žádná změna stávajících výsledků ani leaderboardů týmů,
- do globálního pořadí se počítá pouze aktivní generace Daily.

## Testy

- syntaxe klienta a kompilace serveru,
- 13 regresních testů včetně pořadí, filtrace staré Daily a neúniku identity,
- kontrola metadat a přesných rozměrů všech obrázků,
- kontrola HTML ID, CSS závorek a integrity ZIPů.
