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

  let sel=null, pincel=null, cur=null, drag=null, copiado=null, ultVista=null, armando=false;
  const datos=()=>NV.mundo.terrenoDatos();
  const datosDe=id=>datos().find(d=>d.id===id)||null;
  const pinc=()=>pincel||(pincel=T().normalizar({}));
  function libre(extra){ let n=1; const u=new Set(datos().map(d=>d.id)); if(extra) for(const x of extra) u.add(x); while(u.has('terreno-'+n)) n++; return 'terreno-'+n; }
  /* Un sector nuevo (o movido, o con otro tamaño) BORRA lo que había debajo: cada sector que toca el rectángulo se parte en lo que
     queda fuera de él (hasta cuatro rectángulos con la misma configuración). Así nunca se solapan dos terrenos.
     Devuelve las operaciones del mundo; el llamador las junta con la suya en un solo paso de deshacer. */
  function recortar(r,exceptoId,reservados){
    const ops=[], res=reservados||[];
    for(const d of datos()){
      if(d.id===exceptoId) continue;
      if(d.x>=r.x+r.w||d.x+d.w<=r.x||d.y>=r.y+r.h||d.y+d.h<=r.y) continue;
      ops.push({t:'terreno',id:d.id,datos:null});
      const trozos=[];
      if(r.y>d.y) trozos.push({x:d.x,y:d.y,w:d.w,h:r.y-d.y});
      if(r.y+r.h<d.y+d.h) trozos.push({x:d.x,y:r.y+r.h,w:d.w,h:d.y+d.h-(r.y+r.h)});
      const y0=Math.max(d.y,r.y), y1=Math.min(d.y+d.h,r.y+r.h);
      if(r.x>d.x) trozos.push({x:d.x,y:y0,w:r.x-d.x,h:y1-y0});
      if(r.x+r.w<d.x+d.w) trozos.push({x:r.x+r.w,y:y0,w:d.x+d.w-(r.x+r.w),h:y1-y0});
      for(const t of trozos){
        if(t.w<0.5||t.h<0.5) continue;
        const id=libre(res.concat(ops.map(o=>o.id))); res.push(id);
        const n=copia(d); n.id=id; n.x=t.x; n.y=t.y; n.w=t.w; n.h=t.h; n.historial=[];
        const z=d.flores&&d.flores.zona;
        if(z){ const zx=d.x+z.x, zy=d.y+z.y, ax=Math.max(zx,t.x), ay=Math.max(zy,t.y), bx=Math.min(zx+z.w,t.x+t.w), by=Math.min(zy+z.h,t.y+t.h);
          n.flores.zona=(bx-ax>=1&&by-ay>=1)?{x:ax-t.x,y:ay-t.y,w:bx-ax,h:by-ay}:null; }
        { const pn=T().normalizar(n); pn.id=id; pn.historial=[]; ops.push({t:'terreno',id,datos:pn}); }
      }
    }
    return ops;
  }
  const hacerLote=(ops,aviso)=>E.hacer(ops.length===1?ops[0]:{t:'lote',ops},aviso);
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
    /* si cambió de lugar o de tamaño, lo que tenga debajo desaparece */
    const cortes=('x' in cambios||'y' in cambios||'w' in cambios||'h' in cambios)?recortar({x:n.x,y:n.y,w:n.w,h:n.h},id):[];
    return hacerLote(cortes.concat([{t:'terreno',id,datos:n}]),aviso);
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
    if(armando&&sel&&datosDe(sel)){ const d=datosDe(sel); drag={tipo:'zona',x0:clamp(Math.floor(p.wx),d.x,d.x+d.w-1),y0:clamp(Math.floor(p.wy),d.y,d.y+d.h-1)}; drag.x1=drag.x0; drag.y1=drag.y0; vistaZona(); return; }
    const s=T().sectorEn(p.wx,p.wy);
    if(s&&!e.shiftKey){
      if(s.id===sel) drag={tipo:'mover',ox:p.wx-s.x,oy:p.wy-s.y,orig:copia(datosDe(s.id)||s),movido:false};
      else { sel=s.id; cargarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); }
      return;
    }
    sel=null; drag={tipo:'nuevo',x0:Math.floor(p.wx),y0:Math.floor(p.wy),x1:Math.floor(p.wx),y1:Math.floor(p.wy)};
    cargarUI(); vistaNuevo();
  }
  function rectZona(){ const d=datosDe(sel); const r=rectDe(drag,drag); const x=clamp(r.x,d.x,d.x+d.w-1), y=clamp(r.y,d.y,d.y+d.h-1);
    return {x,y,w:Math.min(r.w,d.x+d.w-x),h:Math.min(r.h,d.y+d.h-y)}; }
  function vistaZona(){ const d=datosDe(sel), z=rectZona(); vista(parchar(d,{'flores.zona':{x:z.x-d.x,y:z.y-d.y,w:z.w,h:z.h}})); }
  function vistaNuevo(){
    const r=rectDe(drag,drag), d=Object.assign(copia(pinc()),{id:'__vista',x:r.x,y:r.y,w:r.w,h:r.h}); vista(d);
  }
  function mover(e){
    const p=puntero(e); cur=p;
    if(drag&&p){
      if(drag.tipo==='zona'){ const d=datosDe(sel); const x1=clamp(Math.floor(p.wx),d.x,d.x+d.w-1), y1=clamp(Math.floor(p.wy),d.y,d.y+d.h-1); if(x1!==drag.x1||y1!==drag.y1){ drag.x1=x1; drag.y1=y1; vistaZona(); } }
      else if(drag.tipo==='nuevo'){ const x1=Math.floor(p.wx), y1=Math.floor(p.wy); if(x1!==drag.x1||y1!==drag.y1){ drag.x1=x1; drag.y1=y1; vistaNuevo(); } }
      else { const x=Math.round(p.wx-drag.ox), y=Math.round(p.wy-drag.oy);
        if(x!==drag.orig.x||y!==drag.orig.y){ drag.movido=true; vista(Object.assign(copia(drag.orig),{x,y})); } }
    }
    E.refrescar(); if(typeof programarCuadro==='function') programarCuadro();
  }
  function soltar(){
    if(!drag) return; const d0=drag; drag=null;
    if(d0.tipo==='zona'){
      const d=datosDe(sel); limpiar(); armando=false;
      if(d){ drag=d0; const z=rectZona(); drag=null; modificar(sel,{'flores.zona':{x:z.x-d.x,y:z.y-d.y,w:z.w,h:z.h}},'Zona de flores marcada.'); }
      cargarUI();
    } else if(d0.tipo==='nuevo'){
      limpiar(); const r=rectDe(d0,d0), id=libre();
      const n=T().normalizar(Object.assign(copia(pinc()),{x:r.x,y:r.y,w:r.w,h:r.h,nombre:'Sector '+id.split('-')[1]})); n.id=id; n.historial=[];
      const cortes=recortar(r,null,[id]);
      if(hacerLote(cortes.concat([{t:'terreno',id,datos:n}]),'Sector de '+r.w+'×'+r.h+' m creado'+(cortes.length?' (lo que había debajo se quitó).':'.'))){ sel=id; cargarUI(); }
    } else if(d0.movido&&cur){
      limpiar(); const x=Math.round(cur.wx-d0.ox), y=Math.round(cur.wy-d0.oy);
      modificar(d0.orig.id,{x,y},'Sector movido.');
    } else limpiar();
    E.refrescar(); if(typeof programarCuadro==='function') programarCuadro();
  }
  function borrar(id){ limpiar(); if(escribir(id,null,'Sector borrado.')&&sel===id){ sel=null; cargarUI(); } }
  function tecla(e,k){
    if(e.ctrlKey||e.metaKey) return false;
    if(k==='escape'){ if(armando){ armando=false; cargarUI(); return true; } if(drag){ drag=null; limpiar(); return true; } if(sel){ sel=null; cargarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); return true; } return false; }
    if(k==='delete'&&sel){ borrar(sel); return true; }
    return false;
  }

  /* ---------- los controles ---------- */
  /* la ventana: dos columnas de filas "etiqueta · control", como las opciones de un juego */
  function html(){
    const t=T(); const opt=(v,tx)=>'<option value="'+v+'">'+tx+'</option>';
    const fila=(et,ctl)=>'<div class="trow"><span class="tet">'+et+'</span><span class="tctl">'+ctl+'</span></div>';
    const rng=(k,et,mn,mx,st)=>fila(et,'<input type="range" data-k="'+k+'" min="'+mn+'" max="'+mx+'" step="'+st+'"><span class="tval" data-v="'+k+'"></span>');
    const sel=(k,et,ops,num)=>fila(et,'<select data-k="'+k+'"'+(num?' data-num="1"':'')+'>'+ops+'</select>');
    const num=(k,et)=>fila(et,'<input type="number" data-k="'+k+'" step="1">');
    const O=(o)=>Object.keys(o).map(k=>opt(k,typeof o[k]==='string'?o[k]:o[k].n)).join('');
    const cab=x=>'<div class="tcab">'+x+'</div>';
    const izq=cab('Superficie (metros)')+num('x','Posición este')+num('y','Posición sur')+num('w','Ancho')+num('h','Largo')+
      '<div class="fila">'+[[5,5],[10,10],[20,10],[10,30],[50,20]].map(a=>'<button class="terTam" data-w="'+a[0]+'" data-h="'+a[1]+'">'+a[0]+'×'+a[1]+'</button>').join('')+'</div>'+
      cab('Terreno')+sel('terreno','Superficie',t.GRUPOS_TERRENO.map(g=>'<optgroup label="'+g+'">'+Object.keys(t.TERRENOS).filter(k=>t.TERRENOS[k].g===g).map(k=>opt(k,t.TERRENOS[k].n)).join('')+'</optgroup>').join(''))+
      cab('Pasto')+rng('pasto.densidad','Densidad',0,1,0.01)+rng('pasto.alto','Altura',0,1,0.01)+sel('pasto.tono','Tono',O(t.TONOS))+
      rng('pasto.claridad','Claridad',0,1,0.01)+rng('pasto.oscuridad','Oscuridad',0,1,0.01)+rng('pasto.saturacion','Saturación',0,1,0.01)+
      rng('pasto.variacion','Variación natural',0,1,0.01)+sel('pasto.estado','Estado',O(t.ESTADOS))+rng('pasto.nieve','Cobertura de nieve',0,1,0.01);
    const der=cab('Flores')+rng('flores.cantidad','Abundancia',0,4,0.05)+
      fila('Colores','<span class="tchk"><label><input type="checkbox" data-k="flores.roja">roja</label><label><input type="checkbox" data-k="flores.amarilla">amarilla</label><label><input type="checkbox" data-k="flores.blanca">blanca</label></span>')+
      sel('flores.distribucion','Disposición',O(t.DISTRIBUCIONES))+
      fila('Dónde','<button id="terZona" title="Después arrastrá sobre el sector">elegir zona</button><button id="terZonaQuitar">todo el sector</button>')+
      '<div class="tnota" id="terZonaTxt"></div>'+
      cab('Relieve y aspecto')+sel('relieve.tipo','Relieve',O(t.RELIEVES))+rng('relieve.intensidad','Intensidad',0,1,0.01)+
      rng('visual.sombra','Sombra',0,1,0.01)+rng('visual.contraste','Contraste',0,1,0.01)+rng('visual.profundidad','Profundidad',0,1,0.01)+
      rng('visual.variacionLuz','Luz variable',0,1,0.01)+rng('visual.humedad','Humedad',0,1,0.01)+rng('visual.textura','Textura',0,1,0.01)+
      cab('Transición con el vecino')+sel('trans.tipo','Tipo',O(t.TRANSICIONES))+rng('trans.ancho','Ancho (m)',0,20,0.5)+
      cab('Preajustes y sector')+fila('Preajuste','<select id="terPre">'+opt('','— elegir —')+Object.keys(PRE).map(k=>opt(k,k)).join('')+'</select>')+
      '<div class="fila"><button id="terRegen" title="Otra semilla: sólo cambia este sector">regenerar</button><button id="terAnt" title="Volver a la configuración anterior">anterior</button></div>'+
      '<div class="fila"><button id="terCopiar">copiar</button><button id="terPegar">pegar</button><button id="terBorrar" title="Supr">borrar</button></div>';
    return '<div class="tcols"><div class="tcol">'+izq+'</div><div class="tcol">'+der+'</div></div>';
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
      if(el.type==='checkbox') el.checked=!!v; else el.value=String(v); mostrarVal(el); }
    const zt=raiz()&&raiz().querySelector?raiz().querySelector('#terZonaTxt'):null;
    if(zt){ const z=c.flores.zona; zt.textContent=armando?'Arrastrá sobre el sector para marcar la zona.':(z?'Zona de flores: '+z.w+' × '+z.h+' m dentro del sector.':'Flores en todo el sector.'); }
  }
  /* el número de al lado de cada deslizador */
  function mostrarVal(el){
    if(el.type!=='range'||!raiz()||!raiz().querySelector) return;
    const v=raiz().querySelector('[data-v="'+el.dataset.k+'"]'); if(!v) return; const x=+el.value;
    if(el.dataset.k==='flores.cantidad'){ let w=T().CANTIDADES[0][0]; for(const [n,q] of T().CANTIDADES) if(x>=q-1e-9) w=n; v.textContent=w; }
    else v.textContent=el.dataset.k==='trans.ancho'?x.toFixed(1):Math.round(x*100)+'%';
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
    if(armando) return '<b>Zona de flores</b>\nArrastrá sobre el sector elegido · Esc cancela';
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
    if(drag&&drag.tipo==='zona'&&sel&&datosDe(sel)){ const z=rectZona(); marco(z.x,z.y,z.w,z.h,vivo); }
    const d=sel&&datosDe(sel);
    if(d&&d.flores&&d.flores.zona&&!(drag&&drag.tipo==='zona')) marco(d.x+d.flores.zona.x,d.y+d.flores.zona.y,d.flores.zona.w,d.flores.zona.h,oro);
    if(d){ const v=(drag&&drag.movido&&cur)?{x:Math.round(cur.wx-drag.ox),y:Math.round(cur.wy-drag.oy)}:d; marco(v.x,v.y,d.w,d.h,vivo); }
    if(cur&&!drag) cruz(cur.wx,cur.wy,vivo);
  }

  /* ---------- el registro en el editor ---------- */
  E.modos.terreno={
    bajar,mover,soltar,tecla,estado,pintar,
    abrir(){ cargarUI(); },
    cerrar(){ drag=null; armando=false; limpiar(); sel=null; cur=null; },
    iniciar(){
      const r=raiz(); if(!r) return;
      r.innerHTML=html();
      for(const el of campos()){
        const rango=el.type==='range';
        if(rango) el.addEventListener('input',()=>{ mostrarVal(el); cambio(el,false); });
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
      bind('terZona',()=>{ if(!sel||!datosDe(sel)){ E.decir('Elegí un sector primero.'); return; } armando=true; E.decir('Arrastrá sobre el sector para marcar dónde van las flores.'); cargarUI(); });
      bind('terZonaQuitar',()=>{ armando=false; if(sel&&datosDe(sel)) modificar(sel,{'flores.zona':null},'Las flores vuelven a todo el sector.'); cargarUI(); });
      addEventListener('pointerup',soltar); addEventListener('pointercancel',soltar);
      cargarUI();
    },
    /* para las pruebas */
    _estado:()=>({sel,pincel,drag:!!drag}), _modificar:modificar, _elegir:id=>{ sel=id; }
  };
})(window.NV);
