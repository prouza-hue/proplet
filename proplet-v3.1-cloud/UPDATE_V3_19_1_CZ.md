# Bezpečná oprava Propletu na v3.19.1

Tento hotfix je určený pro poškozené nasazení v3.19.0. Supabase ani hráčská data nemaž a nečisti data webu v telefonu.

## Doporučený postup

1. Pro jistotu si v GitHubu ponech historii stávajícího repozitáře. Není potřeba mazat repozitář ani odpojovat Vercel.
2. Rozbal `proplet-v3.19.1-cloud.zip`.
3. Nahraj **obsah rozbalené složky** do kořene stejného GitHub repozitáře a přepiš shodné soubory. Kritické jsou zejména `public/index.html`, `public/app.js`, `public/sw.js`, `server.py` a celá složka `public/`.
4. Počkej na dokončení jediného Vercel deploymentu.
5. Nejdřív otevři `/api/health`. Očekávané hodnoty jsou `version: 3.19.1`, `ok: true`, `database: true`, `adminStatic: true` a `freeLevelsPerDifficulty: 200`.
6. Otevři `/admin`; musí přesměrovat na funkční `/admin.html`.
7. Nakonec otevři hlavní aplikaci. Pokud se objeví nabídka aktualizace, potvrď ji. Data webu ani PWA ručně nemaž.

## Proč nepoužívat mazání celého repozitáře

Přepsání kompletním balíkem je bezpečnější a proběhne jedním deploymentem. Smazání všech souborů a jejich následné nahrání by mohlo mezi dvěma commity vytvořit další prázdné nasazení. Historie GitHubu zároveň funguje jako záloha.

## Databáze

Pokud už `/api/health` u v3.19.0 ukazoval všechny migrace jako `true`, nespouštěj žádný rollback. V3.19.1 používá stejné schéma. Přihlášení je uloženo ve stejném originu a po načtení opraveného JavaScriptu se má hráč znovu objevit. I případné nové přihlášení načte serverový postup ze Supabase.
