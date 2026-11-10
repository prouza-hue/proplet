# Automatické QR podpory — evidence a bezpečnost

10. 11. 2026. Implementační záznam; sám o sobě nedokládá produkční nasazení.

Automatická nabídka připravuje jednorázové QR na 129 Kč až po potvrzení viditelnosti své karty. Samotné vložení karty ani vytvoření QR nepředstavuje zájem o platbu, její odeslání nebo přijetí. Měsíční a jiné částky zůstávají explicitním platebním tokem.

## Vazba a oprávnění

`POST /api/patrons/offers/qr` přijímá pouze `receiptId`. Autentizovaný účet musí vlastnit potvrzený receipt. Nová příprava vyžaduje poslední potvrzenou kartu nejvýše 15 minut starou s výsledkem `shown`; zůstávají brány podporovatele, vypnutých připomenutí, herní historie, novinek a nedávné explicitní přípravy. Cooldown a limit vytvořený právě tímto receiptem neblokuje dokončení QR.

Jedna karta vytvoří nejvýše jeden intent. Souběžné požadavky serializuje zámek účtu. Server generuje nový náhodný request UUID; uživatel nemůže přepsat částku, četnost ani původ jiného intentu. Opakovaný požadavek vrací již připravené nezměněné instrukce i později, ale po vypršení okna nesmí vytvořit nové. Původní platební a bankovní záznamy se nemění.

Soukromá tabulka `patron_automatic_intents` váže existující intent na receipt. Výchozí původ intentů bez tohoto záznamu je `manual`, tedy explicitní příprava v dialogu. Tabulka má RLS a není dostupná rolím anon/authenticated. RPC jsou SECURITY INVOKER s prázdným search_path a oprávněním pouze service_role.

## Zájem a připomenutí

`POST /api/patrons/offers/engage` přijímá `intentId` a `action` (`saved`/`copied`). Klient jej volá až po úspěšném vyvolání stažení PNG nebo po úspěšném zápisu do schránky. Není to důkaz, že soubor byl uložen na disk, načten bankou nebo zaplacen.

První úspěšná akce ukládá serverový `engaged_at`; opakování ani souběžné retry jej neposouvá. Automatické QR bez této akce nespouští sedmidenní potlačení připomenutí. Po akci se sedm dní počítá od `engaged_at`, u manuální přípravy nadále od vytvoření intentu. Obvyklé 14/30denní cooldowny a limit tří viditelných nabídek za 90 dní zůstávají nezměněné.

Platba načtená přímo druhým telefonem nemusí mít žádnou save/copy událost. Její skutečné potvrzení standardně udělí značku a přičte peníze do měsíčního součtu. Nikdy se nepodmiňuje kliknutím v Propletu.

## Administrace a interpretace metrik

Řádky mají `source`, `offerShownAt`, `engagedAt` a `engagementAction`. `offerShownAt` potvrzuje viditelnost karty, **nikoli** úspěšné načtení nebo vykreslení samotného QR.

`summary` obsahuje `manualPreparations`, `automaticPrepared`, `automaticOfferShown`, `automaticEngaged`, `activeInterest` a `confirmedIntents`. Součty používají období vytvoření intentů před stránkováním (případně konkrétní VS). `activeInterest` je počet explicitních příprav plus automatických příprav s úspěšnou save/copy akcí; není to počet plátců ani veškerého zájmu. Automatický příspěvek uhrazený přímým skenem může být pouze v `confirmedIntents`.

Historické reporty založené na prostém `COUNT(patron_intents)` se po zavedení automatických QR nesmějí vydávat za počet aktivních příprav nebo zájemců. Zdrojem skutečných peněz zůstává výhradně `patron_payments`; manuální odznak ani QR není příspěvek.

## Ověření

Izolovaný PostgreSQL test přes skutečné RPC a nativní HTTP pokrývá souběžné přípravy/akce, vlastnictví, nepovolené parametry, neviditelné a prošlé receipty, nové manuální přípravy, zpožděné retry, oddělené administrátorské počty, přímou platbu bez save/copy a veřejná oprávnění. QR skutečného encoderu se nezávisle dekóduje při 140, 256 a 512 px. Test běží jako součást existujícího `tools/test_patrons_db.py` v databázovém workflow.
