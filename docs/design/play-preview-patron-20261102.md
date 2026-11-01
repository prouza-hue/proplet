# Patronství v nativním preview Hrát — 2. 11. 2026

Příčina chybějícího Patronství byla serverová: PROPLET_PATRONS_ENABLED existovalo pouze pro production a feature_enabled odmítalo každé preview. Aktuální produkční main zůstává 9569de9 / 4.10.9; větev Hrát vychází z téhož základu, žádný novější produkční hotfix nebyl potřeba přebírat.

Uživatel výslovně schválil běžný produkční kontext účtu a podpory na codex/play-one-screen. Nová podmínka vyžaduje současně vlastní patron flag, přesnou větev, preview prostředí a již schválené LIVE_PLAYER_PREVIEW s produkčním projektem. Ostatní preview včetně jiných živých větví i izolovaného QA zůstávají vypnuté. Ne-preview zapnutí zachovává původní chování. Jediný přidaný plain Vercel záznam je PROPLET_PATRONS_ENABLED=true, target preview, gitBranch codex/play-one-screen; produkční flag ani jiné cíle se nemění.

Používají se původní osobní stav, veřejné dekorace a skutečný manuální tok podpory. Neexistuje klientská imitace odznaku ani modelový QR. Test potvrzuje guest status bez RPC, osobní čtení s p_claim=false a zachování soukromí veřejných dekorací. Nativní klient pro povoleného hosta na Dnes ukazuje Podpořit Proplet; automatická nabídka se jen otevřením stránky nevytvoří.

Čtecí kontrola skutečného ověřeného vlastníka Pavel, bez přihlašovacího tokenu a s rollbackem případných vedlejších efektů status funkce, potvrdila patron=true, publicBadge=true, badgeType=supporter, recurringState=none, contributions=0, canOffer=false a offerWaitReason=patron. Veřejný lookup vrací stejnou modrou značku. Účet, platby, entitlementy ani odznak nebyly změněny či znovu uděleny.

Skutečná SQL definice zachovává prioritu existujícího news receipt/fallback first-seen, prodlevu 48 hodin, dvě další desky po oznámení a původní historii pěti desek ve třech dnech. Announcement queue a priority se nemění; stav ani receipts se neresetují. Release-news zůstává na své dosavadní samostatné preview politice.

Prošlo 11 patron HTTP/gate/privacy/production testů, 8 live-preview hranic a callback testů a cílené klientské testy news koordinace a patron lifecycle. UI pondělní lišty, cache marker2 a online ověření se koordinují ve stejném draft PR236. Aktivace platí pro nový preview deployment, nikoli zpětně pro starý build. Produkční nasazení ani změna databázového schématu není součástí této opravy.
