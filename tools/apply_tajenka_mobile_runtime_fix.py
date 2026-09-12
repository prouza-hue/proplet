#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_once(path: str, old: str, new: str, label: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        print(f"{label}: already applied")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"{label}: applied")


def patch_app() -> None:
    path = ROOT / "public/app.js"
    text = path.read_text(encoding="utf-8")

    marker = "function clearHintTrace(){$$('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}\nfunction applySmartHint(level){"
    helper = """function clearHintTrace(){$$('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}\nfunction setTajenkaHintBanner(text=''){\n const stage=$('#boardStage');if(!stage)return;let banner=$('#tajenkaHintBanner');\n if(!banner){banner=document.createElement('div');banner.id='tajenkaHintBanner';banner.className='tajenka-hint-banner hidden';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');stage.before(banner)}\n const value=String(text||'').trim();banner.textContent=value;banner.classList.toggle('hidden',!value);\n}\nfunction applySmartHint(level){"""
    if "function setTajenkaHintBanner(" not in text:
        if marker not in text:
            raise RuntimeError("tajenka hint helper marker missing")
        text = text.replace(marker, helper, 1)

    old_hint = "if(tajenka&&level===1){message(`💭 ${pick.a.clue||`Hledáš slovo o ${pick.a.word.length} písmenech.`}`,'good')}"
    new_hint = "if(tajenka&&level===1){const hintText=`💭 ${pick.a.clue||`Hledáš slovo o ${pick.a.word.length} písmenech.`}`;message(hintText,'good');setTajenkaHintBanner(hintText)}"
    if new_hint not in text:
        if old_hint not in text:
            raise RuntimeError("tajenka semantic hint marker missing")
        text = text.replace(old_hint, new_hint, 1)

    old_start = "function startGame(puzzle,mode,dailyDate,options={}){\n hideTouchMagnifier();"
    new_start = "function startGame(puzzle,mode,dailyDate,options={}){\n $('#tajenkaHintBanner')?.remove();\n hideTouchMagnifier();"
    if new_start not in text:
        if old_start not in text:
            raise RuntimeError("startGame marker missing")
        text = text.replace(old_start, new_start, 1)

    old_progress = "state.inProgress={puzzleId:g.puzzle.id,mode:'tajenka',found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,elapsedMs:Math.round(gameElapsed(g)),savedAt:Date.now()}"
    new_progress = "state.inProgress={puzzleId:g.puzzle.id,mode:'tajenka',found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,elapsedMs:Math.round(gameElapsed(g)),calmMode:!!g.calmMode,savedAt:Date.now()}"
    if new_progress not in text:
        if old_progress not in text:
            raise RuntimeError("tajenka progress marker missing")
        text = text.replace(old_progress, new_progress, 1)

    path.write_text(text, encoding="utf-8")


def patch_calm() -> None:
    path = ROOT / "public/quality-v334-core-v40114.js"
    text = path.read_text(encoding="utf-8")

    text = text.replace("['daily','free'].includes(g.mode)", "['daily','free','tajenka'].includes(g.mode)")
    text = text.replace("['daily','free'].includes(currentGame.mode)", "['daily','free','tajenka'].includes(currentGame.mode)")
    text = text.replace("event.mode==='daily'||event.mode==='free'", "event.mode==='daily'||event.mode==='free'||event.mode==='tajenka'")

    old_save = "function saveCalmIntoProgress(){try{const g=currentGame;if(!g||!['daily','free','tajenka'].includes(g.mode))return;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();if(s.inProgress?.[key]){s.inProgress[key].calmMode=!!g.calmMode;saveState(s)}}catch{}}"
    new_save = "function saveCalmIntoProgress(){try{const g=currentGame;if(!g||!['daily','free','tajenka'].includes(g.mode))return;if(g.mode==='tajenka'){if(typeof saveTajenkaGameProgress==='function')saveTajenkaGameProgress(g);return}const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();if(s.inProgress?.[key]){s.inProgress[key].calmMode=!!g.calmMode;saveState(s)}}catch{}}"
    if new_save not in text:
        if old_save not in text:
            raise RuntimeError("calm progress marker missing")
        text = text.replace(old_save, new_save, 1)

    if "['daily','free'].includes" in text or "event.mode==='daily'||event.mode==='free'," in text:
        raise RuntimeError("unsupported daily/free-only calm eligibility remains")

    path.write_text(text, encoding="utf-8")


def patch_css() -> None:
    path = ROOT / "public/printshop-ui.css"
    text = path.read_text(encoding="utf-8")
    marker = "Tajenka mobile semantic hint — dedicated visible row"
    if marker in text:
        print("mobile hint CSS: already applied")
        return
    css = r'''

/* Tajenka mobile semantic hint — dedicated visible row, never clipped inside Skládáš. */
html.tiskarna-ui #screen-game .tajenka-hint-banner{display:none}
@media(max-width:600px){
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column,
 html.tiskarna-ui .tajenka-mode .game-board-column{grid-template-rows:auto auto auto auto minmax(0,1fr)!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.tajenka-hint-banner:not(.hidden),
 html.tiskarna-ui .tajenka-mode .game-board-column>.tajenka-hint-banner:not(.hidden){
  grid-row:4!important;display:flex!important;align-items:flex-start!important;min-width:0!important;
  padding:7px 9px!important;border:1px solid color-mix(in srgb,#235BCC 28%,var(--td-line))!important;
  border-radius:9px!important;background:color-mix(in srgb,#235BCC 7%,var(--td-paper))!important;
  color:var(--td-ink)!important;font-size:12px!important;font-weight:750!important;line-height:1.3!important;
  white-space:normal!important;overflow:visible!important;text-overflow:clip!important;
 }
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.board-stage,
 html.tiskarna-ui .tajenka-mode .game-board-column>.board-stage{grid-row:5!important}
}
'''
    path.write_text(text.rstrip() + css + "\n", encoding="utf-8")
    print("mobile hint CSS: applied")


def main() -> None:
    patch_app()
    patch_calm()
    patch_css()
    print("Applied Tajenka mobile hint + calm mode fixes")


if __name__ == "__main__":
    main()
