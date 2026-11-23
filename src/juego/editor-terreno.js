/* Nativa Online — MODO DIOS: la herramienta de terreno y vegetación por sectores.
   Se registra en NV.editor.modos y se enciende con la pestaña "terreno". No sabe dibujar pasto: eso es del motor
   (NV.terreno, que a su vez llama al pasto real); acá se decide qué hacer con el ratón y cada cambio se escribe con
   NV.mundo.editar({t:'terreno',id,datos}), de donde sale también el deshacer.

     · arrastrar sobre el suelo vacío: dibuja un sector rectangular (en metros enteros) con la configuración del "pincel"
     · clic en un sector: lo elige · arrastrar un sector elegido: lo mueve · clic derecho, Supr: lo borra · Esc: suelta
     · con un sector elegido, todos los controles lo editan; sin elegir, editan el pincel (lo que traerá el próximo)
     · mientras se mueve un control se ve en vivo (vista previa); al soltarlo se guarda y queda en el deshacer
   Todo se mide en metros. Cada sector guarda la configuración anterior (hasta 12) para volver a ella. */
(function(NV){
  const E=NV.editor; if(!E||!NV.terreno) return;
  const T=()=>NV.terreno;
  const ORO=[200,162,74], ORO_VIVO=[255,232,160];
  const $e=id=>document.getElementById(id);
  const copia=d=>JSON.parse(JSON.stringify(d));
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const GRUPOS=['pasto','flores','relieve','visual','trans'];

  let sel=null, pincel=null, cur=null, drag=null, copiado=null, ultVista=null;
  const datos=()=>NV.mundo.terrenoDatos();
  const datosDe=id=>datos().find(d=>d.id===id)||null;
  const pinc=()=>pincel||(pincel=T().normalizar({}));
  function libre(){ let n=1; const u=new Set(datos().map(d=>d.id)); while(u.has('terreno-'+n)) n++; return 'terreno-'+n; }
  function escribir(id,d,aviso){ return E.hacer({t:'terreno',id,datos:d},aviso); }
  const config=d=>{ const c=copia(d); delete c.id; delete c.historial; return c; };
  /* aplica un cambio {ruta:valor} sobre la copia de un sector y lo normaliza */
  function parchar(d,cambios){
    const n=copia(d);
    for(const ruta in cambios){ const p=ruta.split('.'); let o=n; for(let i=0;i<p.length-1;i++) o=o[p[i]]; o[p[p.length-1]]=cambios[ruta]; }
    const r=T().normalizar(n); r.id=d.id; r.historial=d.historial||[]; return r;
  }
  function modificar(id,cambios,aviso){
    const d=datosDe(id); if(!d){ E.decir('Ese sector ya no está.'); return false; }
    const n=parchar(d,cambios), h=(d.historial||[]).slice(); h.push(config(d)); while(h.length>12) h.shift(); n.historial=h;
    return escribir(id,n,aviso);
  }

  /* ---------- el puntero ---------- */
  function puntero(e){
    const cv=$e('cv'), r=cv.getBoundingClientRect();
    const col=Math.floor((e.clientX-r.left-(NV.desplaceX||0))/cw), fil=Math.floor((e.clientY-r.top-(NV.desplaceY||0))/chh);
    if(col<0||fil<0||col>=cols||fil>=rowsN) return null;
    const q=NV.casillaEn(col,fil); return {wx:q.wx,wy:q.wy};
  }
  const rectDe=(a,b)=>{ const x=Math.min(a.x0,b.x1), y=Math.min(a.y0,b.y1); return {x,y,w:Math.abs(b.x1-a.x0)+1,h:Math.abs(b.y1-a.y0)+1}; };

  /* ---------- la vista previa ---------- */
  function vista(d){ T().vista(d); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); }
  function limpiar(){ T().vista(null); }

  /* ---------- el ratón y el teclado ---------- */
  function bajar(e){
    const p=puntero(e); if(!p) return; cur=p;
    if(e.button===2){ if(e.ctrlKey) return; const s=T().sectorEn(p.wx,p.wy); if(s) borrar(s.id); else E.decir('Ahí no hay ningún sector.'); return; }
    if(e.button!==0) return;
    const s=T().sectorEn(p.wx,p.wy);
    if(s&&!e.shiftKey){
      if(s.id===sel) drag={tipo:'mover',ox:p.wx-s.x,oy:p.wy-s.y,orig:copia(datosDe(s.id)||s),movido:false};
      else { sel=s.id; cargarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); }
      return;
    }
    sel=null; drag={tipo:'nuevo',x0:Math.floor(p.wx),y0:Math.floor(p.wy),x1:Math.floor(p.wx),y1:Math.floor(p.wy)};
    cargarUI(); vistaNuevo();
  }
  function vistaNuevo(){
    const r=rectDe(drag,drag), d=Object.assign(copia(pinc()),{id:'__vista',x:r.x,y:r.y,w:r.w,h:r.h}); vista(d);
  }
  function mover(e){
    const p=puntero(e); cur=p;
    if(drag&&p){
      if(drag.tipo==='nuevo'){ const x1=Math.floor(p.wx), y1=Math.floor(p.wy); if(x1!==drag.x1||y1!==drag.y1){ drag.x1=x1; drag.y1=y1; vistaNuevo(); } }
      else { const x=Math.round(p.wx-drag.ox), y=Math.round(p.wy-drag.oy);
        if(x!==drag.orig.x||y!==drag.orig.y){ drag.movido=true; vista(Object.assign(copia(drag.orig),{x,y})); } }
    }
    E.refrescar(); if(typeof programarCuadro==='function') programarCuadro();
  }
  function soltar(){
    if(!drag) return; const d0=drag; drag=null;
    if(d0.tipo==='nuevo'){
      limpiar(); const r=rectDe(d0,d0), id=libre();
      const n=T().normalizar(Object.assign(copia(pinc()),{x:r.x,y:r.y,w:r.w,h:r.h,nombre:'Sector '+id.split('-')[1]})); n.id=id; n.historial=[];
      if(escribir(id,n,'Sector de '+r.w+'×'+r.h+' m creado.')){ sel=id; cargarUI(); }
    } else if(d0.movido&&cur){
      limpiar(); const x=Math.round(cur.wx-d0.ox), y=Math.round(cur.wy-d0.oy);
      modificar(d0.orig.id,{x,y},'Sector movido.');
    } else limpiar();
    E.refrescar(); if(typeof programarCuadro==='function') programarCuadro();
  }
  function borrar(id){ limpiar(); if(escribir(id,null,'Sector borrado.')&&sel===id){ sel=null; cargarUI(); } }
  function tecla(e,k){
    if(e.ctrlKey||e.metaKey) return false;
    if(k==='escape'){ if(drag){ drag=null; limpiar(); return true; } if(sel){ sel=null; cargarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); return true; } return false; }
    if(k==='delete'&&sel){ borrar(sel); return true; }
    return false;
  }

  /* ---------- los controles ---------- */
  const CAMPOS=[
    ['grupo','Superficie (metros)'],
    ['num','x','x','x',1],['num','y','y','y',1],['num','w','ancho','ancho',1],['num','h','largo','largo',1],
    ['tam'],
    ['grupo','Terreno'],['terreno'],
    ['grupo','Pasto'],
    ['rng','pasto.densidad','densidad'],['rng','pasto.alto','altura'],['tono'],['rng','pasto.claridad','claridad'],['rng','pasto.oscuridad','oscuridad'],
    ['rng','pasto.saturacion','saturación'],['rng','pasto.variacion','variación'],['estado'],['rng','pasto.nieve','nieve'],
    ['grupo','Flores'],['cantidad'],['colores'],['dist'],
    ['grupo','Relieve y aspecto'],['relieve'],['rng','relieve.intensidad','intensidad'],
    ['rng','visual.sombra','sombra'],['rng','visual.contraste','contraste'],['rng','visual.profundidad','profundidad'],
    ['rng','visual.variacionLuz','luz variable'],['rng','visual.humedad','humedad'],['rng','visual.textura','textura'],
    ['grupo','Transición'],['transtipo'],['rng','trans.ancho','ancho (m)',0,20,0.5]
  ];
  function html(){
    const t=T(); let h='';
    const opt=(v,tx)=>'<option value="'+v+'">'+tx+'</option>';
    for(const c of CAMPOS){
      switch(c[0]){
        case 'grupo': h+='<div class="grupo">'+c[1]+'</div>'; break;
        case 'num': h+='<div class="tcampo"><span>'+c[3]+'</span><input type="number" data-k="'+c[1]+'" step="1"></div>'; break;
        case 'tam': h+='<div class="fila">'+[[5,5],[10,10],[20,10],[10,30],[50,20]].map(a=>'<button class="terTam" data-w="'+a[0]+'" data-h="'+a[1]+'">'+a[0]+'×'+a[1]+'</button>').join('')+'</div>'; break;
        case 'terreno': h+='<select data-k="terreno">'+t.GRUPOS_TERRENO.map(g=>'<optgroup label="'+g+'">'+Object.keys(t.TERRENOS).filter(k=>t.TERRENOS[k].g===g).map(k=>opt(k,t.TERRENOS[k].n)).join('')+'</optgroup>').join('')+'</select>'; break;
        case 'rng': h+='<div class="tcampo"><span>'+c[2]+'</span><input type="range" data-k="'+c[1]+'" min="'+(c[3]===undefined?0:c[3])+'" max="'+(c[4]===undefined?1:c[4])+'" step="'+(c[5]||0.01)+'"></div>'; break;
        case 'tono': h+='<select data-k="pasto.tono">'+Object.keys(t.TONOS).map(k=>opt(k,t.TONOS[k].n)).join('')+'</select>'; break;
        case 'estado': h+='<select data-k="pasto.estado">'+Object.keys(t.ESTADOS).map(k=>opt(k,t.ESTADOS[k])).join('')+'</select>'; break;
        case 'cantidad': h+='<select data-k="flores.cantidad" data-num="1">'+t.CANTIDADES.map(a=>opt(a[1],a[0])).join('')+'</select>'; break;
        case 'colores': h+='<div class="tchk">'+['roja','amarilla','blanca'].map(k=>'<label><input type="checkbox" data-k="flores.'+k+'">'+k+'</label>').join('')+'</div>'; break;
        case 'dist': h+='<select data-k="flores.distribucion">'+Object.keys(t.DISTRIBUCIONES).map(k=>opt(k,t.DISTRIBUCIONES[k].n)).join('')+'</select>'; break;
        case 'relieve': h+='<select data-k="relieve.tipo">'+Object.keys(t.RELIEVES).map(k=>opt(k,t.RELIEVES[k].n)).join('')+'</select>'; break;
        case 'transtipo': h+='<select data-k="trans.tipo">'+Object.keys(t.TRANSICIONES).map(k=>opt(k,t.TRANSICIONES[k])).join('')+'</select>'; break;
      }
    }
    h+='<div class="grupo">Preajustes</div><select id="terPre">'+opt('','— elegir —')+Object.keys(PRE).map(k=>opt(k,k)).join('')+'</select>';
    h+='<div class="grupo">Sector</div>'+
       '<div class="fila"><button id="terRegen" title="Otra semilla: sólo cambia este sector">regenerar</button><button id="terAnt" title="Volver a la configuración anterior">anterior</button></div>'+
       '<div class="fila"><button id="terCopiar">copiar</button><button id="terPegar">pegar</button><button id="terBorrar" title="Supr">borrar</button></div>';
    return h;
  }
  const PRE={
    'Pradera verde':{terreno:'pradera'},
    'Campo seco':{terreno:'muerta',pasto:{estado:'seco',tono:'seco',densidad:0.45}},
    'Pantano':{terreno:'pantano',pasto:{densidad:0.7}},
    'Pradera nevada':{terreno:'pastonieve',pasto:{estado:'nieve-parcial',nieve:0.65}},
    'Pradera de flores':{flores:{cantidad:3.2,roja:true,amarilla:true,blanca:true,distribucion:'concentradas'}},
    'Hierba alta':{pasto:{alto:0.9,densidad:0.7}},
    'Arena':{terreno:'arena'}, 'Quemado':{terreno:'quemado',pasto:{estado:'quemado',densidad:0.4}}
  };
  const raiz=()=>$e('diosTerreno');
  const campos=()=>raiz()?Array.from(raiz().querySelectorAll('[data-k]')):[];
  const actual=()=>{ const d=sel&&datosDe(sel); return d?T().normalizar(d):pinc(); };
  const leer=(o,ruta)=>ruta.split('.').reduce((a,k)=>a[k],o);
  function cargarUI(){
    const c=actual();
    for(const el of campos()){ const v=leer(c,el.dataset.k);
      if(el.type==='checkbox') el.checked=!!v; else el.value=String(v); }
  }
  function valorDe(el){
    if(el.type==='checkbox') return el.checked;
    if(el.type==='range'||el.type==='number'||el.dataset.num) return +el.value;
    return el.value;
  }
  /* vivo: se ve mientras se mueve; fijo: se guarda */
  function cambio(el,fijar){
    const cam={[el.dataset.k]:valorDe(el)};
    if(sel&&datosDe(sel)){
      if(!fijar){ vista(parchar(datosDe(sel),cam)); return; }
      limpiar(); modificar(sel,cam);
    } else { const n=parchar(pinc(),cam); n.id=undefined; pincel=n; E.refrescar(); }
  }
  function aplicarPre(nombre){
    const p=PRE[nombre]; if(!p) return;
    const base=T().normalizar({}); const cfg=T().normalizar(Object.assign(base,p));
    const b=T().normalizar(Object.assign(copia(base),{terreno:p.terreno||base.terreno}));
    for(const g of GRUPOS) if(p[g]) b[g]=T().normalizar(Object.assign(copia(base),{[g]:Object.assign({},base[g],p[g])}))[g];
    const cam={terreno:b.terreno}; for(const g of GRUPOS) for(const k in b[g]) cam[g+'.'+k]=b[g][k];
    if(sel&&datosDe(sel)) modificar(sel,cam,'Preajuste aplicado: '+nombre+'.');
    else { pincel=parchar(pinc(),cam); E.decir('Pincel: '+nombre+'.'); }
    cargarUI();
  }

  /* ---------- lo que se ve ---------- */
  function estado(){
    if(sel&&!datosDe(sel)) sel=null;
    if(drag&&drag.tipo==='nuevo'){ const r=rectDe(drag,drag); return '<b>Nuevo sector</b> · '+r.w+' × '+r.h+' m\nSoltá el clic para crearlo'; }
    const d=sel&&datosDe(sel);
    if(d) return '<b>'+(d.nombre||d.id)+'</b> · '+d.w+' × '+d.h+' m en ('+d.x+', '+d.y+')\nLos controles lo editan · arrastrá para moverlo\nSupr o clic derecho: borrar';
    return '<b>Terreno</b>\nArrastrá sobre el suelo: dibuja un sector\nClic en un sector: lo elige\nSin elegir, los controles son el pincel';
  }
  const cruz=(x,y,color)=>{
    const c0=Math.round((x-camX)*CPM), r0=Math.floor((y-camY)*RPM);
    ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(x,y)*HPM); pickId=0;
    for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,color);
    layer=0; alzaR=0;
  };
  function marco(x,y,w,h,color){
    const paso=Math.max(1,Math.round(Math.max(w,h)/16));
    for(let i=0;i<=w;i+=paso){ cruz(x+i,y,color); cruz(x+i,y+h,color); }
    for(let j=0;j<=h;j+=paso){ cruz(x,y+j,color); cruz(x+w,y+j,color); }
    cruz(x+w,y+h,color);
  }
  function pintar(){
    const oro=packc(ORO[0],ORO[1],ORO[2]), vivo=packc(ORO_VIVO[0],ORO_VIVO[1],ORO_VIVO[2]);
    for(const d of datos()) if(d.id!==sel) marco(d.x,d.y,d.w,d.h,oro);
    if(drag&&drag.tipo==='nuevo'){ const r=rectDe(drag,drag); marco(r.x,r.y,r.w,r.h,vivo); return; }
    const d=sel&&datosDe(sel);
    if(d){ const v=(drag&&drag.movido&&cur)?{x:Math.round(cur.wx-drag.ox),y:Math.round(cur.wy-drag.oy)}:d; marco(v.x,v.y,d.w,d.h,vivo); }
    if(cur&&!drag) cruz(cur.wx,cur.wy,vivo);
  }

  /* ---------- el registro en el editor ---------- */
  E.modos.terreno={
    bajar,mover,soltar,tecla,estado,pintar,
    abrir(){ cargarUI(); },
    cerrar(){ drag=null; limpiar(); sel=null; cur=null; },
    iniciar(){
      const r=raiz(); if(!r) return;
      r.innerHTML=html();
      for(const el of campos()){
        const rango=el.type==='range';
        if(rango) el.addEventListener('input',()=>cambio(el,false));
        el.addEventListener('change',()=>cambio(el,true));
      }
      for(const b of (r.querySelectorAll?r.querySelectorAll('.terTam'):[])) b.addEventListener('click',()=>{
        const w=+b.dataset.w, h=+b.dataset.h;
        if(sel&&datosDe(sel)) modificar(sel,{w,h},'Sector de '+w+'×'+h+' m.'); else { pincel=pincel; E.decir('Elegí un sector para cambiarle el tamaño.'); } cargarUI(); });
      const q=id=>r.querySelector?r.querySelector('#'+id):null;
      const bind=(id,f)=>{ const b=q(id); if(b) b.addEventListener('click',f); };
      const pre=q('terPre'); if(pre) pre.addEventListener('change',()=>{ aplicarPre(pre.value); pre.value=''; });
      bind('terRegen',()=>{ if(!sel||!datosDe(sel)){ E.decir('Elegí un sector.'); return; } const s=((datosDe(sel).sem||0)+1+((Date.now()&0x3ff)))|0; modificar(sel,{sem:s},'Sector regenerado: sólo cambió él.'); });
      bind('terAnt',()=>{ const d=sel&&datosDe(sel); if(!d||!(d.historial||[]).length){ E.decir('No hay una configuración anterior.'); return; }
        const h=d.historial.slice(), a=h.pop(), n=T().normalizar(Object.assign(copia(a),{id:d.id})); n.id=d.id; n.historial=h; escribir(d.id,n,'Configuración anterior recuperada.'); cargarUI(); });
      bind('terCopiar',()=>{ const d=sel&&datosDe(sel); if(!d){ E.decir('Elegí un sector.'); return; } copiado=config(d); E.decir('Configuración copiada.'); });
      bind('terPegar',()=>{ if(!copiado){ E.decir('No hay nada copiado.'); return; }
        const cam={terreno:copiado.terreno,sem:copiado.sem}; for(const g of GRUPOS) for(const k in copiado[g]) cam[g+'.'+k]=copiado[g][k];
        if(sel&&datosDe(sel)){ modificar(sel,cam,'Configuración pegada (posición y tamaño no cambian).'); cargarUI(); }
        else { pincel=parchar(pinc(),cam); E.decir('Pegada en el pincel.'); cargarUI(); } });
      bind('terBorrar',()=>{ if(sel) borrar(sel); });
      addEventListener('pointerup',soltar); addEventListener('pointercancel',soltar);
      cargarUI();
    },
    /* para las pruebas */
    _estado:()=>({sel,pincel,drag:!!drag}), _modificar:modificar, _elegir:id=>{ sel=id; }
  };
})(window.NV);
