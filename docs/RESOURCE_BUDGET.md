# Úsporný vývoj a provoz — 3. 11. 2026

Uživatel požaduje šetrnost k tokenům, GitHubu, Vercelu a Supabase. Změna nemění
pravidla hry, bodování, oprávnění účtů ani produkční databázové schéma.

## GitHub

Jednotkové/runtime testy vlastní hlavní manifest. Měsíční SQL workflow již
neopakuje celý gate; týdenní SQL workflow neopakuje dva skripty z manifestu.
Samostatné SQL acceptance testy zůstávají, protože chrání odlišné chování.

Měsíční DB a historické Gen4 banky používají levný výběr podle změněných souborů.
Čisté UI nespouští měsíční PostgreSQL a release metadata nespouštějí historické
banky. Čtyři levné Gen4 runtime kontrakty jsou přesunuté do hlavního manifestu.
Názvy kontrol zůstávají stabilní; chyba klasifikace nesmí znamenat úspěšné přeskočení.
Výběr používá shallow checkout a případně stáhne jediný chybějící základní commit.

Překonané PR běhy se ruší. Main a ručně spuštěné kontroly mají samostatné skupiny
a navzájem se neruší. Main gate zůstává pojistkou proti přímým změnám a odlišnostem
sloučeného stromu; jeho odstranění by vyžadovalo ověřený merge-queue/protection kontrakt.

## Vercel

`vercel.json` automaticky nasazuje pouze main. Pracovní větve již nevytvářejí
preview při každém pushi. Potřebný náhled vytvořit explicitním CLI/API deploymentem
konkrétního commitu; samotný náhled nepovoluje přístup k živé databázi.

`tools/vercel_build_decision.cjs` vynechá produkční build, pokud se od předchozího
deploymentu změnily pouze docs, tests, CI, release evidence nebo README/AGENTS.
Porovnává celý rozsah od předchozího deploymentu, ne jen poslední commit. Neznámé
cesty, chybějící Git historie, první deployment, stejný SHA při opakovaném nasazení
a explicitní preview vždy pokračují. `PROPLET_FORCE_BUILD=1` dovoluje vynucení.
Vercel konvence: exit 0 znamená přeskočit; exit 1 stavět.

## Supabase

Historické týdny se načítají samostatně přes `includeSummary=false`. Požadavek
nepřenáší celý index týdnů a ledger zlat, ale pouze vybraný uzavřený snapshot
a jeho aktuálně veřejné týmy. Každé serverové čtení znovu ověřuje oprávnění a veřejnost.

Klient odděluje aktuální XP, osobní vitrínu, souhrn a navštívené týdny. Při listování
historie nenačítá znovu aktuální XP ani osobní vitrínu. Cache má 30 sekund, patří
konkrétnímu účtu/tokenu/týmu a zneplatní se při jejich změně; opožděná odpověď
předchozího účtu ji nesmí znovu naplnit. Nezavádí se sdílená cache identity.

První historický přechod s čerstvým souhrnem: jeden úzký požadavek místo tří API
volání. Opětovná návštěva v době platnosti: nula požadavků. Jde o ověřené počty
požadavků, nikoli příslib procentní úspory účtovaných GB.

## Ověřování a tokeny

Používat cílené soubory, výřezy logů a existující důkazy. Jeden vlastník společného
ověření; agenti neopakují živé kontroly. Kompletní gate až po ustálení kandidáta,
pak cílené opakování jen při změně nebo chybě. `--only` zachovává izolaci testů.

Běžné testy nedědí živé credentials a mají Python/Node síťové pojistky. Nejde o OS
sandbox; nativní integrace musí mít explicitně lokální databázi a vlastní hranici.
Vizuální matice běží na lokálních fixtures. Živé ověření má samostatný nástroj
`check_live_release.py`, nejvýše čtyři GETy a žádná automatická opakování. Pokud je
potřeba browser smoke, použít jeden viewport a jen změněný tok, ne znovu celou matici.

Billing odečet před změnou: období 11. 10.–11. 11., organizace 3,487 / 5 GB,
produkční projekt 3,471 GB, testovací projekt 0,016 GB; posledních sedm dní 1,092 GB.
Data byla 3. 11. přečtena v autentizovaném Usage dashboardu. Živé preview a ruční QA
nad produkční databází se započítávají do produkčního projektu. Následnou úsporu
posoudit podle dalšího relevantního odečtu, bez přidávání opakovaných log scanů.

Oficiální Vercel konfigurace: https://vercel.com/docs/project-configuration/git-configuration
a https://vercel.com/docs/project-configuration/vercel-json (ignoreCommand).
