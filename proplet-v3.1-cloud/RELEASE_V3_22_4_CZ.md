# Proplet v3.22.4 — Unified Fold Web/PWA Layout

## Problém

Na rozloženém Samsung Fold7 se stejná hra skládala jinak v browseru a v nainstalované PWA. Důvodem bylo, že responsive struktura hry byla navázaná mimo jiné na `min-height`. Chrome UI odebere část viewportu, standalone PWA ne, a zařízení tak mohlo při stejné šířce překročit výškový breakpoint a přepnout z dolního ovládání na pravý ovládací panel.

## Řešení

- pod 1000 CSS px je struktura hry jednotná bez ohledu na výšku viewportu,
- zpráva a Nápověda/Reset jsou pod deskou,
- PWA využije větší dostupnou výšku pouze pro větší board,
- pravý ovládací rail zůstává až pro široký desktop,
- žádná větev není založena na `display-mode: standalone`,
- 2D exact-fit velkých desek z v3.22.3 zůstává nedotčený.

## Co se nemění

- puzzle obsah,
- starter,
- XP a leaderboardy,
- dark mode paleta,
- databáze,
- orientace nikoho neblokuje.
