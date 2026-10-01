# Finální browserové ověření — 1. 10. 2026

Výsledek **PASS** patří bance
`84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab`,
výrobnímu zdroji `ae0ba92c7a154eaca97a18c08e5dbdc20a6ded5a` a stavu
`technically-verified-unpublished`. Dřívější pracovní běhy nejsou touto přílohou
vydávány za důkaz finální banky.

Samostatný headless Chromium **154.0.8037.58** na lokálním statickém serveru
dokončil všech **100 desek skutečnými myšími událostmi**, včetně nalezených
políček, obnovení po reloadu, dokončení, přechodu na další desku a návratu do
přehledu. Přepnutí katalogu 100 → 12 → 100 prošlo. Nezávisle enumerované
vedlejší slovo **AKCI** se správně uznalo a ponechalo nulové pokrytí cílových
cest. Banka používá všech **103 836** slov zmrazeného uznávání.

Reprezentativní dvanáctka prošla skutečnými CDP dotykovými událostmi na
emulovaném telefonu **390 × 844** a rozloženém Fold viewportu **768 × 1024**.
Fold landscape **1024 × 768** prošel dotykovým tahem, ovládáním a úplným
dokončením jedné desky. Nápověda, lupa, klidný režim, obnova postupu a přechod na
další desku prošly. Desktop **1440 × 1080** a šířky **320, 390 a 768** neměly
vodorovné přetékání. Ověřený motiv je světlý.

Snímky desktopu, telefonu, obou Fold orientací, první výhry a katalogu byly
skutečně prohlédnuty. Seznam těchto snímků a kontrolní součty ukládá
`evidence-manifest.json`; přesný rozsah emulace a dokončená ID ukládá
`report.json`. Zaznamenáno bylo **0 chyb stránky a 0 herních síťových požadavků
nebo zápisů výsledků**. Čtyři testy produkční zábrany, otisků, kompletního
uznávání a identity nativních modulů také prošly.

In-app Browser runtime nevrátil žádný dostupný prohlížeč, proto bylo použito
nové izolované headless testovací prostředí. **Fyzické zařízení nebylo
testováno.** Tyto automatické herní průchody nejsou hráčskou telemetrií ani
měřením lidské obtížnosti. Účty, XP, databáze a aktivace playtestu nejsou
součástí preview.
