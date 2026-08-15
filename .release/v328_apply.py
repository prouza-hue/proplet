from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {count}: {old[:120]}')
    p.write_text(text.replace(old, new), encoding='utf-8')

replace_once('server.py', 'APP_VERSION = "3.27.3"', 'APP_VERSION = "3.28.0"')
replace_once('public/app.js', "const APP_VERSION='3.27.3';", "const APP_VERSION='3.28.0';")
replace_once('public/sw.js', "const CACHE='proplet-v3.27.3-medium-hard-swap';", "const CACHE='proplet-v3.28.0-profile-compact';")

old_achievement_html = '''      <div class="card achievement-card">
        <div class="section-head"><div><span class="eyebrow">ÚSPĚCHY</span><h2>Co už máš za sebou</h2></div></div>
        <div id="achievementGrid" class="achievement-groups"></div>
      </div>'''
new_achievement_html = '''      <div class="card achievement-card">
        <div class="section-head">
          <div><span class="eyebrow">ÚSPĚCHY</span><h2>Co už máš za sebou</h2></div>
          <button id="achievementToggleBtn" class="achievement-toggle-btn" type="button" aria-expanded="false" aria-controls="achievementDetails">Zobrazit vše <span>⌄</span></button>
        </div>
        <div id="achievementSummary" class="achievement-summary"></div>
        <div id="achievementDetails" class="achievement-details" hidden>
          <div id="achievementGrid" class="achievement-groups"></div>
        </div>
      </div>'''
replace_once('public/index.html', old_achievement_html, new_achievement_html)

old_render_achievements = "function renderAchievements(stats){return ACHIEVEMENT_GROUPS.map(([id,label])=>{const list=ACHIEVEMENTS.filter(a=>a.group===id);if(!list.length)return '';const earned=list.filter(a=>a.test(stats)).length;return `<section class=\"achievement-group\"><div class=\"achievement-group-head\"><strong>${label}</strong><span>${earned}/${list.length}</span></div><div class=\"achievement-grid\">${list.map(a=>achievementCard(a,stats)).join('')}</div></section>`}).join('')}"
new_render_achievements = old_render_achievements + r'''
let profileAchievementsExpanded=false;
function achievementProgressState(a,stats){const value=Math.max(0,a.value(stats)||0),done=a.test(stats),pct=Math.min(100,Math.round(value/a.target*100));return {a,value,done,pct}}
function renderAchievementSummary(stats){
 const states=ACHIEVEMENTS.map(a=>achievementProgressState(a,stats)),earned=states.filter(x=>x.done),pending=states.filter(x=>!x.done).sort((a,b)=>b.pct-a.pct||a.a.target-b.a.target),earnedLimit=pending.length?Math.min(4,earned.length):Math.min(8,earned.length),preview=[...earned.slice(-earnedLimit),...pending.slice(0,8-earnedLimit)],pct=states.length?Math.round(earned.length/states.length*100):0,closest=pending[0];
 return `<div class="achievement-summary-copy"><div><strong>${earned.length} z ${states.length} splněno</strong><small>${closest?`Nejblíž: ${esc(closest.a.name)} · ${Math.min(closest.value,closest.a.target)}/${closest.a.target}`:'Všechny úspěchy jsou tvoje. Respekt!'}</small></div><span>${pct}%</span></div><div class="achievement-summary-progress"><span style="width:${pct}%"></span></div><div class="achievement-summary-icons">${preview.map(x=>`<span class="achievement-peek ${x.done?'earned':'next'}" title="${esc(x.a.name)}" aria-label="${esc(x.a.name)}${x.done?', splněno':''}"><b>${x.a.icon}</b>${x.done?'<i>✓</i>':''}</span>`).join('')}</div>`;
}
function syncAchievementDisclosure(){const button=$('#achievementToggleBtn'),details=$('#achievementDetails');if(!button||!details)return;details.hidden=!profileAchievementsExpanded;button.setAttribute('aria-expanded',String(profileAchievementsExpanded));button.innerHTML=profileAchievementsExpanded?'Sbalit <span>⌃</span>':'Zobrazit vše <span>⌄</span>'}
function focusProfileRoadmap(){requestAnimationFrame(()=>{const rail=$('#levelRoadmap'),current=rail?.querySelector('.current');if(!rail||!current)return;const max=Math.max(0,rail.scrollWidth-rail.clientWidth),target=current.offsetLeft-(rail.clientWidth-current.offsetWidth)/2;rail.scrollLeft=Math.max(0,Math.min(max,target))})}'''
replace_once('public/app.js', old_render_achievements, new_render_achievements)
replace_once('public/app.js', "if(screen==='profile')renderProfile();", "if(screen==='profile')renderProfile({focusRoadmap:prev!=='profile'});")
replace_once('public/app.js', 'function renderProfile(){', 'function renderProfile({focusRoadmap=false}={}){')
replace_once('public/app.js', "updatePushUI();$('#achievementGrid').innerHTML=renderAchievements(stats);renderSettings();renderPrivacyActions();", "updatePushUI();const achievementSummary=$('#achievementSummary'),achievementGrid=$('#achievementGrid');if(achievementSummary)achievementSummary.innerHTML=renderAchievementSummary(stats);if(achievementGrid)achievementGrid.innerHTML=renderAchievements(stats);syncAchievementDisclosure();const achievementToggle=$('#achievementToggleBtn');if(achievementToggle)achievementToggle.onclick=()=>{profileAchievementsExpanded=!profileAchievementsExpanded;syncAchievementDisclosure()};if(focusRoadmap)focusProfileRoadmap();renderSettings();renderPrivacyActions();")

