# Výsledkovka a XP sticker — 12. 10. 2026

## Rozhodnutí Pavla
- Jeden společný tiskařský sticker pro získané XP a bonusovou nabídku; zachovat číselnou hodnotu včetně případných bonusových slov.
- Ve výsledku výrazně zlatý sticker vedle vystředěné vítězné hlášky. Pod ní rovnou globální pořadí.
- Bez samostatného „Čistě bez nápovědy“ a bez přepínače Globálně / Můj tým. Metodika pořadí a cleanSolve se nemění.
- Pod pořadím modré „Hraj další úroveň“, pod ním červené „Pozvi kamaráda“. Bez mečů a bez vysvětlující věty nad tlačítkem.
- Bonus +1000 XP se nepřidává na tlačítko výsledkovky.
- Na Dnes kompaktní sticker u ilustrace, viditelné CTA se stejným červeným gradientem jako Tajenka; odstranit spodní řádek „Nový účet · …“.

## Implementovaný průchod
Výsledkovka má jeden vstup „Pozvi kamaráda“. Pozývající v navazujícím dialogu zvolí „Poslat tuhle desku“ (původní nativní share handler) nebo „Pozvat nového hráče“ (bonusový odkaz). Pozvanému hráči funguje přímé sdílení desky a zůstává jeho kompaktní postup k bonusu. Dokončenou odměnu lze zavřít.
Nové pořadí tlačítek vlastní původní layout controller; nativní tlačítka a jejich handlery se nepřepisují. Při odstranění starého docku se zachovávají všechny uzly, včetně odznaků. Tréninkový průchod zachovává vlastní strukturu.
Organické zdobení respektuje data-plain-invite, aby nevracelo meče a nespouštělo vzájemné DOM překreslování.

## Přenos do dalších větví
Sdílené vizuální definice: public/result-refresh.css, třída xp-sticker.
Layout: public/challenge-cta-v3333.js.
Pouze globální výsledek: podmínka pro levelLeaderboardBox v renderFreeLeaderboardPanel; detail úrovně si zachovává vlastní přepínač.
Odstranění ikon: public/organic-ui-v4023.js respektuje explicitní volbu bez ikony.
Referrals.js propojuje obě cesty; preview isolation a review controls se do produkce nepřenášejí.

## Prostředí a ověření
Produkce ověřena před změnou: v4.05.5, d1f5f7825e07d7e8a1751de7075914278d3de8bb.
Tato práce aktualizuje izolovaný PR #176. Nevydává jeho starší herní runtime za aktuální main.
Ukázkové sousední výsledky i účty jsou fixtures; žádný produkční zápis, API server statického preview vrací 410. Bonusy zůstávají pouze v paměti náhledu.
Horní testovací lišta umí „Ukázat výsledkovku“ přes nativní dokončení ukázkové desky. Browser kontrola ověřuje skutečné dohrání, bonusy, původní sdílení, další hru a pořadí prvků na 320/390/690/1440 px, světlé i tmavé téma.


## Dotažení podle screenshotů 12. 10., 02:02–02:06
- Pozvánková tlačítka mají původní gradient Tajenky (#a93262 → #c83f67 → #dc5b70), Outfit 400; platí i pro pozvánkový dialog a dokončenou Tajenku na Dnes/Hrát.
- Text hlavního tlačítka dialogu: „Pozvi kamaráda do Propletu“. Úvodní odstavec odstraněn, tři vysvětlující kroky zachovány.
- Postup: „Ještě 1 deska.“ / „Ještě 2 desky.“ / „Ještě 5 desek.“ a „Bonus získáte oba: ty i {nickname}.“ Žádné skloňování nicknamu ani hardcoded Katku/Katkou/Katky v UI.
- Odměna: „Bonus máte oba!“ + „Ty i {nickname}.“ Bez opakovaného vysvětlení. Text a postup tvoří jeden kompaktní blok; na širokém zobrazení jsou ilustrace a sticker vedle sebe.
- Dvojice avatarů: ježek + liška z existující v3 sady. Dekorativní hvězdička odstraněna.
- Pokud data obsahují celé pořadí, nezobrazuje se zbytečný rozbalovací ovladač. Automatický posun na vlastní řádek se provádí jen u dlouhého rozbaleného seznamu. Fixture rozbalení skutečně obsahuje všech 14 hráčů.
