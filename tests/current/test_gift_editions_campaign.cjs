// Drive the real campaign controller with Prague time, user navigation and
// independently advancing bank receipts. No account, database or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/app/engagement/pet-otisku.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function environment({date='2026-12-25T09:00:00Z', prior=1, donor=false, signed=true, shared}={}) {
  let now = Date.parse(date);
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const handlers = new Map(), nodes = new Map(), timers = {}, clients = [], calls = [];
  const records = shared || {askSeen:false,giftSeen:false};
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, {
      dataset:{}, textContent:'', querySelector:node, focus(){}, remove(){},
      replaceChildren(...parts){ this.textContent = parts.map(item=>item.textContent ?? item).join(''); },
      showModal(){ this.open=true; }, close(){this.open=false;},
      addEventListener(event,fn){handlers.set(key+':'+event,fn);}
    });
    return nodes.get(key);
  }
  const state = {eligible:donor, remainingCzk:680, askActive:!donor, pending:false, editions:donor?['2026-11','2026-12']:[]};
  const model = {enabled:true, authenticated:signed, offersDisabled:false, paid:false};
  const entries = new Map(), store = new Map();
  const context = {
    window:null, document:{querySelector:node, createElement:node, addEventListener:(ev,fn)=>handlers.set(ev,fn)},
    Date:Clock, Intl, URLSearchParams, location:{search:''}, addEventListener:(ev,fn)=>handlers.set(ev,fn),
    setTimeout(fn){timers.clock=fn;return 1;},clearTimeout(){},
    setInterval(fn){timers.meter=fn;return 2;}, clearInterval(){delete timers.meter;},
    getProfile:()=>signed?{token:'token',id:'one',stats:{totalCompleted:prior}}:null,
    getState:()=>({completed:{}}),
    sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
    PropletPatrons:{model,open:()=>clients.push('pay')},
    PropletPetOtiskuGame:{open:v=>clients.push(v), collection:v=>clients.push(v)},
    PropletAnnouncements:{register:e=>entries.set(e.id.split('-').pop(),e),kick(){}},
    registerGameCompletionHook:hook=>handlers.set('finish',hook.after),
    api:async (path,opts)=>{
      calls.push(path);
      let claimed = false;
      if (opts) {
        const key = JSON.parse(opts.body).kind + 'Seen';
        claimed = !records[key];
        records[key] = true;
      }
      return {...state,...records,claimed};
    }
  };
  context.window=context;
  vm.runInNewContext(source,context);
  handlers.get('proplet:ready')();
  const screen = name => handlers.get('proplet:screen-changed')({detail:{screen:name}});
  const finish = (mode='free') => handlers.get('finish')({game:{mode,finished:true}});
  function manualReturn() {
    screen('free');
    handlers.get('click')({target:{closest:()=>({dataset:{nav:'daily'}})}});
    screen('daily');
  }
  const can = type=>entries.get(type).eligible({screen:'daily'});
  const show = type=>entries.get(type).show({isCurrent:()=>can(type)});
  return {handlers,entries,screen,finish,manualReturn,can,show,node,state,model,calls,clients,timers,
    date(value){now=Date.parse(value);},dialog:node('#otiskyLetter')};
}

async function main() {
  const first=environment();
  await flush();
  assert.equal(first.can('ask'),false);
  first.finish('otisky'); first.manualReturn(); await flush();
  assert.equal(first.can('ask'),false);
  first.finish(); first.screen('daily'); await flush();
  assert.equal(first.can('ask'),false,'automatic screen transition is not a voluntary return');
  first.manualReturn(); await flush();
  assert.equal(first.can('ask'),true);
  for (const field of ['offersDisabled','pending']) {
    first.model[field]=true; assert.equal(first.can('ask'),false); first.model[field]=false;
  }
  first.state.remainingCzk=365;
  assert.equal(await first.show('ask'),true);
  assert.match(first.node('[data-letter-copy]').textContent,/365 Kč/);
  first.state.remainingCzk=0; await first.timers.meter();
  assert.equal(first.dialog.open,false);
  const records = {askSeen:false,giftSeen:false};
  const twins = [environment({shared:records}),environment({shared:records})];
  await flush();
  for (const tab of twins) { tab.finish(); tab.manualReturn(); }
  await flush();
  assert.deepEqual(await Promise.all(twins.map(tab=>tab.show('ask'))), [true,false]);
  assert.equal(twins[1].can('ask'),false);

  for (const options of [{prior:0},{signed:false},{date:'2026-12-24T22:59:59Z'}]) {
    const user=environment(options); await flush();
    user.finish(); user.manualReturn(); await flush(); assert.equal(user.can('ask'),false);
  }
  const midnight=environment({date:'2026-12-31T22:59:59Z'}); await flush();
  midnight.finish(); midnight.manualReturn(); await flush(); await midnight.show('ask');
  midnight.date('2026-12-31T23:00:00Z'); midnight.timers.clock(); await flush();
  assert.equal(midnight.dialog.open,false); assert.equal(midnight.can('ask'),false);
  const gift=environment({date:'2026-11-30T23:00:00Z',donor:true}); await flush();
  assert.equal(gift.can('gift'),true,'confirmed donor with hidden badge');
  gift.model.thanksPending=true; assert.equal(gift.can('gift'),false); gift.model.thanksPending=false;
  gift.state.remainingCzk=0; await gift.show('gift');
  assert.equal(gift.dialog.open,true); assert.equal(gift.node('h2').textContent,'Ještě jeden plech');
  await gift.handlers.get('[data-letter-action]:click')();
  assert.equal(gift.clients[0].edition,'2026-12');
  gift.handlers.get('#otiskyEntry:click')();
  assert.deepEqual(Array.from(gift.clients[1].editions),['2026-11','2026-12']);
  const archive=environment({date:'2027-01-01T08:00:00Z',donor:true}); await flush();
  assert.equal(archive.can('gift'),false);
  archive.handlers.get('#otiskyEntry:click')();
  assert.deepEqual(Array.from(archive.clients[0].editions),['2026-11','2026-12']);
  const click=environment(); await flush(); click.finish(); click.manualReturn(); await flush(); await click.show('ask');
  click.state.remainingCzk=250; await click.handlers.get('[data-letter-action]:click')();
  assert.equal(click.dialog.open,true); assert.match(click.node('[data-letter-copy]').textContent,/250 Kč/);
  assert.deepEqual(click.clients,[]);
  click.state.pending=true; await click.handlers.get('[data-letter-action]:click')();
  assert.equal(click.dialog.open,false); assert.deepEqual(click.clients,[]);
  console.log('PASS monthly gift, voluntary visit, competing receipts, live amount, expiration, archive entry');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
