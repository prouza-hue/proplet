# Aktualizace Proplet v3.20.1 → v3.20.2

## Co opravuje

v3.20.2 je malý UX hotfix pro hraní na telefonu naležato.

- Na **telefonu** se během rozehrané hry v landscape už nesnažíme násilně vměstnat desku do nízkého viewportu.
- Místo toho se zobrazí čistá celoplošná informace **„Otoč telefon na výšku“**.
- Hra i čas se při zobrazení této informace **automaticky pozastaví**.
- Po otočení zpět na výšku se hra sama vrátí a čas pokračuje přesně od stejného místa.
- Blokace platí jen pro **aktivní rozehranou hru na telefonu**. Výsledkovka, Dnes, Volná hra, Pořadí, profil, desktop a tablet landscape zůstávají normálně použitelné.

## Supabase

**Žádná SQL migrace není potřeba.**

Pokud už je nasazená migrace v3.20, v Supabase nic dalšího nespouštěj.

## GitHub

Obsah update ZIPu nahraj do adresáře:

`proplet-v3.1-cloud/`

nikoli do rootu repozitáře.

Přepiš stejnojmenné soubory a commitni změnu. Vercel vytvoří nový deployment.

## Kontrola po deployi

1. Otevři `/api/health` a ověř `"version": "3.20.2"`.
2. Na Fold 7 spusť libovolnou hru na výšku.
3. Otoč telefon naležato — má se zobrazit informace **Otoč telefon na výšku** a čas se nesmí posouvat.
4. Otoč telefon zpět — hláška zmizí, deska zůstane rozehraná a čas pokračuje.
5. Po dokončení hry může výsledkovka fungovat i naležato; blokace už se nesmí objevit.

Puzzle banka se v tomto hotfixu nemění.
