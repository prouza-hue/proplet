# Aktualizace Proplet v3.5.2 → v3.6

Tahle aktualizace je jednoduchá. **Není potřeba žádná SQL migrace ani změna Supabase.**

## 1. GitHub

Z update balíčku nahraď v repozitáři tyto soubory:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`

Pak dej **Commit changes**.

## 2. Vercel

Vercel nový commit automaticky nasadí.

## 3. Telefon / PWA

Pokud se v Propletu ukáže lišta **„Je připravená nová verze Propletu“**, klepni na **Aktualizovat**. Jinak aplikaci úplně zavři a znovu otevři.

## 4. Rychlá kontrola

Po aktualizaci ověř:

- profil používá slovo **Hodnost**, ne Level,
- herní HUD říká **Skládáš** a **✨ Čistě**,
- onboardingový PES vede přes roh,
- v menu dole vidíš autorskou patičku,
- rozehrané hry, výsledky a XP zůstaly zachované.
