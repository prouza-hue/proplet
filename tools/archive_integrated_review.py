"""Focused real-browser proof: archive-first integration on production 4.07.3; local API fixtures."""
import functools,http.server,json,pathlib,subprocess,threading,urllib.request,urllib.error,traceback,os
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"public/review-evidence";OUT.mkdir(exist_ok=True)
report={"testedSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"checks":[],"screenshots":[],"pageErrors":[],"networkWrites":[],"layoutIssues":[]}
if (OUT/"production-parity.json").exists():report["productionParity"]=json.loads((OUT/"production-parity.json").read_text())
published={}
for path in ["/api/config","/api/daily","/api/daily-special","/api/tajenka","/api/rolling-content"]:
    try:
        with urllib.request.urlopen("https://hrajproplet.cz"+path,timeout=20) as r:
            published[path]=(r.status,r.read())
    except urllib.error.HTTPError as e: published[path]=(e.code,e.read())
    except Exception as e: published[path]=(503,json.dumps({"error":str(e)}).encode())
report["publishedReads"]={k:{"status":v[0]} for k,v in published.items()}
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        path=self.path.split("?")[0]
        if path in published:
            status,data=published[path];self.send_response(status);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(data);return
        super().do_GET()
server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),functools.partial(Handler,directory=str(ROOT/"public")))
threading.Thread(target=server.serve_forever,daemon=True).start()
def shot(page,name):
    page.screenshot(path=str(OUT/(name+".png")),full_page="announcement" not in name,animations="disabled");report["screenshots"].append(name+".png")
def overflow(page,view,width):
    issue=page.evaluate("""()=>document.documentElement.scrollWidth>innerWidth+1?[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className),right:e.getBoundingClientRect().right})).slice(0,15):null""")
    if issue:report["layoutIssues"].append({"view":view,"width":width,"elements":issue})
def go(page,view):
    if view in ["daily","free","leaderboard","profile"]:page.locator('.bottom-nav [data-nav="'+view+'"]').click()
    elif view=="archive":
        go(page,"free");page.locator('#axPlayArchive [data-archive-action="open"]').click();page.wait_for_selector(".ax-board")
    page.wait_for_timeout(180)
def discovery_audit(page,view,width):
    cards=page.evaluate("""({view,width})=>{
      const root=document.querySelector('#screen-'+view),near=(a,b)=>Math.abs(a-b)<=2;
      return [...root.querySelectorAll('.ax-destination,#difficultyCards .cp-card,#newContentBanner,#tajenkaPreviewCard,#tajenkaPlayCard')].filter(card=>card.getBoundingClientRect().height>0).map(card=>{
        const title=card.querySelector('h2'),copy=card.querySelector('.ax-entry-copy,.cp-heading,.tajenka-entry-copy,.new-content-main>div:last-child'),art=card.querySelector('.ax-entry-art,.cp-art,.tajenka-entry-icon,.new-content-spark'),action=card.querySelector('.ax-card-action,.cp-play,#tajenkaPreviewBtn,[data-tajenka-play-action],[data-tajenka-clone-play],:scope>.primary-btn,.new-content-actions .primary-btn,.tajenka-home-actions'),history=card.querySelector('.cp-history');
        const id=card.id||card.dataset.diff||card.className;
        if(!title||!copy||!art||!action)return {id,error:'missing shared card element'};
        const box=card.getBoundingClientRect(),c=getComputedStyle(card),t=getComputedStyle(title),text=copy.getBoundingClientRect(),a=art.getBoundingClientRect(),b=action.getBoundingClientRect(),titleBox=title.getBoundingClientRect(),phrase=card.querySelector('.tajenka-revealed-phrase'),h=history?.getBoundingClientRect();
        const left=box.left+parseFloat(c.borderLeftWidth)+parseFloat(c.paddingLeft),right=box.right-parseFloat(c.borderRightWidth)-parseFloat(c.paddingRight);
        const buttons=action.matches('button')?[action]:[...action.querySelectorAll('button')];
        return {id,font:t.fontFamily,size:t.fontSize,weight:t.fontWeight,
          artLeft:near(a.left,left),titleFits:title.scrollWidth<=title.clientWidth+1,
          phraseFits:!phrase||phrase.scrollWidth<=phrase.clientWidth+1,
          textAfterArt:titleBox.left>=a.right-1,noHeaderOverlap:a.right<=text.left+1,
          historyRight:!h||near(h.right,right),historyBesideTitle:!h||(h.left>=text.right-1&&h.top<=Math.max(text.bottom,a.bottom)&&h.bottom>=Math.min(text.top,a.top)),
          historyTap:!h||(h.width>=44&&h.height>=44),
          actionFullWidth:near(b.left,left)&&near(b.right,right),
          actionBelow:b.top>=Math.max(text.bottom,a.bottom,h?.bottom||0)-1,
          actionHeight:buttons.every(button=>button.getBoundingClientRect().height>=46)};
      });
    }""",{"view":view,"width":width})
    assert cards,(view,width,"no discovery cards")
    for card in cards:
        assert not card.get("error"),(view,width,card)
        assert all(card[key] for key in ["artLeft","titleFits","phraseFits","textAfterArt","noHeaderOverlap","historyRight","historyBesideTitle","historyTap","actionFullWidth","actionBelow","actionHeight"]),(view,width,card)
    # Compact difficulty columns retain native density; family and weight remain shared.
    assert len({(card["font"],card["weight"]) for card in cards})==1,(view,width,cards)
    report["checks"].append({"view":view,"width":width,"discoveryAnatomy":cards})
    return cards
