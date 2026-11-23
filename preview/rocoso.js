/* Nativa Online — LABORATORIO DE ROCAS (independiente del juego).
   Todo lo que se ve lo genera el motor (NV.rocoso) en este momento: ninguna muestra es una imagen guardada y cada
   control cambia un parámetro real del motor. La luz del entorno es la simulada (deslizadores).
   Vistas: Muestrario (las 12 pedidas × 3 variantes) · Materiales · Banco · Agrupaciones · Formaciones · Favoritas. */
(function(){
'use strict';
const NV=window.NV, RO=NV.rocoso, AR=NV.arbolado, EN=NV.entorno;
const CPMl=13, RPMl=4, HPMl=6.8, ASP=1.393, FONT_K=1/0.42;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const tn=NV.makeNoise(NV.mulberry(31771));
window.tex2=(wx,wy,e)=>0.66*tn(wx/e,wy/e,1,1)+0.34*tn(wx/(e*0.42)+37,wy/(e*0.42),1,1);
window.packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
let GR=null;
window.put=(c,r,ch,col)=>{ if(c<0||c>=GR.cols||r<0||r>=GR.rows) return; const i=r*GR.cols+c; GR.G[i]=ch; GR.C[i]=col; };
const SIM={viento:{valor:0,ciclo:0}, luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}};
EN.usar(EN.simulado(SIM));
const LS=(()=>{ try{ return window.localStorage; }catch(e){ return null; } })();
const FAV_K='nativa.rocoso.favoritas';
const favs=()=>{ try{ return JSON.parse(LS&&LS.getItem(FAV_K)||'[]'); }catch(e){ return []; } };
const guardarFavs=l=>{ try{ LS&&LS.setItem(FAV_K,JSON.stringify(l)); }catch(e){} };
const ESTADO={vista:'muestrario',cw:2.7,detalle:2,contorno:true,pasto:0.5,
  banco:{mat:'granito',tam:'media',forma:'irregular',sem:11,escala:1,yaw:0,estado:{musgo:0,liquen:0,humedad:0,erosion:0,enterrada:0},agua:0,ref:null},
  grupo:{tipo:'pequeno',mat:'granito',mezcla:false,sem:5,musgo:null,humedad:null,densidad:1},
  form:{tipo:'acantilado',mat:'caliza',sem:7,ancho:30,alto:0,estrato:0,columnas:null,erosion:null,derrumbe:null,inclinacion:0,pie:true,estado:{musgo:0.3,liquen:0.2,humedad:0.1,erosion:0,enterrada:0}},
  matSem:3,musSem:2};
const rnd=()=>(Math.random()*60000)|0;

/* ---- escena: pasto del juego + sombras + objetos ---- */
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
  const s={cols,rows,G:GR.G,C:GR.C}; if(cacheSuelo.size>8) cacheSuelo.clear(); cacheSuelo.set(k,s); return s;
}
const AGUA=[[20,50,66],[34,80,100],[52,112,132],[84,152,170]];
function franjaAgua(g,r0,r1,sem){
  for(let r=r0;r<r1;r++) for(let c=0;c<g.cols;c++){
    const i=r*g.cols+c, n=tn(c*0.08,r*0.22+sem,1,1), k=clamp(0.25+0.55*n+(r-r0)/(r1-r0)*0.1,0,1), a=AGUA[Math.min(3,(k*4)|0)];
    g.G[i]=(n>0.62?'~':n>0.45?'-':'.').charCodeAt(0); g.C[i]=window.packc(a[0],a[1],a[2]);
  }
}
function sueloNeutro(cols,rows,sem){
  const G=new Uint16Array(cols*rows), C=new Int32Array(cols*rows), PS=[[36,46,32],[50,64,40],[68,84,50],[88,104,62]];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ const i=r*cols+c, n=tn(c*0.21+sem,r*0.33,1,1), h=((Math.imul(c,73856093)^Math.imul(r,19349663))>>>0)%100;
    if(h<62){ const p=PS[Math.min(3,(n*4)|0)]; G[i]=(h<10?',':h<20?'.':h<28?':':'`').charCodeAt(0); C[i]=window.packc(p[0],p[1],p[2]); } }
  return {cols,rows,G,C};
}
function escena(o){
  const z=o.z||1, CPM=CPMl*z, HPM=HPMl*z, RPM=RPMl*z;
  const s0=z===1?suelo(o.mw,o.mh,60,60,(SIM.luz.amb||1)*0.9):sueloNeutro(Math.round(o.mw*CPM),Math.round(o.mh*RPM),3);
  GR={cols:s0.cols,rows:s0.rows,G:s0.G.slice(),C:s0.C.slice()};
  if(o.agua) franjaAgua(GR,o.agua[0]*RPM,o.agua[1]*RPM,3);
  const G=GR.G, C=GR.C, cols=GR.cols, rows=GR.rows;
  const base=(x,y)=>({x:60+x,y:60+y,t:0,CPM,HPM,RPM,bc:Math.round(x*CPM),br:Math.round(y*RPM)-1,put:window.put,cols,rows,detalle:ESTADO.detalle,contorno:ESTADO.contorno,pasto:ESTADO.pasto,
    sombrear:(c,r,k)=>{ if(c<0||r<0||c>=cols||r>=rows) return; const i=r*cols+c; if(!G[i]) return; const f=1-k, v=C[i]; C[i]=window.packc(((v>>16)&255)*f,((v>>8)&255)*(f+0.02),(v&255)*(f+0.05)); }});
  for(const it of o.items.slice().sort((a,b)=>a.y-b.y)) it.pintar(base(it.x,it.y),G,C,cols,rows);
  return GR;
}
const rocaIt=(S,x,y,extra)=>({x,y,pintar:(ctx)=>{ RO.pintarSombra(S,ctx); RO.pintar(S,Object.assign(ctx,extra||{})); }});
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
      if(start>=0){ ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
        if(canRun) ctx.fillText(buf,start*cw+x0,y); else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],(start+q)*cw+x0,y); start=-1; }
      if(hay){ start=c; col=g.C[i]; buf=String.fromCharCode(g.G[i]); }
    }
  }
}

