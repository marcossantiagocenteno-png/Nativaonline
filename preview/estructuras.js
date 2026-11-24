/* Nativa Online — LABORATORIO DE ESTRUCTURAS Y RUINAS (independiente del juego).
   Todo lo que se ve lo genera el motor (NV.estructuras) en este momento: ninguna muestra es una imagen guardada y cada control
   cambia un parámetro real de la spec. La luz del entorno es la simulada (deslizadores arriba).
   Vistas: Muestrario · Envejecer y deteriorar (edad × deterioro) · Banco · Agrupaciones · Oclusión y distancia · Favoritas. */
(function(){
'use strict';
const NV=window.NV, ES=NV.estructuras, RO=NV.rocoso, AR=NV.arbolado, EN=NV.entorno;
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
const FAV_K='nativa.estructuras.favoritas';
const favs=()=>{ try{ return JSON.parse(LS&&LS.getItem(FAV_K)||'[]'); }catch(e){ return []; } };
const guardarFavs=l=>{ try{ LS&&LS.setItem(FAV_K,JSON.stringify(l)); }catch(e){} };
const rnd=()=>(Math.random()*60000)|0;
const ESTADO={vista:'muestrario',cw:3.4,detalle:2,contorno:true,pasto:0.5,muSem:3,
  banco:{spec:ES.limpiar({tipo:'muro',sem:11,deterioro:0.35,edad:0.55,estado:{musgo:0.3,vegetacion:0.2}}),ref:null,modo:'objeto',copias:[]},
  grupo:{tipo:'ruina',sem:5,deterioro:null,edad:null,parte:null,partes:null},
  env:{tipo:'muro',mat:'mamposteria',sem:4},
  oc:{tipo:'muro',sem:6}};

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
  const G=GR.G, C=GR.C, cols=GR.cols, rows=GR.rows;
  const base=(x,y)=>({x:60+x,y:60+y,t:0,CPM,HPM,RPM,bc:Math.round(x*CPM),br:Math.round(y*RPM)-1,put:window.put,cols,rows,detalle:ESTADO.detalle,contorno:ESTADO.contorno,pasto:ESTADO.pasto,
    sombrear:(c,r,k)=>{ if(c<0||r<0||c>=cols||r>=rows) return; const i=r*cols+c; if(!G[i]) return; const f=1-k, v=C[i]; C[i]=window.packc(((v>>16)&255)*f,((v>>8)&255)*(f+0.02),(v&255)*(f+0.05)); }});
  for(const it of o.items.slice().sort((a,b)=>a.y-b.y)) it.pintar(base(it.x,it.y),G,C,cols,rows);
  return GR;
}
const estIt=(S,x,y,extra)=>({x,y,pintar:ctx=>{ ES.pintarSombra(S,ctx); ES.pintar(S,Object.assign(ctx,extra||{})); }});
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
 '#panel{width:330px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:6px}'+
 '#panel .p{display:grid;grid-template-columns:1fr 54px;gap:2px 8px;align-items:center}#panel .p span{color:var(--dim);font-size:12px}'+
 '#panel .p b{text-align:right;color:var(--oro);font-weight:normal}#panel .p input{grid-column:1/3;width:100%}#panel select{width:100%}'+
 '#panel h3{margin:6px 0 0;font-size:12px;color:var(--oro);letter-spacing:.06em;text-transform:uppercase}'+
 '#panel .bt{display:flex;flex-wrap:wrap;gap:6px}.ctl{display:flex;flex-wrap:wrap;gap:8px 14px;padding:0 14px 12px;align-items:center}'+
 '.est{padding:0 14px 10px;color:var(--dim);font-size:12px}.est b{color:var(--oro);font-weight:normal}';
document.head.appendChild(css);
document.title='Laboratorio de estructuras — Nativa Online';
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
  for(const [id,tx] of [['muestrario','Muestrario'],['envejecer','Envejecer y deteriorar'],['banco','Banco'],['grupos','Agrupaciones'],['oclusion','Oclusión y distancia'],['favoritas','Favoritas ('+favs().length+')']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const sl=(txt,min,max,val,fn)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,value:val})]); l.lastChild.oninput=e=>{ fn(+e.target.value); refrescar(); }; return l; };
  b.appendChild(sl('Sol',0,360,Math.round(Math.atan2(SIM.luz.dy,SIM.luz.dx)*180/Math.PI+360)%360,v=>{ const a=v*Math.PI/180; SIM.luz.dx=Math.cos(a); SIM.luz.dy=Math.sin(a)*0.6; }));
  b.appendChild(sl('Sombra',20,200,Math.round(SIM.luz.porMetro*100),v=>{ SIM.luz.porMetro=v/100; }));
  b.appendChild(sl('Luz',40,130,Math.round(SIM.luz.amb*100),v=>{ SIM.luz.amb=v/100; }));
  b.appendChild(sl('Escala',14,60,Math.round(ESTADO.cw*10),v=>{ ESTADO.cw=v/10; }));
  const dt=el('select'); [[0,'detalle bajo'],[1,'detalle medio'],[2,'detalle alto']].forEach(([k,t])=>{ const o=el('option',{value:k,textContent:t}); if(k===ESTADO.detalle) o.selected=true; dt.appendChild(o); });
  dt.onchange=()=>{ ESTADO.detalle=+dt.value; dibujar(); }; b.appendChild(dt);
  const ct=el('button',{textContent:ESTADO.contorno?'Contorno: sí':'Contorno: no',className:ESTADO.contorno?'on':''}); ct.onclick=()=>{ ESTADO.contorno=!ESTADO.contorno; dibujar(); }; b.appendChild(ct);
  b.appendChild(sl('Pasto al pie',0,100,Math.round(ESTADO.pasto*100),v=>{ ESTADO.pasto=v/100; }));
}
let _tr=0; function refrescar(){ clearTimeout(_tr); _tr=setTimeout(()=>{ for(const v of VIVOS) pintarGrid(v.cv,v.f(),v.zm?v.zm():ESTADO.cw); },60); }
const sel=(opts,val,fn)=>{ const s=el('select'); for(const k of Object.keys(opts)){ const o=el('option',{value:k,textContent:opts[k]}); if(String(k)===String(val)) o.selected=true; s.appendChild(o); } s.onchange=()=>fn(s.value); return s; };
const MATN=ES.MATS.reduce((a,k)=>(a[k]=ES.MATERIALES[k].nombre,a),{});
const TIPN=ES.TIPOS_ID.reduce((a,k)=>(a[k]=ES.TIPOS[k].nombre,a),{});
const GRPN=ES.GRUPOS_ID.reduce((a,k)=>(a[k]=ES.GRUPOS[k].nombre,a),{});

