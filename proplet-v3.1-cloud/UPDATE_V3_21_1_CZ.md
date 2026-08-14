# Aktualizace Proplet v3.21 → v3.21.1

v3.21.1 je čistý hotfix pro Galaxy Z Fold / foldable viewporty. **Neobsahuje žádnou SQL migraci a nemění puzzle, XP pravidla ani hráčská data.**

## Co opravuje

V3.21 klasifikovala tabletový viewport podle příliš vysoké minimální kratší strany (700 CSS px). Reálný dostupný Chrome viewport rozloženého Fold7 může být pod tímto prahem, takže rozložený telefon mohl být mylně zablokovaný jako telefon naležato.

V3.21.1:

- klasifikuje herní viewport podle obou skutečně dostupných rozměrů,
- rozložený Fold s oběma stranami alespoň 540 px a delší stranou alespoň 700 px používá tabletový layout,
- složený telefon naležato zůstává blokovaný, pokud má coarse/touch primární pointer,
- landscape guard už nestojí pouze na mobilním user-agentu,
- herní plocha má `ResizeObserver`, takže se po fold/unfold přepočítá i při asynchronním reflow,
- po resize/orientation/posture změně proběhnou krátké následné přepočty rozložení.

## Nasazení

### 1. Supabase

**Nic nespouštěj. Žádné nové SQL není potřeba.**

### 2. GitHub

Obsah `proplet-v3.21.1-update.zip` nahraj/přepiš v existujícím adresáři:

`proplet-v3.1-cloud/`

**Ne do rootu repozitáře.**

Commitni změny a nech Vercel nasadit nový deployment.

### 3. Kontrola

Otevři `/api/health` a ověř zejména:

```json
"version": "3.21.1",
"gameFeelSprint": "3.21",
"foldViewportHotfix": true,
"foldTabletShortSidePx": 540,
"starterMigration": true,
"ok": true
```

## Doporučený smoke test na Fold7

1. Složený telefon na výšku → rozehrát Proplet → hra funguje.
2. Složený telefon otočit naležato → zobrazí se „Otoč telefon na výšku“ a čas stojí.
3. Vrátit na výšku → hra pokračuje.
4. Rozložit Fold → hra se sama přepočítá na tabletové rozložení.
5. Rozložený Fold otočit → hra zůstane hratelná, bez landscape blockeru.
6. Ověřit tahání přes desku, Nápovědu a Reset/VRÁTIT.

Není potřeba čistit Local Storage ani znovu spouštět migraci v3.21.
