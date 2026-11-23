/* Nativa Online — LABORATORIO DE ÁRBOLES (independiente del juego).
   Carga los motores REALES de viento y luz y el pasto del juego, sin cambiarles nada, y el motor de árboles. El
   viento y la luz que ve el árbol son los de NV.entorno.simulado: acá se mueven con deslizadores, que es justo lo
   que prueba que el árbol no trae viento ni luz propios.

   Vistas:
     Galería       cuatro familias × tres tamaños, cada una con su sombra sobre el pasto
     Bosque        todo mezclado, para ver cómo se ven en grupo
     Conexiones    el MISMO árbol bajo cuatro vientos y cuatro posiciones del sol
     Un árbol      uno solo, grande, con todas las variantes de su familia */
(function(){
'use strict';
const NV=window.NV, AR=NV.arbolado, EN=NV.entorno;
const CPMl=13, RPMl=4, HPMl=6.8, ASP=1.393, FONT_K=1/0.42;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---- el puente con el pasto del juego (pasto.js llama a put/packc/tex2 como globales) ---- */
const tn=NV.makeNoise(NV.mulberry(31771));
window.tex2=(wx,wy,e)=>0.66*tn(wx/e,wy/e,1,1)+0.34*tn(wx/(e*0.42)+37,wy/(e*0.42),1,1);
window.packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
let GR=null;
window.put=(c,r,ch,col)=>{ if(c<0||c>=GR.cols||r<0||r>=GR.rows) return; const i=r*GR.cols+c; GR.G[i]=ch; GR.C[i]=col; };

/* ---- las entradas simuladas de los otros motores ---- */
const SIM={viento:{valor:0.0,ciclo:0}, luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}};
EN.usar(EN.simulado(SIM));
const ESTADO={vista:'galeria', cw:2.7, anim:false, t:0, sem:{}, variante:{}, semBosque:5};
const rnd=()=>(Math.random()*60000)|0;
AR.NOMBRES.forEach((f,i)=>{ ESTADO.sem[f]=3+i*17; ESTADO.variante[f]=null; });

/* ---- la escena: pasto del juego, sombras y árboles ---- */
const cacheSuelo=new Map();
function suelo(mw,mh,x0,y0,lf){
  const k=[mw,mh,x0,y0,lf].join('|'); if(cacheSuelo.has(k)) return cacheSuelo.get(k);
  const cols=mw*CPMl, rows=mh*RPMl;
  GR={cols,rows,G:new Uint16Array(cols*rows),C:new Int32Array(cols*rows)};
  for(let my=0;my<mh;my++) for(let mx=0;mx<mw;mx++){
    const wxm=x0+mx, wym=y0+my, base=mx*CPMl;
    window.pastoPreparar(wxm,wym,true);
    for(let sy=0;sy<RPMl;sy++) window.pastoFranja(wxm,wym,sy,my*RPMl+sy,base,false,lf,0,0,1);
  }
  const s={cols,rows,G:GR.G,C:GR.C}; if(cacheSuelo.size>6) cacheSuelo.clear(); cacheSuelo.set(k,s); return s;
}
/* arboles: [{A,x,y}] en metros dentro de la escena (x al este, y al sur; y es el pie del tronco) */
function escena(o){
  const lf=(SIM.luz.amb||1)*0.9, s0=suelo(o.mw,o.mh,60,60,lf);
  GR={cols:s0.cols,rows:s0.rows,G:s0.G.slice(),C:s0.C.slice()};
  const G=GR.G, C=GR.C, cols=GR.cols, rows=GR.rows, t=ESTADO.t;
  const lista=o.arboles.slice().sort((a,b)=>a.y-b.y);
  const ctx=a=>({x:60+a.x,y:60+a.y,t,CPM:CPMl,HPM:HPMl,RPM:RPMl,bc:Math.round(a.x*CPMl),br:Math.round(a.y*RPMl)-1,put:window.put,cols,rows,
    sombrear:(c,r,k)=>{ if(c<0||r<0||c>=cols||r>=rows) return; const i=r*cols+c; if(!G[i]) return; const f=1-k, v=C[i];
      C[i]=window.packc(((v>>16)&255)*f,((v>>8)&255)*(f+0.02),(v&255)*(f+0.05)); }});
  for(const a of lista) AR.pintarSombra(a.A,ctx(a));
  for(const a of lista) AR.pintar(a.A,ctx(a));
  return GR;
}
function pintarGrid(cv,g,cw){
  const chh=cw*ASP, dpr=Math.min(2,window.devicePixelRatio||1), W=Math.ceil(g.cols*cw), H=Math.ceil(g.rows*chh);
  if(cv.width!==Math.floor(W*dpr)||cv.height!==Math.floor(H*dpr)){ cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px'; }
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

/* ---- interfaz ---- */
const css=document.createElement('style');
css.textContent=
 ':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}'+
 '*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
 '#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
 '#barra label{display:flex;align-items:center;gap:6px;color:var(--dim)}#barra input[type=range]{width:100px;accent-color:var(--oro)}'+
 'button,select{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
 'button.on{background:var(--oro);color:#000}'+
 'h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
 'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:110ch}'+
 '.fila{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px}'+
 'figure{margin:0;border:1px solid #2a2a26;background:#000}figure canvas{display:block}'+
 'figcaption{padding:6px 9px;border-top:1px solid #2a2a26;font-size:12px;display:flex;gap:10px;align-items:center;justify-content:space-between;color:var(--dim)}'+
 '.cuadro{position:relative}.rotulo{position:absolute;top:6px;left:8px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}';
document.head.appendChild(css);
document.title='Laboratorio de árboles — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };
const VIVOS=[];                                         // los lienzos que se redibujan al animar: [{cv,f}]

function figura(titulo,f,pie){
  const cv=el('canvas'); const g=f(); pintarGrid(cv,g,ESTADO.cw);
  VIVOS.push({cv,f});
  return el('figure',{},[el('div',{className:'cuadro'},[cv,el('span',{className:'rotulo',textContent:titulo})]),el('figcaption',{},[el('span',{textContent:pie||''})])]);
}
function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['galeria','Galería'],['bosque','Bosque'],['conexiones','Conexiones'],['uno','Un árbol']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const sl=(txt,min,max,val,fn)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,value:val})]); l.lastChild.oninput=e=>{ fn(+e.target.value); refrescar(); }; return l; };
  b.appendChild(sl('Viento',0,120,Math.round(SIM.viento.valor*100),v=>{ SIM.viento.valor=v/100; }));
  b.appendChild(sl('Sol (dirección)',0,360,Math.round(Math.atan2(SIM.luz.dy,SIM.luz.dx)*180/Math.PI+360)%360,v=>{ const a=v*Math.PI/180; SIM.luz.dx=Math.cos(a); SIM.luz.dy=Math.sin(a)*0.6; }));
  b.appendChild(sl('Largo de sombra',20,200,Math.round(SIM.luz.porMetro*100),v=>{ SIM.luz.porMetro=v/100; }));
  b.appendChild(sl('Luz',40,130,Math.round(SIM.luz.amb*100),v=>{ SIM.luz.amb=v/100; }));
  b.appendChild(sl('Escala',16,40,Math.round(ESTADO.cw*10),v=>{ ESTADO.cw=v/10; }));
  const an=el('button',{textContent:ESTADO.anim?'Viento animado: sí':'Viento animado: no',className:ESTADO.anim?'on':''});
  an.onclick=()=>{ ESTADO.anim=!ESTADO.anim; SIM.viento.ciclo=ESTADO.anim?6:0; if(ESTADO.anim&&SIM.viento.valor<0.3) SIM.viento.valor=0.9; dibujar(); };
  b.appendChild(an);
  const r=el('button',{textContent:'Regenerar todo'}); r.onclick=()=>{ AR.NOMBRES.forEach(f=>ESTADO.sem[f]=rnd()); ESTADO.semBosque=rnd(); dibujar(); };
  b.appendChild(r);
}
let _tr=0; function refrescar(){ clearTimeout(_tr); _tr=setTimeout(()=>{ if(!ESTADO.anim){ for(const v of VIVOS) pintarGrid(v.cv,v.f(),ESTADO.cw); } },40); }

