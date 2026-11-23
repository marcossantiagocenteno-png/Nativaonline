/* Nativa Online — LABORATORIO DE CAMINOS (independiente del juego).
   No toca ningún archivo del juego. Carga la base del motor, el PASTO REAL (src/juego/pasto.js,
   sin cambiarle nada) y el motor de caminos (src/juego/caminos.js). Cada casilla que se ve la
   calculó el motor: acá sólo se arma la grilla, se pinta el pasto y se le pregunta al motor, casilla
   por casilla, si el camino la cubre y con qué glifo y color.

   Orden de pintado = el del juego (drawGroundRow): de norte a sur, por metro; en cada metro primero
   el pasto y encima el camino. Así los trazos de pasto del metro de más al sur, que suben unas filas,
   se montan sobre el borde sur del camino, y el pasto no queda "pegado debajo" sino alrededor.

   Tres vistas:
     Galería  cuatro familias × tres variantes (natural, intermedia, detallada), el mismo camino en
              las tres para poder compararlas, y un botón para regenerar cada familia.
     Banco    una muestra grande con todos los parámetros de la familia, la geometría a elección y
              una referencia fijada al lado para comparar antes/después.
     Barrido  una misma familia con UN parámetro variando en cuatro pasos: anchuras, bordes,
              transiciones, piedras... */