/* Dimensiona la escena con la estructura real: ancho = su caja, alto = altura × 1,7 filas por metro + su fondo */
function dimsDe(S){ const B=S.box; return {mw:Math.max(5,Math.ceil(B.umax*2)+2), mh:Math.ceil(B.vmax*1.7+B.zmax*2)+4, py:B.zmax+0.8}; }
function una(spec,extra){
  const S=ES.crear(spec), D=dimsDe(S), z=(extra&&extra.z)||1;
  const f=()=>escena({mw:D.mw,mh:D.mh,z,items:[estIt(S,D.mw/2,D.mh-D.py)]}); f.S=S; return f;
}
function guardarFav(spec){ const l=favs(); l.push(JSON.parse(JSON.stringify(spec))); guardarFavs(l); barra(); }
const botFav=spec=>{ const b=el('button',{textContent:'★ Conservar',title:'Guarda esta estructura (la receta, no la imagen)'}); b.onclick=()=>{ guardarFav(spec); b.textContent='★ Guardada'; }; return b; };
const ZM={muro:1,muroLadrillo:1,paredCaida:1,cercaPiedra:1,cercaMadera:1,puente:1,arco:0.9,escalera:1.2,chimenea:1.2,columna:1.5,pilar:1.4,pozo:1.5,puerta:1.9,ventana:2,craneo:3.2,cuernos:2.8,colmillos:2,costillar:2,huesosSueltos:1.6,esqueletoPequeno:2.4,esqueletoMediano:1.3,esqueletoGrande:0.9,nido:3,madriguera:1.8,guarida:1,esqueletoHumano:2.2,esqueletoGigante:1,esqueletoDragon:0.8,esqueletoSerpiente:0.8,restosBatalla:1.2,totemHuesos:1.6,circuloRitual:1.3};
const zmDe=t=>ZM[t]||1;

