# Proplet v3.31.8 — Account Recovery & Google Login

## Cíl

Odstranit stav, kdy zapomenuté heslo znamená ztrátu přístupu k účtu, a současně snížit tření při přihlášení přes Google bez rizikové jednorázové migrace existujících hráčů.

## Kompatibilita

- `players.id` zůstává kanonická herní identita.
- Stávající přihlášení jménem + heslem zůstává funkční.
- Stávající scrypt `password_hash` se nemigruje do Supabase Auth.
- Supabase Auth slouží jako důkaz vlastnictví e-mailu / Google identity.
- Ověřený e-mail lze následně použít i jako login identifikátor s existujícím Proplet heslem.

## Recovery email

- E-mail při vytvoření účtu je nepovinný.
- UI výslovně upozorňuje, že bez ověřeného e-mailu nelze obnovit zapomenuté heslo.
- E-mail se stává recovery-capable až po Magic Link ověření.
- Jeden ověřený e-mail může patřit jen jednomu Proplet účtu.
- Veřejný forgot-password endpoint neprozrazuje, zda e-mail v systému existuje.
- Forgot-password používá dedikovaný Supabase password-recovery endpoint; nejde o běžný Magic Link login.
- Recovery challenge je jednorázová, krátkodobá a v DB je uložen pouze SHA-256 hash tokenu.
- Úspěšný reset hesla zneplatní starý primární token i všechny další `player_sessions` a vydá novou session.

## Google

- Google OAuth probíhá přes Supabase Auth.
- Přihlášený Proplet hráč může Google bezpečně propojit se svým existujícím účtem.
- Nepřihlášený Google uživatel se mapuje podle `auth_user_id`; bezpečný auto-link je povolen pouze přes již ověřený e-mail, nikdy podle zobrazovaného jména.
- Pokud neexistuje odpovídající Proplet účet, vytvoří se nový solo účet a zachová se standardní Proplet player/session model.
- Google tlačítko používá standardní barevnou značku Google G.

## Databáze

Migrace `v3_31_8_account_recovery_identity` přidává do `players` nullable:

- `email`
- `email_verified_at`
- `auth_user_id`

A service-role-only tabulku `account_auth_challenges` pro `link_email` a `recover_password`.

## Před produkcí ověřit

1. Starý login jméno + heslo.
2. Login ověřený e-mail + stejné heslo.
3. Vytvoření účtu bez e-mailu.
4. Vytvoření účtu s e-mailem → ověřovací Magic Link → stav profilu zelený.
5. Forgot password pro neexistující e-mail vrací stejnou generickou odpověď.
6. Forgot password pro ověřený e-mail → reset → staré sessions přestanou fungovat.
7. Google link na již přihlášeného hráče zachová player ID, XP, tým a historii.
8. Google login na propojený účet vrátí stejné player ID.
9. První Google login bez existujícího účtu vytvoří nový solo účet.
10. Mobil, desktop, light/dark; návrat z mailové aplikace i z Google OAuth.
11. Produkční SMTP musí být nakonfigurované před ostrým releasem.

## Externí konfigurace

- 2026-08-17: provozovatel potvrdil dokončení Google OAuth + Supabase redirect/provider nastavení.
- Funkční end-to-end ověření Google callbacku a recovery flow stále patří do preview QA před merge do produkce.
