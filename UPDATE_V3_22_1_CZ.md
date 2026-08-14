# Aktualizace Propletu v3.22.0 → v3.22.1

## Co opravuje

V tmavém režimu byly znaky v již nalezených barevných stopách bílé. Na reálném OLED displeji se jejich tvar v barevné ploše hůř četl, přestože formální kontrast vycházel dostatečně.

v3.22.1 používá na nalezených stopách výraznější barvu slova a velmi tmavé písmo. Nejméně příznivá kombinace z celé 12barevné herní palety má kontrast vyšší než 4,5:1.

## Nasazení

1. **Žádné SQL.**
2. Obsah `proplet-v3.22.1-update.zip` nahraj/přepiš uvnitř GitHub adresáře `proplet-v3.1-cloud/`.
3. Commitni a nech Vercel nasadit.
4. Otevři `/api/health` a ověř `"version": "3.22.1"`, `"darkModeSprint": "3.22"`, `"darkFoundTextHotfix": true` a `"ok": true`.
5. V tmavém režimu dohraj několik slov různých barev a ověř čitelnost písmen.

Puzzle banka ani migrace v3.21 se nemění.
