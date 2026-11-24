/* Nativa Online — MODO DIOS: EDITOR DE AGUAS CONTINENTALES.
   Se registra en NV.editor.modos y se enciende con la pestaña "Aguas". No sabe dibujar agua: eso es del motor (NV.aguas);
   acá se decide qué hacer con el ratón y cada cambio se escribe con NV.mundo.editar({t:'agua',id,datos}), de donde sale
   también el deshacer, el guardado en el borrador y la exportación del mundo.

     · elegir el tipo (charco, lago, laguna, arroyo, riachuelo, río, río profundo, cascada)
     · MODO LÁPIZ (botón "lápiz"): se dibuja a mano alzada, arrastrando; al soltar el trazo se suaviza y se vuelve contorno o recorrido
     · MODO PUNTOS: lagos, lagunas y charcos: clic para poner los puntos del contorno; Intro, doble clic o clic en el primer punto lo cierra
     · arroyos y ríos: clic para trazar el recorrido; Intro o doble clic lo termina
     · cascada: un clic en el punto donde cae
     · clic en un cuerpo: lo elige · arrastrar un punto: lo mueve (contorno o recorrido) · arrastrar el cuerpo: lo desplaza
     · Mayús + clic en el borde de un cuerpo elegido: agrega un punto ahí · clic derecho en un punto: lo quita
     · clic derecho en un cuerpo (o Supr): lo borra · Esc: suelta lo que se está haciendo
     · con un cuerpo elegido, los controles lo editan (profundidad, color, transparencia, corriente, viento, reflejo, orilla…);
       sin elegir, editan lo que traerá el próximo
     · "regenerar sector" cambia la semilla: sólo cambia la orilla, el fondo y el oleaje de ese cuerpo
   Mientras se mueve un control o un punto se ve en vivo (vista previa del motor); al soltarlo se guarda y queda en el deshacer.
   Todo se mide en metros. Al cargar el mundo, el agua vuelve a moverse sola: sólo se guardan los datos estáticos. */
