# Admin obnova legacy účtů

Tato funkce řeší staré účty, které mají heslo, ale nemají ověřený e-mail a proto nemohou použít běžnou obnovu hesla.

## Bezpečnostní model

- Nasazená administrace (Vercel `preview` i `production`) je navíc k `admin_accounts` pevně připnutá na jediný vlastnický `player_id`. Přidání dalšího řádku do `admin_accounts` samo o sobě přístup neudělí.
- Admin nikdy nezapisuje `email_verified_at` a nikdy neoznačuje adresu jako ověřenou.
- Admin z detailu konkrétního hráče zadá e-mail. Server vytvoří jednorázový `link_email` challenge právě pro jeho stabilní `player_id` a odešle Supabase Magic Link.
- Teprve existující `/api/account/email/verify` po kliknutí na link ověří, že Supabase Auth token patří stejné e-mailové adrese, a následně ji připíše k hráči jako ověřenou.
- Ověřený e-mail, který už vlastní jiný hráč, nelze převzít.
- Nový požadavek zneplatní starší nedokončené `link_email` challenge stejného hráče.
- Pokud se Magic Link nepodaří odeslat, nově vytvořený challenge se okamžitě zneplatní.
- Admin odpovědi zobrazují pouze maskovaný e-mail. Plná adresa je uložena jen tam, kde ji recovery/auth flow potřebuje.
- Každý požadavek a případné selhání doručení se zapisují do `admin_audit_log`.

## Uživatelský průchod

1. V administraci otevřít **Uživatelé** a konkrétní účet podle historie/UUID.
2. V části **Obnova přístupu** zadat adresu, jejíž držitel byl ověřen mimo Proplet.
3. Potvrdit odeslání.
4. Hráč otevře Magic Link ve své schránce. Tím se e-mail bezpečně propojí s vybraným Proplet účtem.
5. Od této chvíle funguje standardní **Zapomenuté heslo**.

Funkce záměrně neposkytuje přímé přepsání hesla ani ruční „označit e-mail za ověřený“.
