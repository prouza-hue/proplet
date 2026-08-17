# Medium difficulty structural audit

Puzzle DB generated: 2026-08-15

## Group summary

| group | n | score mean / p50 | turns/word | 0-turn | <=1 turn | straight-run ratio | candidates | solver nodes | tier mix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| easy_all | 200 | 21.7 / 22.0 | 0.858 | 42.4% | 72.6% | 0.771 | 9.985 | 7.415 | A:100.0% |
| medium_1_25 | 25 | 44.52 / 44 | 1.073 | 36.1% | 56.6% | 0.753 | 14.8 | 8.64 | A:17.8%, B:82.2% |
| medium_26_50 | 25 | 45.56 / 46 | 1.132 | 33.1% | 55.4% | 0.744 | 15.84 | 8.32 | A:23.5%, B:76.5% |
| medium_1_50 | 50 | 45.04 / 44.0 | 1.103 | 34.6% | 56.0% | 0.749 | 15.32 | 8.48 | A:20.6%, B:79.4% |
| medium_51_100 | 50 | 44.7 / 44.0 | 1.105 | 34.2% | 56.3% | 0.746 | 15.16 | 8.42 | A:21.6%, B:78.4% |
| medium_101_150 | 50 | 42.8 / 44.0 | 1.045 | 36.7% | 61.2% | 0.763 | 15.3 | 8.46 | A:20.6%, B:79.4% |
| medium_151_200 | 50 | 42.2 / 41.0 | 1.015 | 37.6% | 63.4% | 0.778 | 15.34 | 8.44 | A:18.3%, B:81.7% |
| medium_all | 200 | 43.685 / 44.0 | 1.067 | 35.8% | 59.2% | 0.759 | 15.28 | 8.45 | A:20.3%, B:79.7% |
| hard_1_25 | 25 | 82.4 / 81 | 2.11 | 18.9% | 36.1% | 0.558 | 24.16 | 11.24 | B:19.9%, C:80.1% |
| hard_1_50 | 50 | 84.6 / 86.5 | 2.23 | 15.7% | 31.9% | 0.531 | 23.48 | 11.28 | B:20.2%, C:79.8% |
| hard_51_100 | 50 | 84.66 / 84.5 | 2.306 | 15.0% | 30.7% | 0.526 | 23.56 | 10.9 | B:19.8%, C:80.2% |
| hard_all | 200 | 84.89 / 85.0 | 2.298 | 14.7% | 29.8% | 0.517 | 22.835 | 11.155 | B:21.3%, C:78.7% |
| hardcore_all | 200 | 130.815 / 130.0 | 3.354 | 4.8% | 14.9% | 0.395 | 32.845 | 13.425 | C:55.9%, D:44.1% |

## Distribution overlap

```json
{
  "easy_p75": 27.0,
  "medium_median": 44.0,
  "hard_p25": 76.0,
  "medium_first50_below_easy_p75": 0,
  "medium_first50_below_medium_median": 26,
  "medium_all_below_easy_p75": 5,
  "medium_top50_above_hard_p25": 0
}
```

## First 50 Medium levels

