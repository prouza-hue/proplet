#!/usr/bin/env python3
"""Apply the runtime-only Tajenka v2 integration on top of the latest preview branch."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str) -> str:
    new, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return new


def patch_app() -> None:
    path = "public/app.js"
    text = read(path)
    text = replace_once(
        text,
        "const requestedTajenkaWeek=Math.min(10,Math.max(1,Number.parseInt(new URLSearchParams(location.search).get('tajenka_week')||'1',10)||1));",
        "const requestedTajenkaWeek=Math.min(37,Math.max(1,Number.parseInt(new URLSearchParams(location.search).get('tajenka_week')||'1',10)||1));",
        "preview week upper bound",
    )
    text = replace_once(text, "const TAJENKA_PREPARED_WEEKS=10;", "const TAJENKA_PREPARED_WEEKS=37;", "prepared weeks")
    text = replace_once(
        text,
        "if(!data||data.version!==1||!/^tajenka-v2-week-\\d{2}$/.test(data.id)||data.kind!=='weekend_bonus'||data.meta?.previewOnly!==true||Number(data.meta?.rewardXp)!==TAJENKA_REWARD_XP)return false;",
        "if(!data||data.version!==2||!/^tajenka-v2-week-\\d{2}$/.test(data.id)||data.kind!=='weekend_bonus'||data.meta?.previewOnly!==true||Number(data.meta?.rewardXp)!==TAJENKA_REWARD_XP)return false;",
        "fixture schema version",
    )

    marker = "function tajenkaPhraseWords(puzzle=tajenkaPuzzle){return (puzzle?.tajenka?.answerOrder||[]).map(i=>puzzle.answers[i]).filter(Boolean)}"
    helpers = r'''function tajenkaPhraseWords(puzzle=tajenkaPuzzle){return (puzzle?.tajenka?.answerOrder||[]).map(i=>puzzle.answers[i]).filter(Boolean)}
function tajenkaPhraseTokens(puzzle=tajenkaPuzzle){
 const display=String(puzzle?.tajenka?.displayText||puzzle?.tajenka?.phrase||'');
 const parts=display.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu)||[display];
 const tokens=parts.map((text,index)=>({text,index,isWord:/^[\p{L}\p{N}]+$/u.test(text),answerIndex:null}));
 const words=tokens.filter(token=>token.isWord);const used=new Set();
 const norm=value=>String(value||'').toLocaleUpperCase('cs-CZ');
 for(let answerIndex=0;answerIndex<(puzzle?.answers||[]).length;answerIndex++){
  const answer=puzzle.answers[answerIndex];const token=words.find(word=>!used.has(word.index)&&norm(word.text)===norm(answer.word));
  if(token){token.answerIndex=answerIndex;used.add(token.index)}
 }
 for(const companion of (puzzle?.tajenka?.companions||[])){
  const wanted=(String(companion?.text||'').match(/[\p{L}\p{N}]+/gu)||[]).map(norm);if(!wanted.length)continue;
  const revealIndex=(puzzle?.answers||[]).findIndex(answer=>norm(answer.word)===norm(companion?.revealWith));if(revealIndex<0)continue;
  for(let i=0;i<=words.length-wanted.length;i++){
   const slice=words.slice(i,i+wanted.length);if(slice.some(word=>used.has(word.index)))continue;
   if(slice.every((word,j)=>norm(word.text)===wanted[j])){slice.forEach(word=>{word.answerIndex=revealIndex;used.add(word.index)});break}
  }
 }
 return tokens;
}'''
    text = replace_once(text, marker, helpers, "phrase token helpers")

    new_render = r'''function renderTajenkaPhrase(g=currentGame){
 if(!g||g.mode!=='tajenka')return;const box=$('#tajenkaPhrase'),slots=$('#tajenkaSlots'),progress=$('#tajenkaProgress');if(!box||!slots||!progress)return;
 const words=tajenkaPhraseWords(g.puzzle),tokens=tajenkaPhraseTokens(g.puzzle),solved=new Set((g.found||[]).map(f=>f.answerIndex)),previous=new Set((g.tajenkaRevealed||[]));
 slots.innerHTML=tokens.map(token=>{
  if(!token.isWord)return `<span class="tajenka-literal">${esc(token.text)}</span>`;
  const answerIndex=token.answerIndex,revealed=Number.isInteger(answerIndex)&&solved.has(answerIndex),fresh=revealed&&!previous.has(answerIndex);
  const text=revealed?esc(token.text):'·'.repeat(Math.max(1,[...token.text].length));
  return `<span class="tajenka-slot ${revealed?'revealed':'pending'} ${fresh?'newly-revealed':''}">${text}</span>`;
 }).join('');
 progress.innerHTML=words.map((_,i)=>`<i class="${solved.has(i)?'done':''}"></i>`).join('')+`<strong>${solved.size}/${words.length}</strong>`;
 box.classList.remove('hidden');g.tajenkaRevealed=[...solved];
}
function answerIndexForTajenka'''
    text = regex_once(
        text,
        r"function renderTajenkaPhrase\(g=currentGame\)\{.*?\n\}\nfunction answerIndexForTajenka",
        new_render,
        "phrase renderer",
    )
    text = text.replace("winPraise.textContent='Pět slov, jedna společná myšlenka.';winPraise.classList.remove('hidden');", "winPraise.classList.add('hidden');")
    write(path, text)


def patch_backend() -> None:
    path = "backend/config.py"
    text = read(path)
    text = replace_once(text, 'tajenka_bank_path=data_root / "tajenka_weekend_v1.json",', 'tajenka_bank_path=data_root / "tajenka_weekend_v2.json",', "backend bank path")
    write(path, text)

    path = "server.py"
    text = read(path)
    text = replace_once(text, 'def current_tajenka(week: Optional[int] = Query(default=None, ge=1, le=10)):', 'def current_tajenka(week: Optional[int] = Query(default=None, ge=1, le=37)):', "API week upper bound")
    write(path, text)


def patch_result_layer() -> None:
    path = "public/tajenka-release-fix.js"
    text = read(path)
    anchor = "  function sentenceCasePhrase(value){\n"
    helper = r'''  function currentSourceMarkup(){
    let puzzle=null;try{puzzle=tajenkaPuzzle}catch{}
    const source=puzzle?.source;if(!source?.url||!/^https:\/\//i.test(String(source.url)))return '';
    const href=esc(String(source.url)),label=esc(source.label||'zdroj');
    if(source.author){
      const byline=[source.author,source.work].filter(Boolean).map(esc).join(' · ');
      return `<span>${byline}</span><a href="${href}" target="_blank" rel="noopener noreferrer">Zdroj ↗</a>`;
    }
    return `<span>Zdroj:</span><a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
  }
  function syncTajenkaSourceLine(modal){
    let line=q('.tajenka-result-source',modal),markup=currentSourceMarkup();
    if(!markup){line?.remove();return}
    if(!line){line=document.createElement('div');line.className='tajenka-result-source';const text=q('#winText',modal);text?.insertAdjacentElement('afterend',line)}
    line.innerHTML=markup;
  }
'''
    text = replace_once(text, anchor, helper + anchor, "source helpers")
    text = replace_once(
        text,
        "    const text=q('#winText',modal);if(text)text.textContent=resultLine(result);",
        "    const text=q('#winText',modal);if(text)text.textContent=resultLine(result);syncTajenkaSourceLine(modal);",
        "visible result source",
    )
    text = replace_once(
        text,
        "    modal?.classList.remove('tajenka-daily-result');",
        "    modal?.classList.remove('tajenka-daily-result');q('.tajenka-result-source',modal)?.remove();",
        "source reset",
    )
    write(path, text)

    path = "public/tajenka-release-fix.css"
    text = read(path)
    css = r'''

/* Tajenka v2 — source/author is a quiet post-solve editorial footnote. */
html.tiskarna-ui #winModal.tajenka-daily-result .tajenka-result-source{
  display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;
  margin:-2px 0 8px;color:var(--td-muted,#706a62);font-size:11px;line-height:1.35;text-align:center;
}
html.tiskarna-ui #winModal.tajenka-daily-result .tajenka-result-source a{
  color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;font-weight:750;
}
html.tiskarna-ui #winModal.tajenka-daily-result .tajenka-result-source a:hover{color:var(--td-ink,#2c2925)}
.tajenka-literal{white-space:pre;font-size:11px;font-weight:850;color:#706987}
@media(max-width:600px){.tajenka-literal{font-size:10px}}
'''
    if "Tajenka v2 — source/author" not in text:
        text = text.rstrip() + css + "\n"
    write(path, text)


def main() -> None:
    patch_app()
    patch_backend()
    patch_result_layer()
    print("Applied Tajenka v2 runtime integration")


if __name__ == "__main__":
    main()
