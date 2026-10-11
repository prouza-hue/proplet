'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// Execute the real browser reporter with a captured transport, never a live API.
const app=fs.readFileSync('public/app.js','utf8');
const reporter=app.slice(app.indexOf('let reportingClientError=false;'),app.indexOf('function bindClientErrorReporting(){'));

async function verify(){
  for(const loggedIn of [false,true]){
    const calls=[];
    const context={navigator:{onLine:true},location:{pathname:'/index.html',search:'?fbclid=click-secret&utm_source=instagram&auth=google&challenge=challenge-secret',hash:'#access_token=oauth-secret'},
      window:{},URL,URLSearchParams,APP_VERSION:'4.05.4',APP_PREVIEW_RELEASE:'proplet-v4.05.4-clienterrors2',analyticsHeaders:()=>({'X-Proplet-Test':'1','X-Proplet-Client-Release':'older-state'}),
      getProfile:()=>loggedIn?{token:'synthetic-session'}:null,getAnonymousId:()=>'synthetic-installation',
      fetch:(url,options)=>{calls.push({url,options});return Promise.resolve({ok:true});}};
    vm.createContext(context);vm.runInContext(reporter,context);
    context.reportClientError('puzzle_boot_failed','both-attempts-failed');
    assert.equal(calls.length,1);
    const {url,options}=calls[0],body=JSON.parse(options.body);
    assert.equal(url,'/api/client-error');
    assert.equal(body.route,'/index.html','diagnostic route must contain only pathname');
    assert.equal(body.code,'puzzle_boot_failed');assert.equal(body.message,'both-attempts-failed');
    for(const secret of ['click-secret','challenge-secret','oauth-secret','fbclid','utm_source','access_token'])assert(!options.body.includes(secret),'client error body must not export URL context: '+secret);
    assert.equal(options.keepalive,true,'boot diagnostics must retain their reliable transport');
    assert.equal(options.headers['X-Proplet-Test'],'1','technical errors retain the test exclusion');
    assert.equal(options.headers['X-Proplet-Client-Release'],'proplet-v4.05.4-clienterrors2','actual producer beats stale flow metadata');
    assert.equal(body.client_release,options.headers['X-Proplet-Client-Release']);assert.equal(body.is_test,true);
    assert.equal(loggedIn?options.headers.Authorization:options.headers['X-Proplet-Anon-ID'],loggedIn?'Bearer synthetic-session':'synthetic-installation');
    await Promise.resolve();
  }
  const headersContext={currentGame:null,getProfile:()=>null,APP_PREVIEW_RELEASE:'synthetic',URLSearchParams,location:{search:''},window:{PropletMarketing:{},PropletAcquisition:{headers:()=>({})}}};
  vm.createContext(headersContext);vm.runInContext(app.slice(app.indexOf('function analyticsHeaders('),app.indexOf('function productAnalytics()')),headersContext);
  for(const marketingGate of ['eligible','unknown_parameter','auth_url','nonproduction','non_game_path'])assert.equal(headersContext.analyticsHeaders('marketing_measurement_ready',{marketingGate})['X-Proplet-Marketing-Gate'],marketingGate);
  assert.equal(headersContext.analyticsHeaders('app_open',{marketingGate:'eligible'})['X-Proplet-Marketing-Gate'],undefined);
  assert.equal(headersContext.analyticsHeaders('marketing_measurement_ready',{marketingGate:'fbclid=click-secret'})['X-Proplet-Marketing-Gate'],undefined,'marketing gate must not export arbitrary URL values');
  console.log('PASS client error sends pathname only for guest/account without URL secrets');
}
verify().catch(error=>{console.error(error);process.exitCode=1});