/* ---- Muestrario: las categorías pedidas para esta tanda, tres variantes de cada una ---- */
const MUESTRAS=[
  ['Muros de piedra',{tipo:'muro',mat:['mamposteria','sillar','piedraSeca'],det:0.18,edad:0.5,est:{musgo:0.35,liquen:0.25}}],
  ['Muros de ladrillo',{tipo:'muroLadrillo',mat:['ladrillo','ladrillo','ladrillo'],det:[0.15,0.4,0.7],edad:[0.3,0.55,0.8],est:{humedad:0.3,vegetacion:0.25}}],
  ['Muros derrumbados',{tipo:'paredCaida',mat:['mamposteria','sillar','ladrillo'],det:[0.75,0.9,1.0],edad:0.7,est:{musgo:0.5,vegetacion:0.4,tierra:0.4,hojas:0.3}}],
  ['Pozos antiguos',{tipo:'pozo',mat:['mamposteria','sillar','ladrillo'],det:[0.15,0.35,0.6],edad:[0.4,0.7,0.9],extra:{marco:true,polea:true,cubeta:true},est:{musgo:0.5,humedad:0.5,vegetacion:0.3}}],
  ['Columnas',{tipo:'columna',mat:['sillar','mamposteria','sillar'],det:[0.15,0.55,0.9],edad:0.7,est:{musgo:0.3,vegetacion:0.3,tierra:0.3}}],
  ['Arcos',{tipo:'arco',mat:['sillar','mamposteria','ladrillo'],det:[0.1,0.35,0.65],edad:0.7,est:{musgo:0.3,vegetacion:0.35,liquen:0.2}}],
  ['Puentes deteriorados',{tipo:'puente',mat:['madera','madera','madera'],det:[0.25,0.55,0.85],edad:[0.4,0.7,0.9],est:{humedad:0.4,musgo:0.3}}],
  ['Escaleras destruidas',{tipo:'escalera',mat:['mamposteria','sillar','piedraSeca'],det:[0.3,0.55,0.85],edad:0.7,est:{musgo:0.4,vegetacion:0.3,hojas:0.3}}],
  ['Chimeneas, puertas y ventanas',{tipo:['chimenea','puerta','ventana'],mat:['ladrillo','madera','madera'],det:[0.4,0.5,0.55],edad:0.7,est:{vegetacion:0.25,humedad:0.2,quemadura:0.35}}],
  ['Cercas',{tipo:['cercaPiedra','cercaMadera','cercaMadera'],mat:['piedraSeca','madera','madera'],det:[0.3,0.3,0.7],edad:[0.6,0.5,0.8],est:{musgo:0.3,vegetacion:0.3}}],
  ['Cráneos',{tipo:'craneo',mat:'hueso',det:[0.1,0.45,0.85],edad:[0.3,0.6,0.9],est:{musgo:0.15,tierra:0.2}}],
  ['Costillas',{tipo:'costillar',mat:'hueso',det:[0.2,0.55,0.9],edad:[0.4,0.6,0.9],est:{tierra:0.25,vegetacion:0.2}}],
  ['Cuernos y colmillos',{tipo:['cuernos','cuernos','colmillos'],mat:'hueso',det:[0.1,0.5,0.4],edad:[0.3,0.7,0.8],est:{tierra:0.15,musgo:0.1}}],
  ['Huesos parcialmente enterrados',{tipo:'huesosSueltos',mat:'hueso',det:[0.3,0.6,0.9],edad:[0.5,0.7,0.9],est:{enterrada:0.5,tierra:0.4,vegetacion:0.25}}],
  ['Esqueletos pequeños y medianos',{tipo:['esqueletoPequeno','esqueletoMediano','esqueletoMediano'],mat:'hueso',det:[0.1,0.3,0.85],edad:[0.4,0.6,0.85],est:{tierra:0.2,vegetacion:0.2,musgo:0.15}}],
  ['Esqueletos grandes: completo, incompleto, desordenado',{tipo:'esqueletoGrande',mat:'hueso',det:[0,0.55,0.95],edad:[0.4,0.65,0.9],est:{tierra:0.25,vegetacion:0.3,musgo:0.2}}],
  ['Nidos abandonados',{tipo:'nido',mat:'madera',det:[0.1,0.45,0.85],edad:[0.3,0.6,0.9],est:{musgo:0.2,hojas:0.3}}],
  ['Madrigueras y guaridas',{tipo:['madriguera','madriguera','guarida'],mat:'tierra',det:[0.1,0.65,0.3],edad:[0.4,0.7,0.6],est:{vegetacion:0.3,hojas:0.3}}],
  ['Esqueletos humanos',{tipo:'esqueletoHumano',mat:'hueso',det:[0,0.4,0.9],edad:[0.5,0.7,0.9],est:{tierra:0.2,vegetacion:0.15}}],
  ['Esqueletos de gigantes',{tipo:'esqueletoGigante',mat:'hueso',det:[0.05,0.45,0.9],edad:[0.6,0.75,0.9],est:{tierra:0.25,vegetacion:0.25,musgo:0.2}}],
  ['Esqueletos de dragón',{tipo:'esqueletoDragon',mat:'hueso',det:[0.05,0.5,0.9],edad:[0.6,0.8,0.95],est:{tierra:0.25,vegetacion:0.3,musgo:0.25}}],
  ['Serpientes gigantes',{tipo:'esqueletoSerpiente',mat:'hueso',det:[0.05,0.45,0.9],edad:[0.5,0.7,0.9],est:{tierra:0.25,vegetacion:0.25}}],
  ['Restos de batalla',{tipo:'restosBatalla',mat:'hueso',det:[0.15,0.5,0.9],edad:[0.4,0.7,0.9],est:{tierra:0.3,humedad:0.35,vegetacion:0.2}}],
  ['Tótems de huesos sobre un pilar',{tipo:'totemHuesos',mat:['madera','sillar','madera'],det:[0.1,0.4,0.8],edad:[0.4,0.7,0.9],est:{musgo:0.2,liquen:0.15}}],
  ['Círculos rituales de huesos',{tipo:'circuloRitual',mat:'hueso',det:[0.05,0.4,0.85],edad:[0.4,0.65,0.9],est:{tierra:0.2,hojas:0.2}}]
];
const pick=(v,k)=>Array.isArray(v)?v[k%v.length]:v;
function muestrario(c){
  c.appendChild(el('h2',{textContent:'Muestrario: construcciones, ruinas y estructuras rurales, tres variantes de cada una'}));
  c.appendChild(el('p',{className:'nota',textContent:'Cada cuadro lo genera el motor ahora mismo con una receta distinta (material, semilla, antigüedad, deterioro). "Conservar" guarda la receta en Favoritas. Cubre construcciones y ruinas, el pozo y los restos animales; madera caída, campamentos, cuevas, objetos abandonados y estatuas vienen después.'}));
  MUESTRAS.forEach(([tit,d],ii)=>{
    c.appendChild(el('h2',{textContent:(ii+1)+'. '+tit}));
    const fila=el('div',{className:'fila'});
    for(let k=0;k<3;k++){
      const tipo=pick(d.tipo,k), spec=Object.assign({tipo,mat:pick(d.mat,k),sem:ESTADO.muSem*13+ii*7+k*3+1,deterioro:pick(d.det,k),edad:pick(d.edad,k),estado:Object.assign({},d.est)},d.extra||{});
      fila.appendChild(figura(ES.TIPOS[tipo].nombre+' · '+ES.MATERIALES[spec.mat].nombre,una(spec),'edad '+spec.edad+' · deterioro '+spec.deterioro,botFav(spec),zmDe(tipo)));
    }
    c.appendChild(fila);
  });
  const reg=el('button',{textContent:'Regenerar variantes'}); reg.onclick=()=>{ ESTADO.muSem=rnd(); dibujar(); }; c.appendChild(el('div',{className:'ctl'},[reg]));
}
/* ---- Envejecer y deteriorar: la matriz edad × deterioro prueba que son dos perillas separadas ---- */
function envejecer(c){
  const e=ESTADO.env;
  c.appendChild(el('h2',{textContent:'Antigüedad y deterioro: dos perillas distintas'}));
  c.appendChild(el('p',{className:'nota',textContent:'Misma forma y misma semilla en las dieciséis. De izquierda a derecha sube el deterioro (qué falta, qué cayó); de arriba abajo sube la antigüedad (juntas comidas, aristas redondas, tono lavado). Arriba a la derecha hay algo reciente y destruido; abajo a la izquierda, algo muy viejo y entero.'}));
  const reg=el('button',{textContent:'Otra semilla'}); reg.onclick=()=>{ e.sem=rnd(); dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[sel(TIPN,e.tipo,v=>{ e.tipo=v; e.mat=ES.TIPOS[v].mat; dibujar(); }),sel(MATN,e.mat,v=>{ e.mat=v; dibujar(); }),reg]));
  const A=[['Nuevo',0],['Usado',0.18],['Viejo',0.45],['Muy antiguo',0.85]], Dd=[['Intacto',0],['Deteriorado',0.38],['Parcialmente destruido',0.68],['Derrumbado',1]];
  for(const [an,av] of A){
    c.appendChild(el('h2',{textContent:an+' (edad '+av+')'}));
    const fila=el('div',{className:'fila'});
    for(const [dn,dv] of Dd){ const spec={tipo:e.tipo,mat:e.mat,sem:e.sem,edad:av,deterioro:dv,estado:{musgo:av*0.6,humedad:av*0.3,vegetacion:av*0.3*dv}};
      fila.appendChild(figura(dn,una(spec),'',null,zmDe(e.tipo)*0.8)); }
    c.appendChild(fila);
  }
}
/* ---- Banco ---- */
const PARAM=[
  ['Forma',[['Escala',0.4,2.5,0.05,'escala'],['Orientación',0,6.28,0.05,'yaw'],['Inclinación',-0.35,0.35,0.01,'inclinacion'],['Largo (m)',0.4,16,0.1,'largo'],['Alto (m)',0.3,8,0.1,'alto'],['Grosor / fondo (m)',0.08,6,0.05,'grosor']]],
  ['Antigüedad y deterioro',[['Antigüedad',0,1,0.01,'edad'],['Deterioro',0,1,0.01,'deterioro']]],
  ['Apariencia',[['Tono (frío ↔ cálido)',-1,1,0.05,'tono'],['Luminosidad',-0.6,0.6,0.02,'lum'],['Saturación',0,2,0.05,'sat']]],
  ['Naturaleza y estado',[['Musgo',0,1,0.05,'estado.musgo'],['Líquenes',0,1,0.05,'estado.liquen'],['Humedad',0,1,0.05,'estado.humedad'],['Vegetación invasora',0,1,0.05,'estado.vegetacion'],['Tierra acumulada',0,1,0.05,'estado.tierra'],['Hojas',0,1,0.05,'estado.hojas'],['Quemadura',0,1,0.05,'estado.quemadura'],['Parcialmente enterrada',0,1,0.05,'estado.enterrada']]]
];
const getP=(sp,k)=>k.indexOf('estado.')===0?sp.estado[k.slice(7)]:sp[k];
function banco(c){
  const B=ESTADO.banco;
  c.appendChild(el('h2',{textContent:'Banco de pruebas'}));
  c.appendChild(el('p',{className:'nota',textContent:'Todos los controles son campos reales de la spec. Con "Editar: este objeto" se cambia sólo lo que ves (editar() devuelve qué capa se tocó y el motor reutiliza el sólido si no cambió la forma). Con "Editar: el generador" los cambios van a la plantilla del tipo y valen sólo para los objetos NUEVOS: lo ya hecho no se mueve.'}));
  const cont=el('div',{className:'fila'}); c.appendChild(cont);
  const panel=el('div',{id:'panel'}); cont.appendChild(panel);
  const modo=el('div',{className:'bt'}); for(const [k,t] of [['objeto','Editar: este objeto'],['generador','Editar: el generador']]){ const b=el('button',{textContent:t,className:B.modo===k?'on':''}); b.onclick=()=>{ B.modo=k; dibujar(); }; modo.appendChild(b); } panel.appendChild(modo);
  panel.appendChild(sel(TIPN,B.spec.tipo,v=>{ B.spec=ES.nuevo(v,B.spec.sem); B.spec=ES.limpiar(Object.assign({},B.spec,{mat:ES.TIPOS[v].mat})); dibujar(); }));
  panel.appendChild(sel(MATN,B.spec.mat,v=>{ aplicar({mat:v}); }));
  const est=el('div',{className:'est'}); const verEst=()=>{ const s=ES.estadisticas(); est.innerHTML='sólidos hechos <b>'+s.solidos+'</b> · reutilizados <b>'+s.aciertos+'</b> · rayos <b>'+s.rasters+'</b> · pintados <b>'+s.pintados+'</b>'; };
  function aplicar(cambios){
    if(B.modo==='generador'){ ES.plantilla(B.spec.tipo,cambios); verEst(); return; }
    B.spec=ES.editar(B.spec,cambios).spec; clearTimeout(B.t); B.t=setTimeout(()=>{ refrescarBanco(); verEst(); },40);
  }
  for(const [grupo,lista] of PARAM){
    panel.appendChild(el('h3',{textContent:grupo}));
    if(grupo==='Antigüedad y deterioro'){
      const a=el('div',{className:'bt'}); for(const k of Object.keys(ES.ANTIGUEDAD)){ const b=el('button',{textContent:k}); b.onclick=()=>{ aplicar({edad:ES.ANTIGUEDAD[k]}); dibujar(); }; a.appendChild(b); } panel.appendChild(a);
      const d=el('div',{className:'bt'}); for(const k of Object.keys(ES.DETERIORO)){ const b=el('button',{textContent:k}); b.onclick=()=>{ aplicar({deterioro:ES.DETERIORO[k]}); dibujar(); }; d.appendChild(b); } panel.appendChild(d);
    }
    for(const [txt,min,max,step,k] of lista){
      const lab=el('b',{textContent:Math.round(getP(B.spec,k)*100)/100}); const inp=el('input',{type:'range',min,max,step,value:getP(B.spec,k)});
      inp.oninput=e=>{ const v=+e.target.value; lab.textContent=Math.round(v*100)/100; aplicar(k.indexOf('estado.')===0?{estado:{[k.slice(7)]:v}}:{[k]:v}); };
      panel.appendChild(el('div',{className:'p'},[el('span',{textContent:txt}),lab,inp]));
    }
  }
  const t=B.spec.tipo;
  if(t==='pozo'||t==='puerta'){ panel.appendChild(el('h3',{textContent:'Piezas de '+ES.TIPOS[t].nombre.toLowerCase()}));
    if(t==='pozo') for(const k of ['marco','polea','cubeta','techo']){ const ch=el('input',{type:'checkbox',checked:!!B.spec[k]||(k!=='techo'&&B.spec[k]===undefined)}); ch.onchange=()=>aplicar({[k]:ch.checked}); panel.appendChild(el('label',{style:'display:flex;gap:6px;color:var(--dim)'},[ch,k])); }
    if(t==='puerta'){ const lab=el('b',{textContent:B.spec.hoja==null?0.4:B.spec.hoja}); const inp=el('input',{type:'range',min:0,max:1,step:0.05,value:B.spec.hoja==null?0.4:B.spec.hoja}); inp.oninput=e=>{ lab.textContent=e.target.value; aplicar({hoja:+e.target.value}); }; panel.appendChild(el('div',{className:'p'},[el('span',{textContent:'Hoja abierta'}),lab,inp])); } }
  panel.appendChild(el('h3',{textContent:'Semillas (cada una decide una sola capa)'}));
  const nums=el('div',{className:'bt'});
  for(const [txt,k,parte] of [['forma','sem','forma'],['deterioro','semD','deterioro'],['vegetación','semV','vegetacion']]){
    const n=el('input',{type:'number',value:B.spec[k],style:'width:88px',title:'Semilla de '+txt}); n.onchange=()=>aplicar({[k]:+n.value|0});
    const b=el('button',{textContent:'↻ '+txt,title:'Regenera sólo la '+txt}); b.onclick=()=>{ B.spec=ES.regenerar(B.spec,parte); refrescarBanco(); verEst(); dibujar(); };
    nums.appendChild(el('div',{style:'display:flex;flex-direction:column;gap:3px'},[n,b])); }
  panel.appendChild(nums);
  const bt=el('div',{className:'bt'}); const bb=(txt,f)=>{ const b=el('button',{textContent:txt}); b.onclick=f; bt.appendChild(b); };
  bb('Otra variante',()=>{ B.spec=ES.variar(B.spec); dibujar(); });
  bb('Fijar referencia',()=>{ B.ref=JSON.parse(JSON.stringify(B.spec)); refrescarBanco(); });
  bb('Quitar referencia',()=>{ B.ref=null; refrescarBanco(); });
  bb('Duplicar',()=>{ B.copias.push(JSON.parse(JSON.stringify(B.spec))); refrescarBanco(); });
  bb('Quitar copias',()=>{ B.copias=[]; refrescarBanco(); });
  bb('★ Conservar',()=>guardarFav(B.spec));
  panel.appendChild(bt); panel.appendChild(est); verEst();
  const der=el('div',{style:'display:flex;flex-direction:column;gap:12px'}); cont.appendChild(der); B._der=der; refrescarBanco();
}
function refrescarBanco(){
  const B=ESTADO.banco, der=B._der; if(!der) return; der.innerHTML=''; VIVOS.length=0;
  const mk=(sp,t)=>{ const S=ES.crear(sp), D=dimsDe(S); return figura(t,()=>escena({mw:D.mw,mh:D.mh,items:[estIt(S,D.mw/2,D.mh-D.py)]}),S.nombre+' · '+S.g.rubble+' piezas caídas',null,zmDe(sp.tipo)*1.1); };
  der.appendChild(mk(B.spec,'ACTUAL'));
  if(B.ref) der.appendChild(mk(B.ref,'REFERENCIA'));
  B.copias.forEach((sp,i)=>der.appendChild(mk(sp,'COPIA '+(i+1))));
}
/* ---- Agrupaciones: se descomponen y se edita cada parte por separado ---- */
function grupos(c){
  const g=ESTADO.grupo;
  c.appendChild(el('h2',{textContent:'Agrupaciones coherentes'}));
  c.appendChild(el('p',{className:'nota',textContent:'Un conjunto es una lista de partes con su posición. Elige una parte y edítala (deterioro, antigüedad, otra variante): las demás no se mueven. "Quitar parte" y "Regenerar grupo" también son reales.'}));
  if(!g.partes||g.partes._k!==g.tipo+'|'+g.sem+'|'+g.deterioro+'|'+g.edad){ const G=ES.grupo(g.tipo,g.sem,{deterioro:g.deterioro,edad:g.edad}); g.partes=ES.descomponer(G); g.partes._k=g.tipo+'|'+g.sem+'|'+g.deterioro+'|'+g.edad; g.parte=null; }
  const reg=el('button',{textContent:'Regenerar grupo'}); reg.onclick=()=>{ g.sem=rnd(); g.partes=null; dibujar(); };
  const gd=el('label',{},['Deterioro de todo ',el('input',{type:'range',min:0,max:100,value:g.deterioro==null?50:Math.round(g.deterioro*100)})]); gd.lastChild.onchange=e=>{ g.deterioro=e.target.value/100; g.partes=null; dibujar(); };
  const ge=el('label',{},['Antigüedad de todo ',el('input',{type:'range',min:0,max:100,value:g.edad==null?50:Math.round(g.edad*100)})]); ge.lastChild.onchange=e=>{ g.edad=e.target.value/100; g.partes=null; dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[sel(GRPN,g.tipo,v=>{ g.tipo=v; g.partes=null; dibujar(); }),gd,ge,reg]));
  const P=g.partes, ids={}; P.forEach(p=>ids[p.id]=p.id+' · '+ES.TIPOS[p.spec.tipo].nombre);
  if(!g.parte||!P.find(p=>p.id===g.parte)) g.parte=P.length?P[0].id:null;
  const cur=P.find(p=>p.id===g.parte);
  const ed=el('div',{className:'ctl'},[el('span',{style:'color:var(--dim)'},['Parte: ']),sel(ids,g.parte,v=>{ g.parte=v; dibujar(); })]);
  if(cur){
    const sl=(txt,k,min,max)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min:0,max:100,value:Math.round(cur.spec[k]*100)})]); l.lastChild.oninput=e=>{ cur.spec=ES.editar(cur.spec,{[k]:e.target.value/100}).spec; clearTimeout(g.t); g.t=setTimeout(refrescar,30); }; return l; };
    const b1=el('button',{textContent:'Otra variante de esta parte'}); b1.onclick=()=>{ cur.spec=ES.variar(cur.spec); dibujar(); };
    const b2=el('button',{textContent:'Quitar parte'}); b2.onclick=()=>{ g.partes.splice(g.partes.indexOf(cur),1); g.partes._k=g.tipo+'|'+g.sem+'|'+g.deterioro+'|'+g.edad; dibujar(); };
    const b3=el('button',{textContent:'↻ vegetación'}); b3.onclick=()=>{ cur.spec=ES.regenerar(cur.spec,'vegetacion'); dibujar(); };
    ed.appendChild(sl('Deterioro','deterioro')); ed.appendChild(sl('Antigüedad','edad')); ed.appendChild(b1); ed.appendChild(b3); ed.appendChild(b2);
  }
  c.appendChild(ed);
  let x0=1e9,x1=-1e9,y1=-1e9,hmax=0; const SS=P.map(p=>{ const S=ES.crear(p.spec); x0=Math.min(x0,p.x-S.box.umax); x1=Math.max(x1,p.x+S.box.umax); y1=Math.max(y1,p.y+S.box.zmax); hmax=Math.max(hmax,S.box.vmax); return S; });
  const mw=Math.max(8,Math.ceil(x1-x0)+3), mh=Math.ceil(hmax*1.7+y1+6), ox=-x0+1.5, oy=hmax*1.7+3;
  c.appendChild(el('div',{className:'fila'},[figura(GRPN[g.tipo],()=>escena({mw,mh,items:P.map((p,i)=>estIt(SS[i],ox+p.x,oy+p.y))}),P.length+' partes',null,0.9)]));
}
/* ---- Oclusión y distancia ---- */
function oclusion(c){
  const o=ESTADO.oc;
  c.appendChild(el('h2',{textContent:'Oclusión y distancia de cámara'}));
  c.appendChild(el('p',{className:'nota',textContent:'Arriba: la estructura con un árbol y una roca DELANTE (se pintan después por estar más al sur: la estructura queda tapada de verdad) y otra roca detrás. Abajo: la misma estructura a tres distancias de cámara (zoom). Las tres dibujan los mismos metros; sólo cambia el número de celdas por metro.'}));
  const reg=el('button',{textContent:'Otra semilla'}); reg.onclick=()=>{ o.sem=rnd(); dibujar(); };
  c.appendChild(el('div',{className:'ctl'},[sel(TIPN,o.tipo,v=>{ o.tipo=v; dibujar(); }),reg]));
  const sp={tipo:o.tipo,sem:o.sem,deterioro:ES.TIPOS[o.tipo].det==null?0.4:ES.TIPOS[o.tipo].det,edad:0.6,estado:{musgo:0.3,vegetacion:0.25}}, S=ES.crear(sp), D=dimsDe(S);
  const mw=D.mw+10, mh=D.mh+7, cx=mw/2, cy=mh-D.py-3;
  const roca=(sem,tam,mat)=>RO.crearRoca({mat,tam,forma:'irregular',sem,estado:{musgo:0.3}});
  const R1=roca(5,'media','granito'), R2=roca(9,'grande','caliza');
  const A=AR.generar('encino','grande',9,{variante:0});
  const items=[estIt(S,cx,cy),
    {x:cx-S.box.umax*0.45,y:cy+2.6,pintar:ctx=>{ AR.pintarSombra(A,ctx); AR.pintar(A,ctx); }},
    {x:cx+S.box.umax*0.55,y:cy+2.2,pintar:ctx=>{ RO.pintarSombra(R1,ctx); RO.pintar(R1,ctx); }},
    {x:cx-S.box.umax-1.2,y:cy-1.2,pintar:ctx=>{ RO.pintarSombra(R2,ctx); RO.pintar(R2,ctx); }}];
  c.appendChild(el('div',{className:'fila'},[figura('Con árbol y rocas delante',()=>escena({mw,mh,items}),S.nombre,null,0.95)]));
  c.appendChild(el('h2',{textContent:'La misma estructura a tres distancias'}));
  const fila=el('div',{className:'fila'});
  for(const [z,t] of [[1,'cerca (zoom 1)'],[0.6,'media (zoom 0,6)'],[0.4,'lejos (zoom 0,4)']]) fila.appendChild(figura(t,una(sp,{z}),'celdas por metro '+(CPMl*z).toFixed(1),null,Math.max(1,1/z*0.9)));
  c.appendChild(fila);
}
/* ---- Favoritas ---- */
function favoritas(c){
  c.appendChild(el('h2',{textContent:'Favoritas conservadas'}));
  c.appendChild(el('p',{className:'nota',textContent:'Se guarda la receta (tipo, material, semillas, medidas, antigüedad, deterioro, estado), no una imagen: al abrirla el motor vuelve a generar exactamente la misma estructura.'}));
  const l=favs(); if(!l.length){ c.appendChild(el('p',{className:'nota',textContent:'Todavía no hay ninguna. Usa "★ Conservar" en el muestrario o en el banco.'})); return; }
  const fila=el('div',{className:'fila'});
  l.forEach((spec,i)=>{ const b=el('button',{textContent:'Quitar'}); b.onclick=()=>{ const x=favs(); x.splice(i,1); guardarFavs(x); dibujar(); };
    const sp=ES.limpiar(spec); fila.appendChild(figura(ES.TIPOS[sp.tipo].nombre,una(sp),ES.MATERIALES[sp.mat].nombre+' · sem '+sp.sem,b,zmDe(sp.tipo))); });
  c.appendChild(fila);
}
function dibujar(){ VIVOS.length=0; barra(); const c=$('#cuerpo'); c.innerHTML='';
  ({muestrario,envejecer,banco,grupos,oclusion,favoritas}[ESTADO.vista]||muestrario)(c); }
const q=new URLSearchParams(location.search);
if(q.get('vista')) ESTADO.vista=q.get('vista');
if(q.get('escala')) ESTADO.cw=+q.get('escala');
if(q.get('pasto')!=null) ESTADO.pasto=+q.get('pasto');
if(q.get('det')!=null) ESTADO.banco.spec=ES.limpiar(Object.assign({},ESTADO.banco.spec,{deterioro:+q.get('det')}));
if(q.get('tipo')&&ES.TIPOS[q.get('tipo')]){ ESTADO.banco.spec=ES.nuevo(q.get('tipo'),ESTADO.banco.spec.sem); ESTADO.env.tipo=q.get('tipo'); ESTADO.env.mat=ES.TIPOS[q.get('tipo')].mat; ESTADO.oc.tipo=q.get('tipo'); }
if(q.get('semilla')) ESTADO.banco.spec=ES.limpiar(Object.assign({},ESTADO.banco.spec,{sem:+q.get('semilla')}));
if(q.get('grupo')) ESTADO.grupo.tipo=q.get('grupo');
window.EstructurasLab={ESTADO,SIM,escena,dibujar,ES,EN};
dibujar();
})();
