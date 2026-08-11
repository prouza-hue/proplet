# Proplet v3.2.1 – hotfix synchronizace

Tento hotfix nevyžaduje žádnou změnu v Supabase ani nové Environment Variables.

1. Nahraď na GitHubu `server.py` novou verzí z tohoto balíčku.
2. Doporučeně nahraď také `public/sw.js`, aby se cache verze jednoznačně posunula.
3. Commitni změny. Vercel automaticky nasadí nový deployment.
4. Po dokončení otevři Proplet a v Profilu stiskni **Synchronizovat**. Čekající Daily výsledek se má odeslat a fronta zmizet.
5. Pokud by synchronizace stále selhala, frontend už zobrazí detail. Ve Vercelu navíc otevři Project > Logs a vyhledej request `/api/result`.

### Co hotfix opravuje
- Výpočet statistik je odolný vůči starším nebo nekonzistentním řádkům.
- Již úspěšně uložený výsledek už nebude označen jako neúspěšný jen proto, že následné přepočítání statistik selhalo.
- Číselné hodnoty z databáze se explicitně převádějí na `int` před porovnáváním rekordů.

Databáze ani Daily puzzle se nemění.