/* ---- interfaz ---- */
const css=document.createElement('style');
css.textContent=
 ':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}*{box-sizing:border-box}'+
 'body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
 '#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
 '#barra label,.ctl label{display:flex;align-items:center;gap:6px;color:var(--dim)}input[type=range]{width:110px;accent-color:var(--oro)}'+
 'button,select,input[type=number]{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
 'button.on{background:var(--oro);color:#000}'+
 'h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
 'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:110ch}'+
 '.fila{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px;align-items:flex-start}'+
 'figure{margin:0;border:1px solid #2a2a26;background:#000}figure canvas{display:block}'+
 'figcaption{padding:5px 9px;border-top:1px solid #2a2a26;font-size:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;color:var(--dim)}'+
 '.cuadro{position:relative}.rotulo{position:absolute;top:6px;left:8px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}'+
 '#panel{width:310px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:7px}'+
 '#panel .p{display:grid;grid-template-columns:1fr 54px;gap:2px 8px;align-items:center}#panel .p span{color:var(--dim);font-size:12px}'+
 '#panel .p b{text-align:right;color:var(--oro);font-weight:normal}#panel .p input{grid-column:1/3;width:100%}#panel select{width:100%}'+
 '#panel .bt{display:flex;flex-wrap:wrap;gap:6px}.ctl{display:flex;flex-wrap:wrap;gap:8px 14px;padding:0 14px 12px;align-items:center}';
