# Detaily úspěchů a Krotitel pohromy

Pavel požádal o přepracování nečitelného Krotitele pohromy, detail všech úspěchů po klepnutí ve stylu CTA Refresh 300 a souvislé pořadí obtížností. Výchozí main i produkce: c2718b89a618b750fbdccaa30b156687c3233096.

## Ilustrace a vlastní kritika

Původní čtyři svorky kolem víru byly bez vysvětlení nejasné. Nový motiv: měděná rukavice svírá zlatý blesk pod bouřkovým mrakem. Zachovává inkoustovou linku, měď, zlato, papírová světla i čtyři drobné značky stupně. První vlastní kontrola odhalila, že dolní část blesku zcela mizela za rukou; finální varianta ji nechává vystoupit vedle zápěstí. Silueta nyní ukazuje akci a odlišuje se od ostatních kruhových emblémů série. Jde o původní statické SVG, zdroj je v existujícím generátoru. V obrázku nejsou filtry, animace ani rastrové části.

## Detail

Všech 97 úspěchů má vlastní krátký text v achievement-stories.js. Přesná podmínka i stav se dál čtou z původní definice a jednoho effectiveStats() snapshotu při otevření. Žádný průběžný přepočet při scrollování či nové observery. Zobrazení je read-only, nezískává úspěch a neoznačuje hromadnou oslavu za viděnou.

Klepnutí, kliknutí, Enter nebo mezerník funguje na kartě v profilu, miniatuře v souhrnu i odznaku v dokončovacím okně. Nativní dialog má velkou barevnou kresbu (i u zamčeného úspěchu), název, příběh, přesnou podmínku, postup a tlačítko Zavřít detail. Bez eyebrow. Barvy, světlo na papíru, Fraunces a plastické zelené tlačítko navazují na produkční CTA Refresh 300.

Zavření: křížek, hlavní tlačítko, Escape, ťuknutí na pozadí, Android/browser Back. Focus trap, návrat focusu a obnovení scrollu; detail je nad výsledkovým modálem a jeho zavření výsledek nezavře. Změna účtu/obrazovky a globální zavírání používají vlastní close metodu.

Pořadí skupin: celkový postup, Snadná, Střední, Těžká, Mozkožrout, Mozkomor, Mozkokalypsa, následně Denní výzva, Tajenka a ostatní. Pravidla odemykání i dřívější společné předání Mozkokalypsy se nemění.

## Ověření

Rozšířený test achievementů kontroluje úplnost a jedinečnost 97 textů, pořadí a offline soubory. Browser test ověřuje dotyk, klávesnici, focus, Escape, Back, zavření pozadím, všechny ilustrace a texty, zamčený/získaný stav, beze změny uloženého postupu. Screenshoty 320/390/768/1440 px, dark mode a detail z oslavy. Izolovaný server bez produkčních přístupových údajů; emulace není test fyzického Fold 7.