const arbol=(f,t,sem,v)=>AR.generar(f,t,sem,{variante:v==null?undefined:v});
function galeria(c){
  c.appendChild(el('h2',{textContent:'Galería: cuatro familias, tres tamaños'}));
  c.appendChild(el('p',{className:'nota',textContent:'Pequeño, mediano y grande de cada familia sobre el pasto real del juego. Las sombras salen del motor de árboles con la luz del entorno; el viento sale del entorno (deslizador). Cada familia tiene tres variantes de forma, que se sortean con la semilla.'}));
  for(const f of AR.NOMBRES){
    const cab=el('div',{style:'display:flex;gap:10px;align-items:center'});
    cab.appendChild(el('h2',{textContent:AR.FAMILIAS[f].nombre,style:'flex:0 0 auto'}));
    const b1=el('button',{textContent:'Otra semilla'}); b1.onclick=()=>{ ESTADO.sem[f]=rnd(); dibujar(); }; cab.appendChild(b1);
    const sv=el('select'); [['',''],['0','variante 1'],['1','variante 2'],['2','variante 3']].forEach(([k,tx])=>{ const o=el('option',{value:k,textContent:k===''?'variante: sorteada':tx}); if(String(ESTADO.variante[f]==null?'':ESTADO.variante[f])===k) o.selected=true; sv.appendChild(o); });
    sv.onchange=()=>{ ESTADO.variante[f]=sv.value===''?null:+sv.value; dibujar(); }; cab.appendChild(sv);
    c.appendChild(cab);
    const fila=el('div',{className:'fila'});
    const arboles=AR.TAMANOS.map((t,i)=>({A:arbol(f,t,ESTADO.sem[f]+i*3,ESTADO.variante[f]),x:[5,14,25][i],y:25}));
    fila.appendChild(figura(AR.FAMILIAS[f].nombre+' · pequeño, mediano, grande',()=>escena({mw:32,mh:27,arboles}),
      arboles.map(a=>'h '+a.A.h.toFixed(1)+' m · v'+(a.A.variante+1)).join('   ')));
    c.appendChild(fila);
  }
}
function bosque(c){
  c.appendChild(el('h2',{textContent:'Bosque mixto'}));
  c.appendChild(el('p',{className:'nota',textContent:'Todo junto, a la distancia a la que se verían en el juego. Sirve para juzgar si se leen bien en grupo, si las sombras se mezclan y si el contorno separa un árbol del otro.'}));
  const rn=NV.mulberry(ESTADO.semBosque), arboles=[];
  for(let i=0;i<22;i++){
    const f=AR.NOMBRES[(rn()*AR.NOMBRES.length)|0], t=AR.TAMANOS[(rn()*rn()*3.2)|0];
    arboles.push({A:AR.generar(f,t,(rn()*60000)|0),x:3+rn()*44,y:14+rn()*13});
  }
  c.appendChild(el('div',{className:'fila'},[figura('Bosque',()=>escena({mw:50,mh:28,arboles}),'22 árboles de las cuatro familias')]));
}
function conexiones(c){
  c.appendChild(el('h2',{textContent:'Conexiones: lo mismo, con otro viento y otro sol'}));
  c.appendChild(el('p',{className:'nota',textContent:'Cada cuadro es el MISMO árbol; sólo cambia lo que le llega del entorno simulado. Arriba, cuatro intensidades de viento (la sombra sigue a la copa). Abajo, cuatro posiciones del sol (cambian las caras iluminadas, la autosombra y hacia dónde cae la sombra).'}));
  const f=ESTADO.conx||(ESTADO.conx='encino'), sel=el('select');
  AR.NOMBRES.forEach(n=>{ const o=el('option',{value:n,textContent:AR.FAMILIAS[n].nombre}); if(n===f) o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>{ ESTADO.conx=sel.value; dibujar(); }; c.appendChild(el('div',{className:'fila'},[sel]));
  const A=arbol(f,'mediano',ESTADO.sem[f]+1,ESTADO.variante[f]);
  const guardar=JSON.stringify(SIM);
  const una=(titulo,patch)=>figura(titulo,()=>{ const s0=JSON.stringify(SIM); Object.assign(SIM.viento,patch.viento||{}); Object.assign(SIM.luz,patch.luz||{});
    const g=escena({mw:14,mh:17,arboles:[{A,x:7,y:15}]}); const o=JSON.parse(s0); Object.assign(SIM.viento,o.viento); Object.assign(SIM.luz,o.luz); return g; });
  const f1=el('div',{className:'fila'}); for(const v of [0,0.35,0.75,1.15]) f1.appendChild(una('viento '+(v===0?'calma':v<0.5?'brisa':v<1?'fuerte':'ráfaga'),{viento:{valor:v,ciclo:0}}));
  const f2=el('div',{className:'fila'});
  for(const [tx,dx,dy,pm] of [['sol bajo, desde el oeste',1,0.1,1.9],['sol medio',1,0.45,0.9],['sol alto',0.4,0.3,0.35],['sol desde el este',-1,0.3,0.9]])
    f2.appendChild(una(tx,{luz:{dx,dy,porMetro:pm},viento:{valor:0,ciclo:0}}));
  c.appendChild(f1); c.appendChild(f2);
}
function uno(c){
  const f=ESTADO.conx||(ESTADO.conx='encino');
  c.appendChild(el('h2',{textContent:'Un árbol, sus tres variantes'}));
  const sel=el('select'); AR.NOMBRES.forEach(n=>{ const o=el('option',{value:n,textContent:AR.FAMILIAS[n].nombre}); if(n===f) o.selected=true; sel.appendChild(o); });
  sel.onchange=()=>{ ESTADO.conx=sel.value; dibujar(); };
  const tm=el('select'); AR.TAMANOS.forEach(n=>{ const o=el('option',{value:n,textContent:AR.ETIQUETA[n]}); if(n===(ESTADO.tm||'grande')) o.selected=true; tm.appendChild(o); });
  tm.onchange=()=>{ ESTADO.tm=tm.value; dibujar(); };
  c.appendChild(el('div',{className:'fila'},[sel,tm]));
  const t=ESTADO.tm||'grande', fila=el('div',{className:'fila'});
  for(let v=0;v<3;v++){
    const A=AR.generar(f,t,ESTADO.sem[f]+v*11,{variante:v});
    fila.appendChild(figura('variante '+(v+1),()=>escena({mw:20,mh:Math.ceil(A.h*1.7+7),arboles:[{A,x:10,y:Math.ceil(A.h*1.7+5)}]}),'h '+A.h.toFixed(1)+' m'));
  }
  c.appendChild(fila);
}
function dibujar(){
  VIVOS.length=0; barra(); const c=$('#cuerpo'); c.innerHTML='';
  (ESTADO.vista==='galeria'?galeria:ESTADO.vista==='bosque'?bosque:ESTADO.vista==='conexiones'?conexiones:uno)(c);
}
function tick(){
  if(ESTADO.anim){ ESTADO.t=performance.now()/1000; for(const v of VIVOS) pintarGrid(v.cv,v.f(),ESTADO.cw); setTimeout(()=>requestAnimationFrame(tick),70); }
}
const q=new URLSearchParams(location.search);
if(q.get('vista')) ESTADO.vista=q.get('vista');
if(q.get('familia')) ESTADO.conx=q.get('familia');
if(q.get('tam')) ESTADO.tm=q.get('tam');
if(q.get('escala')) ESTADO.cw=+q.get('escala');
if(q.get('viento')) SIM.viento.valor=+q.get('viento');
if(q.get('semilla')) AR.NOMBRES.forEach(f=>ESTADO.sem[f]=+q.get('semilla'));
window.ArboladoLab={ESTADO,SIM,escena,dibujar,AR,EN};
const _d=dibujar; dibujar=function(){ _d(); if(ESTADO.anim) tick(); };
dibujar();
})();
