# QA — Proplet v3.20.2

## Ověřené invarianty

- aktivní hra + telefon + landscape ⇒ guard aktivní,
- aktivní hra + telefon + portrait ⇒ guard vypnutý,
- desktop landscape ⇒ guard vypnutý,
- dokončená hra / výsledkovka ⇒ guard vypnutý,
- ostatní obrazovky ⇒ guard vypnutý,
- guard používá `pauseGameClock('landscape')` a po návratu `resumeGameClock()`,
- CSS blocker se vejde do 568×320, 640×320, 740×360 a 932×430,
- `data/puzzles.json` a `public/puzzles.json` zůstávají bitově identické,
- SHA-256 puzzle banky zůstává `1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84`.

## Automatické regresní testy

Před zabalením release byly spuštěny:

- syntaxe `public/app.js`,
- kompilace `server.py`,
- v3.20.2 package test,
- v3.20.2 server account/team test,
- v3.20 nudge cadence test,
- v3.19.2 rescue regression,
- v3.19 focus/pause regression,
- statický bind/HTML contract.

Lokální navigaci plné PWA v headless Chromiu blokuje administrátorská policy prostředí, proto byl vizuál guardu renderován izolovaně přes Playwright. Samotný release je potřeba po Vercel deployi ještě jednou smoke-testovat na fyzickém Fold 7.