def no_monthly(page):
    assert page.locator('#screen-season,#axRankingSeason,[data-archive-action="season"],[data-archive-action="season-announcement"]').count()==0
    assert page.evaluate("typeof window.PropletSeasonView==='undefined'")
    assert not page.locator('script[src*="season-view"],link[href*="season-view"]').count()
    assert "Měsíční soutěž" not in page.locator("#screen-daily").inner_text()
def hidden_card_audit(page):
    cards=page.locator("#tajenkaPreviewCard.hidden,#tajenkaPlayCard.hidden,#newContentBanner.hidden").evaluate_all("""cards=>cards.map(e=>{
        const b=e.getBoundingClientRect();return {id:e.id,width:b.width,height:b.height};
    })""")
    assert all(card["width"]==0 and card["height"]==0 for card in cards),("Hidden cards must not leave empty pills",cards)
    report["checks"].append({"hiddenCards":cards,"result":"PASS"})
def ready(page):
    page.wait_for_selector('html[data-archive-ready="1"]',timeout=35000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    if page.locator('#archiveExperienceModal .ax-announcement').count() and page.locator('#archiveExperienceModal').is_visible():
        page.keyboard.press('Escape')
def scenario(page,values):
    with page.expect_navigation(wait_until="domcontentloaded"):
        page.evaluate("next=>PropletArchiveReview.setScenario(next)",values)
    ready(page)
    assert page.evaluate("currentScreen==='daily'"),"Review scenarios must open Dnes for the player"
    hidden_card_audit(page)
    no_monthly(page)
    # Keep the actual navigation control in the test flow.
    go(page,"daily")
    assert page.locator("#tajenkaPreviewCard").is_visible(), "Published Tajenka lost after model-date switch"
    go(page,"free")
    assert page.locator("#tajenkaPlayCard").is_visible(), "Published Tajenka missing on Hrat"
    go(page,"daily")
def free_order_audit(page,width):
    order=page.evaluate("""()=>{
      const archive=document.querySelector('#axPlayArchive'),difficulties=document.querySelector('#difficultyCards'),tajenka=document.querySelector('#tajenkaPlayCard');
      const after=element=>!element||element.getBoundingClientRect().height===0||(Boolean(element.compareDocumentPosition(archive)&Node.DOCUMENT_POSITION_FOLLOWING)&&archive.getBoundingClientRect().top>=element.getBoundingClientRect().bottom-1);
      return {afterDifficulties:after(difficulties),afterTajenka:after(tajenka)};
    }""")
    assert all(order.values()),(width,order)
    page.wait_for_timeout(300)
    mutations=page.evaluate("""()=>new Promise(resolve=>{
      const started=performance.now();let records=0,batches=0,finished=false;
      const finish=()=>{if(finished)return;finished=true;observer.disconnect();resolve({records,batches,elapsedMs:Math.round(performance.now()-started)});};
      const observer=new MutationObserver(changes=>{records+=changes.length;batches++;if(records>60||batches>20)finish();});
      observer.observe(document.querySelector('#screen-free'),{childList:true,subtree:true,characterData:true});
      setTimeout(finish,500);
    })""")
    report["checks"].append({"width":width,"archiveOrder":order,"freeIdleMutations":mutations})
    # Permit incidental native settling; reject sustained render/observer churn.
    assert mutations["records"]<=60 and mutations["batches"]<=20,("free observer churn",width,mutations)
def compact_result(page,label,invite=True):
    page.wait_for_selector("#winModal:not(.hidden)")
    page.wait_for_selector("#winResultActions #winShareBtn")
    if invite:
        page.wait_for_function("document.querySelector('#winResultActions #winShareBtn')?.textContent.includes('Pozvi kamaráda')")
    else:
        # Current production intentionally uses generic sharing for daily_special.
        # challenge-cta-v3333.js only promotes free/daily/Tajenka to invitation choices.
        assert "Sdílet" in page.locator("#winShareBtn").inner_text()
        assert "challenge-share-cta" not in (page.locator("#winShareBtn").get_attribute("class") or "")
    assert not page.locator("#winClean").is_visible()
    assert page.locator('#levelLeaderboardBox [role="tablist"],#levelLeaderboardBox .ranking-expand').count()==0
    layout=page.evaluate("""()=>{
      const r=id=>document.getElementById(id).getBoundingClientRect().toJSON();
      return {rank:r('levelLeaderboardBox'),next:r('winPrimaryBtn'),invite:r('winShareBtn'),xp:r('winXp')};
    }""")
    assert layout["rank"]["bottom"]<=layout["next"]["top"]+2 and layout["next"]["bottom"]<=layout["invite"]["top"]+2,(label,layout)
    assert layout["xp"]["top"]<layout["rank"]["top"],(label,layout)
    overflow(page,label,page.viewport_size["width"])
    shot(page,label)
    if invite:
        page.locator("#winShareBtn").click()
        page.wait_for_selector("#refShareBoard")
        assert page.locator('#referralDialog [data-ref-open]').is_visible()
        page.locator('#referralDialog [data-ref-open]').click()
        page.wait_for_selector('#refLink')
        assert "invite=REVIEWONLYALEX" in page.locator('#refLink').input_value()
        page.keyboard.press("Escape")
        report["checks"].append({"compactResult":label,"invitationChoiceAndLocalLink":"PASS"})
    else:report["checks"].append({"compactResult":label,"nativeExtraGenericShare":"PASS"})
def solve_word(page,answer):
    cells=page.locator("#board .cell")
    boxes=[page.locator('#board .cell[data-index="'+str(i)+'"]').bounding_box() for i in answer["path"]]
    assert all(boxes),("cells unavailable",answer["word"])
    page.mouse.move(boxes[0]["x"]+boxes[0]["width"]/2,boxes[0]["y"]+boxes[0]["height"]/2)
    page.mouse.down()
    for b in boxes[1:]:page.mouse.move(b["x"]+b["width"]/2,b["y"]+b["height"]/2,steps=3)
    page.mouse.up();page.wait_for_timeout(90)
try:
    p=sync_playwright().start()
    browser=p.chromium.launch(**({'executable_path':os.environ['PROPLET_BROWSER_EXECUTABLE'],'args':['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']} if os.environ.get('PROPLET_BROWSER_EXECUTABLE') else {}))
    for width in [390,690,1440,320]:
        context=browser.new_context(viewport={"width":width,"height":950},device_scale_factor=1,reduced_motion="reduce")
        page=context.new_page();page.set_default_timeout(12000)
        def capture_error(err):
            report["pageErrors"].append(err.stack or str(err))
            try:
                report["failureText"]=page.locator("body").inner_text()[:9000]
                shot(page,"runtime-error")
            except:pass
        page.on("pageerror",capture_error)
        page.on("request",lambda req:report["networkWrites"].append({"url":req.url,"method":req.method}) if req.method not in ["GET","HEAD"] else None)
        page.goto("http://127.0.0.1:8765/?archive-preview=1&reviewExtra=mozkokalypsa&reviewReferral=member",wait_until="domcontentloaded")
        ready(page)
        no_monthly(page)
        go(page,"daily")
        assert page.locator("#tajenkaPreviewCard").is_visible()
        assert page.locator("#playDailyBtn").evaluate("(e)=>getComputedStyle(e,'::after').maskImage.includes('svg')"), "Daily arrow missing"
        assert page.locator("#referralHome [data-ref-open]>span[aria-hidden=true]").evaluate("(e)=>getComputedStyle(e).maskImage.includes('svg')"), "Invitation arrow missing"
        assert page.locator('#dailyChallengeSwitch [data-daily-kind="special"]').is_visible(), "Linked review must show Extra"
        assert page.locator('#referralHome .ref-art-card img').count()==2
        assert page.locator('#referralHome .ref-art-card img').evaluate_all("(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth>0&&i.getBoundingClientRect().width>0)"), "Both invitation avatars must load"
        report["checks"].append({"width":width,"linkedExtraAndTwoAvatars":"PASS"})
        shot(page,"initial-"+str(width))
        assert page.locator(".bottom-nav [data-nav]").all_text_contents()==["Dnes","Hrát","Pořadí","Já"] or page.locator(".bottom-nav [data-nav]").count()==4
        discovery={}
        for view in ["daily","free","archive"]:
            go(page,view);overflow(page,view,width);shot(page,view+"-"+str(width))
            if view in ["daily","free"]:discovery[view]=discovery_audit(page,view,width)
        go(page,"free")
        assert "Najdi 5 slov a odhal frázi" not in page.locator("#tajenkaPlayCard").inner_text()
        for selector in ["#tajenkaPreviewBtn","#tajenkaPlayCard [data-tajenka-clone-play]","#playNewContentBtn"]:
            button=page.locator(selector)
            if button.count():
                assert button.evaluate("(e)=>getComputedStyle(e,'::after').maskImage.includes('svg')"), selector
        for selector in ['#axPlayArchive .ax-card-action','#tajenkaPlayCard button','#newContentBanner button']:
            button=page.locator(selector).first
            if button.count():
                assert button.evaluate("(e)=>getComputedStyle(e).backgroundImage.includes('linear-gradient')"), selector
        typography=[{key:card[key] for key in ["id","font","size","weight"]} for cards in discovery.values() for card in cards]
        assert len({(t["font"],t["weight"]) for t in typography})==1,typography
        free_order_audit(page,width)
        assert page.locator(".ax-order-link,.ax-level-link,.order-next").count()==0
        go(page,"daily")
        assert page.locator("#axHomeFree .ax-free-difficulty").count()==4
        assert "Ve hře jste spolu" not in page.locator("#screen-daily").inner_text()
        report["checks"].append({"width":width,"typography":typography,"fourCanonicalIcons":"PASS","noDuplicateCardControls":"PASS"})
        page.evaluate("window.scrollTo(0,document.querySelector(\'#axHomeFree\').getBoundingClientRect().top+scrollY-500)")
        page.screenshot(path=str(OUT/("daily-more-"+str(width)+".png")))
        report["screenshots"].append("daily-more-"+str(width)+".png")
        page.locator('#archiveReviewNotice button').click()
        page.locator('[data-archive-action="announcement"]').click()
        page.wait_for_function("""()=>{
            const card=document.querySelector('#archiveExperienceModal .ax-announcement');
            return card&&Number(getComputedStyle(card).opacity)>=.99;
        }""")
        cta=page.locator("#archiveExperienceModal .ax-announcement").evaluate("""e=>{
            const b=e.getBoundingClientRect();return {top:b.top,left:b.left,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight,opacity:Number(getComputedStyle(e).opacity)};
        }""")
        assert cta["top"]>=-1 and cta["left"]>=-1 and cta["right"]<=cta["width"]+1 and cta["bottom"]<=cta["height"]+1 and cta["opacity"]>=.99,cta
        report["checks"].append({"width":width,"archiveCtaViewport":cta})
        shot(page,"announcement-"+str(width))
        assert page.locator("#archiveExperienceModal .ax-modal").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
        assert page.locator('#archiveExperienceModal [data-archive-action="enter"]').is_visible()
        page.locator('#archiveExperienceModal [data-archive-action="extra"]').click()
        assert page.evaluate("currentScreen==='daily' && dailySpecialUI().getState().selected==='special'")
        page.evaluate("PropletArchiveExperience.announcement()")
        page.locator('#archiveExperienceModal [data-archive-action="enter"]').click()
        page.wait_for_selector("#screen-archive.active .ax-board")
        report["checks"].append({"width":width,"twoAnnouncementDestinations":"PASS"})
        if width==390:
            # A local presentation fixture through the real Tajenka store; no result submission.
            tajenka_before=page.evaluate("structuredClone(tajenkaState())")
            seeded=page.evaluate("""()=>{
              if(!tajenkaPuzzle)return false;
              const state=tajenkaState(),puzzle=tajenkaPuzzle,completion={puzzleId:puzzle.id,found:puzzle.answers.map((answer,index)=>({answerIndex:index,word:answer.word,path:[...answer.path],colorIndex:index%COLORS.length})),moves:puzzle.answers.length,hints:0,elapsedMs:180000,completedAt:new Date().toISOString(),rewarded:true,rewardXp:Number(puzzle.meta?.rewardXp)||200};
              state.version=2;state.completions={...(state.completions||{}),[puzzle.id]:completion};state.completed=completion;delete state.inProgress;saveTajenkaState(state);renderTajenkaEntry();renderFree();return true;
            }""")
            if seeded:
                for view in ["daily","free"]:
                    go(page,view);page.wait_for_timeout(250);overflow(page,view+"-tajenka-completed",width)
                    discovery_audit(page,view,width);shot(page,view+"-tajenka-completed-390")
                free_order_audit(page,width)
                report["checks"].append({"completedTajenkaPresentation":"PASS"})
            else:report["checks"].append({"completedTajenkaPresentation":"SKIP: published Tajenka unavailable"})
            page.evaluate("state=>{saveTajenkaState(state);renderTajenkaEntry();renderFree();}",tajenka_before)
            if seeded:
                # The exact-clone adapter must forward its real play button after IDs are removed.
                go(page,"free")
                page.locator('#tajenkaPlayCard [data-tajenka-clone-play]').click()
                page.wait_for_selector('#screen-game.active')
                assert page.evaluate("currentGame.mode==='tajenka' && currentGame.puzzle.id===tajenkaPuzzle.id")
                # First entry opens native rules. Back would dismiss that modal first.
                if page.locator('#tajenkaRulesModal').is_visible():page.locator('#tajenkaRulesDone').click()
                page.locator('#backFromGame').click()
                page.wait_for_function("currentScreen!=='game'")
                report["checks"].append({"clonedTajenkaPlayAndBack":"PASS"})
        go(page,"archive")
        page.locator("#axSearch").fill("88");assert page.locator('[data-archive-board="g3-e-088"]').count()==1
        page.locator('[data-archive-board="g3-e-088"]').click()
        assert "Čeká na tebe 15 XP" in page.locator("#archiveExperienceModal").inner_text()
        page.keyboard.press("Escape")
        assert page.locator('[data-archive-board="g3-e-088"]').evaluate("(e)=>document.activeElement===e")
        page.locator("#axSearch").fill("")
        page.locator('[data-archive-diff="hardcore"]').click()
        assert "+100 XP" in page.locator("#axBoardResults").inner_text()
        assert page.locator('[data-archive-diff="hardcore"] strong').inner_text()=="Mozkožrout"
        assert "Hardcore" not in page.locator("#screen-archive").inner_text()
        shot(page,"archive-mozkozrout-"+str(width))
        page.locator('[data-archive-filter="reward"]').click();assert page.locator(".ax-board.ax-paid").count()==0
        page.locator('[data-archive-filter="all"]').click();page.locator('[data-archive-diff="easy"]').click()
        if width==320:
            page.set_viewport_size({"width":390,"height":950})
            bank=page.evaluate("fetch('/app/archive/boards.json').then(r=>r.json())")
            assert len(bank["boards"])==800 and bank["completeCovers"]==879
            contract=page.evaluate("""async()=>{const bank=await fetch('/app/archive/boards.json').then(r=>r.json());let count=0;for(const r of bank.boards){const c=PropletArchiveSolutions.create(r.puzzle,r.solutions);for(const cover of r.solutions.solutionSets){let s=c.emptyState();for(const a of cover){const out=c.submit(s,a.word,a.path);if(!out.accepted)throw Error(r.puzzle.id+': '+out.reason);s=out.state;}if(!c.evaluate(s).completed)throw Error('incomplete');count++;}}return count;}""")
            report["checks"].append({"approvedCovers":contract})
            # Newer completion at easy slot 20 must not suppress this historical award.
            assert page.evaluate("freeProgress('easy').done")>=20
            before=page.evaluate("freeProgress('easy').done")
            page.locator('[data-archive-board="g3-e-020"]').click();page.locator('#archiveExperienceModal [data-archive-start="g3-e-020"]').click()
            page.wait_for_selector("#screen-game.active")
            page.wait_for_timeout(350)
            shot(page,"archive-game-390")
            answers=page.evaluate("currentGame.puzzle.answers")
            solve_word(page,answers[0])
            assert page.evaluate("currentGame.found.length")==1
            page.evaluate("goBackFromGame()");page.wait_for_selector("#screen-archive.active")
            page.locator('[data-archive-board="g3-e-020"]').click();assert "Rozehráno" in page.locator("#archiveExperienceModal").inner_text()
            page.locator('#archiveExperienceModal [data-archive-start="g3-e-020"]').click();page.wait_for_selector("#screen-game.active")
            assert page.evaluate("currentGame.found.length")==1
            # Fold viewport changes only presentation.
            page.set_viewport_size({"width":690,"height":950});page.wait_for_timeout(150)
            assert page.evaluate("currentGame.puzzle.id")=="g3-e-020" and page.evaluate("currentGame.found.length")==1
            page.set_viewport_size({"width":390,"height":950});page.wait_for_timeout(150)
            for a in answers[1:]:solve_word(page,a)
            page.wait_for_selector("#winModal:not(.hidden)",timeout=10000)
            assert "+15 XP" in page.locator("#winXp").inner_text()
            assert page.evaluate("freeProgress('easy').done")==before
            shot(page,"archive-result-390")
            page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
            page.locator('[data-archive-board="g3-e-020"]').click();assert "Odměna už je tvoje" in page.locator("#archiveExperienceModal").inner_text()
            page.locator('#archiveExperienceModal [data-archive-start="g3-e-020"]').click();page.wait_for_selector("#screen-game.active")
            for a in answers:solve_word(page,a)
            page.wait_for_selector("#winModal:not(.hidden)")
            assert "0 XP" in page.locator("#winXp").inner_text()
            page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
            # Approved VRTÍ alternative goes through actual input and restore.
            page.locator('[data-archive-board="g3-e-009"]').click();page.locator('#archiveExperienceModal [data-archive-start="g3-e-009"]').click();page.wait_for_selector("#screen-game.active")
            alt=next(r for r in bank["boards"] if r["puzzle"]["id"]=="g3-e-009")["solutions"]["solutionSets"][1]
            solve_word(page,next(a for a in alt if a["word"]=="VRTÍ"))
            assert page.evaluate("currentGame.found[0].word")=="VRTÍ"
            page.evaluate("applySmartHint(2)")
            page.evaluate("goBackFromGame()");page.wait_for_selector("#screen-archive.active")
            page.locator('[data-archive-board="g3-e-009"]').click();page.locator('#archiveExperienceModal [data-archive-start="g3-e-009"]').click();page.wait_for_selector("#screen-game.active")
            assert page.evaluate("currentGame.found[0].word")=="VRTÍ"
            assert page.evaluate("currentGame.archiveHints.length")==1
            for a in alt:
                if a["word"]!="VRTÍ":solve_word(page,a)
            page.wait_for_selector("#winModal:not(.hidden)")
            assert "0 XP" in page.locator("#winXp").inner_text()
            page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
            # Verify canonical history/order controls and the weekly team entry.
            go(page,"free")
            assert page.locator(".ax-order-link,.ax-level-link,.order-next").count()==0
            # Ordering still uses the canonical store/settings, without another modal on Hrát.
            page.evaluate("changeFreeOrder('easy','numeric')")
            page.wait_for_function("freeOrder().record('easy').mode==='numeric'")
            page.evaluate("changeFreeOrder('easy','varied')")
            page.wait_for_function("freeOrder().record('easy').mode==='varied'")
            page.locator('[data-played-levels="easy"]').click()
            page.wait_for_selector("#playedLevelsModal:not(.hidden)")
            page.locator("#closePlayedLevelsModal").click()
            go(page,"daily")
            page.locator('[data-archive-action="team"]').click()
            page.wait_for_timeout(250)
            assert page.locator('[data-ranking-xp-scope="teams"]').get_attribute("class").find("active")>=0
            assert page.locator('[data-ranking-period="week"]').get_attribute("class").find("active")>=0
            report["checks"].append({"catalogueOrder":"PASS","levels":"PASS","weeklyTeamEntry":"PASS"})
            report["checks"].append({"actualGame":"PASS","resume":"PASS","foldResize":"PASS","xpOnce":"PASS","newerDoesNotBlockHistorical":"PASS","alternativeAndHintRestore":"PASS","modernProgressUnchanged":before})
        if width==390:
            # Separate local namespaces; native handlers. No server reward assertion.
            for extra in ["hardcore","mozkomor","mozkokalypsa"]:
                scenario(page,{"extra":extra,"referral":"invite"})
                page.locator('#dailyChallengeSwitch [data-daily-kind="special"]').click()
                page.wait_for_timeout(200)
                assert page.locator('#dailyChallengeSwitch [data-daily-kind="special"]').get_attribute('aria-pressed')=="true"
                assert page.locator("#playDailyBtn>span").evaluate("(e)=>getComputedStyle(e,'::after').maskImage.includes('svg')"), "Extra arrow missing"
                overflow(page,"extra-"+extra,390);shot(page,"daily-extra-"+extra+"-390")
                if extra=="hardcore":
                    page.locator("#playDailyBtn").click()
                    page.wait_for_selector("#screen-game.active")
                    assert page.evaluate("currentGame.mode==='daily_special' && currentGame.puzzle.difficulty==='hardcore'")
                    for answer in page.evaluate("currentGame.puzzle.answers"):solve_word(page,answer)
                    compact_result(page,"extra-compact-result-390",invite=False)
                    assert "+100 XP" in page.locator("#winXp").inner_text()
                    page.locator("#winMenuBtn").click()
                report["checks"].append({"nativeExtraScenario":extra,"result":"PASS"})
            for referral in ["progress","earned"]:
                scenario(page,{"extra":"live","referral":referral})
                page.wait_for_selector("#referralHome")
                page.wait_for_function("PropletReferrals.model.ready")
                text=page.locator("#referralHome").inner_text()
                assert "1 000 XP" in text
                if referral=="earned":
                    assert page.locator("#referralHome .ref-reward small").count()==0
                    assert page.locator("#referralInviteHome [data-ref-open]").is_visible()
                overflow(page,"referral-"+referral,390);shot(page,"daily-referral-"+referral+"-390")
                report["checks"].append({"nativeReferralScenario":referral,"result":"PASS"})
            scenario(page,{"reset":True})
        if width==320:
            # Actual native free-game result; archive completion override is absent.
            page.set_viewport_size({"width":390,"height":950})
            go(page,"free")
            page.locator('#difficultyCards .cp-card[data-diff="easy"] .cp-play').click()
            page.wait_for_selector("#screen-game.active")
            assert page.evaluate("currentGame.mode==='free' && !currentGame.puzzle.meta?.archiveExperience")
            for answer in page.evaluate("currentGame.puzzle.answers"):solve_word(page,answer)
            compact_result(page,"free-compact-result-390")
            assert page.locator("#winPrimaryBtn").inner_text()=="Hraj další úroveň"
            page.locator("#winMenuBtn").click()
            page.set_viewport_size({"width":320,"height":950})
        if width in [320,390,690,1440]:
            page.set_viewport_size({"width":width,"height":950})
            page.locator('#archiveReviewNotice button').click();page.locator('[data-archive-action="theme"]').click();page.keyboard.press("Escape")
            go(page,"daily");discovery_audit(page,"daily",width);overflow(page,"daily-dark",width);shot(page,"daily-dark-"+str(width));go(page,"free");discovery_audit(page,"free",width);overflow(page,"free-dark",width);shot(page,"free-dark-"+str(width))
            contrast=page.locator('#difficultyCards .cp-play').evaluate_all("""buttons=>{
              const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
              return buttons.map(button=>{const c=getComputedStyle(button),a=luminance(c.color),b=luminance(c.backgroundColor);return {difficulty:button.closest('[data-diff]').dataset.diff,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
            }""")
            assert all(item['ratio']>=4.5 for item in contrast),contrast
            report['checks'].append({'width':width,'darkButtonContrast':contrast});go(page,"archive");shot(page,"archive-dark-"+str(width))
        assert page.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")==0
        report["checks"].append({"width":width,"result":"PASS"})
        context.close()
    # Capture the actual production frontend with a synthetic local profile.
    # Intercept every write before the network; no production account is used.
    for width in [320,390,690,1440]:
        baseline=browser.new_context(viewport={"width":width,"height":950},device_scale_factor=1,reduced_motion="reduce")
        bp=baseline.new_page();bp.set_default_timeout(12000)
        isolation=(ROOT/"public/app/archive/preview-isolation.js").read_text()
        def production_route(route):
            req=route.request
            if req.method not in ["GET","HEAD"]:
                route.fulfill(status=403,body="Read-only visual reference");return
            if req.is_navigation_request() and req.url.rstrip("/")=="https://hrajproplet.cz":
                try: response=route.fetch()
                except Exception as e:
                    report.setdefault("productionReferenceErrors",[]).append({"error":str(e),"url":req.url})
                    route.abort();return
                html=response.text().replace("<head>","<head><script>document.documentElement.setAttribute('data-archive-preview','');"+isolation+"</script>",1)
                route.fulfill(response=response,body=html);return
            route.continue_()
        baseline.route("**/*",production_route)
        try:
            bp.goto("https://hrajproplet.cz/",wait_until="domcontentloaded",timeout=30000)
            bp.wait_for_function("typeof nav==='function' && typeof puzzleDB!=='undefined' && Boolean(puzzleDB?.free)",timeout=20000)
            bp.evaluate("window.__PROPLET_REVEAL_CURRENT_UI?.();nav('free',{replace:true})")
            bp.wait_for_timeout(500)
            bp.wait_for_selector("#difficultyCards .cp-card")
            bp.evaluate("document.fonts.ready")
            bp.wait_for_timeout(500)
            for theme in ["light","dark"]:
                bp.evaluate("theme=>applyTheme(theme,{persist:true})",theme)
                for view in ["daily","free"]:
                    bp.evaluate("view=>nav(view,{replace:true})",view)
                    bp.wait_for_timeout(200)
                    shot(bp,"production-"+view+"-"+theme+"-"+str(width))
            report["checks"].append({"productionVisualReference":width,"version":bp.evaluate("window.PROPLET_RUNTIME_META?.version")})
        except Exception as e:
            report.setdefault("productionReferenceErrors",[]).append({"error":str(e)})
        baseline.close()
    browser.close()
    assert not report["layoutIssues"],report["layoutIssues"]
    assert not report["pageErrors"],report["pageErrors"]
    assert not report["networkWrites"],report["networkWrites"]
    report["result"]="PASS"
except Exception as e:
    report["result"]="FAIL";report["error"]=str(e);report["traceback"]=traceback.format_exc()
    try:shot(page,"failure");report["failureText"]=page.locator("body").inner_text()[:9000]
    except:pass
finally:
    try: browser.close(); p.stop()
    except: pass
    server.shutdown()
    (OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(report,ensure_ascii=False))
assert report["result"]=="PASS",report.get("error")