(function(){
'use strict';
const NV=window.NV, C=NV.caminos;
const CPMl=13, RPMl=4, ASP=1.393, FONT_K=1/0.42;            // el zoom estándar del juego
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---- el puente con el pasto del juego: pasto.js llama a put/packc/tex2 como globales ---- */
const tn=NV.makeNoise(NV.mulberry(31771));                  // el mismo ruido que usa dibujar.js
window.tex2=(wx,wy,e)=>0.66*tn(wx/e,wy/e,1,1)+0.34*tn(wx/(e*0.42)+37,wy/(e*0.42),1,1);
window.packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
let GR=null;
window.put=(c,r,ch,col)=>{ if(c<0||c>=GR.cols||r<0||r>=GR.rows) return; const i=r*GR.cols+c; GR.G[i]=ch; GR.C[i]=col; };

/* ---- geometrías de prueba: cada una devuelve especificaciones de camino en metros locales ---- */
const GEOMETRIAS={
  recto:       'Recto',
  curvo:       'Curvo',
  sinuoso:     'Sinuoso',
  sendero:     'Sendero irregular',
  bifurca:     'Se bifurca',
  interseccion:'Intersección',
  conecta:     'Conecta dos puntos',
  destino:     'Termina en un destino'
};
function geometria(nombre,mw,mh,sem){
  const a=[0.4,mh*0.62], b=[mw-0.4,mh*0.40];
  switch(nombre){
    case 'recto':   return [{puntos:C.recto([0.2,mh*0.58],[mw-0.2,mh*0.42])}];
    case 'curvo':   return [{puntos:C.curvo(a,b,0.13)}];
    case 'sinuoso': return [{puntos:C.sinuoso([0.2,mh*0.52],[mw-0.2,mh*0.48],{amp:0.15,ondas:2.2,semilla:sem})}];
    case 'sendero': return [{puntos:C.sendero([0.2,mh*0.6],[mw-0.2,mh*0.4],{semilla:sem,amp:1.4})}];
    case 'bifurca': return [{puntos:C.curvo(a,[mw-0.4,mh*0.36],0.10),hijo:{f:0.42,hacia:[mw-0.6,mh*0.94]}}];
    case 'interseccion': return [{puntos:C.recto([0.2,mh*0.56],[mw-0.2,mh*0.44])},
                                 {puntos:C.curvo([mw*0.36,0.4],[mw*0.62,mh-0.4],-0.10),ancho:0.85}];
    case 'conecta': return [{puntos:C.conectar([1.6,mh*0.28],[mw-2.4,mh*0.74],{semilla:sem})}];
    case 'destino': return [{puntos:C.sinuoso([0.2,mh*0.66],[mw*0.7,mh*0.42],{amp:0.10,ondas:1.4,semilla:sem}),fin:'plaza'}];
  }
  throw new Error('geometría desconocida: '+nombre);
}
/* arma los caminos del motor para una muestra */
function armar(o){
  const mw=o.mw, mh=o.mh, x0=o.x0, y0=o.y0, lista=[];
  const specs=geometria(o.geom,mw,mh,o.semTrazado);
  specs.forEach((sp,i)=>{
    const pts=sp.puntos.map(p=>[p[0]+x0,p[1]+y0]);
    const params=Object.assign({},o.params); if(sp.ancho) params.ancho=sp.ancho;
    const c=C.nuevo({id:'lab-'+i,familia:o.fam,puntos:pts,params,semTrazado:o.semTrazado+i*97,semTextura:o.semTextura,fin:sp.fin||'redondo'});
    lista.push(c);
    if(sp.hijo){
      lista.push(C.bifurcar(c,sp.hijo.f,[sp.hijo.hacia[0]+x0,sp.hijo.hacia[1]+y0],{semilla:o.semTrazado+5,id:'lab-h'+i,params:o.params,ancho:o.params.ancho*0.8}));
    }
  });
  return lista;
}

/* ---- pintar una muestra: pasto del juego + camino del motor ---- */
function renderMuestra(o){
  const cols=Math.round(o.mw*CPMl), rows=Math.round(o.mh*RPMl);
  GR={cols,rows,G:new Uint16Array(cols*rows),C:new Int32Array(cols*rows)};
  const lista=armar(o), lf=o.luz, sal=C.sal;
  for(let my=0;my<o.mh;my++){
    for(let mx=0;mx<o.mw;mx++){
      const wxm=o.x0+mx, wym=o.y0+my, base=mx*CPMl;
      window.pastoPreparar(wxm,wym,true);
      for(let sy=0;sy<RPMl;sy++) window.pastoFranja(wxm,wym,sy,my*RPMl+sy,base,false,lf,0,0,1);
    }
    /* el camino de este metro de fondo, encima del pasto que ya se pintó */
    for(let sy=0;sy<RPMl;sy++){
      const r=my*RPMl+sy, wy=o.y0+my+(sy+0.5)/RPMl, cyb=(o.y0+my)*RPMl+sy;
      for(let c=0;c<cols;c++){
        const wx=o.x0+(c+0.5)/CPMl, cx=o.x0*CPMl+c;
        if(C.celdaRed(wx,wy,lf,cx,cyb,lista)) window.put(c,r,sal.g,sal.c);
      }
    }
  }
  return {grid:GR,lista};
}
function pintarGrid(cv,g,cw){
  const chh=cw*ASP, dpr=Math.min(2,window.devicePixelRatio||1), W=Math.ceil(g.cols*cw), H=Math.ceil(g.rows*chh);
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px';
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='rgb(5,9,8)'; ctx.fillRect(0,0,W,H);
  ctx.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; ctx.textBaseline='middle';
  const adv=ctx.measureText('W').width, canRun=('letterSpacing' in ctx);
  if(canRun){ ctx.textAlign='left'; ctx.letterSpacing=(cw-adv).toFixed(2)+'px'; } else ctx.textAlign='center';
  const x0=canRun?(cw-adv)/2:cw/2;
  for(let r=0;r<g.rows;r++){
    const y=r*chh+chh/2; let start=-1,col=0,buf='';
    for(let c=0;c<=g.cols;c++){
      const i=r*g.cols+c, hay=c<g.cols&&g.G[i];
      if(hay&&(start<0||g.C[i]===col)){ if(start<0){ start=c; col=g.C[i]; buf=''; } buf+=String.fromCharCode(g.G[i]); continue; }
      if(start>=0){
        ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
        if(canRun) ctx.fillText(buf,start*cw+x0,y); else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],(start+q)*cw+x0,y);
        start=-1;
      }
      if(hay){ start=c; col=g.C[i]; buf=String.fromCharCode(g.G[i]); }
    }
  }
}

/* ======================================================================== PÁGINA ==== */
const ESTADO={
  vista:'galeria', cw:2.8, luz:0.9,
  semT:{}, semTr:{},                       // por familia (galería)
  banco:{fam:'tierra',geom:'curvo',params:C.variante('tierra','intermedia'),semTr:11,semT:23,ref:null},
  barrido:{param:'ancho',geom:'recto'}
};
const FAMS=Object.keys(C.FAMILIAS);
const rnd=()=>(Math.random()*60000)|0;
FAMS.forEach((f,i)=>{ ESTADO.semT[f]=101+i*31; ESTADO.semTr[f]=7+i*13; });

