(function installCompletionPipeline(global){
  'use strict';

  function create(){
    const hooks=new Map();

    function register(hook){
      if(!hook||typeof hook.id!=='string'||!hook.id.trim())throw new Error('Completion hook requires id');
      const id=hook.id.trim();
      if(hooks.has(id))return true;
      hooks.set(id,{
        id,
        priority:Number.isFinite(Number(hook.priority))?Number(hook.priority):100,
        before:typeof hook.before==='function'?hook.before:null,
        after:typeof hook.after==='function'?hook.after:null,
      });
      return true;
    }

    function ordered(){
      return [...hooks.values()].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
    }

    async function run(phase,context){
      for(const hook of ordered()){
        const fn=hook[phase];
        if(fn)await fn(context);
      }
    }

    return {
      register,
      runBefore:context=>run('before',context),
      runAfter:context=>run('after',context),
      registeredIds:()=>ordered().map(hook=>hook.id),
    };
  }

  const api={create};
  if(global)global.PropletCompletionPipeline=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
