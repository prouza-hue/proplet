# Jednorázová a měsíční podpora — 31. 10. 2026

Samostatná větev patronství; nepatří do listopadového vydání.

Schválený text nabídky převzat přesně, značka je znovu trvale viditelná. Hráč vědomě volí Jednorázově/Měsíčně. Měsíční příprava obsahuje první datum platby a stejný variabilní symbol pro opakované převody. Bankovní aplikace musí založení trvalého příkazu podporovat; hráč jej potvrzuje, mění a ruší v bance. Proplet neoznačuje přípravu QR jako aktivní předplatné a sám nic nestrhává.

Platební backend používá pro měsíční příkaz SPD FRQ:1M a DT:YYYYMMDD podle příkladu KB: https://www.kb.cz/en/faq-and-support/accounts-and-payments/how-to-insert-qr-codes-into-invoices . Podpora jednotlivých bankovních aplikací není garantovaná. Preview je stále izolované a neplatební.

Četnost/datum/částka/vlastník jsou neměnné vlastnosti intentu. Každý přijatý měsíční převod má vlastní bankovní ID, záznam a audit; opakovaný příjem stejného ID je idempotentní. Jednorázový intent nepřijme jinou druhou transakci. Veřejná značka zůstává dobrovolná a nepřidává XP.

Ověřeno: cílené HTTP kontrakty a skutečná izolovaná PostgreSQL acceptance včetně souběžného opakování ID, vlastnictví, dat, ACL a historie. Browser: 390 px měsíční volba/QR a přesný schválený text, dvě modelová potvrzení stejného VS s jinými ID -> 2 převody / 198 Kč. Žádný produkční zápis, aktivace nebo bankovní napojení.
