# Aktualizace Propletu na v3.19.2

Jde o čistě klientský hotfix nad v3.19.1. Není potřeba spouštět SQL ani měnit Supabase.

1. Nahraj obsah `proplet-v3.19.2-update.zip` do kořene stejného GitHub repozitáře a přepiš shodné soubory.
2. Počkej na dokončení Vercel deploymentu.
3. `/api/health` musí ukazovat `version: 3.19.2` a `ok: true`.
4. Obnov aplikaci nebo potvrď nabídku nové PWA verze.

Data webu ani přihlášení nemaž.
