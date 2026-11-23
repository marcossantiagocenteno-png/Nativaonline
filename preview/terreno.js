/* Nativa Online — LABORATORIO DE TERRENO Y VEGETACIÓN POR SECTORES (independiente del juego).
   Carga el pasto real y el viento global sin tocarlos; el motor es preview/terreno-motor.js.
   Vistas: Muestras (las 16 pruebas del encargo) · Banco (editor de un sector con todos los parámetros,
   selección en metros, transiciones, historial, copiar configuración, preajustes, JSON). */
(function(){
'use strict';
const NV=window.NV, T=NV.terreno;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ASP=1.393, FONT_K=1/0.42;
/* puente con el pasto del juego (igual que los demás laboratorios) */
const tn=NV.makeNoise(NV.mulberry(31771));
window.tex2=(wx,wy,e)=>0.66*tn(wx/e,wy/e,1,1)+0.34*tn(wx/(e*0.42)+37,wy/(e*0.42),1,1);
window.packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
let GR=null;
window.put=(c,r,ch,col)=>{ if(!GR||c<0||c>=GR.cols||r<0||r>=GR.rows) return; const i=r*GR.cols+c; GR.G[i]=ch; GR.C[i]=col; };

/* ---- escena: un rectángulo de metros del mundo con los sectores que haya ---- */
function escena(o){
  const cols=Math.round(o.mw*CPM), rows=Math.round(o.mh*RPM);
  GR={cols,rows,G:new Uint16Array(cols*rows),C:new Int32Array(cols*rows)};
  for(let my=0;my<o.mh;my++) for(let mx=0;mx<o.mw;mx++){
    const wx=o.x0+mx, wy=o.y0+my;
    const d=NV.vientoPasto?NV.vientoPasto(wx,wy,o.t||0):0;
    T.dibujarMetro(wx,wy,{base:mx*CPM,rb0:my*RPM,luz:o.luz,calor:0,dPasto:d||0,t:o.t||0,cx0:o.x0*CPM+mx*CPM});
  }
  return GR;
}
function pintar(cv,g,cw){
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

/* ---- las 16 muestras del encargo ---- */
const MW=16, MH=9, OX=40, OY=40;
const S=(o)=>Object.assign({x:OX,y:OY,w:MW,h:MH},o);
const MUESTRAS=[
 ['Pasto corto abundante',[S({pasto:{densidad:0.95,alto:0.12}})]],
 ['Pasto largo escaso',[S({pasto:{densidad:0.22,alto:0.95}})]],
 ['Verde claro',[S({pasto:{tono:'claro',claridad:0.25}})]],
 ['Verde oscuro',[S({pasto:{tono:'oscuro',oscuridad:0.3}})]],
 ['Pasto seco',[S({pasto:{estado:'seco',tono:'seco',densidad:0.4}})]],
 ['Pasto quemado',[S({terreno:'quemado',pasto:{estado:'quemado',densidad:0.4}})]],
 ['Pasto nevado',[S({terreno:'pastonieve',pasto:{estado:'nieve-parcial',nieve:0.6}})]],
 ['Flores rojas',[S({flores:{cantidad:1.8,roja:true,blanca:false,distribucion:'grupos'}})]],
 ['Flores amarillas',[S({flores:{cantidad:1.8,amarilla:true,blanca:false,distribucion:'grupos'}})]],
 ['Flores blancas',[S({flores:{cantidad:1.8,blanca:true,distribucion:'grupos'}})]],
 ['Sin flores',[S({flores:{cantidad:0}})]],
 ['Arena',[S({terreno:'arena'})]],
 ['Pantano',[S({terreno:'pantano'})]],
 ['Tierra húmeda',[S({terreno:'humeda',visual:{humedad:0.6}})]],
 ['Transición pasto → arena',[S({}),S({terreno:'arena',x:OX+MW/2,w:MW/2,trans:{tipo:'organica',ancho:5}})]],
 ['Transición verde → seco',[S({}),S({terreno:'muerta',pasto:{estado:'seco',tono:'seco',densidad:0.45},x:OX+MW/2,w:MW/2,trans:{tipo:'irregular',ancho:5}})]],
 ['Transición natural → nieve',[S({}),S({terreno:'pastonieve',pasto:{estado:'nieve-parcial',nieve:0.7},x:OX+MW/2,w:MW/2,trans:{tipo:'gradual',ancho:6}})]]
];
function cargarEscena(lista){ T.nuevoMundo(); lista.forEach(s=>T.agregar(s)); }

/* ---- estado de la página ---- */
const E={vista:'muestras',cw:2.6,luz:0.9,t:0,anim:false,sel:null,banco:null,favN:1,
  rect:{x:OX,y:OY,w:20,h:10}};
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };
const css=document.createElement('style');
css.textContent=':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
'#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
'#barra label{display:flex;align-items:center;gap:6px;color:var(--dim)}input[type=range]{accent-color:var(--oro)}'+
'button,select,input[type=number],input[type=text],textarea{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
'button.on{background:var(--oro);color:#000}h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:100ch}.fila{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px}'+
'figure{margin:0;border:1px solid #2a2a26;background:#000}figure canvas{display:block}figcaption{padding:5px 9px;border-top:1px solid #2a2a26;font-size:12px;color:var(--oro)}'+
'#banco{display:flex;flex-wrap:wrap;gap:14px;padding:12px 14px;align-items:flex-start}#panel{width:330px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:6px;max-height:calc(100vh - 70px);overflow:auto}'+
'#panel h3{margin:8px 0 2px;font-size:12px;color:var(--oro);text-transform:uppercase;letter-spacing:.06em}'+
'.p{display:grid;grid-template-columns:1fr 60px;gap:1px 8px;align-items:center}.p span{color:var(--dim);font-size:12px}.p b{text-align:right;color:var(--oro);font-weight:normal}.p input[type=range]{grid-column:1/3;width:100%}'+
'#panel select{width:100%}.bt{display:flex;flex-wrap:wrap;gap:6px}.ck{display:flex;gap:10px;color:var(--dim)}.ck label{display:flex;gap:4px;align-items:center}'+
'.wh{display:flex;gap:6px;align-items:center;color:var(--dim)}.wh input{width:64px}.cuadro{position:relative}.cuadro canvas{display:block}'+
'.marco{position:absolute;border:1px dashed var(--oro);pointer-events:none;box-shadow:0 0 0 1px #000a}'+
'textarea{width:100%;height:70px;font-size:11px;cursor:text}';
document.head.appendChild(css);
document.title='Laboratorio de terreno y vegetación — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';

function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['muestras','Las 16 muestras'],['banco','Editor de sectores']]){
    const x=el('button',{textContent:tx,className:E.vista===id?'on':''}); x.onclick=()=>{ E.vista=id; dibujar(); }; b.appendChild(x); }
  const l1=el('label',{},['Luz ',el('input',{type:'range',min:40,max:130,value:Math.round(E.luz*100)})]); l1.lastChild.oninput=e=>{ E.luz=e.target.value/100; dibujar(true); };
  const l2=el('label',{},['Escala ',el('input',{type:'range',min:16,max:44,value:Math.round(E.cw*10)})]); l2.lastChild.onchange=e=>{ E.cw=e.target.value/10; dibujar(); };
  const an=el('button',{textContent:E.anim?'Viento: moviéndose':'Viento: quieto',className:E.anim?'on':''}); an.onclick=()=>{ E.anim=!E.anim; barra(); loop(); };
  b.append(l1,l2,an);
}
let _raf=0, _last=0;
function loop(){ cancelAnimationFrame(_raf); if(!E.anim) return;
  const f=(ts)=>{ if(ts-_last>110){ _last=ts; E.t+=0.11; redibujarCanvases(); } _raf=requestAnimationFrame(f); }; _raf=requestAnimationFrame(f); }
