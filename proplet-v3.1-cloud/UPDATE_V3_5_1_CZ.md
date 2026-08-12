# Proplet v3.5.1 — jednorázová výzva k účtu

Tato verze přidává jednu UX změnu: anonymní hráč po dokončení prvního levelu dostane při pokračování jednorázovou nabídku vytvořit hráče nebo se přihlásit.

- výsledková obrazovka se nepřekrývá; nabídka přijde až při klepnutí na další krok,
- nabídka obsahuje `Vytvořit hráče`, `Už účet mám` a `Teď ne`,
- po přihlášení/vytvoření hráče se právě dohraný lokální výsledek synchronizuje z existující fronty,
- výzva se na daném zařízení zobrazí pouze jednou,
- žádná databázová migrace není potřeba.

## Nasazení

Na GitHub nahraď pouze:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`

Pak Commit changes. Vercel provede deployment automaticky.
