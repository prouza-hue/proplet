(() => {
  const $=id=>document.getElementById(id);
  function update(){
    const width=Number($('width').value),height=width>=1280?900:width>=768?1024:844;
    const scenario=$('scenario').value;
    const params=new URLSearchParams({state:scenario==='legend'?'cabinet':scenario,theme:$('theme').value,motion:$('motion').value});
    if(scenario==='legend')params.set('gold','50');
    const src=`/qa/index.html?${params}`;
    $('preview').width=width;$('preview').height=height;$('preview').src=src;
    $('direct').href=src;$('sizeLabel').textContent=`${width} × ${height} · emulovaný viewport`;
  }
  ['width','scenario','theme','motion'].forEach(id=>$(id).addEventListener('change',update));
  $('replay').onclick=update;update();
})();
