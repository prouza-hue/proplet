# Aktualizace nasazeného Propletu v3.1 → v3.2

Databáze Supabase se nemění. Environment Variables ve Vercelu se nemění.

1. Rozbal `proplet-v3.2-cloud.zip`.
2. Otevři své repository `proplet` na GitHubu.
3. Nahraď obsah repository obsahem rozbalené složky v3.2. Nejdůležitější změněné soubory jsou `server.py` a soubory v `public/`.
4. Commitni změny do stejné hlavní větve, ze které Vercel deployuje.
5. Vercel automaticky spustí nový deployment.
6. Po dokončení otevři aplikaci a obnov stránku. U nainstalované PWA ji jednou úplně zavři a znovu otevři; v3.2 má nový service-worker cache a převezme řízení automaticky.
7. Otevři Profil. U synchronizace musí být vidět konkrétní stav místo původního tichého tlačítka.
8. Dokonči Daily nebo běžnou úlohu. Výsledek se má synchronizovat automaticky. Pokud ne, Profil nyní ukáže konkrétní důvod chyby.

### Rychlá kontrola
Otevři `https://proplet-nine.vercel.app/api/health`.
Správně má vrátit `"ok": true` a `"database": true`.

Žádný nový SQL skript není potřeba spouštět.