document.head.appendChild(css);
document.title='Laboratorio de rocas — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };
const VIVOS=[];
function figura(titulo,f,pie,acc,zm){
  const cv=el('canvas'); const t0=performance.now(); const g=f(); const ms=Math.round(performance.now()-t0); const cwz=()=>ESTADO.cw*(zm||1); pintarGrid(cv,g,cwz()); VIVOS.push({cv,f,zm:cwz});
  const hijos=[el('span',{textContent:(pie||'')+(ms>=1?'  ·  '+ms+' ms':'')})]; if(acc) hijos.push(acc);
  return el('figure',{},[el('div',{className:'cuadro'},[cv,el('span',{className:'rotulo',textContent:titulo})]),el('figcaption',{},hijos)]);
}
function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['muestrario','Muestrario'],['materiales','Materiales'],['banco','Banco'],['grupos','Agrupaciones'],['formaciones','Formaciones'],['favoritas','Favoritas ('+favs().length+')']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const sl=(txt,min,max,val,fn,w)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,value:val})]); l.lastChild.oninput=e=>{ fn(+e.target.value); refrescar(); }; return l; };
  b.appendChild(sl('Sol',0,360,Math.round(Math.atan2(SIM.luz.dy,SIM.luz.dx)*180/Math.PI+360)%360,v=>{ const a=v*Math.PI/180; SIM.luz.dx=Math.cos(a); SIM.luz.dy=Math.sin(a)*0.6; }));
  b.appendChild(sl('Sombra',20,200,Math.round(SIM.luz.porMetro*100),v=>{ SIM.luz.porMetro=v/100; }));
  b.appendChild(sl('Luz',40,130,Math.round(SIM.luz.amb*100),v=>{ SIM.luz.amb=v/100; }));
  b.appendChild(sl('Escala',16,40,Math.round(ESTADO.cw*10),v=>{ ESTADO.cw=v/10; }));
  const dt=el('select'); [[0,'detalle bajo'],[1,'detalle medio'],[2,'detalle alto']].forEach(([k,t])=>{ const o=el('option',{value:k,textContent:t}); if(k===ESTADO.detalle) o.selected=true; dt.appendChild(o); });
  dt.onchange=()=>{ ESTADO.detalle=+dt.value; dibujar(); }; b.appendChild(dt);
  const ct=el('button',{textContent:ESTADO.contorno?'Contorno: sí':'Contorno: no',className:ESTADO.contorno?'on':''}); ct.onclick=()=>{ ESTADO.contorno=!ESTADO.contorno; dibujar(); }; b.appendChild(ct);
  b.appendChild(sl('Pasto al pie',0,100,Math.round(ESTADO.pasto*100),v=>{ ESTADO.pasto=v/100; }));
}
let _tr=0; function refrescar(){ clearTimeout(_tr); _tr=setTimeout(()=>{ for(const v of VIVOS) pintarGrid(v.cv,v.f(),v.zm?v.zm():ESTADO.cw); },60); }
const sel=(opts,val,fn)=>{ const s=el('select'); for(const k of Object.keys(opts)){ const o=el('option',{value:k,textContent:opts[k]}); if(String(k)===String(val)) o.selected=true; s.appendChild(o); } s.onchange=()=>fn(s.value); return s; };
const MATN=RO.MATS.reduce((a,k)=>(a[k]=RO.MATERIALES[k].nombre,a),{});
const FORMN=RO.FORMAS.reduce((a,k)=>(a[k]=k,a),{});
const TAMN={pequena:'Pequeña',media:'Mediana',grande:'Grande'};
const ALTO={pequena:[0.38,0.6],media:[1.1,1.4],grande:[2.4,3.2]};
const ZM={pequena:2.5,media:1.15,grande:0.95}, ZZ={pequena:3,media:2,grande:1};
const MWH=t=>t==='grande'?[10,Math.ceil(3.2*1.7+3)]:t==='media'?[5,Math.ceil(1.4*1.7+2.5)]:[2.6,Math.ceil(0.6*1.7+2)];