| lvl | id | score | turns/word | 0-turn | <=1 turn | straight-run | tiers | words |
|---:|---|---:|---:|---:|---:|---:|---|---|
| 1 | g2-m-001 | 35 | 1.00 | 37.5% | 62.5% | 0.75 | A1 B7 | DOBA, OPÁL, ANDĚL, SLEVA, MOCT, OSOBA, JAGUÁR, KARAVAN |
| 2 | g2-m-002 | 36 | 1.00 | 28.6% | 71.4% | 0.80 | A3 B4 | KOALA, DÍLO, HŘEBEN, MANGO, STRAKA, PIJAVICE, BAŽANT |
| 3 | g2-m-003 | 60 | 1.71 | 14.3% | 14.3% | 0.56 | B7 | LARVA, VRCHOL, LABYRINT, KUŽELKY, ÚZKÝ, SARDINKA, KONVICE |
| 4 | g2-m-004 | 45 | 0.88 | 37.5% | 75.0% | 0.82 | A1 B7 | VZTEK, MALÝ, PONORKA, SNĚHOVÁ, TÁBOR, DRON, VIKING, VĚDA |
| 5 | g2-m-005 | 42 | 0.88 | 37.5% | 75.0% | 0.79 | A3 B5 | VESELÝ, KOLOTOČ, PLAST, KŘEČEK, STÁT, DÁMA, NÁHORNÍ, SURF |
| 6 | g2-m-006 | 38 | 1.00 | 42.9% | 57.1% | 0.79 | A3 B4 | MŮRA, FJORD, TRILOBIT, DRŽET, RUKA, VRÁTIT, BULDOZER |
| 7 | g2-m-007 | 42 | 1.00 | 50.0% | 50.0% | 0.75 | A1 B7 | ÚZEMÍ, ODEJÍT, PEPŘ, OSUD, ČLEN, GEPARD, KOMEDIE, ŽULA |
| 8 | g2-m-008 | 39 | 1.14 | 28.6% | 57.1% | 0.77 | A1 B6 | ŽALÁŘ, BUMERANG, SUSHI, HRANOLKY, PISTÁCIE, CHLAP, DOMINO |
| 9 | g2-m-009 | 42 | 0.88 | 50.0% | 62.5% | 0.82 | A4 B4 | PAPÍR, KOŠTĚ, CVRČEK, NÁVŠTĚVA, KORUNA, BRZY, HELMA, ZVLÁŠŤ |
| 10 | g2-m-010 | 44 | 1.29 | 28.6% | 42.9% | 0.74 | B7 | VANILKA, PUŠTÍK, ANAKONDA, RYBÁK, DŽUNGLE, NÁVOD, TUPÝ |
| 11 | g2-m-011 | 52 | 0.88 | 50.0% | 62.5% | 0.81 | A1 B7 | PSTRUH, CEDULE, ŠÁLA, PROSINEC, SEŠIT, MAKAK, BAVLNA, BÁJE |
| 12 | g2-m-012 | 40 | 1.00 | 37.5% | 62.5% | 0.75 | A1 B7 | NÁDRAŽÍ, PANÍ, MEDAILE, ŘADA, ŠEDÁ, CHROUST, ÚNOR, SPACÁK |
| 13 | g2-m-013 | 44 | 1.00 | 50.0% | 50.0% | 0.75 | A1 B7 | DECH, KOMBAJN, KAFE, MÍLE, TRIČKO, STŘECHA, HLUK, ČEDIČ |
| 14 | g2-m-014 | 51 | 1.38 | 25.0% | 37.5% | 0.68 | B8 | SEZNAM, GLÓBUS, SUCHÝ, KIVI, ŠTÍR, PEVNOST, VODOPÁD, ŠKEBLE |
| 15 | g2-m-015 | 54 | 1.57 | 14.3% | 28.6% | 0.62 | B7 | KONFETA, ŽIVOT, HURIKÁN, PERISKOP, ÚHOŘ, KAVÁRNA, VRAŽDA |
| 16 | g2-m-016 | 37 | 0.88 | 37.5% | 75.0% | 0.77 | A2 B6 | MEDÚZA, VĚTA, HŘIB, KUDLANKA, SNÍH, HROCH, ČARODĚJ, ŽELVA |
| 17 | g2-m-017 | 45 | 1.25 | 25.0% | 50.0% | 0.69 | A2 B6 | ZEMĚ, PLYN, UČIT, MRÁZ, ZPĚVÁK, VÁLKA, TICHO, VRTULNÍK |
| 18 | g2-m-018 | 33 | 1.14 | 14.3% | 71.4% | 0.76 | A2 B5 | SLON, POLE, KUNA, SNĚHULÁK, DOVOLENÁ, FRISBEE, JEŠTĚRKA |
| 19 | g2-m-019 | 48 | 0.62 | 62.5% | 75.0% | 0.84 | A2 B6 | TRENÉR, JMÉNO, FOSILIE, STAV, ŠTIKA, CENA, AMONIT, ZÁSTUPCE |
| 20 | g2-m-020 | 41 | 1.00 | 37.5% | 62.5% | 0.75 | B8 | SVIŠŤ, ČERVEN, TERMOSKA, LEKCE, PITÍ, STŘED, LEVÝ, KŮŽE |
| 21 | g2-m-021 | 56 | 1.71 | 14.3% | 14.3% | 0.61 | B7 | STOLETÍ, DIAMANT, FÉNIX, KAPYBARA, SPOLUŽÁK, KEČUP, MOKRÝ |
| 22 | g2-m-022 | 49 | 1.00 | 42.9% | 57.1% | 0.78 | A2 B5 | VYSOČINA, UČEBNICE, JOJO, HRNEC, HOŘKÝ, PRAVDA, MAPA |
| 23 | g2-m-023 | 40 | 0.75 | 37.5% | 87.5% | 0.83 | A2 B6 | DLAŇ, PALÁC, JEHLA, HÁZET, KONDOR, HLÁŠENÍ, VOLNÝ, SIRÉNA |
| 24 | g2-m-024 | 54 | 1.12 | 37.5% | 50.0% | 0.76 | B8 | PROPAST, SASANKA, DÍRA, MURÉNA, ČMELÁK, OVÁD, PATA, HRANICE |
| 25 | g2-m-025 | 46 | 0.75 | 62.5% | 62.5% | 0.84 | A2 B6 | PLAVAT, KOSTÝM, BÍLÝ, LEOPARD, JANTAR, NINJA, LOUPEŽ, ŘEKA |
| 26 | g2-m-026 | 58 | 1.29 | 28.6% | 42.9% | 0.71 | A2 B5 | MLOK, TEPLOMĚR, ODDĚLENÍ, PALETA, SKLENICE, NOVÝ, MĚKKÝ |
| 27 | g2-m-027 | 48 | 1.25 | 25.0% | 50.0% | 0.69 | A3 B5 | NAROZENÍ, KLOBOUK, KVĚT, DOBRÝ, MROŽ, DUHA, HÁDANKA, ZIMA |
| 28 | g2-m-028 | 53 | 1.12 | 50.0% | 50.0% | 0.75 | A1 B7 | POVOLENÍ, OTEC, LYŽE, ZÁCHOD, HORA, LABYRINT, KREVETA, LÁVA |
| 29 | g2-m-029 | 44 | 0.86 | 42.9% | 71.4% | 0.79 | A1 B6 | TRAMVAJ, SÉPIE, DUNA, ČELO, JEDNÁNÍ, LANGUSTA, KOLENO |
| 30 | g2-m-030 | 29 | 0.57 | 42.9% | 100.0% | 0.90 | A2 B5 | ALBATROS, KOUPELNA, MONITOR, PLAST, PUZZLE, KOBLIHA, ŠTÍT |
| 31 | g2-m-031 | 47 | 1.12 | 37.5% | 50.0% | 0.71 | A3 B5 | POLOVINA, ČÁRA, OREL, KLID, BULDOZER, BLUDIŠTĚ, OÁZA, MALÝ |
| 32 | g2-m-032 | 55 | 1.43 | 14.3% | 42.9% | 0.72 | A2 B5 | PLAKAT, SKOŘICE, BANKOVKA, ROVNÝ, VICHŘICE, KOMIKS, GUMA |
| 33 | g2-m-033 | 36 | 1.29 | 14.3% | 57.1% | 0.70 | A2 B5 | PISTOLE, OBRAZ, RAŠELINA, ANDĚL, RACEK, VÁŽKA, TAŤKA |
| 34 | g2-m-034 | 38 | 0.57 | 57.1% | 85.7% | 0.85 | B7 | KŘEMEN, KRÁLOVNA, PISTÁCIE, KAPR, DÍLO, MRAMOR, LETADLO |
| 35 | g2-m-035 | 46 | 0.75 | 50.0% | 75.0% | 0.80 | A3 B5 | DOLE, SMÁT, KINO, HLAVOLAM, ZKOUŠKA, ÚDOLÍ, MÝTUS, DRAK |
| 36 | g2-m-036 | 54 | 1.57 | 14.3% | 28.6% | 0.62 | A1 B6 | KRAJINA, SENDVIČ, ČERVENÁ, PRAVOPIS, VIDLIČKA, RÁNA, KEŠU |
| 37 | g2-m-037 | 61 | 1.71 | 14.3% | 14.3% | 0.62 | A2 B5 | CUKR, ZMRZLINA, RANNÍ, TERMIT, MÝDLO, HOUPAČKA, TRILOBIT |
| 38 | g2-m-038 | 51 | 1.29 | 42.9% | 42.9% | 0.78 | B7 | VĚZENÍ, PLAMEŇÁK, SUMEC, SURF, ANAKONDA, NEŠTĚSTÍ, KOTVA |
| 39 | g2-m-039 | 44 | 1.29 | 28.6% | 42.9% | 0.68 | A1 B6 | KAMERA, PORTÁL, FIXKA, LEDNICE, ČLUN, GORILA, JEZEVEC |
| 40 | g2-m-040 | 39 | 1.14 | 42.9% | 57.1% | 0.76 | A1 B6 | ŘÍJEN, OSLAVA, PONORKA, PIRÁT, ALIGÁTOR, ŽENA, TELEVIZE |
| 41 | g2-m-041 | 38 | 0.75 | 50.0% | 75.0% | 0.83 | A1 B7 | LEZENÍ, MANŽEL, BÁJE, MAKRELA, BŘEH, FINÁLE, ŠTÍR, KOSATKA |
| 42 | g2-m-042 | 38 | 0.88 | 37.5% | 75.0% | 0.76 | A2 B6 | NÁVŠTĚVA, HLASITÝ, ČÁST, SRPEN, HUMR, OKNO, ÚŘAD, STŘÍBRNÁ |
| 43 | g2-m-043 | 42 | 0.86 | 42.9% | 71.4% | 0.82 | A1 B6 | HLEDÁNÍ, BIZON, RŮŽE, OBLEČENÍ, PODLAHA, KOMBAJN, KOMISE |
| 44 | g2-m-044 | 49 | 1.12 | 25.0% | 62.5% | 0.77 | A2 B6 | TVAROH, CVRČEK, DRUHÝ, MRAK, ŽALÁŘ, KONCERT, VĚČNOST, RŮŽOVÁ |
| 45 | g2-m-045 | 48 | 1.57 | 14.3% | 28.6% | 0.62 | A3 B4 | BAREVNÝ, BRUSLE, BŘEZEN, CUKRÁRNA, DESET, VLASY, CHROUST |
| 46 | g2-m-046 | 43 | 1.29 | 28.6% | 42.9% | 0.72 | B7 | KŮŽE, PROSINEC, VANILKA, KROUPY, TERMOSKA, MEDÚZA, MRÁZ |
| 47 | g2-m-047 | 49 | 1.29 | 28.6% | 42.9% | 0.70 | A1 B6 | CHLAPÍK, SARDINKA, KONFETA, POPCORN, KOSMOS, PLYN, RUBÍN |
| 48 | g2-m-048 | 47 | 1.14 | 28.6% | 57.1% | 0.75 | A3 B4 | PLANINA, LEKTVAR, MALINA, VOLNÝ, PERO, KUDLANKA, REJSEK |
| 49 | g2-m-049 | 41 | 0.88 | 37.5% | 75.0% | 0.77 | A4 B4 | BAGR, ZNÁT, NUDA, ZÁŘÍ, RADOST, METEORIT, ÚHOŘ, KUCHYNĚ |
| 50 | g2-m-050 | 41 | 1.29 | 28.6% | 42.9% | 0.75 | A2 B5 | BAŽINA, LIMONÁDA, AVOKÁDO, ÚZKÝ, PRAK, MOCT, HRDLIČKA |

