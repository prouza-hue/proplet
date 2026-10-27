# Pilot nového vzhledu Propletu

Návrh z 27. 10. 2026. Nábor ani sběr odpovědí zatím není spuštěný. Níže je konkrétní doporučená varianta, nikoli další redesign hry.

## Koho oslovit

První kolo: 10 nejaktivnějších skutečných hráčů za posledních 7 celých dnů v českém čase, podle počtu **různých dokončených běžných desek**, ne XP. Počítat Daily, Extra, Tajenku, Volnou hru a Archiv. Doručení téhož výsledku ani opakování stejné desky počet nezvyšuje; vyloučit trénink, záchranu série, QA účty a staré experimenty. Nápověda, Klid a platné offline výsledky nejsou důvodem k vyřazení.

Výběr jednou uložit a během pilotu nepřepočítávat. Při shodě použít počet aktivních dnů. Před realizací ověřit dostupnost a úplnost autoritativních výsledků; samotné analytické dokončení pokusu ani klientský čas nejsou dostatečným podkladem.

Top 10 dobře odhalí problémy častých hráčů, ale nereprezentuje všechny. Po jejich první opravné iteraci přidat menší druhou skupinu méně aktivních nebo novějších hráčů. Pohlídat zastoupení mobilu, Foldu/tabletu a desktopu.

## Pozvánka bez vyrušování

V produkci pouze vybraným účtům malá zavíratelná nabídka na Dnes, mimo hru a otevřené dialogy. Ne automatický modal, push ani e-mail. Respektovat dosavadní ochrany onboardingu a přednost herních akcí.

> **Pomůžeš mi doladit nový vzhled?**
>
> Zkouším nový vzhled Propletu. Zajímá mě upřímně, co je lepší — a co jsem naopak zhoršil.
>
> **Vyzkoušet náhled** · **Teď ne**

Krátká informace před přechodem: „V náhledu se přihlas svým běžným účtem. Výsledky a XP se ukládají jako obvykle.“ Otevřít stávající Vercel preview v nové kartě; běžný Proplet zůstane po ruce. Mezi odlišnými adresami je přihlášení samostatné, přihlašovací token nepatří do odkazu.

„Teď ne“ odloží nabídku na 7 dní; celkem nejvýše dvě zobrazení. Zřetelné zavření znamená odmítnutí dalšího oslovování v tomto pilotu. Přijetí i odmítnutí ukládat na účet, ne jen do konkrétního prohlížeče. Pilot trvá přibližně týden, bez úkolu odehrát stanovený počet her a bez XP odměny za hodnocení.

## Jak získat odpověď

V preview využít stávající místo „Nahlásit chybu“ v patičce pro **Zpětnou vazbu**. Žádný další trvalý blok na kompaktním Dnes; formulář musí dál umožnit nahlásit i skutečnou chybu.

Po dvou hrách nebo druhé návštěvě jednou nenápadně upozornit na tento odkaz, až po zavření výsledkovky a návratu na Dnes. Nic samo neotevírat. Po odpovědi nebo odmítnutí už nepřipomínat.

Formulář na přibližně půl minuty:

> **Jaký máš z nového Propletu dojem?**
>
> Lepší · Podobný · Horší · Ještě nevím
>
> **Co konkrétně se ti líbí, vadí nebo se hůř hledá?** *(nepovinné)*
>
> **Odeslat** · **Později**

Volba sama o sobě je platná odpověď; text není povinný. Nepoužívat otázku „Líbí se ti nový a svěží vzhled?“ — předem naznačuje žádanou odpověď. Poděkování: „Díky, pomáháš Proplet vyladit.“

## Vyhodnocení a rozsah realizace

Počítat lidi: kolik jich pozvánku vidělo, přijalo, skutečně použilo náhled a odpovědělo. Zaznamenat i odmítnutí. U deseti lidí hledat konkrétní opakující se potíže, ne statistickou převahu. Chyby opravit hned, ostatní připomínky sloučit do jedné následné iterace a účastníkům stručně sdělit, co jejich feedback změnil.

Využitelné jsou běžné účty ve Vercel preview, administrativní inbox hlášení a ochranné podmínky fronty oznámení. Nově je potřeba doplnit výběrový report, stav účasti na účtu, malou nabídku a formulář s identifikátorem kampaně a konkrétní revizí preview. Samotné číslo verze 4.09.13 nerozliší tyto UI varianty. K odpovědi stačí přidat režim barev a velikost obrazovky; její text nepatří do běžné analytiky.

Historický podklad: `docs/playtests/MOZKOKALYPSA-ROUND2-20260926.md` již používá zmrazenou kohortu a upozorňuje na omezení Top 10. Jeho XP pravidla ani tabulky starého experimentu se pro tento test nepřebírají.