/* Dimensiona la escena con la roca real: ancho = su caja, alto = altura × 1,7 filas por metro + su fondo */
function dimsDe(S){ const ub=S.box.umax, zm=S.box.zmax; return {mw:Math.ceil(ub*2)+2, mh:Math.ceil(S.h*1.7+zm)+2, py:zm+0.6}; }
function una(spec,extra){
  const S=RO.crearRoca(spec), z=ZZ[spec.tam]||1, D=dimsDe(S), mh=D.mh;
  const f=()=>escena({mw:D.mw,mh,z,agua:extra&&extra.agua,items:[rocaIt(S,D.mw/2,mh-D.py+(extra&&extra.dy||0),extra&&extra.ctx)]});
  f.S=S; return f;
}
function guardarFav(spec){ const l=favs(); l.push(JSON.parse(JSON.stringify(spec))); guardarFavs(l); barra(); }
const botFav=spec=>{ const b=el('button',{textContent:'★ Conservar',title:'Guarda esta roca (se mantiene la receta, no la imagen)'}); b.onclick=()=>{ guardarFav(spec); b.textContent='★ Guardada'; }; return b; };

/* ---- Muestrario: las 12 pedidas, tres alternativas cada una ---- */
const DOCE=[
  ['Piedra pequeña redondeada',{tam:'pequena',forma:'redondeada',mat:['granito','caliza','basalto']}],
  ['Piedra pequeña angular',{tam:'pequena',forma:'angular',mat:['pizarra','granito','rojiza']}],
  ['Roca mediana plana',{tam:'media',forma:'plana',mat:['pizarra','arenisca','caliza']}],
  ['Roca mediana irregular',{tam:'media',forma:'irregular',mat:['granito','basalto','rojiza']}],
  ['Roca grande redondeada',{tam:'grande',forma:'redondeada',mat:['granito','caliza','arenisca']}],
  ['Roca grande fracturada',{tam:'grande',forma:'fracturada',mat:['granito','basalto','pizarra']}],
  ['Roca con musgo',{tam:'media',forma:'irregular',mat:['granito','caliza','basalto'],estado:{musgo:0.85,humedad:0.25}}],
  ['Roca con líquenes',{tam:'media',forma:'redondeada',mat:['granito','arenisca','caliza'],estado:{liquen:0.9}}],
  ['Roca erosionada',{tam:'media',forma:'erosionada',mat:['arenisca','caliza','rojiza'],estado:{erosion:0.7}}]
];
function muestrario(c){
  c.appendChild(el('h2',{textContent:'Muestrario: las doce pedidas, tres alternativas cada una'}));
  c.appendChild(el('p',{className:'nota',textContent:'Cada cuadro lo genera el motor ahora mismo con una receta distinta (material, forma, semilla). "Conservar" guarda la receta en Favoritas. Las tres últimas —formación gigante, acantilado y pie de montaña— están en la vista Formaciones.'}));
  DOCE.forEach(([tit,d],ii)=>{
    c.appendChild(el('h2',{textContent:(ii+1)+'. '+tit}));
    const fila=el('div',{className:'fila'});
    d.mat.forEach((m,k)=>{
      const spec={mat:m,tam:d.tam,forma:d.forma,sem:ESTADO.musSem*13+ii*5+k*3+1,estado:d.estado||{},escala:1,yaw:0};
      fila.appendChild(figura(RO.MATERIALES[m].nombre,una(spec),'',botFav(spec),ZM[d.tam]));
    });
    c.appendChild(fila);
  });
  const reg=el('button',{textContent:'Regenerar variantes'}); reg.onclick=()=>{ ESTADO.musSem=rnd(); dibujar(); }; c.appendChild(el('div',{className:'ctl'},[reg]));
}
/* ---- Materiales ---- */
function materiales(c){
  c.appendChild(el('h2',{textContent:'Seis familias geológicas, tres tamaños'}));
  c.appendChild(el('p',{className:'nota',textContent:'Misma forma y semilla en todas: lo que cambia es el material. Cada uno tiene su estructura (juntas, estratos, columnas, láminas, poros, grano), no sólo su color.'}));
  const fm=el('select'); for(const k of RO.FORMAS){ const o=el('option',{value:k,textContent:k}); if(k===(ESTADO.matForma||'angular')) o.selected=true; fm.appendChild(o); }
  fm.onchange=()=>{ ESTADO.matForma=fm.value; dibujar(); };
  const reg=el('button',{textContent:'Otra semilla'}); reg.onclick=()=>{ ESTADO.matSem=rnd(); dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[fm,reg]));
  for(const m of RO.MATS){
    c.appendChild(el('h2',{textContent:RO.MATERIALES[m].nombre}));
    const fila=el('div',{className:'fila'});
    for(const t of ['pequena','media','grande']){
      const spec={mat:m,tam:t,forma:ESTADO.matForma||'angular',sem:ESTADO.matSem,estado:{},escala:1,yaw:0};
      fila.appendChild(figura(TAMN[t],una(spec),'',null,ZM[t]));
    }
    c.appendChild(fila);
  }
}
/* ---- Banco ---- */
function banco(c){
  const B=ESTADO.banco;
  c.appendChild(el('h2',{textContent:'Banco de pruebas'}));
  c.appendChild(el('p',{className:'nota',textContent:'Todos los controles son parámetros reales de la spec de la roca. "Fijar referencia" congela la actual para comparar. Sol, sombra, luz, detalle, contorno y pasto están arriba.'}));
  const cont=el('div',{className:'fila'}); c.appendChild(cont);
  const panel=el('div',{id:'panel'}); cont.appendChild(panel);
  panel.appendChild(sel(MATN,B.mat,v=>{ B.mat=v; refrescarBanco(); }));
  panel.appendChild(sel(TAMN,B.tam,v=>{ B.tam=v; refrescarBanco(); }));
  panel.appendChild(sel(FORMN,B.forma,v=>{ B.forma=v; refrescarBanco(); }));
  const sld=(txt,min,max,step,get,set)=>{ const lab=el('b',{textContent:get()}); const inp=el('input',{type:'range',min,max,step,value:get()});
    inp.oninput=e=>{ set(+e.target.value); lab.textContent=Math.round(get()*100)/100; clearTimeout(B.t); B.t=setTimeout(refrescarBanco,40); };
    panel.appendChild(el('div',{className:'p'},[el('span',{textContent:txt}),lab,inp])); };
  sld('Escala',0.5,2,0.05,()=>B.escala,v=>B.escala=v);
  sld('Orientación',0,6.28,0.05,()=>B.yaw,v=>B.yaw=v);
  sld('Musgo',0,1,0.05,()=>B.estado.musgo,v=>B.estado.musgo=v);
  sld('Líquenes',0,1,0.05,()=>B.estado.liquen,v=>B.estado.liquen=v);
  sld('Humedad',0,1,0.05,()=>B.estado.humedad,v=>B.estado.humedad=v);
  sld('Erosión',0,1,0.05,()=>B.estado.erosion,v=>B.estado.erosion=v);
  sld('Parcialmente enterrada',0,1,0.05,()=>B.estado.enterrada,v=>B.estado.enterrada=v);
  sld('Nivel del agua (m)',0,2,0.05,()=>B.agua,v=>B.agua=v);
  const nm=el('input',{type:'number',value:B.sem,style:'width:90px'}); nm.onchange=()=>{ B.sem=+nm.value|0; refrescarBanco(); };
  panel.appendChild(el('label',{style:'display:flex;gap:6px;align-items:center;color:var(--dim)'},['Semilla',nm]));
  const bt=el('div',{className:'bt'}); const bb=(t,f)=>{ const b=el('button',{textContent:t}); b.onclick=f; bt.appendChild(b); };
  bb('Regenerar',()=>{ B.sem=rnd(); nm.value=B.sem; refrescarBanco(); });
  bb('Fijar referencia',()=>{ B.ref=JSON.parse(JSON.stringify(B)); delete B.ref.ref; refrescarBanco(); });
  bb('Quitar referencia',()=>{ B.ref=null; refrescarBanco(); });
  bb('★ Conservar',()=>guardarFav(specB(B)));
  panel.appendChild(bt);
  const der=el('div',{style:'display:flex;flex-direction:column;gap:12px'}); cont.appendChild(der); B._der=der; refrescarBanco();
}
const specB=B=>({mat:B.mat,tam:B.tam,forma:B.forma,sem:B.sem,escala:B.escala,yaw:B.yaw,estado:Object.assign({},B.estado)});
function refrescarBanco(){
  const B=ESTADO.banco, der=B._der; if(!der) return; der.innerHTML=''; VIVOS.length=0;
  const mk=(b,t)=>{ const S=RO.crearRoca(specB(b)), z=ZZ[b.tam], D=dimsDe(S), mh=D.mh, agua=b.agua>0?b.agua:null;
    return figura(t,()=>escena({mw:Math.max(D.mw,6),mh,z,agua:agua?[mh-3,mh]:null,items:[rocaIt(S,Math.max(D.mw,6)/2,mh-D.py,agua?{nivelAgua:agua}:null)]}),S.nombre+' · '+S.h.toFixed(2)+' m',null,ZM[b.tam]*1.15); };
  der.appendChild(mk(B,'ACTUAL'));
  if(B.ref) der.appendChild(mk(B.ref,'REFERENCIA'));
}
/* ---- Agrupaciones ---- */
function grupos(c){
  const g=ESTADO.grupo, GN=RO.GRUPOS_ID.reduce((a,k)=>(a[k]=RO.GRUPOS[k].nombre,a),{});
  c.appendChild(el('h2',{textContent:'Agrupaciones naturales'}));
  c.appendChild(el('p',{className:'nota',textContent:'Posiciones al azar con separación según el tamaño de cada piedra (nunca en retícula); las grandes se colocan primero; algunas se apilan. Las del río van parcialmente sumergidas y dejan su estela en la corriente.'}));
  const reg=el('button',{textContent:'Regenerar grupo'}); reg.onclick=()=>{ g.sem=rnd(); dibujar(); };
  const mx=el('label',{},['Mezcla de materiales ',el('input',{type:'checkbox',checked:!!g.mezcla})]); mx.lastChild.onchange=e=>{ g.mezcla=e.target.checked; dibujar(); };
  const den=el('label',{},['Cantidad ',el('input',{type:'range',min:30,max:180,value:Math.round(g.densidad*100)})]); den.lastChild.onchange=e=>{ g.densidad=e.target.value/100; dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[sel(GN,g.tipo,v=>{ g.tipo=v; dibujar(); }),sel(MATN,g.mat,v=>{ g.mat=v; dibujar(); }),mx,den,reg]));
  const opt={mat:g.mat,materiales:g.mezcla?RO.MATS:null,densidad:g.densidad};
  const G=RO.grupo(g.tipo,g.sem,opt), mw=34, mh=g.tipo==='penascos'||g.tipo==='bloques'||g.tipo==='arbol'?27:22, cx=mw/2, cy=mh*0.62;
  const items=[]; let agua=null;
  if(g.tipo==='rio') agua=[Math.round(cy+1),mh];
  if(g.tipo==='arbol'){ const A=AR.generar('encino','grande',9,{variante:0}); items.push({x:cx,y:cy,pintar:(ctx)=>{ AR.pintarSombra(A,ctx); AR.pintar(A,ctx); }}); }
  if(g.tipo==='piedemonte'){ const F=RO.crearFormacion({tipo:'piedemonte',mat:g.mat,ancho:mw,sem:g.sem,estado:{musgo:0.2}}); items.push({x:0,y:cy-5,pintar:(ctx)=>{ ctx.bc=0; RO.pintarFormacion(F,ctx); }}); }
  const cuerpos=[];
  for(const e of G.rocas){ const S=RO.crearRoca(e.spec); items.push({x:cx+e.x,y:cy+e.y,pintar:(ctx)=>{ RO.pintarSombra(S,ctx); RO.pintar(S,Object.assign(ctx,{elev:e.elev||0,nivelAgua:e.agua==null?undefined:e.agua})); if(e.agua!=null){ for(const p of RO.perturbacion(S,Object.assign({},ctx,{corriente:1}))) window.put(p.c,p.r,p.g,p.col); } }}); }
  c.appendChild(el('div',{className:'fila'},[figura(GN[g.tipo],()=>escena({mw,mh,agua,items}),G.rocas.length+' rocas')]));
}
/* ---- Formaciones ---- */
function formaciones(c){
  const f=ESTADO.form, FN=RO.TIPOS.reduce((a,k)=>(a[k]=RO.TIPOS_FORM[k].nombre,a),{});
  c.appendChild(el('h2',{textContent:'Formaciones gigantes, acantilados y pies de montaña'}));
  c.appendChild(el('p',{className:'nota',textContent:'Sistema propio: un frente con estratos que retroceden según la dureza de cada capa, columnas separadas por juntas, canaletas de erosión, derrumbe al pie, cavidades, cima con relieve y bloques que emergen. El contorno sólo recorre la silueta exterior. Se calcula por tramos: "Rehacer un tramo" invalida sólo 5 m de pared y mide cuánto cuesta.'}));
  const sld=(txt,min,max,step,get,set)=>{ const v=get(); const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,step,value:v==null?min:v}),el('b',{textContent:v==null?'auto':v,style:'color:var(--oro);font-weight:normal;min-width:34px'})]);
    l.children[1].oninput=e=>{ set(+e.target.value); l.lastChild.textContent=+e.target.value; clearTimeout(f.t); f.t=setTimeout(dibujar,120); }; return l; };
  const reg=el('button',{textContent:'Regenerar'}); reg.onclick=()=>{ f.sem=rnd(); dibujar(); };
  const pie=el('label',{},['Rocas al pie ',el('input',{type:'checkbox',checked:!!f.pie})]); pie.lastChild.onchange=e=>{ f.pie=e.target.checked; dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[sel(FN,f.tipo,v=>{ f.tipo=v; f.alto=0; f.columnas=null; f.erosion=null; f.derrumbe=null; dibujar(); }),sel(MATN,f.mat,v=>{ f.mat=v; dibujar(); }),pie,reg]));
  c.appendChild(el('div',{className:'ctl'},[sld('Ancho m',16,48,1,()=>f.ancho,v=>f.ancho=v),sld('Alto m',0,18,1,()=>f.alto||null,v=>f.alto=v),sld('Estrato m',0,3,0.1,()=>f.estrato||null,v=>f.estrato=v),
    sld('Columnas m',0,8,0.5,()=>f.columnas,v=>f.columnas=v),sld('Erosión',0,1,0.05,()=>f.erosion,v=>f.erosion=v),sld('Derrumbe',0,1,0.05,()=>f.derrumbe,v=>f.derrumbe=v),sld('Inclinación',-0.4,0.4,0.05,()=>f.inclinacion,v=>f.inclinacion=v)]));
  const st=f.estado; c.appendChild(el('div',{className:'ctl'},[sld('Musgo',0,1,0.05,()=>st.musgo,v=>st.musgo=v),sld('Líquenes',0,1,0.05,()=>st.liquen,v=>st.liquen=v),sld('Humedad',0,1,0.05,()=>st.humedad,v=>st.humedad=v)]));
  const spec={tipo:f.tipo,mat:f.mat,ancho:f.ancho,sem:f.sem,estado:Object.assign({},st),inclinacion:f.inclinacion};
  if(f.alto) spec.alto=f.alto; if(f.estrato) spec.estrato=f.estrato; if(f.columnas!=null) spec.columnas=f.columnas; if(f.erosion!=null) spec.erosion=f.erosion; if(f.derrumbe!=null) spec.derrumbe=f.derrumbe;
  const F=RO.crearFormacion(spec), Hh=F.Hh, mh=Math.ceil(Hh*1.7+F.D+6), mw=f.ancho+2, cy=mh-4;
  const items=[{x:1,y:cy,pintar:(ctx)=>{ ctx.bc=Math.round(1*CPMl); RO.pintarSombra(F,ctx); RO.pintarFormacion(F,ctx); }}];
  if(f.pie){ const G=RO.grupo('piedemonte',f.sem,{mat:f.mat,densidad:f.ancho/20}); for(const e of G.rocas){ e.spec.escala=(e.spec.escala||1)*0.55; const S=RO.crearRoca(e.spec); items.push({x:1+f.ancho/2+e.x*(f.ancho/14),y:cy+0.8+Math.abs(e.y)*0.35,pintar:(ctx)=>{ RO.pintarSombra(S,ctx); RO.pintar(S,ctx); }}); } }
  const rehacer=el('button',{textContent:'Rehacer un tramo (5 m)'}); rehacer.onclick=()=>{ const u=Math.random()*(f.ancho-5); const t0=performance.now(); const n=RO.invalidarFormacion(F,u,u+5,CPMl); const g=escena({mw,mh,items}); pintarGrid(cv0,g,ESTADO.cw); rehacer.textContent='Tramo rehecho: '+n+' de '+Math.ceil(f.ancho*CPMl/RO.TRAMO)+' · '+Math.round(performance.now()-t0)+' ms'; };
  const fig=figura(FN[f.tipo],()=>escena({mw,mh,items}),'alto '+Hh.toFixed(1)+' m · ancho '+f.ancho+' m',rehacer);
  const cv0=fig.querySelector('canvas');
  c.appendChild(el('div',{className:'fila'},[fig]));
}
/* ---- Favoritas ---- */
function favoritas(c){
  c.appendChild(el('h2',{textContent:'Favoritas conservadas'}));
  c.appendChild(el('p',{className:'nota',textContent:'Se guarda la receta (material, forma, semilla, estado), no una imagen: al abrirla el motor vuelve a generar exactamente la misma roca.'}));
  const l=favs(); if(!l.length){ c.appendChild(el('p',{className:'nota',textContent:'Todavía no hay ninguna. Usa "★ Conservar" en el muestrario o en el banco.'})); return; }
  const fila=el('div',{className:'fila'});
  l.forEach((spec,i)=>{ const b=el('button',{textContent:'Quitar'}); b.onclick=()=>{ const x=favs(); x.splice(i,1); guardarFavs(x); dibujar(); };
    fila.appendChild(figura(RO.MATERIALES[spec.mat].nombre,una(spec),spec.forma+' · sem '+spec.sem,b,ZM[spec.tam])); });
  c.appendChild(fila);
}
function dibujar(){ VIVOS.length=0; barra(); const c=$('#cuerpo'); c.innerHTML='';
  ({muestrario,materiales,banco,grupos,formaciones,favoritas}[ESTADO.vista]||muestrario)(c); }
const q=new URLSearchParams(location.search);
if(q.get('vista')) ESTADO.vista=q.get('vista');
if(q.get('escala')) ESTADO.cw=+q.get('escala');
if(q.get('mat')) { ESTADO.banco.mat=q.get('mat'); ESTADO.grupo.mat=q.get('mat'); ESTADO.form.mat=q.get('mat'); }
if(q.get('tam')) ESTADO.banco.tam=q.get('tam');
if(q.get('forma')) ESTADO.banco.forma=q.get('forma');
if(q.get('grupo')) ESTADO.grupo.tipo=q.get('grupo');
if(q.get('tipo')) ESTADO.form.tipo=q.get('tipo');
if(q.get('semilla')) { ESTADO.banco.sem=+q.get('semilla'); ESTADO.grupo.sem=+q.get('semilla'); ESTADO.form.sem=+q.get('semilla'); }
window.RocosoLab={ESTADO,SIM,escena,dibujar,RO,EN};
dibujar();
})();