css = r'''

/* v3.28 — compact profile progress */
.level-roadmap::-webkit-scrollbar{display:none}
.achievement-card .section-head{align-items:center}
.achievement-toggle-btn{flex:0 0 auto;border:1px solid #ddd6e8;background:#f5f1fa;color:#625a73;border-radius:999px;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}
.achievement-toggle-btn span{display:inline-block;margin-left:2px;font-size:12px;line-height:1}
.achievement-summary{margin-top:11px;padding:11px 12px;border:1px solid #ebe5f1;border-radius:16px;background:#f8f5fb}
.achievement-summary-copy{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.achievement-summary-copy strong,.achievement-summary-copy small{display:block}.achievement-summary-copy strong{font-size:13px}.achievement-summary-copy small{margin-top:2px;color:var(--muted);font-size:9.5px;line-height:1.3}.achievement-summary-copy>span{flex:0 0 auto;color:#6558c7;font-size:11px;font-weight:950}
.achievement-summary-progress{height:5px;margin-top:8px;border-radius:999px;background:#e9e4f0;overflow:hidden}.achievement-summary-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6c5ce7,#55cfa7)}
.achievement-summary-icons{display:flex;gap:6px;margin-top:10px;overflow:hidden}
.achievement-peek{position:relative;flex:0 0 32px;width:32px;height:32px;border:1px solid #e1dbe8;border-radius:11px;background:#f1edf5;display:grid;place-items:center;opacity:.58;filter:grayscale(.32)}
.achievement-peek b{font-size:18px;line-height:1;font-weight:400}.achievement-peek.earned{background:#eef8f3;border-color:#cfe5da;opacity:1;filter:none}.achievement-peek i{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;border-radius:50%;display:grid;place-items:center;background:#49a982;color:#fff;border:2px solid #f8f5fb;font-size:7px;font-style:normal;font-weight:1000}
.achievement-details[hidden]{display:none}.achievement-details .achievement-groups{margin-top:14px;padding-top:13px;border-top:1px solid #eee8f3}
html[data-theme="dark"] .achievement-toggle-btn{background:#2b2735;border-color:#40394c;color:#c2bacb}
html[data-theme="dark"] .achievement-summary{background:#24212e;border-color:#3b3547}
html[data-theme="dark"] .achievement-summary-copy>span{color:#b6a9ff}html[data-theme="dark"] .achievement-summary-progress{background:#34303d}
html[data-theme="dark"] .achievement-peek{background:#2b2833;border-color:#403a49}html[data-theme="dark"] .achievement-peek.earned{background:#21372f;border-color:#355247}html[data-theme="dark"] .achievement-peek i{border-color:#24212e}
html[data-theme="dark"] .achievement-details .achievement-groups{border-top-color:#373241}
@media(max-width:390px){.achievement-toggle-btn{padding:7px 9px}.achievement-summary{padding:10px}.achievement-summary-icons{gap:5px}.achievement-peek{flex-basis:30px;width:30px;height:30px}.achievement-peek b{font-size:17px}}
'''
styles = Path('public/styles.css')
text = styles.read_text(encoding='utf-8')
if '/* v3.28 — compact profile progress */' in text:
    raise SystemExit('public/styles.css: v3.28 CSS already present')
styles.write_text(text + css, encoding='utf-8')

print('v3.28.0 profile UX patch applied')
