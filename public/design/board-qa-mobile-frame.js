(function loadMobileBoardQa(){
'use strict';
const params=new URLSearchParams(location.search);
params.set('boardQaState',params.get('boardQaState')||'default');
params.set('boardQaDifficulty',params.get('boardQaDifficulty')||'easy');
document.querySelector('#qa').src='/?'+params.toString();
})();
