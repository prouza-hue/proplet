(function loadMobileBoardQa(){
'use strict';
const params=new URLSearchParams(location.search);
params.set('boardQaState',params.get('boardQaState')||'default');
params.set('boardQaDifficulty',params.get('boardQaDifficulty')||'easy');
fetch('/?'+params.toString()).then(response=>response.text()).then(html=>{document.querySelector('#qa').srcdoc=html});
})();
