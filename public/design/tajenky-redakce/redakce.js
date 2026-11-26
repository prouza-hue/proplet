(() => {
  'use strict';

  const apiPath = '/api/editorial/tajenka';
  const statusNames = {pending:'Ke kontrole', approved:'Schváleno', revise:'Přepracovat'};
  const categoryNames = {observation:'Postřeh', fact:'Zajímavost', czech:'Česká zajímavost', proverb:'Přísloví', quote:'Citát'};
  const groups = {new:'Nové', existing:'Předchozí', all:'Vše'};
  const limits = {phrase:240, comment:4000, clue:320, clueComment:2000};
  const $ = id => document.getElementById(id);
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const action = (cls, label, callback) => {
    const el = node('button', cls, label);
    el.type = 'button';
    el.addEventListener('click', callback);
    return el;
  };
  const format = options => new Intl.DateTimeFormat('cs-CZ',{...options,timeZone:'Europe/Prague'});
  const dayFormat = format({day:'numeric',month:'long',year:'numeric',weekday:'long'});
  const monthFormat = format({month:'long',year:'numeric'});
  const weekdayFormat = format({weekday:'short'});
  const submittedFormat = format({day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  const asDate = iso => new Date(iso+'T12:00:00Z');
  const capitalize = text => text.charAt(0).toLocaleUpperCase('cs-CZ')+text.slice(1);
  const cleanSearch = text => String(text || '').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('cs-CZ');
  const category = value => categoryNames[value] || value || 'Jiný styl';

  let token = '', prefix = '', durable = true, connected = false, locked = false;
  let loading = null, sending = null, submitting = false, revision = null, submission = null;
  let debounce = null, retryTimer = null, retryDelay = 5000;
  let editions = [], byId = new Map(), selected = null, group = 'new', displayed = [];
  let submitMessage = '', firstOnlineSet = true;
  const records = new Map(), drafts = new Map(), rowErrors = new Map();
  const blank = () => ({version:0,fields:{}});
  const record = id => records.get(id) || blank();
  const listDraft = id => drafts.get(id) || new Map();
  const mobile = window.matchMedia('(max-width:720px)');

  function getAccess() {
    const params = new URLSearchParams(location.hash.slice(1));
    const key = params.get('k');
    if (key != null) {
      params.delete('k');
      history.replaceState(history.state,'',location.pathname+location.search+(params.size?'#'+params:''));
      try { sessionStorage.setItem('proplet:tajenky-redakce:access',key); } catch {}
      return key;
    }
    try { return sessionStorage.getItem('proplet:tajenky-redakce:access') || ''; } catch { return ''; }
  }
  async function localNamespace() {
    if (!window.crypto?.subtle) { durable=false; return; }
    const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    prefix = 'proplet:tajenky-redakce:v1:'+Array.from(new Uint8Array(hash).slice(0,16),b=>b.toString(16).padStart(2,'0')).join('')+':';
  }
  function read(key) {
    if (!prefix) return null;
    try { return JSON.parse(localStorage.getItem(prefix+key)); }
    catch { return null; }
  }
  function write(key, value) {
    if (!prefix) return;
    try {
      if (value == null) localStorage.removeItem(prefix+key);
      else localStorage.setItem(prefix+key,JSON.stringify(value));
    } catch { durable=false; }
  }
  function draftKey(id,key) { return 'draft/'+encodeURIComponent(id)+'/'+encodeURIComponent(key); }
  function draftEntry(id,key,entry,store=true) {
    let map = drafts.get(id);
    if (entry) {
      if (!map) { map=new Map(); drafts.set(id,map); }
      map.set(key,entry);
    } else if (map) {
      map.delete(key);
      if (!map.size) drafts.delete(id);
    }
    if (store) write(draftKey(id,key),entry);
  }
  function loadLocal() {
    if (!prefix) return;
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(prefix+'draft/')) continue;
        const [,id,field] = key.slice(prefix.length).split('/').map(decodeURIComponent);
        const entry = read(draftKey(id,field));
        if (typeof entry?.value==='string' && typeof entry?.base==='string') draftEntry(id,field,entry,false);
      }
    } catch { durable=false; }
    const cached=read('set');
    if (cached?.editions) installSet(cached.editions);
    for (const e of editions) {
      const row = read('record/'+e.id);
      if (row && Number.isInteger(row.version)) records.set(e.id,row);
    }
    const head=read('head');
    if (head) setHead(head,false);
  }
  function setHead(result,persist=true) {
    if (!Number.isInteger(result?.revision) || (Number.isInteger(revision)&&result.revision<revision)) return;
    revision=result.revision;
    submission=result.submission || null;
    if(persist) write('head',{revision,submission});
  }
  function installSet(rows) {
    const valid = rows.filter(e=>typeof e?.id==='string' && /^\d{4}-\d\d-\d\d$/.test(e.date) && typeof e.phrase==='string' && Array.isArray(e.answers) && e.answers.every(a=>typeof a.word==='string'&&typeof a.clue==='string'));
    if (!valid.length || valid.length!==rows.length || new Set(valid.map(e=>e.id)).size!==valid.length) throw Error('set');
    editions=valid.slice().sort((a,b)=>a.date.localeCompare(b.date));
    byId=new Map(editions.map(e=>[e.id,e]));
    if (!byId.has(selected)) selected=editions.find(e=>e.group===group)?.id || editions[0].id;
  }
  function keyParts(key) {
    const ix=key.indexOf(':');
    return ix<0?[key,'']:[key.slice(0,ix),key.slice(ix+1)];
  }
  function valueFrom(e,fields,key) {
    const [kind,word]=keyParts(key);
    if(kind==='phrase') return fields.phrase ?? e.phrase;
    if(kind==='status') return fields.status || 'pending';
    if(kind==='comment') return fields.comment || '';
    if(kind==='clue') return fields.clues?.[word] ?? e.answers.find(a=>a.word===word)?.clue ?? '';
    return fields.clueComments?.[word] || '';
  }
  function serverValue(e,key) { return valueFrom(e,record(e.id).fields,key); }
  function value(e,key) { return listDraft(e.id).get(key)?.value ?? serverValue(e,key); }
  function isConflict(e,key,entry) {
    const current=serverValue(e,key);
    return current!==entry.base && current!==entry.value;
  }
  function conflicts(e) { return [...listDraft(e.id)].filter(([k,v])=>isConflict(e,k,v)); }
  function setField(e,fields,key,v) {
    const [kind,word]=keyParts(key);
    const base=valueFrom(e,{},key);
    if (kind==='clue'||kind==='clueComment') {
      const map=kind==='clue'?'clues':'clueComments';
      fields[map]={...fields[map]};
      if(v===base) delete fields[map][word]; else fields[map][word]=v;
      if(!Object.keys(fields[map]).length) delete fields[map];
    } else if(v===base) delete fields[kind];
    else fields[kind]=v;
  }
  function editedFields(e) {
    const fields={...record(e.id).fields};
    for(const [key,entry] of listDraft(e.id)) setField(e,fields,key,entry.value);
    return fields;
  }
  function applyRecord(id,row,sent) {
    const e=byId.get(id);
    if(!e || !Number.isInteger(row?.version) || !row.fields || row.version<record(id).version) return;
    const normalized={version:row.version,fields:row.fields};
    records.set(id,normalized); write('record/'+id,normalized);
    for(const [key,entry] of listDraft(id)) {
      const latest=serverValue(e,key);
      if(latest===entry.value) draftEntry(id,key,null);
      else if(sent?.get(key)?.value===latest && entry.base===sent.get(key).base) draftEntry(id,key,{base:latest,value:entry.value});
    }
  }
  function edit(e,key,text) {
    const previous=listDraft(e.id).get(key),remote=serverValue(e,key);
    draftEntry(e.id,key,text===remote?null:{base:previous?.base??remote,value:text});
    rowErrors.delete(e.id); submitMessage='';
    paintIndex(); paintStatus(); paintConflicts(e); paintOriginal(e);
    schedule();
  }
  function apiError(status) { const error=Error('request');error.status=status;return error; }
  async function api(suffix='',method='GET',data) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(apiPath+suffix,{
        method,cache:'no-store',mode:'same-origin',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',
        headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
        body:data?JSON.stringify(data):undefined,signal:controller.signal
      });
      if(response.status===409) return {conflict:true,data:await response.json()};
      if(!response.ok) throw apiError(response.status);
      return {data:await response.json()};
    } finally { clearTimeout(timer); }
  }
  function notice(message='',again=false) {
    $('noticeText').textContent=message;$('notice').hidden=!message;$('retry').hidden=!again;
  }
  function lockAccess() {
    locked=true;connected=false;clearTimeout(retryTimer);
    $('workspace').hidden=true;$('delivery').hidden=true;$('progress').hidden=true;$('export').disabled=true;
    $('accessForm').hidden=false;
    notice('Redakci můžeš otevřít stejným soukromým odkazem jako minule.');paintStatus();
  }
  function offline() {
    connected=false;
    notice(editions.length?'Spojení se nepodařilo navázat. Úpravy čekají v tomto prohlížeči.':'Sadu se nepodařilo načíst. K prvnímu otevření je potřeba připojení.',true);
    if(navigator.onLine && !retryTimer && !locked) {
      retryTimer=setTimeout(()=>{retryTimer=null;refresh();},retryDelay);
      retryDelay=Math.min(60000,retryDelay*2);
    }
    paintStatus();
  }
  async function refresh() {
    if(locked || loading) return loading;
    clearTimeout(retryTimer); retryTimer=null;
    loading=(async()=>{
      try {
        const [set,reviews]=await Promise.all([api('/set'),api()]);
        const contentChanged=read('set')?.contentRevision!==set.data.contentRevision;
        installSet(set.data.editions);write('set',set.data);
        if(!reviews.data?.reviews || !Number.isInteger(reviews.data.revision)) throw Error('reviews');
        for(const e of editions) applyRecord(e.id,reviews.data.reviews[e.id] || blank());
        setHead(reviews.data); connected=true;retryDelay=5000;notice();
        if(firstOnlineSet && set.data.contentRevision==='2026-12-review-64-r2') {
          const firstPending=editions.find(e=>e.group==='new' && trackedStatus(e)==='pending');
          if(firstPending) { $('stateFilter').value='pending';selected=firstPending.id; }
        }
        firstOnlineSet=false;
        paintAll(contentChanged);schedule(100);
      } catch(error) {
        if(error.status===401||error.status===403) lockAccess();
        else { offline(); if(editions.length) paintAll(false); }
      } finally { loading=null;paintStatus(); }
    })();
    return loading;
  }
  function schedule(delay=950) {
    clearTimeout(debounce);
    if(connected && !locked) debounce=setTimeout(()=>flush(),delay);
  }
  async function flush() {
    if(sending) return sending;
    if(!connected || locked) return false;
    clearTimeout(debounce);
    sending=(async()=>{
      for(const e of editions) {
        for(let tries=0;tries<3;tries++) {
          const changes=new Map(listDraft(e.id));
          if(!changes.size || conflicts(e).length || rowErrors.has(e.id)) break;
          try {
            const row=record(e.id);
            const result=await api('/'+encodeURIComponent(e.id),'PUT',{version:row.version,fields:editedFields(e)});
            applyRecord(e.id,result.data,result.conflict?null:changes);setHead(result.data);
            if(selected===e.id) patchEditor(e);
            paintIndex();
          } catch(error) {
            if(error.status===401||error.status===403) lockAccess();
            else if([400,413,422].includes(error.status)) {
              rowErrors.set(e.id,'Zkontroluj text a délku úprav u vydání '+dayFormat.format(asDate(e.date))+'.');
              notice(rowErrors.get(e.id),true);
            } else offline();
            break;
          }
        }
        if(!connected || locked) break;
      }
    })();
    paintStatus();
    try { await sending; } finally { sending=null;paintStatus(); }
    if(connected && editions.some(e=>listDraft(e.id).size && !conflicts(e).length && !rowErrors.has(e.id))) schedule(400);
    return !drafts.size;
  }
  async function deliver() {
    if(submitting || locked) return;
    submitting=true;submitMessage='';paintStatus();
    try {
      if(!connected) await refresh();
      if(!connected) {submitMessage='Odevzdání potřebuje připojení.';return;}
      await flush();
      if(drafts.size) {
        const troubled=editions.find(e=>conflicts(e).length || rowErrors.has(e.id));
        submitMessage=troubled?'Před odevzdáním vyřeš označenou úpravu.':'Některé změny čekají na uložení. Zkus odevzdat znovu.';
        if(troubled) openEdition(troubled.id);
        return;
      }
      // Another edition can change between two successful writes to this edition.
      // A per-edition PUT only reports its own fields, even when it advances the global revision.
      const latest=(await api()).data;
      if(!latest?.reviews || !Number.isInteger(latest.revision)) throw Error('reviews');
      const elsewhere=editions.some(e=>(latest.reviews[e.id]?.version || 0)!==record(e.id).version);
      for(const e of editions) applyRecord(e.id,latest.reviews[e.id] || blank());
      setHead(latest);paintAll(false);
      if(elsewhere) {
        submitMessage='Mezitím přibyly úpravy. Projdi je a odevzdej sadu znovu.';return;
      }
      if(drafts.size) {submitMessage='Nejdřív se uloží rozepsané změny. Potom můžeš sadu odevzdat.';return;}
      const attempt=await api('/submit','POST',{revision});
      if(attempt.conflict) {
        await refresh();submitMessage='Mezitím přibyly úpravy. Projdi je a odevzdej sadu znovu.';
      } else { setHead(attempt.data);submitMessage=''; }
    } catch(error) {
      if(error.status===401||error.status===403) lockAccess();
      else { offline();submitMessage='Odevzdání se nepodařilo potvrdit. Zkus to po připojení znovu.'; }
    } finally {submitting=false;paintStatus();}
  }

  function trackedStatus(e) { return value(e,'status'); }
  function currentSet() { return editions.filter(e=>group==='all'||e.group===group); }
  function matches(e) {
    const state=$('stateFilter').value,style=$('categoryFilter').value;
    if(state==='conflict' ? !conflicts(e).length : state && state!==trackedStatus(e)) return false;
    if(style && style!==e.category) return false;
    const term=cleanSearch($('search').value.trim());
    if(!term) return true;
    return cleanSearch([
      e.date,dayFormat.format(asDate(e.date)),e.phrase,value(e,'phrase'),value(e,'comment'),e.alternative?.phrase,
      ...e.answers.flatMap(a=>[a.word,value(e,'clue:'+a.word),value(e,'clueComment:'+a.word)])
    ].join(' ')).includes(term);
  }
  function paintGroups() {
    const options=Object.entries(groups).map(([key,title])=>{
      const count=editions.filter(e=>key==='all'||e.group===key).length;
      const btn=action('',title+' · '+count,()=>{
        if(group===key) return;
        group=key;selectThroughFilters();
      });
      btn.setAttribute('aria-pressed',String(group===key));return btn;
    });
    $('groups').replaceChildren(...options);
    const filter=$('categoryFilter'),previous=filter.value;
    const names=[...new Set(editions.map(e=>e.category))].sort((a,b)=>category(a).localeCompare(category(b),'cs'));
    filter.replaceChildren(new Option('Všechny styly',''),...names.map(n=>new Option(category(n),n)));
    if(names.includes(previous)) filter.value=previous;
  }
  function paintIndex() {
    const all=currentSet();
    displayed=all.filter(matches);
    const approved=all.filter(e=>trackedStatus(e)==='approved').length;
    $('progressBar').max=Math.max(1,all.length);$('progressBar').value=approved;
    $('progressText').textContent='Schváleno '+approved+' z '+all.length;
    $('resultCount').textContent=displayed.length===all.length?'':displayed.length+' / '+all.length;
    const fragment=document.createDocumentFragment();
    let lastMonth='';
    for(const e of displayed) {
      const date=asDate(e.date),month=e.date.slice(0,7);
      if(month!==lastMonth) {fragment.append(node('h3','month',monthFormat.format(date)));lastMonth=month;}
      const status=trackedStatus(e),conflict=conflicts(e).length>0;
      const row=action('edition-row','',()=>openEdition(e.id));row.dataset.id=e.id;
      if(e.id===selected) row.setAttribute('aria-current','true');
      const leaf=node('span','date-leaf');
      leaf.setAttribute('aria-hidden','true');
      leaf.append(node('small','',weekdayFormat.format(date)),node('b','',date.getUTCDate()));
      const title=node('span','row-text',value(e,'phrase') || 'Prázdná věta');
      title.append(node('small','',category(e.category)+' · '+(conflict?'Ke sloučení':statusNames[status])));
      const mark=node('span','mark');mark.dataset.status=conflict?'conflict':status;mark.setAttribute('aria-hidden','true');
      row.setAttribute('aria-label',dayFormat.format(date)+'. '+title.textContent);
      row.append(leaf,title,mark);fragment.append(row);
    }
    if(!displayed.length) fragment.append(node('p','empty','Tomuto výběru žádné vydání neodpovídá.'));
    $('editionList').replaceChildren(fragment);
    updateNav();
  }
  function selectThroughFilters() {
    paintGroups();paintIndex();
    if(!displayed.some(e=>e.id===selected)) selected=displayed[0]?.id || null;
    paintIndex();paintEditor();
  }
  function paintStatus() {
    const count=[...drafts.values()].reduce((n,map)=>n+map.size,0);
    const conflicted=editions.some(e=>conflicts(e).length);
    const savedLocally=durable?'Uloženo v zařízení':'Neuložené úpravy';
    const text=locked?'Uzamčeno':!token?'Bez přístupu':conflicted?'Ke sloučení':!connected?(loading?'Připojuji…':count?savedLocally:'Offline'):rowErrors.size?'Chyba uložení':sending?'Ukládám…':count?'Čeká na uložení':'Uloženo';
    const sync=$('sync');
    if(sync.textContent!==text) sync.textContent=text;
    sync.dataset.tone=conflicted||rowErrors.size||locked?'error':connected&&!count&&!sending?'ok':'wait';
    if(!editions.length || locked) return;
    const done=submission && !count && !rowErrors.size;
    let delivered=submitMessage;
    if(!delivered && done) {
      const stamp=new Date(submission.submittedAt);
      delivered=Number.isNaN(stamp.getTime())?'Připomínky jsou odevzdané.':'Odevzdáno '+submittedFormat.format(stamp);
    }
    if(!delivered) delivered=conflicted?'Některé úpravy potřebují sloučit.':'Odevzdat můžeš i část sady.';
    $('deliveryText').textContent=delivered;
    $('submit').textContent=submitting?'Odevzdávám…':done?'Odevzdáno ✓':'Odevzdat připomínky';
    $('submit').disabled=submitting||!!done;
    if(!durable && count && !locked) notice('Tento prohlížeč neuchoval rozepsané změny. Než stránku zavřeš, použij Export JSON.');
  }
  function openEdition(id) {
    if(!byId.has(id)) return;
    selected=id;paintIndex();paintEditor();
    $('workspace').classList.add('editing');
    if(mobile.matches) {
      if(!history.state?.tajenkaEditor) history.pushState({tajenkaEditor:true},'',location.href);
      window.scrollTo(0,0);
      $('editor').focus({preventScroll:true});
    }
  }
  function overview(returnFocus=true) {
    $('workspace').classList.remove('editing');
    if(returnFocus) {
      const target=[...$('editionList').querySelectorAll('[data-id]')].find(el=>el.dataset.id===selected);
      if(target) {target.focus({preventScroll:true});target.scrollIntoView({block:'center'});}
    }
  }
  function goBack() { if(history.state?.tajenkaEditor) history.back(); else overview(); }
  function neighbor(step) {
    const i=displayed.findIndex(e=>e.id===selected);
    const target=displayed[i+step];if(i>=0 && target) openEdition(target.id);
  }
  function updateNav() {
    const pos=displayed.findIndex(e=>e.id===selected);
    const prev=$('prevEdition'),next=$('nextEdition');
    if(prev) prev.disabled=pos<1;
    if(next) next.disabled=pos<0||pos>=displayed.length-1;
  }
  function fieldName(key) {
    const [kind,word]=keyParts(key);
    return kind==='phrase'?'Věta Tajenky':kind==='comment'?'Poznámka k větě':kind==='status'?'Stav vydání':(kind==='clue'?'Vodítko · ':'Poznámka · ')+word;
  }
  function describe(key,v) {return v ? key==='status'?statusNames[v]:v : '(prázdné)';}
  function paintConflicts(e) {
    const box=$('conflicts');if(!box || selected!==e.id) return;
    const pairs=conflicts(e);box.hidden=!pairs.length;
    if(!pairs.length) {box.replaceChildren();return;}
    const parts=[node('h3','','Vyber platnou verzi')];
    for(const [key,entry] of pairs) {
      const section=node('div','conflict-item');
      const server=serverValue(e,key);
      const controls=node('div','conflict-actions');
      controls.append(action('','Ponechat mou',()=>resolve(e,key,true)),action('','Převzít ze serveru',()=>resolve(e,key,false)));
      section.append(node('strong','',fieldName(key)),node('p','','Moje · '+describe(key,entry.value)),node('p','','Na serveru · '+describe(key,server)),controls);
      parts.push(section);
    }
    box.replaceChildren(...parts);
  }
  function resolve(e,key,mine) {
    const entry=listDraft(e.id).get(key);
    draftEntry(e.id,key,mine&&entry?{base:serverValue(e,key),value:entry.value}:null);
    rowErrors.delete(e.id);submitMessage='';
    patchEditor(e);paintIndex();paintStatus();schedule(200);
  }
  function editorInput(e,key,rows=2) {
    const input=node('textarea','');
    input.dataset.field=key;input.rows=rows;input.maxLength=limits[keyParts(key)[0]];input.value=value(e,key);
    input.setAttribute('aria-label',fieldName(key));input.spellcheck=true;
    input.addEventListener('input',()=>edit(e,key,input.value));
    return input;
  }
  function comment(e,key,label) {
    const details=node('details','comment-box'),summary=node('summary','',label);
    const input=editorInput(e,key);
    details.open=!!input.value;details.append(summary,input);return details;
  }
  function sourceLine(source) {
    if(!source) return null;
    const line=node('p','source'),credit=[source.author,source.work].filter(Boolean).join(' · ');
    const label=source.label || credit;
    let href=null;try {const url=new URL(source.url);if(['https:','http:'].includes(url.protocol))href=url.href;} catch {}
    if(!label&&!href) return null;
    line.append('Zdroj · ');
    if(credit && credit!==label) line.append(credit+' · ');
    if(!href) {line.append(label);return line;}
    const link=node('a','',label||new URL(href).hostname);link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';line.append(link);
    return line;
  }
  function paintOriginal(e) {
    const panel=$('original');
    if(panel&&selected===e.id) panel.hidden=value(e,'phrase')===e.phrase;
  }
  function alternative(e) {
    const alt=e.alternative;
    if(!alt?.phrase) return null;
    const panel=node('details','alternative');
    const summary=node('summary','','Původní návrh');
    const text=node('p','alternative-text',alt.phrase);
    const meta=node('p','source',[alt.date?dayFormat.format(asDate(alt.date)):null,category(alt.category)].filter(Boolean).join(' · '));
    panel.append(summary,text,meta);
    const from=sourceLine(alt.source);if(from)panel.append(from);
    const hints=node('dl','alternative-answers');
    for(const answer of alt.answers || []) hints.append(node('dt','',answer.word),node('dd','',answer.clue));
    if(hints.childElementCount) panel.append(hints);
    panel.append(action('small-button','Použít tuto větu',()=>{
      edit(e,'phrase',alt.phrase);patchEditor(e);panel.open=false;
      $('phrase')?.focus();
    }));
    return panel;
  }
  function patchEditor(e) {
    if(selected!==e.id || !$('sheet')) return;
    for(const input of $('sheet').querySelectorAll('textarea[data-field]')) {
      const next=value(e,input.dataset.field);
      if(input.value!==next) {
        input.value=next;
        if(input.closest('.comment-box') && next) input.closest('details').open=true;
      }
    }
    for(const btn of $('sheet').querySelectorAll('[data-status]')) btn.setAttribute('aria-pressed',String(btn.dataset.status===trackedStatus(e)));
    paintConflicts(e);paintOriginal(e);
  }
  function paintEditor() {
    const target=$('editor'),e=byId.get(selected);
    target.replaceChildren();target.dataset.edition=selected || '';
    if(!e) {target.append(node('p','empty','Vyber vydání z přehledu.'));return;}
    const nav=node('div','sheet-nav');
    const prev=action('','← Předchozí',()=>neighbor(-1)),next=action('','Další →',()=>neighbor(1));
    prev.id='prevEdition';next.id='nextEdition';nav.append(action('back','← Přehled',goBack),prev,next);
    const sheet=node('article','sheet');sheet.id='sheet';
    const h2=node('h2','sheet-title',capitalize(dayFormat.format(asDate(e.date))));
    const meta=node('p','sheet-meta',category(e.category)+' · '+(e.group==='new'?'Nová sada':'Předchozí vydání'));
    const alerts=node('div','conflict');alerts.id='conflicts';alerts.hidden=true;
    const phraseLabel=node('label','field');phraseLabel.htmlFor='phrase';
    const inp=editorInput(e,'phrase',2);inp.id='phrase';inp.className='phrase';
    phraseLabel.append(node('span','field-label','Věta Tajenky'),inp);
    const base=node('details','original');base.id='original';
    base.append(node('summary','','Výchozí znění'),node('p','',e.phrase));
    sheet.append(h2,meta,alerts,phraseLabel,base);
    const source=sourceLine(e.source);if(source)sheet.append(source);
    const alt=alternative(e);if(alt) sheet.append(alt);
    sheet.append(comment(e,'comment','Poznámka k větě'));
    const fieldset=node('fieldset','status-field'),choices=node('div','status-choices');
    fieldset.append(node('legend','','Stav vydání'),choices);
    for(const [key,name] of Object.entries(statusNames)) {
      const btn=action('',name,()=>{edit(e,'status',key);patchEditor(e);});
      btn.dataset.status=key;choices.append(btn);
    }
    sheet.append(fieldset);
    const section=node('section','clue-section');section.append(node('h3','','Vodítka'));
    for(const [i,answer] of e.answers.entries()) {
      const row=node('div','clue'),label=node('label','',answer.word),field=editorInput(e,'clue:'+answer.word);
      field.id='clue-'+i;label.htmlFor=field.id;
      row.append(label,field,comment(e,'clueComment:'+answer.word,'Poznámka k vodítku'));section.append(row);
    }
    sheet.append(section);target.append(nav,sheet);patchEditor(e);updateNav();
  }
  function paintAll(rebuild=true) {
    if(!editions.length || locked) return;
    $('workspace').hidden=false;$('delivery').hidden=false;$('progress').hidden=false;$('export').disabled=false;
    paintGroups();paintIndex();
    if(rebuild || !$('sheet') || $('editor').dataset.edition!==selected) paintEditor(); else patchEditor(byId.get(selected));
    $('editor').dataset.edition=selected || '';
    paintStatus();
  }
  function exportFile() {
    if(locked||!editions.length) return;
    const payload={
      exportedAt:new Date().toISOString(),revision,submission,
      editions:editions.map(e=>({
        ...e,version:record(e.id).version,fields:editedFields(e),
        ...(listDraft(e.id).size?{pending:Object.fromEntries(listDraft(e.id))}:{}),
        ...(conflicts(e).length?{serverFields:record(e.id).fields}:{})
      }))
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const download=node('a');download.href=url;download.download='proplet-tajenky-redakce-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(download);download.click();download.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  window.addEventListener('storage',event=>{
    if(!prefix || !event.key?.startsWith(prefix) || locked) return;
    const key=event.key.slice(prefix.length);
    if(key.startsWith('draft/')) {
      const [,id,field]=key.split('/').map(decodeURIComponent);
      draftEntry(id,field,read(key),false);
    } else if(key.startsWith('record/')) {
      const id=key.slice(7),row=read(key);
      if(!row || row.version<record(id).version) return;
      records.set(id,row);
    } else if(key==='head') { const head=read(key);if(head)setHead(head,false); }
    else return;
    if(editions.length) {paintIndex();if(byId.has(selected))patchEditor(byId.get(selected));paintStatus();schedule();}
  });
  $('accessForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=$('privateLink');
    let key='';
    try {
      const link=new URL(input.value.trim());
      if(link.protocol==='https:') key=new URLSearchParams(link.hash.slice(1)).get('k') || '';
    } catch {}
    if(!/^[A-Za-z0-9_-]{32,128}$/.test(key)) {
      notice('Vlož celý původní soukromý odkaz včetně části za znakem #.');
      input.focus();return;
    }
    input.value='';
    history.replaceState(history.state,'',location.pathname+location.search+'#k='+encodeURIComponent(key));
    location.reload();
  });
  $('stateFilter').addEventListener('change',selectThroughFilters);
  $('categoryFilter').addEventListener('change',selectThroughFilters);
  $('search').addEventListener('input',selectThroughFilters);
  $('retry').addEventListener('click',()=>{rowErrors.clear();refresh();});
  $('submit').addEventListener('click',deliver);
  $('export').addEventListener('click',exportFile);
  window.addEventListener('popstate',()=>{if(!history.state?.tajenkaEditor) overview();});
  window.addEventListener('offline',()=>{if(!locked)offline();});
  window.addEventListener('online',()=>{if(token&&!locked)refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && navigator.onLine && token && !locked && !submitting)refresh();});
  (async()=>{
    token=getAccess();
    if(!token) {lockAccess();return;}
    await localNamespace();loadLocal();
    if(editions.length) paintAll();
    if(navigator.onLine) await refresh(); else offline();
  })().catch(()=>notice('Redakci se nepodařilo otevřít. Načti stránku znovu.',true));
})();
