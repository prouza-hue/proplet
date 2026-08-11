# Proplet v3.4.2 — perzistentní rozehrané úlohy

Tato verze je postavená přímo z v3.4. **Nepřebírá změnu z odmítnuté v3.4.1**, která povolovala alternativní trasu správného slova.

## Co se mění

- Rozehrané Free i Daily úlohy se automaticky ukládají do `localStorage`.
- Ukládá se: puzzle, nalezená slova a jejich cesty, tahy, použití nápověd / Clean stav a odehraný čas.
- Autosave probíhá po tahu, Undo, nápovědě, resetu, při návratu do menu, při skrytí aplikace a navíc každých 5 sekund.
- Čas se při pobytu v menu nebo mimo aplikaci pozastaví a po návratu pokračuje.
- Rescue puzzle se záměrně neukládá jako pauzovatelná hra — 30sekundový limit zůstává neobejitelný.
- V menu se rozehraná obtížnost označí `ROZEHRÁNO` a tlačítko se změní na `Pokračovat`.
- Pravý kruhový progress s šipkou je nyní klikací (včetně klávesnice Enter/Space).
- Po dokončení úlohy se uložený rozehraný snapshot smaže.
- Pokud hráč sestaví cílové slovo jinou cestou než tou, která patří do unikátního řešení, hra ho **nepřijme** a explicitně vysvětlí proč.
- Intro nyní jasně říká, že nestačí najít existující slovo; musí sedět i jeho konkrétní cesta v jediném řešení.

## Nasazení z v3.4

**Supabase ani SQL se nemění.**

Na GitHubu nahraď pouze:

- `public/app.js`
- `public/styles.css`
- `public/sw.js`

Pak dej `Commit changes`. Vercel provede deploy automaticky.

Service worker má nový cache klíč `proplet-v3-4-2-cloud-1`, takže se klientům načte nová verze.

## Doporučený test po deployi

1. Spusť libovolnou Free úlohu.
2. Najdi 1–2 slova.
3. Dej šipku Zpět do menu.
4. Karta obtížnosti má ukázat `ROZEHRÁNO` / `Pokračovat`.
5. Klikni i přímo na pravý kruhový progress se šipkou — musí otevřít hru.
6. Musí se vrátit stejný puzzle, nalezená slova, tahy a čas.
7. Po dořešení a další návštěvě už se starý rozehraný stav nesmí vracet.
