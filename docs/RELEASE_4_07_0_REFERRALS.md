# Proplet 4.07.0 — pozvánky a výsledkovka

Zadání a autorizace produkčního nasazení: Pavel, 12. 10. 2026.
Základ: main a0e3b622 (4.06.0), zachovává Denní Extra a opravy databázového provozu.

## Rozsah
- Schválené UI pozvánek a kompaktní výsledkovka přenesené z PR #176, bez fixture transportu a testovacích ovladačů.
- Liška a ježek jsou věrné WebP deriváty existujících v3 SVG (192 px, kvalita 88), dohromady přibližně 22 kB místo 2,4 MB. Jednorázové CTA čeká na oba obrázky.
- Jednorázové CTA respektuje rozehranou hru, otevřené dialogy a onboarding. Zapamatování je pro účet v daném prohlížeči.
- Připsaný bonus „Bonus máš ty i {nickname}.“ lze zavřít; server pamatuje zavření mezi zařízeními. Nastavení neobsahuje pozvánkové karty.
- Dokončený pozvaný může sám zvát. Neplatný veřejný kód neblokuje běžnou registraci.
- Serverová atribuce pouze nového účtu při registraci heslem nebo přes Google. Stejná deska se započítá pouze jednou; desky před registrací a trénink se nepočítají.
- Pátá uznaná deska a obě odměny +1000 XP tvoří jedinou databázovou transakci. Bonus je pouze v celkových XP, nikoli v časově omezených osobních/týmových žebříčcích.
- Nový flag PROPLET_REFERRALS_ENABLED je pouze produkční. Vypnutí zastaví nové pozvánky; již slíbené odměny se bezpečně dokončí.
- Archiv a měsíční soutěž z PR #188 se tímto nespouštějí.

## Ověření
Browser testy používají skutečné produkční skripty a obrázky s explicitně mockovaným API, bez zápisů do produkce.
Databázové testy používají samostatné testovací schéma s rollbackem a izolovaný PostgreSQL v CI. Nejsou to simulované odměny z původního preview.
Finální SHA, běhy a produkční deployment jsou uvedeny v release PR.