const css=document.createElement('style');
css.textContent=
 ':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}'+
 '*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
 '#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
 '#barra label{display:flex;align-items:center;gap:6px;color:var(--dim)}#barra input[type=range]{width:110px;accent-color:var(--oro)}'+
 'button,select,input[type=number]{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
 'button.on{background:var(--oro);color:#000}button:active{background:var(--oro);color:#000}'+
 'h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
 'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:100ch}'+
 '.fila{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px}'+
 'figure{margin:0;border:1px solid #2a2a26;background:#000}figure canvas{display:block}'+
 'figcaption{padding:6px 9px;border-top:1px solid #2a2a26;font-size:12px;display:flex;gap:10px;align-items:center;justify-content:space-between}'+
 'figcaption span{color:var(--dim)}figcaption b{font-weight:600}'+
 '#banco{display:flex;flex-wrap:wrap;gap:14px;padding:0 14px 14px;align-items:flex-start}'+
 '#panel{width:300px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:7px}'+
 '#panel .p{display:grid;grid-template-columns:1fr 70px;gap:2px 8px;align-items:center}'+
 '#panel .p span{color:var(--dim);font-size:12px}#panel .p b{text-align:right;color:var(--oro);font-weight:normal}'+
 '#panel .p input{grid-column:1/3;width:100%;accent-color:var(--oro)}'+
 '#panel .bt{display:flex;flex-wrap:wrap;gap:6px}#panel select{width:100%}'+
 '.rotulo{position:absolute;top:6px;left:8px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}'+
 '.cuadro{position:relative}';
document.head.appendChild(css);
document.title='Laboratorio de caminos — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };

function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['galeria','Galería'],['banco','Banco de pruebas'],['barrido','Barrido de un parámetro']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const l1=el('label',{},['Luz ',el('input',{type:'range',min:40,max:130,value:Math.round(ESTADO.luz*100)})]); l1.lastChild.oninput=e=>{ ESTADO.luz=e.target.value/100; dibujar(); };
  const l2=el('label',{},['Escala ',el('input',{type:'range',min:18,max:48,value:Math.round(ESTADO.cw*10)})]); l2.lastChild.oninput=e=>{ ESTADO.cw=e.target.value/10; dibujar(); };
  b.appendChild(l1); b.appendChild(l2);
  const r=el('button',{textContent:'Regenerar todo'}); r.onclick=()=>{
    FAMS.forEach(f=>{ ESTADO.semT[f]=rnd(); ESTADO.semTr[f]=rnd(); }); ESTADO.banco.semT=rnd(); ESTADO.banco.semTr=rnd(); dibujar(); };
  b.appendChild(r);
}
function muestraFig(o,titulo,extra){
  const cv=el('canvas'); const r=renderMuestra(o); pintarGrid(cv,r.grid,ESTADO.cw);
  const fig=el('figure',{},[el('div',{className:'cuadro'},[cv,el('span',{className:'rotulo',textContent:titulo})]),
    el('figcaption',{},[el('span',{textContent:'trazado '+o.semTrazado+' · textura '+o.semTextura}),...(extra?[extra]:[])])]);
  return fig;
}
const MW=15, MH=14, OX=60, OY=60;
function base(o){ return Object.assign({mw:MW,mh:MH,x0:OX,y0:OY,luz:ESTADO.luz},o); }

/* ---- Galería ---- */
function galeria(cuerpo){
  cuerpo.appendChild(el('h2',{textContent:'Galería: cuatro familias, tres variantes'}));
  cuerpo.appendChild(el('p',{className:'nota',textContent:
    'En cada familia las tres variantes comparten trazado y semilla de textura: lo único que cambia es el nivel de detalle '+
    '(cuántas capas pinta el motor) y un poco la densidad y las partículas. Cada muestra la generó el motor, con el pasto real del juego alrededor.'}));
  for(const f of FAMS){
    const cab=el('div',{style:'display:flex;gap:10px;align-items:center'});
    cab.appendChild(el('h2',{textContent:C.FAMILIAS[f].nombre,style:'flex:0 0 auto'}));
    const b1=el('button',{textContent:'Otra textura',title:'Misma forma del camino, otra piel'}); b1.onclick=()=>{ ESTADO.semT[f]=rnd(); dibujar(); };
    const b2=el('button',{textContent:'Otro trazado',title:'Otro recorrido del camino'}); b2.onclick=()=>{ ESTADO.semTr[f]=rnd(); dibujar(); };
    cab.appendChild(b1); cab.appendChild(b2); cuerpo.appendChild(cab);
    const fila=el('div',{className:'fila'});
    for(const v of Object.keys(C.VARIANTES)){
      const o=base({fam:f,geom:'curvo',params:C.variante(f,v),semTrazado:ESTADO.semTr[f],semTextura:ESTADO.semT[f]});
      const b=el('button',{textContent:'Abrir en el banco'}); b.onclick=()=>{
        Object.assign(ESTADO.banco,{fam:f,params:C.variante(f,v),semTr:ESTADO.semTr[f],semT:ESTADO.semT[f]}); ESTADO.vista='banco'; dibujar(); };
      fila.appendChild(muestraFig(o,v.toUpperCase(),b));
    }
    cuerpo.appendChild(fila);
  }
}