## 30 structurally easiest Medium levels by generator score

| lvl | score | turns/word | 0-turn | <=1 turn | words |
|---:|---:|---:|---:|---:|---|
| 112 | 17 | 0.57 | 42.9% | 100.0% | HRANÍ, FENEK, LUCERNA, SPORÁK, FOTBAL, MANŽEL, CHLAP |
| 189 | 20 | 0.43 | 57.1% | 100.0% | LEVÝ, TERMOSKA, VORVAŇ, LASICE, ŽIVOT, SIRÉNA, LESNÍ |
| 149 | 25 | 0.71 | 42.9% | 85.7% | ŠTÍR, POVOLENÍ, CVRČEK, BULDOZER, ČÁRA, GEKON, SKLEP |
| 100 | 26 | 0.71 | 42.9% | 85.7% | ŠKOLKA, KOMBAJN, ORIGAMI, PŘÍPAD, SNÍH, BONBON, SFINGA |
| 134 | 27 | 0.57 | 57.1% | 85.7% | LAGUNA, KUDLANKA, PERISKOP, JOJO, HROM, MOŘSKÝ, LANOVKA |
| 200 | 28 | 0.50 | 62.5% | 87.5% | ŠATY, OTÁZKA, CIBULE, LIMONÁDA, MROŽ, AKVAREL, RYBA, ČÍST |
| 107 | 28 | 0.57 | 57.1% | 85.7% | ZMIJE, LETĚT, MAKRELA, PELIKÁN, DOMOV, TERMOSKA, PRODAVAČ |
| 30 | 29 | 0.57 | 42.9% | 100.0% | ALBATROS, KOUPELNA, MONITOR, PLAST, PUZZLE, KOBLIHA, ŠTÍT |
| 64 | 29 | 0.71 | 42.9% | 85.7% | SPACÁK, FOUKAT, ŽÁDOST, KORUNA, KRAB, KOMÁR, ODDĚLENÍ |
| 52 | 29 | 1.00 | 28.6% | 71.4% | KOPEC, POKLAD, MALOVAT, VORVAŇ, SVOLENÍ, JEŘÁB, FJORD |
| 119 | 30 | 0.57 | 57.1% | 85.7% | KRAJTA, LEMUR, VEČERNÍ, PILOT, KIVI, POUŽITÍ, VEČEŘE |
| 92 | 30 | 0.62 | 50.0% | 87.5% | BULDOZER, DRON, ALBATROS, ŠTĚRK, LANGUSTA, VZÍT, HRÁČ, SOCHA |
| 186 | 31 | 0.75 | 50.0% | 75.0% | HÁZET, NÁMĚSTÍ, OVÁD, ČÁRA, LARVA, KLOBOUK, STRAKA, HŘIB |
| 161 | 31 | 0.86 | 42.9% | 71.4% | TÁHNOUT, VIDLIČKA, UPÍR, RUKAVICE, MROŽ, PLÁN, SLABIKA |
| 169 | 31 | 0.86 | 42.9% | 71.4% | NEŠTĚSTÍ, HORSKÝ, PALETA, SOUČÁST, ŘEKA, ŽÍŽALA, KRÁL |
| 138 | 33 | 0.75 | 50.0% | 75.0% | DĚDA, ČERNÁ, ŽULA, OVÁD, ZVUK, PLANINA, ROHÁČ, DIAMANT |
| 159 | 33 | 0.86 | 42.9% | 71.4% | VĚTA, STRÝC, PANDA, ÚSTŘICE, ŠKEBLE, TUNDRA, PERISKOP |
| 162 | 33 | 1.00 | 42.9% | 71.4% | ČÍST, HUSA, PEVNOST, KULATÝ, HLAVOLAM, KŘEPELKA, DÍRA |
| 166 | 33 | 0.86 | 42.9% | 71.4% | BATOLE, SILNICE, LUPA, DUCH, BÍLÁ, PAPOUŠEK, ZELENINA |
| 137 | 33 | 1.00 | 28.6% | 71.4% | PORUČÍK, SOJKA, KŘEMEN, PISTÁCIE, BUMERANG, ŠPATNÝ, PAVIÁN |
| 152 | 33 | 1.00 | 28.6% | 71.4% | KOPAT, PRŮLIV, OTEVŘÍT, ZABITÍ, STŘELEC, JEŘÁB, FIRMA |
| 18 | 33 | 1.14 | 14.3% | 71.4% | SLON, POLE, KUNA, SNĚHULÁK, DOVOLENÁ, FRISBEE, JEŠTĚRKA |
| 118 | 33 | 1.14 | 14.3% | 71.4% | TVÁŘ, RÝŽE, LAMA, TRILOBIT, HOLČIČKA, HOŘČICE, JEŠTĚRKA |
| 111 | 34 | 0.75 | 50.0% | 75.0% | LIŠKA, PEPŘ, SIRÉNA, KRYPTA, KUŘE, HÁDANKA, RÁNO, ŠPAČEK |
| 123 | 34 | 0.75 | 37.5% | 87.5% | BÍLÝ, PANOŠ, JELEN, KABÁT, JOGURT, HODINKY, VČELA, SLIMÁK |
| 185 | 34 | 1.00 | 28.6% | 71.4% | POVOLENÍ, OHEŇ, KOUPELNA, SUCHÝ, MANŽEL, SAMURAJ, HLÁŠENÍ |
| 151 | 34 | 1.14 | 14.3% | 71.4% | POMERANČ, TORTILLA, KONFETA, DUHA, KLUK, SPORÁK, SOKOL |
| 188 | 35 | 0.62 | 62.5% | 75.0% | HUMR, KONFETA, VLEVO, DUBEN, PEŘINA, KAMZÍK, SLON, MOŘE |
| 171 | 35 | 1.00 | 42.9% | 57.1% | CIKÁDA, REJNOK, METEORIT, DÁREK, KUNA, JOGURT, FINÁLE |
| 1 | 35 | 1.00 | 37.5% | 62.5% | DOBA, OPÁL, ANDĚL, SLEVA, MOCT, OSOBA, JAGUÁR, KARAVAN |

