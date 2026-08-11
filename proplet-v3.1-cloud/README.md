Proplet v3.2 – zadání a akceptační kritéria

1. Krásnější vzhled

Cíl: z funkčního prototypu udělat vizuálně výraznou, současnou a hravou mobilní hru bez ztráty přehlednosti.

vlastní výrazná fialová identita Propletu s mint/coral/žlutými akcenty

hravější Daily hero a výraznější hierarchie obrazovek

měkčí karty, dlaždice a barevně odlišitelné nalezené cesty

odlišné vizuální identity obtížností easy / medium / hard

modernizovaný profil, leaderboard a vítězná obrazovka

animace respektují prefers-reduced-motion

Akceptace: všechny čtyři hlavní obrazovky i hra působí jako jedna konzistentní aplikace a zůstávají dobře čitelné na malém telefonu.

2. Lepší pocit ze hry

Cíl: každé správné slovo a dokončení úlohy má okamžitou a příjemnou odezvu.

jemná haptika při tahu, správném slově, chybě a výhře

krátké syntetické zvuky bez externích audio souborů

zvuk i haptiku lze v profilu vypnout

animace správně nalezeného slova

confetti a výraznější výsledková obrazovka

robustnější service worker: API se necachuje, nová verze se rychle aktivuje

Akceptace: ovládání zůstává rychlé; efekty nikdy neblokují tah ani navigaci.

3. Motivační systém

Cíl: dát důvod vracet se nejen kvůli Daily, ale i kvůli dlouhodobému postupu.

stávající streak a streak odznaky zůstávají

body se vizuálně mění na XP

7 levelů od Nováčka po Legendu Propletu

progress bar k dalšímu levelu

achievementy odvozené z už existujících statistik (bez migrace databáze)

na výsledkové obrazovce se zobrazuje získané XP

free obtížnosti ukazují XP odměnu

Akceptace: hráč vždy vidí aktuální level, další dosažitelný cíl a odemčené úspěchy.

Opravy v3.2

Synchronizace

výsledek se po dokončení okamžitě zařadí do sync fronty

automatický pokus po dokončení, při startu aplikace, návratu online, návratu do popředí a každou minutu

manuální tlačítko ukazuje Synchronizuji…, úspěch nebo konkrétní chybu

fronta je deduplikovaná podle challenge key

API GET odpovědi se necachují service workerem

server má diagnostický /api/result-status

Sdílení

Sdílený Daily výsledek vždy obsahuje veřejnou adresu:https://proplet-nine.vercel.app/

# Proplet v3.1 Cloud

Cloud-ready verze Propletu pro **Vercel + Supabase**.

- FastAPI běží jako Vercel Function.
- `public/` obsahuje PWA frontend a puzzle databázi.
- Supabase (Postgres přes Data REST API) drží hráče a výsledky.
- Citlivý `SUPABASE_SECRET_KEY` je pouze environment variable na Vercelu a není v browseru ani GitHubu.
- Daily Challenge se mění automaticky podle data v Europe/Prague a každý hráč ji může dokončit pouze jednou.
- Volná hra obsahuje 50 unikátních úloh pro každou obtížnost (150 celkem).

Začni souborem **NASAZENI_CZ.md**.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

## Databáze

Spusť `SUPABASE_SETUP.sql` v Supabase SQL Editoru.

## Lokální vývoj (volitelné)

```bash
pip install -r requirements.txt
export SUPABASE_URL='https://...supabase.co'
export SUPABASE_SECRET_KEY='sb_secret_...'
uvicorn server:app --reload
```

## Jazyková data

Viz `NOTICE.md`.