/* ---- Banco ---- */
function banco(cuerpo){
  const B=ESTADO.banco, fam=B.fam;
  cuerpo.appendChild(el('h2',{textContent:'Banco de pruebas'}));
  cuerpo.appendChild(el('p',{className:'nota',textContent:
    'Todos los controles son parámetros reales del motor; cada familia muestra sólo los suyos. "Fijar referencia" congela la muestra de la izquierda para compararla con lo que cambies después.'}));
  const cont=el('div',{id:'banco'}); cuerpo.appendChild(cont);
  const panel=el('div',{id:'panel'}); cont.appendChild(panel);
  const sel=(opts,val,fn)=>{ const s=el('select'); for(const k of Object.keys(opts)){ const o=el('option',{value:k,textContent:opts[k]}); if(k===val) o.selected=true; s.appendChild(o); } s.onchange=()=>fn(s.value); return s; };
  panel.appendChild(el('span',{textContent:'Familia',style:'color:var(--dim)'}));
  panel.appendChild(sel(FAMS.reduce((a,f)=>(a[f]=C.FAMILIAS[f].nombre,a),{}),fam,v=>{ B.fam=v; B.params=C.variante(v,'intermedia'); B.ref=null; dibujar(); }));
  panel.appendChild(el('span',{textContent:'Geometría',style:'color:var(--dim)'}));
  panel.appendChild(sel(GEOMETRIAS,B.geom,v=>{ B.geom=v; dibujar(); }));
  const vb=el('div',{className:'bt'});
  for(const v of Object.keys(C.VARIANTES)){ const b=el('button',{textContent:v}); b.title='Carga los valores de esa variante'; b.onclick=()=>{ B.params=C.variante(fam,v); dibujar(); }; vb.appendChild(b); }
  panel.appendChild(vb);
  const ps=C.parametrosDe(fam);
  for(const k of Object.keys(ps)){
    const P=ps[k], val=B.params[k];
    const lab=el('b',{textContent:(Math.round(val*100)/100)});
    const inp=el('input',{type:'range',min:P.min,max:P.max,step:P.paso,value:val});
    inp.oninput=e=>{ B.params[k]=+e.target.value; lab.textContent=Math.round(B.params[k]*100)/100; clearTimeout(B.t); B.t=setTimeout(()=>refrescarBanco(),30); };
    panel.appendChild(el('div',{className:'p'},[el('span',{textContent:P.etiqueta}),lab,inp]));
  }
  const sm=(txt,get,set)=>{ const i=el('input',{type:'number',value:get(),style:'width:90px'}); i.onchange=()=>{ set(+i.value|0); dibujar(); }; return el('label',{style:'display:flex;gap:6px;align-items:center;color:var(--dim)'},[txt,i]); };
  panel.appendChild(sm('Semilla del trazado',()=>B.semTr,v=>B.semTr=v));
  panel.appendChild(sm('Semilla de la textura',()=>B.semT,v=>B.semT=v));
  const bt=el('div',{className:'bt'});
  const bb=(tx,fn,tt)=>{ const b=el('button',{textContent:tx,title:tt||''}); b.onclick=fn; bt.appendChild(b); };
  bb('Regenerar textura',()=>{ B.semT=rnd(); dibujar(); },'Cambia la piel y deja el recorrido igual');
  bb('Regenerar trazado',()=>{ B.semTr=rnd(); dibujar(); },'Cambia el recorrido');
  bb('Fijar referencia',()=>{ B.ref={fam:B.fam,geom:B.geom,params:Object.assign({},B.params),semTr:B.semTr,semT:B.semT}; dibujar(); });
  bb('Quitar referencia',()=>{ B.ref=null; dibujar(); });
  bb('Valores de la familia',()=>{ B.params=Object.assign({},C.FAMILIAS[fam].def); dibujar(); });
  panel.appendChild(bt);
  const der=el('div',{style:'display:flex;flex-direction:column;gap:12px'}); cont.appendChild(der);
  B._der=der; refrescarBanco();
}
function refrescarBanco(){
  const B=ESTADO.banco, der=B._der; if(!der) return; der.innerHTML='';
  const mw=MW+9, mh=MH+4;
  der.appendChild(muestraFig(base({mw,mh,fam:B.fam,geom:B.geom,params:B.params,semTrazado:B.semTr,semTextura:B.semT}),'ACTUAL · '+C.FAMILIAS[B.fam].nombre));
  if(B.ref) der.appendChild(muestraFig(base({mw,mh,fam:B.ref.fam,geom:B.ref.geom,params:B.ref.params,semTrazado:B.ref.semTr,semTextura:B.ref.semT}),'REFERENCIA · '+C.FAMILIAS[B.ref.fam].nombre));
}

