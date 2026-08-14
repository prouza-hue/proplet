# Aktualizace Propletu v3.22.3 → v3.22.4

## Co opravuje v3.22.4

v3.22.4 sjednocuje herní layout mezi běžným Chrome a nainstalovanou PWA na Foldu/tabletu.

Příčina rozdílu nebyla speciální PWA logika. Starší CSS přepínalo mezi dvěma strukturami hry podle kombinace šířky a **výšky viewportu** (`min-height`). Browserová lišta v Chromu zmenšila dostupnou výšku, zatímco standalone PWA měla viewport vyšší, takže stejný Fold na stejném fyzickém displeji mohl spadnout do jiné responsive větve.

Nově se na všech viewpotech pod 1000 CSS px používá jedna stabilní struktura:

- HUD,
- řádek „Skládáš“,
- deska,
- dole zpráva + Nápověda / Reset.

PWA může mít díky chybějícím browserovým lištám větší desku, ale už nemění strukturu UI. Pravý ovládací panel zůstává pouze pro skutečně široký desktop (`>= 1000 px` a dostatečná výška).

Oprava 2D fitování velkých 10×10 desek z v3.22.3 zůstává zachovaná.

## Databáze

**Žádné SQL.**

## Nasazení

1. Rozbal `proplet-v3.22.4-update.zip`.
2. Obsah nahraj/přepiš uvnitř GitHub adresáře **`proplet-v3.1-cloud/`**.
3. Commitni změny a počkej na Vercel Production deployment.
4. Otevři `/api/health`.

Očekávej zejména:

```json
{
  "version": "3.22.4",
  "boardFit2DHotfix": true,
  "foldWebPwaLayoutUnified": true,
  "tabletGameLayoutBreakpointPx": 1000,
  "orientationBlocking": false,
  "ok": true
}
```

## PWA po deployi

v3.22.4 má nový service-worker cache key. Pokud nainstalovaná PWA stále ukazuje starou verzi, přijmi nabídku aktualizace / aplikaci úplně zavři a znovu otevři. V patičce musí být `Proplet v3.22.4`.

## Doporučený smoke test na Fold7

Na stejném rozehraném velkém puzzle zkontroluj:

1. Chrome — rozložený Fold portrait,
2. Chrome — rozložený Fold landscape,
3. PWA — rozložený Fold portrait,
4. PWA — rozložený Fold landscape.

Struktura má být ve všech čtyřech případech stejná. Lišit se smí pouze velikost desky podle dostupného viewportu. Žádný řádek 10×10 desky nesmí přetéct.