let _vivos=[];
function redibujarCanvases(){ for(const v of _vivos) v(); }

function fig(titulo,lista,mw,mh,x0,y0,extra){
  const cv=el('canvas');
  const pintarMe=()=>{ cargarEscena(lista); pintar(cv,escena({mw,mh,x0,y0,luz:E.luz,t:E.t}),E.cw); };
  _vivos.push(pintarMe); pintarMe();
  return el('figure',{},[el('div',{className:'cuadro'},[cv]),el('figcaption',{textContent:titulo}),...(extra?[extra]:[])]);
}

/* ---- Vista 1: las 16 muestras ---- */
function muestras(c){
  c.appendChild(el('h2',{textContent:'Las 16 pruebas del encargo'}));
  c.appendChild(el('p',{className:'nota',textContent:'Cada una es un sector de '+MW+'×'+MH+' m dibujado por el pasto real del juego, ajustado por la capa de terreno. Las tres últimas son dos sectores con una transición en medio. Luz y viento son los globales.'}));
  const fila=el('div',{className:'fila'}); c.appendChild(fila);
  MUESTRAS.forEach(([t,l],i)=>{ const b=el('button',{textContent:'Abrir en el editor'}); b.onclick=()=>{ E.banco=T.copia(l.length>1?l[l.length-1]:l[0]); E.baseSectores=l.length>1?[l[0]]:[]; E.vista='banco'; dibujar(); };
    fila.appendChild(fig((i+1)+'. '+t,l,MW,MH,OX,OY,b)); });
}

