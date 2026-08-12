# Proplet – čerstvý herní review po v3.5

## Co už je silné
Jádro hry je rozpoznatelné a vlastní: český jazyk, nepravidelné plochy, přesná cesta slova, Daily, Free progres a Mozkožrout. Proplet už nepotřebuje další režim jen proto, aby měl další režim.

## Největší změna v3.5: obtížnost měříme podle lidí
Generátor dál používá strukturální skóre, ale v3.5 začne pro přihlášené hráče ukládat:
- počet startů a dokončení,
- čas dokončení,
- počet chybných tahů,
- počet a nejvyšší úroveň nápovědy,
- Clean solve,
- subjektivní rating Lehčí / Akorát / Těžší.

`/api/quality-report` pak pro každou úlohu spočítá completion rate, medián času, průměr chyb/hintů, Clean rate a rating. Prvních méně než 5 pokusů je označeno jako `early`; od 5 pokusů jako `usable`.

### Jak data použít
Neautomatizovat hned. Po pár týdnech:
1. hledat outliery uvnitř každé obtížnosti,
2. porovnat medián času a completion rate se sousedními levely,
3. přesunout/reorderovat jen jasné případy,
4. divná slova vyřadit podle reportů,
5. následně upravit generátor, aby další banka lépe odpovídala reálné obtížnosti.

## Co bych dělal jako další kroky až po nasbírání dat
### P1 – Cloud save rozehrané hry
Dnes je rozehraný snapshot lokální. Přenesení rozehrané úlohy mobil ↔ notebook by dokončilo multi-device příběh. Je to užitečné, ale vyžaduje conflict resolution, proto jsem ho netlačil do v3.5.

### P1 – Kalibrace banky podle telemetry
Až bude alespoň cca 10–20 pokusů na relevantní úlohy, přeuspořádat levely. Bez dat by to byla jen další forma hádání.

### P2 – Personal best / srovnání se sebou
U replay Free úloh ukázat vlastní rekord a při zlepšení jednoduché „o 18 s rychleji“. Motivuje bez další měny nebo shopu.

### P2 – Přístupnost
Volitelně vyšší kontrast barevných cest a alternativní vzory pro hráče s poruchami barvocitu.

### Co bych zatím nepřidával
Power-upy, virtuální měnu, shop, loot, pět dalších módů ani permanentní časovky. Proplet je lepší jako čistá slovně-logická hra než jako přeplácaná engagement mašina.
