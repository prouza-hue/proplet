# Podporovatel v pořadí — designový preview

3. 10. 2026, navazuje na dobrovolnou podporu. Pavel nyní preferuje začít QR pilotem; tímto zadáním žádá návrh veřejného označení v žebříčcích, nikoli zapnutí plateb.

## Výsledek a doporučení

Inkoustově modrá pečeť se stávajícím srdcem podpory, jemný dvojitý obrys původního avatara, čitelný štítek Podporovatel. Stejná identita po dokončení úrovně a v celkovém XP pořadí. Zlato zůstává výkonu; zelené vlastní zvýraznění zůstává. Označení se nepřepočítává podle výše příspěvku a nemění pořadí ani XP.

Kliknutí na označení otevře dialog s poděkováním, vlastní ukázkovou značkou a CTA do neplatební QR demonstrace. Veřejné označení je volitelné. Samotné zobrazení QR nic neaktivuje. Před skutečným pilotem rozhodnout dobu platnosti označení po jednorázovém příspěvku a způsob ověřeného párování bankovních převodů.

## Provenance a izolace

- GitHub main znovu ověřen: `5ac821081a64d3b106aff997a5aa5d2b36986f05`.
- Produkční Vercel deployment znovu ověřen: `dpl_3VHfzz2tygVryBey64395PuXcM6j`, stejný SHA.
- Pracovní větev `preview/support-20261003`, před začátkem čistá na `4ae03a9`.
- Žádná připojená databáze, Supabase, bankovní API ani platební brána. Původní statická izolace platí i pro `patron.html`.
- Produkční `app.js` beze změny. Nové soubory CSS/JS tvoří výhradně designovou vrstvu nad jeho aktuálním HTML, styly a lokálními avatary. Pořadí a jména jsou syntetické fixtures, nikoli skutečné výsledky hráčů.
- Tato větev je výhradně preview a nesmí být mergována do mainu: má statickou konfiguraci Vercelu. Preview deploy neposílá production target ani aliases.

## Ověření

16 browser kontrol: badge/detail/QR/částka/Escape/návrat do výsledku/skrytí značky, bez horizontálního přetečení při 320, 390, 768 a 1440 px. Světlý a tmavý režim, dlouhé jméno, lokálně nulové JS výjimky a žádné požadavky na produkční/datové/platební API. QR nese pouze demo text, žádný platební příkaz. Skutečné screenshoty viz `public/patron-review`, galerie `patron-gallery.html`. Emulované viewporty, nikoli test fyzického Foldu.

Nezávislá vizuální revize doporučila tento směr; zapracováno zjemnění štítku a sjednocení modrého CTA. Pořadí týmové a globální lze přepnout; v rozbaleném globálním pořadí je explicitně popsáno, že jde o ukázku prvních šesti hráčů.

Build: nejprve existující `tools/build_support_preview.py`, potom `tools/build_patron_preview.py`. Browser kontrola `tools/patron_verify.cjs`; galerie `tools/patron_gallery.py`; pouze preview nasazení `tools/deploy_patron_preview.cjs`.

## Publikovaný výsledek

- Preview: https://proplet-dfdb6tmdg-pavel-prouzas-projects.vercel.app/patron.html
- Galerie: https://proplet-dfdb6tmdg-pavel-prouzas-projects.vercel.app/patron-gallery.html
- Deployment `dpl_6kwHCEo6nCGboSawfuzr13meFCD6`, READY, target null, žádné aliasy.
- Publikovaný zdrojový commit `cce6492e29d90920d7fe1441d7ce637e994a370a`.
- Všech 16 browser kontrol prošlo také na veřejném URL, bez JS výjimek a bez požadavků na produkci/databázi/platební API. Online screenshot vizuálně zkontrolován.
- Expirované lokální Vercel přihlášení obnoveno standardním `vercel@48 whoami` (aktuální CLI 62 mělo chybu závislosti). Poté publikování přes explicitní statický preview skript.