/* ---- Vista 2: el editor ---- */
const PRE={
 'Pradera A (verde)':{terreno:'pradera'},
 'Campo seco B':{terreno:'muerta',pasto:{estado:'seco',tono:'seco',densidad:0.45}},
 'Pantano C':{terreno:'pantano',pasto:{densidad:0.7}},
 'Pradera nevada D':{terreno:'pastonieve',pasto:{estado:'nieve-parcial',nieve:0.65}},
 'Pradera de flores':{flores:{cantidad:3.2,roja:true,amarilla:true,blanca:true,distribucion:'concentradas'}},
 'Hierba alta':{pasto:{alto:0.9,densidad:0.7}}
};
function banco(c){
  const wrap=el('div',{id:'banco'}); c.appendChild(wrap);
  if(!T.mundo.sectores.length&&!E.banco){ E.banco=T.normalizar({x:OX+2,y:OY+1,w:16,h:8,nombre:'Sector 1'}); E.baseSectores=[]; }
  const cur=()=>E.banco;
  const cvw=el('div',{className:'cuadro'}); const cv=el('canvas'); const marco=el('div',{className:'marco'}); cvw.append(cv,marco);
  const VW=34, VH=16, VX=OX-2, VY=OY-1;
  const redraw=()=>{ T.nuevoMundo(); (E.baseSectores||[]).forEach(s=>T.agregar(s)); const s=cur(); if(s) T.agregar(Object.assign({},s,{id:undefined}));
    pintar(cv,escena({mw:VW,mh:VH,x0:VX,y0:VY,luz:E.luz,t:E.t}),E.cw);
    if(s){ const cw=E.cw, ch=cw*ASP*RPM/CPM*CPM/ (CPM) ; const pxm=cw*CPM, pym=cw*ASP*RPM;
      Object.assign(marco.style,{left:((s.x-VX)*pxm)+'px',top:((s.y-VY)*pym)+'px',width:(s.w*pxm)+'px',height:(s.h*pym)+'px'}); } };
  _vivos.push(redraw);
  const panel=el('div',{id:'panel'});
  wrap.append(cvw,panel);
  const aplicar=(patch)=>{ const s=cur(); const n=T.normalizar(Object.assign(T.copia(s),patch)); for(const g of ['pasto','flores','relieve','visual','trans']) if(patch[g]) n[g]=T.normalizar(Object.assign(T.copia(s),{[g]:Object.assign({},s[g],patch[g])}))[g];
    (E.hist=E.hist||[]).push(T.copia(s)); if(E.hist.length>40) E.hist.shift(); E.banco=n; redraw(); };
  const sel=(titulo,valor,opts,fn)=>{ const s=el('select'); for(const [k,t] of opts) s.appendChild(el('option',{value:k,textContent:t,selected:k===valor})); s.onchange=()=>fn(s.value); panel.append(el('div',{className:'p'},[el('span',{textContent:titulo})]),s); };
  const rng=(t,v,mn,mx,st,fn,fmt)=>{ const o=el('b',{textContent:(fmt||(x=>(+x).toFixed(2)))(v)}); const i=el('input',{type:'range',min:mn,max:mx,step:st,value:v});
    i.oninput=()=>{ o.textContent=(fmt||(x=>(+x).toFixed(2)))(i.value); fn(+i.value); }; panel.append(el('div',{className:'p'},[el('span',{textContent:t}),o,i])); };
  const s=cur();
  panel.append(el('h3',{textContent:'1 · Superficie (metros del mundo)'}));
  const nuevo=()=>{ const r=el('div',{className:'wh'},[]);
    for(const [k,t] of [['x','x'],['y','y'],['w','ancho'],['h','largo']]){ const i=el('input',{type:'number',value:s[k],step:1,min:k==='w'||k==='h'?1:-9999}); i.onchange=()=>aplicar({[k]:+i.value}); r.append(t+' ',i); } return r; };
  panel.append(nuevo());
  const presetTam=el('div',{className:'bt'}); for(const [a,b] of [[5,5],[10,10],[20,10],[10,30],[50,20]]){ const x=el('button',{textContent:a+'×'+b}); x.onclick=()=>{ aplicar({w:a,h:b}); dibujar(); }; presetTam.append(x); } panel.append(presetTam);
  panel.append(el('h3',{textContent:'2 · Terreno'}));
  sel('Superficie',s.terreno,Object.keys(T.TERRENOS).map(k=>[k,T.TERRENOS[k].g+' · '+T.TERRENOS[k].n]),v=>{ aplicar({terreno:v}); });
  panel.append(el('h3',{textContent:'3 · Pasto'}));
  rng('Densidad (0 muy escaso · 1 muy denso)',s.pasto.densidad,0,1,0.01,v=>aplicar({pasto:{densidad:v}}));
  rng('Altura (0 muy corto · 1 muy largo)',s.pasto.alto,0,1,0.01,v=>aplicar({pasto:{alto:v}}));
  sel('Tono',s.pasto.tono,Object.keys(T.TONOS).map(k=>[k,T.TONOS[k].n]),v=>{ aplicar({pasto:{tono:v}}); });
  rng('Claridad',s.pasto.claridad,0,1,0.01,v=>aplicar({pasto:{claridad:v}}));
  rng('Oscuridad',s.pasto.oscuridad,0,1,0.01,v=>aplicar({pasto:{oscuridad:v}}));
  rng('Saturación',s.pasto.saturacion,0,1,0.01,v=>aplicar({pasto:{saturacion:v}}));
  rng('Variación natural',s.pasto.variacion,0,1,0.01,v=>aplicar({pasto:{variacion:v}}));
  sel('Estado',s.pasto.estado,Object.keys(T.ESTADOS).map(k=>[k,T.ESTADOS[k]]),v=>{ aplicar({pasto:{estado:v}}); });
  rng('Cobertura de nieve',s.pasto.nieve,0,1,0.01,v=>aplicar({pasto:{nieve:v}}));
  panel.append(el('h3',{textContent:'4 · Flores'}));
  sel('Cantidad',String(s.flores.cantidad),T.CANTIDADES.map(([t,v])=>[String(v),t]),v=>{ aplicar({flores:{cantidad:+v}}); });
  const ck=el('div',{className:'ck'}); for(const k of ['roja','amarilla','blanca']){ const i=el('input',{type:'checkbox',checked:s.flores[k]}); i.onchange=()=>aplicar({flores:{[k]:i.checked}}); ck.append(el('label',{},[i,k])); } panel.append(ck);
  sel('Distribución',s.flores.distribucion,Object.keys(T.DISTRIBUCIONES).map(k=>[k,T.DISTRIBUCIONES[k].n]),v=>{ aplicar({flores:{distribucion:v}}); });
  panel.append(el('h3',{textContent:'5 · Relieve y aspecto'}));
  sel('Relieve',s.relieve.tipo,Object.keys(T.RELIEVES).map(k=>[k,T.RELIEVES[k].n]),v=>{ aplicar({relieve:{tipo:v}}); });
  rng('Intensidad del relieve',s.relieve.intensidad,0,1,0.01,v=>aplicar({relieve:{intensidad:v}}));
  const gk=el('input',{type:'checkbox',checked:s.relieve.geometria}); gk.onchange=()=>aplicar({relieve:{geometria:gk.checked}});
  panel.append(el('div',{className:'ck'},[el('label',{},[gk,'Alzar el dibujo con el relieve (en el juego, geometría real: se decide al integrar)'])]));
  for(const [k,t] of [['sombra','Intensidad de sombra'],['contraste','Contraste'],['profundidad','Profundidad visual'],['variacionLuz','Variación de iluminación'],['humedad','Humedad'],['textura','Textura superficial']])
    rng(t,s.visual[k],0,1,0.01,v=>aplicar({visual:{[k]:v}}));
  panel.append(el('h3',{textContent:'6 · Transición con lo que lo rodea'}));
  sel('Tipo',s.trans.tipo,Object.keys(T.TRANSICIONES).map(k=>[k,T.TRANSICIONES[k]]),v=>{ aplicar({trans:{tipo:v}}); });
  rng('Ancho (m)',s.trans.ancho,0,20,0.5,v=>aplicar({trans:{ancho:v}}),x=>(+x).toFixed(1));
  panel.append(el('h3',{textContent:'Acciones'}));
  const bt=el('div',{className:'bt'}); panel.append(bt);
  const B=(t,fn)=>{ const b=el('button',{textContent:t}); b.onclick=fn; bt.append(b); };
  B('Regenerar sólo este sector',()=>aplicar({sem:((cur().sem||0)+1+((Math.random()*997)|0))}));
  B('Volver a la configuración anterior',()=>{ if(E.hist&&E.hist.length){ E.banco=E.hist.pop(); dibujar(); } });
  B('Copiar configuración',()=>{ E.copiado=T.copia(cur()); });
  B('Pegar configuración',()=>{ if(E.copiado){ const c=T.copia(E.copiado); aplicar({terreno:c.terreno,pasto:c.pasto,flores:c.flores,relieve:c.relieve,visual:c.visual,trans:c.trans}); dibujar(); } });
  B('Restaurar valores originales',()=>{ const c=cur(); E.banco=T.normalizar({x:c.x,y:c.y,w:c.w,h:c.h,nombre:c.nombre}); dibujar(); });
  B('Guardar como preajuste',()=>{ T.guardarFavorito('Favorito '+(E.favN++),cur()); dibujar(); });
  B('Fijar este sector y empezar otro',()=>{ (E.baseSectores=E.baseSectores||[]).push(T.copia(cur())); const c=cur(); E.banco=T.normalizar({x:c.x+c.w,y:c.y,w:c.w,h:c.h,nombre:'Sector '+(E.baseSectores.length+1)}); dibujar(); });
  B('Quitar los sectores fijados',()=>{ E.baseSectores=[]; dibujar(); });
  sel('Preajuste',' ',[[' ','— elegir —'],...Object.keys(PRE).map(k=>[k,k]),...Object.keys(T.mundo.fav).map(k=>['fav:'+k,k])],v=>{ if(v===' ') return;
    const p=v.indexOf('fav:')===0?T.favorito(v.slice(4)):PRE[v]; const c=cur(); E.banco=T.normalizar(Object.assign({x:c.x,y:c.y,w:c.w,h:c.h,nombre:c.nombre},p)); dibujar(); });
  panel.append(el('h3',{textContent:'Guardado (JSON del mundo)'}));
  const ta=el('textarea',{spellcheck:false}); panel.append(ta);
  const b2=el('div',{className:'bt'}); panel.append(b2);
  const B2=(t,fn)=>{ const b=el('button',{textContent:t}); b.onclick=fn; b2.append(b); };
  B2('Exportar',()=>{ T.nuevoMundo(); (E.baseSectores||[]).forEach(x=>T.agregar(x)); T.agregar(cur()); ta.value=T.exportar(); });
  B2('Importar',()=>{ try{ T.importar(ta.value); const l=T.mundo.sectores.map(x=>T.copia(x)); E.banco=l.pop(); E.baseSectores=l; dibujar(); }catch(e){ ta.value='Error: '+e.message; } });
  redraw();
}

function dibujar(soloCanvas){
  if(soloCanvas&&_vivos.length){ redibujarCanvases(); return; }
  _vivos=[]; barra(); const c=$('#cuerpo'); c.innerHTML='';
  if(E.vista==='muestras') muestras(c); else banco(c);
  loop();
}
dibujar();
})();