/* ---- Barrido ---- */
function barrido(cuerpo){
  const B=ESTADO.banco, S=ESTADO.barrido, fam=B.fam, ps=C.parametrosDe(fam);
  if(!ps[S.param]) S.param=Object.keys(ps)[0];
  cuerpo.appendChild(el('h2',{textContent:'Barrido: '+C.FAMILIAS[fam].nombre}));
  cuerpo.appendChild(el('p',{className:'nota',textContent:
    'Un solo parámetro cambia en cuatro pasos de su rango; todo lo demás sale del banco de pruebas (misma familia, mismos valores y semillas). '+
    'Sirve para juzgar anchuras, bordes, transiciones con el pasto y la distribución de las piedras.'}));
  const ctl=el('div',{className:'fila',style:'align-items:center'});
  const s1=el('select'); for(const k of Object.keys(ps)){ const o=el('option',{value:k,textContent:ps[k].etiqueta}); if(k===S.param) o.selected=true; s1.appendChild(o); }
  s1.onchange=()=>{ S.param=s1.value; dibujar(); };
  const s2=el('select'); for(const k of Object.keys(GEOMETRIAS)){ const o=el('option',{value:k,textContent:GEOMETRIAS[k]}); if(k===S.geom) o.selected=true; s2.appendChild(o); }
  s2.onchange=()=>{ S.geom=s2.value; dibujar(); };
  const sf=el('select'); for(const k of FAMS){ const o=el('option',{value:k,textContent:C.FAMILIAS[k].nombre}); if(k===fam) o.selected=true; sf.appendChild(o); }
  sf.onchange=()=>{ B.fam=sf.value; B.params=C.variante(B.fam,'intermedia'); B.ref=null; dibujar(); };
  ctl.appendChild(sf); ctl.appendChild(s1); ctl.appendChild(s2); cuerpo.appendChild(ctl);
  const P=ps[S.param], n=S.param==='detalle'?3:4, fila=el('div',{className:'fila'});
  for(let i=0;i<n;i++){
    const v=S.param==='detalle'?i:P.min+(P.max-P.min)*(0.08+0.84*i/(n-1));
    const vv=P.paso>=1?Math.round(v):Math.round(v/P.paso)*P.paso;
    const params=Object.assign({},B.params,{[S.param]:vv});
    fila.appendChild(muestraFig(base({fam,geom:S.geom,params,semTrazado:B.semTr,semTextura:B.semT}),P.etiqueta+' = '+(Math.round(vv*100)/100)));
  }
  cuerpo.appendChild(fila);
}

function dibujar(){
  barra(); const c=$('#cuerpo'); c.innerHTML='';
  (ESTADO.vista==='galeria'?galeria:ESTADO.vista==='banco'?banco:barrido)(c);
}
ESTADO.barrido.geom='recto';
/* se puede abrir ya configurado: caminos.html?vista=banco&familia=empedrado&geom=bifurca */
const q=new URLSearchParams(location.search);
if(q.get('vista')) ESTADO.vista=q.get('vista');
if(q.get('familia')&&C.FAMILIAS[q.get('familia')]){ ESTADO.banco.fam=q.get('familia'); ESTADO.banco.params=C.variante(q.get('familia'),'intermedia'); }
if(q.get('geom')&&GEOMETRIAS[q.get('geom')]) ESTADO.banco.geom=q.get('geom');
if(q.get('param')) ESTADO.barrido.param=q.get('param');
if(q.get('escala')) ESTADO.cw=+q.get('escala');
window.CaminosLab={renderMuestra,armar,geometria,GEOMETRIAS,ESTADO,dibujar};
dibujar();
})();
