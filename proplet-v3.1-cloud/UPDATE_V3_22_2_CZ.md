# Aktualizace Propletu v3.22.1 → v3.22.2

## Co opravuje

V tmavém režimu už měla nalezená písmena přímo v herní desce tmavé písmo, ale malé barevné štítky v řádku **Nalezeno** nahoře stále používaly světlý text.

v3.22.2 sjednocuje obě místa: štítky v řádku **Nalezeno** nyní v dark mode používají stejný princip jako vyřešené buňky — 70 % barvy slova + tmavý povrch a velmi tmavé písmo. Light mode zůstává vizuálně beze změny.

## Nasazení

1. **Žádné SQL.**
2. Obsah `proplet-v3.22.2-update.zip` nahraj/přepiš uvnitř GitHub adresáře `proplet-v3.1-cloud/`.
3. Commitni a nech Vercel nasadit.
4. Otevři `/api/health` a ověř `"version": "3.22.2"`, `"darkFoundChipTextHotfix": true` a `"ok": true`.
5. V tmavém režimu najdi několik slov a zkontroluj jak písmena v desce, tak štítky v řádku **Nalezeno**.

Puzzle banka ani databázové migrace se nemění.