(function(NV){
  const E=NV.editor; if(!E||!NV.aguas) return;
  const A=()=>NV.aguas;
  const ORO=[200,162,74], ORO_VIVO=[255,232,160];
  const $e=id=>document.getElementById(id);
  const copia=d=>JSON.parse(JSON.stringify(d));
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const ESTANCADAS=['charco','lago','laguna'], CURSOS=['arroyo','riachuelo','rio','rio-profundo'];
  const esEst=t=>ESTANCADAS.indexOf(t)>=0, esCur=t=>CURSOS.indexOf(t)>=0;

  let sel=null, tipo='lago', trazo=null, drag=null, cur=null, ultClic=0, pincel={}, modoTrazo='puntos', lapiz=null, tVistaL=0;
  const datos=()=>NV.mundo.aguasDatos();
  const datosDe=id=>datos().find(d=>d.id===id)||null;
  function libre(t){ const u=new Set(datos().map(d=>d.id)); let n=1; while(u.has(t+'-'+n)) n++; return t+'-'+n; }
  const tol=()=>Math.max(0.9,9/CPM);      // cuánto es "cerca de un punto", en metros: unos 9 caracteres de ancho

  /* ---------- escribir en el mundo ---------- */
  const escribir=(id,d,aviso)=>E.hacer({t:'agua',id,datos:d},aviso);
  function recrear(d,cambios){
    /* pasa por el motor para que los números queden normalizados y validados; la semilla y el id se conservan */
    const n=Object.assign(copia(d),cambios||{});
    const c=A().crear(n.tipo,n); return A().aDatos(c);
  }
  const refrescar=()=>{ E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); };
  function vista(d){ A().vista(d); refrescar(); }
  function limpiar(){ A().vista(null); }

  /* ---------- geometría ---------- */
  const puntosDe=d=>d.tipo==='cascada'?[[d.x,d.y]]:esEst(d.tipo)?d.poligono:d.curso.puntos;
  function puntoCerca(d,x,y){ const P=puntosDe(d); let best=tol(),bi=-1; P.forEach((q,i)=>{ const k=Math.hypot(q[0]-x,q[1]-y); if(k<best){ best=k; bi=i; } }); return bi; }
  function aristaCerca(d,x,y){
    const P=puntosDe(d), n=P.length, cerrado=esEst(d.tipo); let best=tol()*1.3,bi=-1,bq=null;
    for(let i=0;i<(cerrado?n:n-1);i++){ const a=P[i], b=P[(i+1)%n], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy; let u=l2>0?((x-a[0])*dx+(y-a[1])*dy)/l2:0; u=clamp(u,0,1);
      const qx=a[0]+dx*u, qy=a[1]+dy*u, k=Math.hypot(qx-x,qy-y); if(k<best){ best=k; bi=i; bq=[qx,qy]; } }
    return bi<0?null:{i:bi,p:bq};
  }
  const mover=(d,dx,dy)=>{ const n=copia(d); if(n.tipo==='cascada'){ n.x+=dx; n.y+=dy; } else { for(const p of puntosDe(n)){ p[0]+=dx; p[1]+=dy; } for(const q of (n.piedras||[])){ q.x+=dx; q.y+=dy; } } return n; };

  /* ---------- el puntero ---------- */
  function puntero(e){
    const cv=$e('cv'), r=cv.getBoundingClientRect();
    const col=Math.floor((e.clientX-r.left-(NV.desplaceX||0))/cw), fil=Math.floor((e.clientY-r.top-(NV.desplaceY||0))/chh);
    if(col<0||fil<0||col>=cols||fil>=rowsN) return null;
    const q=NV.casillaEn(col,fil); return {wx:q.wx,wy:q.wy};
  }

  /* ---------- el lápiz: a mano alzada ---------- */
  /* Douglas-Peucker: deja los puntos que de verdad cambian la forma (tol en metros) */
  function simplificar(P,tol){
    if(P.length<3) return P.slice();
    const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1; const pila=[[0,P.length-1]];
    while(pila.length){
      const [a,b]=pila.pop(); let mx=0,mi=-1; const A0=P[a], B0=P[b], dx=B0[0]-A0[0], dy=B0[1]-A0[1], l2=dx*dx+dy*dy;
      for(let i=a+1;i<b;i++){ let t=l2>0?((P[i][0]-A0[0])*dx+(P[i][1]-A0[1])*dy)/l2:0; t=clamp(t,0,1); const d=Math.hypot(P[i][0]-(A0[0]+dx*t),P[i][1]-(A0[1]+dy*t)); if(d>mx){ mx=d; mi=i; } }
      if(mx>tol&&mi>0){ keep[mi]=1; pila.push([a,mi],[mi,b]); }
    }
    return P.filter((_,i)=>keep[i]);
  }
  function puntosDeLapiz(){
    if(!lapiz) return null;
    let P=lapiz.pts, tol=0.35, R=simplificar(P,tol);
    while(R.length>70&&tol<4){ tol*=1.4; R=simplificar(P,tol); }
    /* un contorno cerrado a mano casi nunca cierra justo: se quita el último punto si queda pegado al primero */
    if(esEst(tipo)&&R.length>3&&Math.hypot(R[0][0]-R[R.length-1][0],R[0][1]-R[R.length-1][1])<1.2) R.pop();
    return R.map(p=>[Math.round(p[0]*8)/8,Math.round(p[1]*8)/8]);
  }
  function vistaLapiz(){
    const R=puntosDeLapiz(); if(!R) return;
    try{
      if(esEst(tipo)){ if(R.length<3){ limpiar(); return; } A().vista(A().aDatos(A().crear(tipo,Object.assign(paramsNuevos(),{id:'__vista',poligono:R,sem:1})))); }
      else { if(R.length<2){ limpiar(); return; } A().vista(A().aDatos(A().crear(tipo,Object.assign(paramsNuevos(),{id:'__vista',curso:{puntos:R,anchos:null},sem:1})))); }
    }catch(err){ limpiar(); }
  }
  function terminarLapiz(){
    const R=puntosDeLapiz(), largo=lapiz?lapiz.pts.reduce((a,p,i,q)=>i?a+Math.hypot(p[0]-q[i-1][0],p[1]-q[i-1][1]):0,0):0; lapiz=null; limpiar();
    if(!R||largo<2||R.length<(esEst(tipo)?3:2)){ E.decir('El trazo quedó muy corto: dibujá más largo.'); refrescar(); return; }
    trazo=R; crearDesdeTrazo();
  }

  /* ---------- trazar un cuerpo nuevo ---------- */
  function paramsNuevos(){ return Object.assign({},pincel); }
  function crearDesdeTrazo(){
    const P=trazo.map(p=>[Math.round(p[0]*4)/4,Math.round(p[1]*4)/4]), t=tipo; trazo=null; limpiar();
    const id=libre(t); let c;
    try{
      if(esEst(t)){ if(P.length<3){ E.decir('Un contorno necesita al menos tres puntos.'); return; } c=A().crear(t,Object.assign(paramsNuevos(),{id,poligono:P,sem:(Date.now()&0xffff)})); }
      else { if(P.length<2){ E.decir('Un recorrido necesita al menos dos puntos.'); return; } c=A().crear(t,Object.assign(paramsNuevos(),{id,curso:{puntos:P,anchos:null},sem:(Date.now()&0xffff)})); }
    }catch(err){ E.decir('No se pudo crear: '+err.message); return; }
    if(escribir(id,A().aDatos(c),A().NOMBRES[t]+' creado.')){ sel=id; cargarUI(); }
    refrescar();
  }
  function vistaTrazo(){
    if(!trazo||!trazo.length||!cur){ limpiar(); return; }
    const P=trazo.concat([[cur.wx,cur.wy]]);
    try{
      if(esEst(tipo)){ if(P.length<3){ limpiar(); return; } A().vista(A().aDatos(A().crear(tipo,Object.assign(paramsNuevos(),{id:'__vista',poligono:P,sem:1})))); }
      else { if(P.length<2){ limpiar(); return; } A().vista(A().aDatos(A().crear(tipo,Object.assign(paramsNuevos(),{id:'__vista',curso:{puntos:P,anchos:null},sem:1})))); }
    }catch(err){ limpiar(); }
  }

  /* ---------- el ratón y el teclado ---------- */
  function bajar(e){
    const p=puntero(e); if(!p) return; cur=p;
    const ahora=Date.now();
    if(e.button===2){
      if(e.ctrlKey) return;
      if(trazo){ trazo.pop(); vistaTrazo(); refrescar(); return; }
      const d=sel&&datosDe(sel);
      if(d&&d.tipo!=='cascada'){ const i=puntoCerca(d,p.wx,p.wy); if(i>=0){ quitarPunto(d,i); return; } }
      const c=A().cuerpoEn(p.wx,p.wy); if(c) borrar(c.id); else E.decir('Ahí no hay agua.'); return;
    }
    if(e.button!==0) return;
    if(trazo){
      const P=trazo, cerrar=esEst(tipo)&&P.length>=3&&Math.hypot(P[0][0]-p.wx,P[0][1]-p.wy)<tol()*1.4;
      const doble=ahora-ultClic<320&&P.length>=1&&Math.hypot(P[P.length-1][0]-p.wx,P[P.length-1][1]-p.wy)<tol();
      ultClic=ahora;
      if(cerrar||doble){ crearDesdeTrazo(); return; }
      P.push([p.wx,p.wy]); vistaTrazo(); refrescar(); return;
    }
    ultClic=ahora;
    const d=sel&&datosDe(sel);
    if(d){
      if(e.shiftKey&&d.tipo!=='cascada'){ const a=aristaCerca(d,p.wx,p.wy); if(a){ agregarPunto(d,a); return; } }
      if(d.tipo!=='cascada'){ const i=puntoCerca(d,p.wx,p.wy); if(i>=0){ drag={tipo:'punto',id:d.id,i,orig:copia(d),movido:false}; return; } }
    }
    const c=A().cuerpoEn(p.wx,p.wy);
    if(c&&!e.altKey){
      const dd=datosDe(c.id)||A().aDatos(c);
      if(c.id!==sel){ sel=c.id; tipo=c.tipo; cargarUI(); refrescar(); return; }
      drag={tipo:'cuerpo',id:c.id,ox:p.wx,oy:p.wy,orig:copia(dd),movido:false}; return;
    }
    /* suelo vacío: empieza algo nuevo */
    sel=null; cargarUI();
    if(tipo==='cascada'){
      const id=libre('cascada'); let c2; try{ c2=A().crear('cascada',Object.assign(paramsNuevos(),{id,x:Math.round(p.wx*4)/4,y:Math.round(p.wy*4)/4,sem:(Date.now()&0xffff)})); }catch(err){ E.decir('No se pudo crear: '+err.message); return; }
      if(escribir(id,A().aDatos(c2),'Cascada creada.')){ sel=id; cargarUI(); }
      refrescar(); return;
    }
    if(modoTrazo==='lapiz'){ lapiz={pts:[[p.wx,p.wy]]}; tVistaL=0; refrescar(); return; }
    trazo=[[p.wx,p.wy]]; vistaTrazo(); refrescar();
  }
  function moverRaton(e){
    const p=puntero(e); cur=p;
    if(lapiz&&p){
      const u=lapiz.pts[lapiz.pts.length-1];
      if(Math.hypot(u[0]-p.wx,u[1]-p.wy)>=0.45){ lapiz.pts.push([p.wx,p.wy]); const t=Date.now(); if(t-tVistaL>90){ tVistaL=t; vistaLapiz(); } }
      refrescar(); return;
    }
    if(drag&&p){
      const d=drag.orig;
      if(drag.tipo==='punto'){
        const n=copia(d), q=puntosDe(n)[drag.i]; q[0]=Math.round(p.wx*8)/8; q[1]=Math.round(p.wy*8)/8; if(n.tipo==='cascada'){ n.x=q[0]; n.y=q[1]; }
        drag.movido=true; try{ vista(recrear(n)); }catch(err){}
      } else {
        const dx=Math.round((p.wx-drag.ox)*4)/4, dy=Math.round((p.wy-drag.oy)*4)/4;
        if(dx||dy){ drag.movido=true; drag.dx=dx; drag.dy=dy; vista(mover(d,dx,dy)); }
      }
    } else if(trazo){ vistaTrazo(); }
    refrescar();
  }
  function soltar(){
    if(lapiz){ terminarLapiz(); return; }
    if(!drag) return; const d0=drag; drag=null;
    if(!d0.movido){ limpiar(); refrescar(); return; }
    const d=datosDe(d0.id); if(!d){ limpiar(); return; }
    let n;
    if(d0.tipo==='punto'&&cur){ n=copia(d0.orig); const q=puntosDe(n)[d0.i]; q[0]=Math.round(cur.wx*8)/8; q[1]=Math.round(cur.wy*8)/8; }
    else n=mover(d0.orig,d0.dx||0,d0.dy||0);
    limpiar();
    try{ escribir(d0.id,recrear(n),d0.tipo==='punto'?'Punto movido.':'Cuerpo de agua movido.'); }catch(err){ E.decir('No se pudo: '+err.message); }
    refrescar();
  }
  function agregarPunto(d,a){
    const n=copia(d), P=puntosDe(n), q=[Math.round(a.p[0]*8)/8,Math.round(a.p[1]*8)/8];
    P.splice(a.i+1,0,q);
    if(n.curso&&n.curso.anchos){ const w=n.curso.anchos; w.splice(a.i+1,0,(w[a.i]+(w[a.i+1]!==undefined?w[a.i+1]:w[a.i]))/2); }
    try{ escribir(d.id,recrear(n),'Punto agregado.'); }catch(err){ E.decir('No se pudo: '+err.message); }
    refrescar();
  }
  function quitarPunto(d,i){
    const min=esEst(d.tipo)?3:2, P=puntosDe(d);
    if(P.length<=min){ E.decir(esEst(d.tipo)?'Un contorno necesita al menos tres puntos.':'Un recorrido necesita al menos dos puntos.'); return; }
    const n=copia(d); puntosDe(n).splice(i,1); if(n.curso&&n.curso.anchos) n.curso.anchos.splice(i,1);
    try{ escribir(d.id,recrear(n),'Punto quitado.'); }catch(err){ E.decir('No se pudo: '+err.message); }
    refrescar();
  }
  function borrar(id){ limpiar(); if(escribir(id,null,'Cuerpo de agua borrado.')&&sel===id){ sel=null; cargarUI(); } refrescar(); }
  function tecla(e,k){
    if(e.ctrlKey||e.metaKey) return false;
    if(k==='escape'){ if(lapiz){ lapiz=null; limpiar(); refrescar(); return true; } if(trazo){ trazo=null; limpiar(); refrescar(); return true; } if(drag){ drag=null; limpiar(); refrescar(); return true; } if(sel){ sel=null; cargarUI(); refrescar(); return true; } return false; }
    if((k==='enter')&&trazo){ crearDesdeTrazo(); return true; }
    if(k==='delete'&&sel){ borrar(sel); return true; }
    return false;
  }

  /* ---------- los controles ---------- */
  /* solo: 'e' estancadas · 'c' cursos · 'k' cascada · 'a' todo lo que no sea cascada */
  const PARAMS=[
    ['Profundidad y color',null,'a'],
    ['prof','Profundidad máx. (m)',0.05,12,0.05,'a'],
    ['claridad','Claridad (m)',0.1,8,0.05,'a'],
    ['opacidad','Opacidad',0,1,0.01,'a'],
    ['tono','Tono (verde ↔ azul)',0,1,0.01,'a'],
    ['Oleaje y reflejo',null,'a'],
    ['ondas','Intensidad de las ondas',0,2,0.01,'a'],
    ['viento','Respuesta al viento',0,1.5,0.01,'a'],
    ['reflejo','Reflejo',0,1.5,0.01,'a'],
    ['Forma y orilla',null,'a'],
    ['suave','Curvatura (0 = recto)',0,1,0.01,'a'],
    ['sinuosidad','Sinuosidad del cauce',0,3,0.01,'c'],
    ['irreg','Irregularidad de bordes',0,3,0.01,'a'],
    ['entierro','Entierro en el terreno (m)',0,3,0.05,'a'],
    ['humedad','Humedad de la orilla (m)',0.1,2,0.05,'a'],
    ['talud','Pendiente de la orilla (m)',0.1,8,0.05,'e'],
    ['Corriente',null,'c'],
    ['vel','Velocidad (m/s; 0 = reposo)',0,3,0.01,'c'],
    ['ancho','Ancho (m)',0.3,20,0.1,'c'],
    ['Cascada',null,'k'],
    ['alto','Altura (m)',0.8,20,0.1,'k'],
    ['anchoK','Ancho de la caída (m)',0.8,10,0.1,'k'],
    ['intensidad','Intensidad',0.1,1.6,0.01,'k'],
    ['espuma','Espuma',0,2,0.01,'k']
  ];
  function html(){
    const opt=(v,tx)=>'<option value="'+v+'">'+tx+'</option>';
    const fila=(et,ctl,solo)=>'<div class="trow" data-solo="'+(solo||'t')+'"><span class="tet">'+et+'</span><span class="tctl">'+ctl+'</span></div>';
    const cab=(x,solo)=>'<div class="tcab" data-solo="'+(solo||'t')+'">'+x+'</div>';
    let izq=cab('Tipo de agua')+fila('Tipo','<select id="aguTipo">'+A().TIPOS_ID.map(t=>opt(t,A().NOMBRES[t])).join('')+'</select>');
    izq+='<div class="fila"><button id="aguPuntos" class="on" title="Clic para cada punto">puntos</button><button id="aguLapiz" title="Dibujar a mano alzada, arrastrando">lápiz</button></div>';
    izq+='<div class="tnota" id="aguAyuda"></div>';
    izq+='<div class="fila"><button id="aguRegen" title="Otra semilla: sólo cambia este cuerpo">regenerar sector</button><button id="aguInvertir" title="Invierte el sentido de la corriente">invertir corriente</button></div>';
    izq+='<div class="fila"><button id="aguBorrar" title="Supr o clic derecho">borrar</button><button id="aguSoltar" title="Esc">soltar</button></div>';
    const out=[[],[]];
    PARAMS.forEach((q,i)=>{
      const dest=i<9?0:1;
      if(q[1]===null){ out[dest].push(cab(q[0],q[2])); return; }
      out[dest].push(fila(q[1],'<input type="range" data-k="'+q[0]+'" min="'+q[2]+'" max="'+q[3]+'" step="'+q[4]+'"><span class="tval" data-v="'+q[0]+'"></span>',q[5]));
    });
    return '<div class="tcols"><div class="tcol">'+izq+out[0].join('')+'</div><div class="tcol">'+out[1].join('')+'</div></div>';
  }
  const raiz=()=>$e('diosAguas');
  const campos=()=>raiz()?Array.from(raiz().querySelectorAll('[data-k]')):[];
  const tipoActual=()=>{ const d=sel&&datosDe(sel); return d?d.tipo:tipo; };
  function valorCampo(d,k){
    if(d.tipo==='cascada'){ if(k==='anchoK') return d.ancho; if(k==='alto'||k==='intensidad'||k==='espuma') return d[k]; return null; }
    if(k==='ancho'){ if(!d.curso) return null; const a=d.curso.anchos; return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:d.ancho; }
    if(k==='alto'||k==='anchoK'||k==='intensidad'||k==='espuma') return null;
    return d[k];
  }
  const nuevoBase=t=>t==='cascada'?A().CASCADA0:A().TIPOS[t];
  function baseDe(){ const d=sel&&datosDe(sel); if(d) return d; const b=Object.assign({},nuevoBase(tipo),pincel); return Object.assign({tipo},b,{curso:esCur(tipo)?{anchos:null}:undefined}); }
  function cargarUI(){
    const d=baseDe(), t=d.tipo||tipo;
    const sTipo=raiz()&&raiz().querySelector?raiz().querySelector('#aguTipo'):null; if(sTipo) sTipo.value=t;
    for(const el of campos()){ const k=el.dataset.k; let v=valorCampo(d,k); if(v==null) v=(el.dataset.k==='ancho'&&A().TIPOS[t]&&A().TIPOS[t].ancho)||0; el.value=String(v); mostrarVal(el); }
    /* sólo las filas que valen para este tipo */
    const fam=t==='cascada'?'k':esEst(t)?'e':'c';
    if(raiz()&&raiz().querySelectorAll) for(const f of raiz().querySelectorAll('[data-solo]')){ const s=f.dataset.solo; const ver=s==='t'||(s==='a'&&fam!=='k')||s===fam; f.style.display=ver?'':'none'; }
    ayuda();
  }
  function ayuda(){
    const el=raiz()&&raiz().querySelector?raiz().querySelector('#aguAyuda'):null; if(!el) return;
    const t=tipoActual();
    if(!sel&&modoTrazo==='lapiz'&&tipo!=='cascada'){ el.textContent='Lápiz: arrastrá sobre el suelo dibujando '+(esEst(tipo)?'el contorno (se cierra solo al soltar)':'el recorrido (corre en el sentido en que lo dibujás)')+'. Se suaviza solo.'; return; }
    el.textContent=sel?'Elegido: '+sel+'. Arrastrá un punto del contorno para cambiarlo; Mayús + clic en el borde agrega uno; clic derecho en un punto lo quita.'
      :(t==='cascada'?'Un clic en el punto donde cae el agua.':esEst(t)?'Clic para poner el contorno. Intro, doble clic o clic en el primer punto lo cierra.':'Clic para trazar el recorrido (corre en el sentido del trazo). Intro o doble clic lo termina.');
  }
  function mostrarVal(el){
    const v=raiz()&&raiz().querySelector?raiz().querySelector('[data-v="'+el.dataset.k+'"]'):null; if(!v) return;
    const x=+el.value; v.textContent=(el.dataset.k==='opacidad'||el.dataset.k==='tono'||el.dataset.k==='ondas'||el.dataset.k==='viento'||el.dataset.k==='reflejo'||el.dataset.k==='irreg'||el.dataset.k==='intensidad'||el.dataset.k==='espuma'||el.dataset.k==='suave'||el.dataset.k==='sinuosidad')?Math.round(x*100)+'%':x.toFixed(2);
  }
  /* un cambio {campo:valor} sobre los datos de un cuerpo */
  function parchar(d,k,v){
    const n=copia(d);
    const propio=k==='ancho'?!!n.curso:(k==='alto'||k==='anchoK'||k==='intensidad'||k==='espuma')?n.tipo==='cascada':(k==='vel'||k==='sinuosidad')?!!n.curso:(k==='talud')?!!n.poligono:n.tipo!=='cascada';
    if(!propio) return null;               // un control que no es de este tipo de agua no hace nada
    if(n.tipo==='cascada'){ if(k==='anchoK') n.ancho=v; else n[k]=v; return recrear(n); }
    if(k==='ancho'){
      const a=n.curso.anchos&&n.curso.anchos.length?n.curso.anchos:n.curso.puntos.map(()=>n.ancho||v), m=a.reduce((x,y)=>x+y,0)/a.length||1;
      n.curso.anchos=a.map(w=>Math.max(0.3,w*v/m)); n.ancho=v; return recrear(n);
    }
    n[k]=v; return recrear(n);
  }
  function cambio(el,fijar){
    const k=el.dataset.k, v=+el.value, d=sel&&datosDe(sel);
    if(d){
      let n; try{ n=parchar(d,k,v); }catch(err){ E.decir('No se pudo: '+err.message); return; }
      if(!n) return;
      if(!fijar){ vista(n); return; }
      limpiar(); escribir(d.id,n); refrescar();
    } else { pincel[k==='anchoK'?'ancho':k]=v; if(k==='ancho') pincel.ancho=v; mostrarVal(el); }
  }
  function cambiarTipo(t){
    const d=sel&&datosDe(sel);
    if(!d){ tipo=t; pincel={}; trazo=null; limpiar(); cargarUI(); refrescar(); return; }
    const misma=(esEst(d.tipo)&&esEst(t))||(esCur(d.tipo)&&esCur(t));
    if(!misma){ sel=null; tipo=t; pincel={}; trazo=null; limpiar(); E.decir('Ahora se traza '+A().NOMBRES[t].toLowerCase()+' nuevo (un '+A().NOMBRES[d.tipo].toLowerCase()+' no se convierte en eso).'); cargarUI(); refrescar(); return; }
    const base=copia(A().TIPOS[t]); const n=copia(d); for(const k in base) if(k!=='lam'&&k!=='ramp'&&k!=='estancada'&&k!=='fondoVis') n[k]=base[k]; n.tipo=t; n.lam=base.lam.slice();
    if(n.curso) n.curso.anchos=null;
    try{ escribir(d.id,recrear(n),'Ahora es '+A().NOMBRES[t].toLowerCase()+'.'); tipo=t; }catch(err){ E.decir('No se pudo: '+err.message); }
    cargarUI(); refrescar();
  }

  /* ---------- lo que se ve ---------- */
  function estado(){
    if(sel&&!datosDe(sel)) sel=null;
    if(lapiz) return '<b>Lápiz</b> · '+A().NOMBRES[tipo]+'\nSoltá el clic para terminar el trazo · Esc cancela';
    if(trazo){ const n=trazo.length; return '<b>'+A().NOMBRES[tipo]+'</b> · '+n+' punto'+(n===1?'':'s')+'\n'+(esEst(tipo)?'Intro, doble clic o clic en el primer punto: cerrar':'Intro o doble clic: terminar')+'\nClic derecho: quita el último · Esc cancela'; }
    const d=sel&&datosDe(sel);
    if(d){ const n=puntosDe(d).length; return '<b>'+A().NOMBRES[d.tipo]+'</b> · '+d.id+(d.tipo==='cascada'?' · '+d.alto+' m de caída':' · '+n+' puntos')+'\nLos controles lo editan · arrastrá un punto o el cuerpo\nSupr o clic derecho: borrar · Esc: soltar'; }
    return '<b>Aguas continentales</b> · '+A().NOMBRES[tipo]+(modoTrazo==='lapiz'&&tipo!=='cascada'?' · lápiz':'')+'\n'+(tipo==='cascada'?'Clic: coloca una cascada':modoTrazo==='lapiz'?'Arrastrá: dibuja a mano alzada':esEst(tipo)?'Clic: pone el contorno':'Clic: traza el recorrido')+'\nClic en un cuerpo de agua: lo elige';
  }
  const cruz=(x,y,color)=>{
    const c0=Math.round((x-camX)*CPM), r0=Math.floor((y-camY)*RPM);
    ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(x,y)*HPM); pickId=0;
    for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,color);
    layer=0; alzaR=0;
  };
  const punto=(x,y,color)=>{
    const c0=Math.round((x-camX)*CPM), r0=Math.floor((y-camY)*RPM);
    ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(x,y)*HPM); pickId=0;
    for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) put(c0+dx,r0+dy,35,color);
    layer=0; alzaR=0;
  };
  function linea(P,cerrado,color){
    const n=P.length;
    for(let i=0;i<(cerrado?n:n-1);i++){ const a=P[i], b=P[(i+1)%n], L=Math.hypot(b[0]-a[0],b[1]-a[1]), m=Math.max(1,Math.round(L/1.2)); for(let k=0;k<m;k++) cruz(a[0]+(b[0]-a[0])*k/m,a[1]+(b[1]-a[1])*k/m,color); }
  }
  function pintar(){
    const oro=packc(ORO[0],ORO[1],ORO[2]), vivo=packc(ORO_VIVO[0],ORO_VIVO[1],ORO_VIVO[2]);
    for(const d of datos()) if(d.id!==sel){ if(d.tipo==='cascada') punto(d.x,d.y,oro); else linea(puntosDe(d),esEst(d.tipo),oro); }
    if(lapiz){ linea(lapiz.pts,false,vivo); return; }
    if(trazo){ const P=trazo.concat(cur?[[cur.wx,cur.wy]]:[]); linea(P,false,vivo); for(const q of trazo) punto(q[0],q[1],vivo); return; }
    const d=sel&&datosDe(sel);
    if(d){
      let v=d; if(drag&&drag.movido&&cur){ try{ v=(drag.tipo==='punto')?(()=>{ const n=copia(drag.orig); const q=puntosDe(n)[drag.i]; q[0]=cur.wx; q[1]=cur.wy; if(n.tipo==='cascada'){ n.x=cur.wx; n.y=cur.wy; } return n; })():mover(drag.orig,drag.dx||0,drag.dy||0); }catch(e){} }
      if(v.tipo==='cascada') punto(v.x,v.y,vivo); else { linea(puntosDe(v),esEst(v.tipo),vivo); for(const q of puntosDe(v)) punto(q[0],q[1],vivo); }
    }
    if(cur&&!drag) cruz(cur.wx,cur.wy,vivo);
  }

  /* ---------- el registro en el editor ---------- */
  E.modos.aguas={
    bajar,mover:moverRaton,soltar,tecla,estado,pintar,
    abrir(){ cargarUI(); },
    cerrar(){ drag=null; trazo=null; lapiz=null; limpiar(); sel=null; cur=null; },
    iniciar(){
      const r=raiz(); if(!r) return;
      r.innerHTML=html();
      for(const el of campos()){
        el.addEventListener('input',()=>{ mostrarVal(el); cambio(el,false); });
        el.addEventListener('change',()=>cambio(el,true));
      }
      const q=id=>r.querySelector?r.querySelector('#'+id):null;
      const bind=(id,f)=>{ const b=q(id); if(b) b.addEventListener('click',f); };
      const st=q('aguTipo'); if(st) st.addEventListener('change',()=>cambiarTipo(st.value));
      const ponerModo=m=>{ modoTrazo=m; trazo=null; lapiz=null; limpiar(); const a=q('aguPuntos'), l=q('aguLapiz'); if(a) a.classList.toggle('on',m==='puntos'); if(l) l.classList.toggle('on',m==='lapiz'); ayuda(); refrescar(); };
      bind('aguPuntos',()=>ponerModo('puntos')); bind('aguLapiz',()=>ponerModo('lapiz'));
      bind('aguRegen',()=>{ const d=sel&&datosDe(sel); if(!d){ E.decir('Elegí un cuerpo de agua.'); return; } const n=copia(d); n.sem=((n.sem||0)+1+(Date.now()&0x3ff))|0; escribir(d.id,recrear(n),'Sector regenerado: sólo cambió este cuerpo.'); refrescar(); });
      bind('aguInvertir',()=>{ const d=sel&&datosDe(sel); if(!d||!d.curso){ E.decir('Elegí un río o un arroyo.'); return; } const n=copia(d); n.curso.puntos.reverse(); if(n.curso.anchos) n.curso.anchos.reverse(); escribir(d.id,recrear(n),'Corriente invertida.'); refrescar(); });
      bind('aguBorrar',()=>{ if(sel) borrar(sel); else E.decir('Elegí un cuerpo de agua.'); });
      bind('aguSoltar',()=>{ trazo=null; drag=null; limpiar(); sel=null; cargarUI(); refrescar(); });
      addEventListener('pointerup',soltar); addEventListener('pointercancel',soltar);
      cargarUI();
    },
    /* para las pruebas */
    _estado:()=>({sel,tipo,trazo:trazo&&trazo.length,drag:!!drag,pincel,modoTrazo,lapiz:lapiz&&lapiz.pts.length}), _modo:m=>{ modoTrazo=m; }, _elegir:id=>{ sel=id; if(id){ const d=datosDe(id); if(d) tipo=d.tipo; } }, _tipo:t=>{ tipo=t; pincel={}; trazo=null; },
    _cambio:(k,v)=>{ const d=sel&&datosDe(sel); if(!d) return false; const n=parchar(d,k,v); if(!n) return false; escribir(d.id,n); return true; }, _tipoCambio:cambiarTipo
  };
})(window.NV);
