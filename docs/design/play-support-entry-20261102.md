# Výraznější ruční podpora na Dnes — 2. 11. 2026

Uživatel schválil pouze výraznější vstup podpory na Dnes. Nativní tlačítko #patronTodayLink používá stejné open(offer, link), stejnou viditelnost i celkovou 60px stopu. Nová papírová podoba přidává existující modrou a červenou srdeční značku, Fraunces titulek a jednu šipku; finanční tok ani status účtu nemění. Hrát zůstává výslovně uzamčené.

Root schválil dark mobil390, narrow320 bez horizontálního přetečení a light Fold832. Test klienta podpory zachovává autoritu serveru, soukromí, lifecycle a stejné otevření nabídky. Před začleněním main byla uložena přesná tří-souborová záloha i patch mimo checkout.

Do existující preview větve je následně MERGE začleněn již vydaný produkční main aa00fc1 /4.10.10 s opravou zbytečných přenosů historie odměn. Není to merge preview do main ani produkční deployment. Konflikty byly pouze app/index/SW/theme release metadata; ponechaly celé schválené tělo Hrát. Backendová optimalizace a její testy zůstávají přesně upstream. Marker je proplet-v4.10.10-play-one-screen3; změněné patron JS/CSS a release-core URL mají odpovídající revize.

Uzamčení dokládá 12-souborový snapshot proti760e939: app.js dovoluje pouze release marker, index pouze query revize assetů; všech ostatních 10 souborů Hrát má shodný raw SHA256. Schválené tři nové UI/test soubory podpory mají také zachovaný normalizovaný SHA před a po merge. tools/studio-preview/guard.js má jen existující EOL rozdíl a není zahrnutý; qa-refresh300 zůstává lokální QA a do commitu se nedostává.

Online READY a čtecí ověření nového preview patří do následného handoffu mimo repozitář. Žádná nová bankovní operace, grant odznaku, schéma, auth konfigurace ani environment proměnná není součástí této iterace. Produkční alias zůstává na svém již vydaném deploymentu.