## First 25 Hard levels

| lvl | score | turns/word | 0-turn | <=1 turn | straight-run | tiers | words |
|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 61 | 1.40 | 30.0% | 50.0% | 0.67 | B2 C8 | ŠŤÁVA, NINJA, RECENZE, SÍRA, PIXEL, OPOZICE, DÁVÁNÍ, VÝZKUM, HRŮZA, KLEP |
| 2 | 94 | 2.90 | 20.0% | 20.0% | 0.51 | B4 C6 | PODMÍNKA, BITVA, ŠVAGR, PŘEHRÁVAČ, VÝZVA, ŠEDÁ, AKTA, SNOWBOARD, MARMELÁDA, JEZEVEC |
| 3 | 62 | 1.20 | 40.0% | 60.0% | 0.69 | B2 C8 | ŠAKAL, PŮVAB, FOTON, SAMEC, PĚST, PALEC, NERV, SKRBLÍK, ZBRAŇ, ZÁJEM |
| 4 | 92 | 1.67 | 33.3% | 50.0% | 0.65 | B3 C9 | DÉMON, TURBÍNA, PROCEDURA, BONUS, MŮRA, MARIONETA, POKYN, HANBA, VÝKON, HRANÍ, DRES, OBJEV |
| 5 | 88 | 2.30 | 10.0% | 20.0% | 0.48 | B3 C7 | PROSTOR, KAPITÁN, VRAK, ZLOM, MINISTR, BIZON, DROZD, ŽIVEL, LOVEC, CIBULE |
| 6 | 99 | 2.33 | 8.3% | 25.0% | 0.49 | B3 C9 | POLKA, POLOŽKA, OPÁL, STEZKA, EMOCE, OBLIČEJ, DISK, SÉPIE, KULTURA, VRATA, PŘÍKLAD, ŠROUB |
| 7 | 82 | 2.00 | 20.0% | 30.0% | 0.55 | B1 C9 | NÁBOR, HMOTA, SAMIČKA, SIROTEK, RÉBUS, BURKA, CHOŤ, RYTÍŘ, RUNA, UBOŽÁK |
| 8 | 81 | 1.91 | 9.1% | 54.5% | 0.60 | B1 C10 | FÁZE, BOBULE, KOŤÁTKO, ROZVOJ, BRADA, OLEJ, BEZPEČÍ, ADRESA, PIANISTA, PLÍCE, MAMUT |
| 9 | 60 | 1.70 | 30.0% | 50.0% | 0.63 | B3 C7 | OCEL, DELTA, HOCH, ŠTĚRK, KALUŽ, PÁSMO, ZÁLOHA, VÁLKA, MAJÁK, BOROVICE |
| 10 | 123 | 3.60 | 0.0% | 10.0% | 0.34 | B2 C8 | TVRZ, LEGIONÁŘ, BASKETBAL, SNOUBENKA, POCTA, PŘERUŠENÍ, MALÍŘ, PENĚŽENKA, VOJÍN, HLEDÁNÍ |
| 11 | 76 | 2.33 | 11.1% | 33.3% | 0.53 | B2 C7 | STAHOVÁNÍ, UBRUS, FRISBEE, LŮŽKO, VRTULNÍK, MSTA, FILOZOFIE, PLAZ, STŘET |
| 12 | 101 | 1.58 | 25.0% | 25.0% | 0.61 | B3 C9 | ENZYM, JEŽEK, BALON, GENOM, ÚSILÍ, DOHODA, TOXIN, ŠTÍR, MEDAILON, ŠÁTEK, OBILÍ, TKÁŇ |
| 13 | 70 | 1.50 | 20.0% | 40.0% | 0.61 | B4 C6 | BABA, UMĚNÍ, BOUDA, ÚHOŘ, KOLÍK, STŘED, PLAKÁT, DÍVKA, SVITEK, RIFLE |
| 14 | 104 | 2.00 | 27.3% | 27.3% | 0.60 | C11 | ÚTVAR, DATABÁZE, KRITIK, VÝVOJ, DIALEKT, BLÍZKOST, ČETA, ČERNODÍRA, ŠAMAN, VOUS, SENÁT |
| 15 | 81 | 2.11 | 11.1% | 33.3% | 0.54 | B3 C6 | SMYSL, HMYZ, BUBLINA, MLHA, NÁDRAŽÍ, ŠKOLKA, OBRANA, NOMÁD, PRODÁVÁNÍ |
| 16 | 94 | 2.00 | 10.0% | 40.0% | 0.59 | B1 C9 | POZNATEK, MIKROB, SLUHA, POLITIKA, HOSTITEL, FŮRA, PLOCHA, PRÁZDNOTA, MINUTKA, SUCHÝ |
| 17 | 61 | 1.60 | 30.0% | 50.0% | 0.61 | B3 C7 | TCHÁN, ÚTOK, NEURON, BETA, VÝDAJ, ÚVAHA, BORŮVKA, OKRUH, AUDIO, PANTER |
| 18 | 91 | 3.30 | 0.0% | 30.0% | 0.38 | C10 | NEMLUVNĚ, URAN, DRUŽICE, SLZA, PROROCTVÍ, SOFTWARE, HOLENÍ, SUPERNOVA, DŽÍNY, BARIÉRA |
| 19 | 70 | 2.44 | 11.1% | 33.3% | 0.50 | B1 C8 | KURNÍK, PORCELÁN, VĚDEC, KÁVA, OSUD, GLADIÁTOR, HYBRID, ATMOSFÉRA, DÁVKA |
| 20 | 87 | 3.10 | 0.0% | 20.0% | 0.37 | B2 C8 | GALEONA, ZÁPAL, ZRÁDKYNĚ, HARDWARE, PRŮBĚH, SAVANA, ČELO, ELIXÍR, PŘÍLIV, PLACHTA |
| 21 | 68 | 1.67 | 22.2% | 33.3% | 0.61 | B2 C7 | OPATRNOST, NÁZEV, ŠELMA, CHLUP, PEKLO, GRYF, ÚRAZ, TELESKOP, OCEÁN |
| 22 | 90 | 2.80 | 20.0% | 20.0% | 0.53 | B1 C9 | DOMEK, PŘÍPLATEK, ZJEVENÍ, ČESKÝ, VIRTUÁLNÍ, ÚTĚCHA, KLIP, SOBECTVÍ, ZRNKO, VÝSLEDEK |
| 23 | 75 | 2.00 | 20.0% | 40.0% | 0.57 | B1 C9 | ČÍSLICE, VAFLE, HORMON, PAMÁTKA, BROŽ, ZRAK, OBVOD, POSTAVA, LVICE, KOTEL |
| 24 | 76 | 1.50 | 25.0% | 58.3% | 0.65 | B3 C9 | SENZOR, KANEC, DOTEK, ČERV, HOLE, KONFETA, MOČÁL, ŽUPAN, DŮRAZ, AVATAR, STŘEVO, PRÁVO |
| 25 | 74 | 1.80 | 40.0% | 50.0% | 0.63 | B1 C9 | SOUTĚŽ, ARCHA, ÚČEL, ROKLE, OBJEM, JAZYK, PECH, KORÁB, PAMĚŤ, DOBYVATEL |
