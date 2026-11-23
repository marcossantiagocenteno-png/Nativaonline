/* Nativa Online — EL MUNDO EDITABLE.
   El mundo del juego = lo que genera la semilla + las ediciones guardadas aquí.
   Este módulo es dueño de las ediciones, que son DATOS puros:

     {formato:1, semilla:'claro-01',
      paneles:{ 'pi,pj':{ def:{bioma,nombre,esq?}, suelo:[[x,y,'d'],..],
                          objetos:{agregar:[{x,y,k,h,sp?,s?,len?}], quitar:[[x,y],..]},
                          alturas:[[x,y,dm],..] } },
      rasgos:[{id,tipo:'camino'|'rio'|..,puntos:[[x,y],..],ancho,material:'d'}],
      caminos:[{id,tipo:'camino',puntos:[[x,y],..],camino:{familia,params,vs,anchos,semTrazado,semTextura,fin,sectores}}]}

   `rasgos` son líneas de una sola letra de material (el suelo plano de siempre). `caminos` son los del motor de
   caminos (src/juego/caminos.js): se PINTAN encima del suelo, en cada cuadro, y no tocan el terreno ni los paneles;
   por eso agregar o quitar uno no regenera nada, sólo vuelve a dibujar.

   Coordenadas: las de ADENTRO del juego (x crece al este, y crece al SUR), en metros enteros del
   mundo. Los paneles se llaman 'pi,pj' como en paneles.js (pj crece al sur).

   Se aplican, panel por panel y en este orden, justo después de generarlo:
     1. rasgos (caminos, ríos: líneas con ancho y material, en el orden de la lista)
     2. suelo (pinceladas metro por metro)
     3. objetos (quitar los generados, agregar los nuevos)
   y las alturas son una diferencia sobre el relieve (NV.mundo.deltaAltura, que alturaCalc suma).
   Sin ediciones no cambia NADA: el juego sale idéntico (lo vigila pruebas/dorado.js).

   REGLA DE ORO: este módulo no sabe que existe el Modo Dios. El editor llama a editar(), cargar()
   y exportar(); el mundo no depende de él ni de ningún estado suyo. */

const NVe = window.NV;

const FORMATO = 2;
const L = NVe.LADO;
const clavePanel = (pi,pj)=>pi+','+pj;
const claveXY = (x,y)=>x+','+y;
const kAlt = (x,y)=>(x+2000)*8192+(y+2000);      // la misma clave que usa paneles.js

/* ---------- estado interno (Maps para buscar rápido; se serializa ordenado) ---------- */
let D = null;                    // {semilla, pan:Map<'pi,pj', P>, rasgos:[], caminos:[]}
let idxAlt = new Map();          // kAlt -> metros de diferencia
const oyentes = [];
let version = 0;                 // sube con cada cambio: el editor y el guardado saben si hay algo nuevo

const nuevoP = ()=>({def:null, suelo:new Map(), agregar:[], quitar:new Set(), alturas:new Map()});
function datosVacios(){ return {semilla:NVe.CONFIG.seed, pan:new Map(), rasgos:[], caminos:[], terreno:[]}; }
const pDe = (k,crear)=>{ let P=D.pan.get(k); if(!P&&crear){ P=nuevoP(); D.pan.set(k,P); } return P||null; };
const panelDeXY = (x,y)=>clavePanel(Math.floor(x/L),Math.floor(y/L));

/* ---------- validación y conversión (archivo <-> estado) ---------- */
const MIGRACIONES = {          // MIGRACIONES[n] = f(datos) que sube un archivo del formato n al n+1
  1:o=>Object.assign({},o,{formato:2,caminos:o.caminos||[]})     // 1 -> 2: aparecen los caminos del motor de caminos
};
function validar(o){
  if(!o||typeof o!=='object') throw new Error('el mundo no es un objeto');
  let f=o.formato|0;
  if(f<1) throw new Error('el mundo no trae formato');
  if(f>FORMATO) throw new Error('este mundo es de un formato más nuevo ('+f+') que el que entiende el juego ('+FORMATO+')');
  while(f<FORMATO){ if(!MIGRACIONES[f]) throw new Error('no hay migración desde el formato '+f); o=MIGRACIONES[f](o); f++; }
  if(o.semilla!==NVe.CONFIG.seed) throw new Error('el mundo es de la semilla "'+o.semilla+'" y el juego usa "'+NVe.CONFIG.seed+'"');
  const mat=m=>typeof m==='string'&&m.length===1&&!!NVe.MAT[m];
  const xy=(a,quien)=>{ if(!Array.isArray(a)||!Number.isInteger(a[0])||!Number.isInteger(a[1])) throw new Error(quien+': coordenadas inválidas'); };
  for(const k in (o.paneles||{})){
    if(!/^-?\d+,-?\d+$/.test(k)) throw new Error('panel con nombre inválido: '+k);
    const P=o.paneles[k];
    for(const s of (P.suelo||[])){ xy(s,'suelo'); if(!mat(s[2])) throw new Error('suelo: material desconocido "'+s[2]+'"'); }
    for(const a of (P.alturas||[])){ xy(a,'alturas'); if(typeof a[2]!=='number') throw new Error('alturas: valor inválido'); }
    for(const q of ((P.objetos||{}).quitar||[])) xy(q,'objetos.quitar');
    for(const a of ((P.objetos||{}).agregar||[])){ xy([a.x,a.y],'objetos.agregar'); if(typeof a.k!=='string') throw new Error('objeto sin tipo'); }
    if(P.def&&typeof P.def.bioma!=='string') throw new Error('panel '+k+': def sin bioma');
  }
  for(const r of (o.rasgos||[])){
    if(typeof r.id!=='string'||!Array.isArray(r.puntos)||r.puntos.length<1) throw new Error('rasgo inválido');
    for(const p of r.puntos) if(typeof p[0]!=='number'||typeof p[1]!=='number') throw new Error('rasgo '+r.id+': punto inválido');
    if(!(r.ancho>0)||!mat(r.material)) throw new Error('rasgo '+r.id+': ancho o material inválido');
  }
  for(const r of (o.caminos||[])) validarCamino(r);
  for(const r of (o.terreno||[])) validarTerreno(r);
  return o;
}
/* estructura, no familia: este archivo se lee ANTES de que cargue el motor de caminos; la familia se comprueba al armarlo */
function validarCamino(r){
  const num=v=>typeof v==='number'&&isFinite(v);
  if(!r||typeof r.id!=='string'||!r.id||r.id.slice(0,2)==='__') throw new Error('camino sin nombre válido');
  if(!Array.isArray(r.puntos)||r.puntos.length<2) throw new Error('camino '+r.id+': necesita al menos dos puntos');
  for(const p of r.puntos) if(!Array.isArray(p)||!num(p[0])||!num(p[1])) throw new Error('camino '+r.id+': punto inválido');
  const c=r.camino; if(!c||typeof c.familia!=='string') throw new Error('camino '+r.id+': sin familia');
  if(!c.params||typeof c.params!=='object'||!(c.params.ancho>0)) throw new Error('camino '+r.id+': sin parámetros');
  if(c.vs&&(!Array.isArray(c.vs)||c.vs.length!==r.puntos.length)) throw new Error('camino '+r.id+': vs no coincide con los puntos');
  if(c.anchos&&(!Array.isArray(c.anchos)||c.anchos.length!==r.puntos.length)) throw new Error('camino '+r.id+': anchos no coincide con los puntos');
}
/* un sector de terreno: estructura nada más; las perillas las normaliza el motor (src/juego/terreno.js) al dibujar */
function validarTerreno(r){
  const num=v=>typeof v==='number'&&isFinite(v);
  if(!r||typeof r.id!=='string'||!r.id||r.id.slice(0,2)==='__') throw new Error('sector de terreno sin nombre válido');
  for(const k of ['x','y','w','h']) if(!num(r[k])) throw new Error('sector '+r.id+': '+k+' inválido');
  if(!(r.w>0)||!(r.h>0)) throw new Error('sector '+r.id+': sin tamaño');
  if(typeof r.terreno!=='string') throw new Error('sector '+r.id+': sin terreno');
}
function desdeArchivo(o){
  o=validar(o); const d={semilla:o.semilla,pan:new Map(),rasgos:[],caminos:(o.caminos||[]).map(r=>JSON.parse(JSON.stringify(r))),terreno:(o.terreno||[]).map(r=>JSON.parse(JSON.stringify(r)))};
  for(const k in (o.paneles||{})){
    const s=o.paneles[k], P=nuevoP();
    P.def=s.def?JSON.parse(JSON.stringify(s.def)):null;
    for(const [x,y,m] of (s.suelo||[])) P.suelo.set(claveXY(x,y),m);
    for(const [x,y,v] of (s.alturas||[])) P.alturas.set(claveXY(x,y),v);
    for(const [x,y] of ((s.objetos||{}).quitar||[])) P.quitar.add(claveXY(x,y));
    for(const a of ((s.objetos||{}).agregar||[])) P.agregar.push(Object.assign({},a));
    d.pan.set(k,P);
  }
  for(const r of (o.rasgos||[])) d.rasgos.push({id:r.id,tipo:r.tipo||'camino',puntos:r.puntos.map(p=>[p[0],p[1]]),ancho:r.ancho,material:r.material});
  return d;
}
const porXY=(a,b)=>a[1]-b[1]||a[0]-b[0];
const partir=k=>k.split(',').map(Number);
/* ordenado y sin adornos: el archivo cambia sólo donde cambia el mundo (se lleva bien con git) */
function aArchivo(d){
  const o={formato:FORMATO,semilla:d.semilla,paneles:{},rasgos:d.rasgos.map(r=>({id:r.id,tipo:r.tipo,puntos:r.puntos.map(p=>[p[0],p[1]]),ancho:r.ancho,material:r.material})),
    caminos:d.caminos.map(r=>JSON.parse(JSON.stringify(r))),terreno:d.terreno.map(r=>JSON.parse(JSON.stringify(r)))};
  for(const k of Array.from(d.pan.keys()).sort()){
    const P=d.pan.get(k), s={};
    if(P.def) s.def=JSON.parse(JSON.stringify(P.def));
    if(P.suelo.size) s.suelo=Array.from(P.suelo,([c,m])=>{ const [x,y]=partir(c); return [x,y,m]; }).sort(porXY);
    if(P.alturas.size) s.alturas=Array.from(P.alturas,([c,v])=>{ const [x,y]=partir(c); return [x,y,v]; }).sort(porXY);
    const ob={};
    if(P.agregar.length) ob.agregar=P.agregar.map(a=>Object.assign({},a)).sort((a,b)=>a.y-b.y||a.x-b.x);
    if(P.quitar.size) ob.quitar=Array.from(P.quitar,c=>partir(c)).sort(porXY);
    if(ob.agregar||ob.quitar) s.objetos=ob;
    if(Object.keys(s).length) o.paneles[k]=s;
  }
  return o;
}
function reindexar(){
  idxAlt=new Map();
  for(const P of D.pan.values()) for(const [c,v] of P.alturas){ const [x,y]=partir(c); idxAlt.set(kAlt(x,y),v); }
}

/* ---------- aplicar las ediciones a un panel recién generado ---------- */
const OCUPAN={arbol:1,roca:1,hoguera:1,rocoso:1,arbolnv:1,tope:1};
/* las casillas (índices del panel) que ocupa un objeto: un tronco, len a lo largo; una roca grande, su ancho */
function huella(t){
  const out=[];
  if(t.k==='caido'){ for(let q=0;q<(t.len||1);q++) if(t.x+q<L) out.push(t.y*L+t.x+q); return out; }
  const fx=t.fx||0, fy=t.fy||0;
  for(let dy=-fy;dy<=fy;dy++) for(let dx=-fx;dx<=fx;dx++){ const x=t.x+dx, y=t.y+dy; if(x>=0&&y>=0&&x<L&&y<L) out.push(y*L+x); }
  return out;
}
const ponerSuelo=(p,lx,ly,c)=>{ const f=p.ground[ly]; if(f[lx]===c) return false; p.ground[ly]=f.slice(0,lx)+c+f.slice(lx+1); return true; };
function distSeg(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0; t=t<0?0:t>1?1:t;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
function rasterizar(p,r,ox,oy){
  let cambio=false; const R=r.ancho/2, pts=r.puntos;
  for(let i=0;i<Math.max(1,pts.length-1);i++){
    const a=pts[i], b=pts[Math.min(i+1,pts.length-1)];
    const x0=Math.max(ox,Math.floor(Math.min(a[0],b[0])-R)), x1=Math.min(ox+L-1,Math.ceil(Math.max(a[0],b[0])+R));
    const y0=Math.max(oy,Math.floor(Math.min(a[1],b[1])-R)), y1=Math.min(oy+L-1,Math.ceil(Math.max(a[1],b[1])+R));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++)
      if(distSeg(x+0.5,y+0.5,a[0],a[1],b[0],b[1])<=R) cambio=ponerSuelo(p,x-ox,y-oy,r.material)||cambio;
  }
  return cambio;
}
function aplicar(p){
  if(!D||!D.pan) return;
  const k=p.clave||clavePanel(p.pi,p.pj), P=D.pan.get(k), ox=p.pi*L, oy=p.pj*L;
  let cambio=false;
  for(const r of D.rasgos){
    /* descarte barato: la caja del rasgo, con su ancho, contra el panel */
    let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
    for(const q of r.puntos){ mnx=Math.min(mnx,q[0]); mxx=Math.max(mxx,q[0]); mny=Math.min(mny,q[1]); mxy=Math.max(mxy,q[1]); }
    const R=r.ancho/2+1;
    if(mxx+R<ox||mnx-R>=ox+L||mxy+R<oy||mny-R>=oy+L) continue;
    cambio=rasterizar(p,r,ox,oy)||cambio;
  }
  if(P){
    for(const [c,m] of P.suelo){ const [x,y]=partir(c); if(x>=ox&&x<ox+L&&y>=oy&&y<oy+L) cambio=ponerSuelo(p,x-ox,y-oy,m)||cambio; }
    if(P.quitar.size){
      const antes=p.trees.length, quitados=[];
      p.trees=p.trees.filter(t=>{ if(!P.quitar.has(claveXY(t.x+ox,t.y+oy))) return true; quitados.push(t); return false; });
      if(quitados.length){
        /* se libera lo que ocupaban; si otro objeto cubría esas casillas, las vuelve a ocupar */
        const liberadas=new Set();
        for(const t of quitados) for(const i of huella(t)){ p.occ[i]=0; liberadas.add(i); }
        for(const t of p.trees){ const h=huella(t); if(h.some(i=>liberadas.has(i))) for(const i of h) p.occ[i]=1; }
      }
      cambio=cambio||p.trees.length!==antes;
    }
    for(const a of P.agregar){
      const lx=a.x-ox, ly=a.y-oy; if(lx<0||ly<0||lx>=L||ly>=L) continue;
      const o=Object.assign({},a,{x:lx,y:ly}); if(o.s===undefined) o.s=(Math.imul(a.x,73856093)^Math.imul(a.y,19349663))>>>0&0xfffff;
      p.trees.push(o);
      if(OCUPAN[a.k]||a.k==='caido') for(const i of huella(o)) p.occ[i]=1;
      cambio=true;
    }
  }
  if(!cambio) return;
  /* lo que el generador deriva de los objetos: el orden, el mapa general y las sombras */
  p.trees.sort((a,b)=>a.y-b.y);
  p.mapG=[]; for(let y=0;y<L;y++) p.mapG.push(' '.repeat(L));
  for(const t of p.trees){
    const c=t.k==='tope'?null:t.k==='arbolnv'?'T':t.k==='arbol'?(t.sp==='mistico'?'Y':'T'):t.k==='hoguera'?'f':null;
    if(c&&t.x>=0&&t.y>=0&&t.x<L&&t.y<L) p.mapG[t.y]=p.mapG[t.y].slice(0,t.x)+c+p.mapG[t.y].slice(t.x+1);
  }
  NVe.calcularSombras(p,L);
}

/* ---------- cambios: lo único que el editor necesita para escribir ----------
   editar(op) devuelve la operación INVERSA, así deshacer es aplicar lo que devolvió. */
function tocar(claves,terreno){
  version++;
  for(const k of claves){ const [pi,pj]=partir(k); NVe.olvidarPanel(pi,pj); }
  /* el relieve y las paredes dependen del agua de alrededor: se recalculan al cambiar el suelo, la altura
     o un panel; una piedra o un árbol no los tocan */
  if(terreno!==false) NVe.olvidarTerreno();
  for(const f of oyentes) f(Array.from(claves));
}
const vecinos=k=>{ const [pi,pj]=partir(k); const s=[]; for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++) s.push(clavePanel(pi+i,pj+j)); return s; };
/* aplica UNA operación sobre los datos y anota qué paneles hay que regenerar en `toca`.
   toca.soloObjetos queda en true mientras todas las operaciones sean de objetos: entonces se regenera
   sólo el panel tocado (16 ms) en vez de él y sus ocho vecinos (124 ms), y no se recalcula el terreno. */
function aplicarUna(op,toca){
  let inv=null;
  const marca=(x,y)=>{ toca.soloObjetos=false; for(const k of vecinos(panelDeXY(x,y))) toca.add(k); };
  const marcaObj=(x,y)=>{ toca.add(panelDeXY(x,y)); };
  switch(op.t){
    case 'lote': {
      const invs=[]; for(const o of op.ops){ const r=aplicarUna(o,toca); if(r) invs.unshift(r); }
      inv=invs.length?{t:'lote',ops:invs}:null; break; }
    case 'suelo': {
      if(!NVe.MAT[op.m]) throw new Error('material desconocido "'+op.m+'"');
      const P=pDe(panelDeXY(op.x,op.y),true), c=claveXY(op.x,op.y), antes=P.suelo.get(c);
      P.suelo.set(c,op.m); inv=antes===undefined?{t:'suelo-',x:op.x,y:op.y}:{t:'suelo',x:op.x,y:op.y,m:antes}; marca(op.x,op.y); break; }
    case 'suelo-': {
      const P=pDe(panelDeXY(op.x,op.y)), c=claveXY(op.x,op.y);
      if(P&&P.suelo.has(c)){ inv={t:'suelo',x:op.x,y:op.y,m:P.suelo.get(c)}; P.suelo.delete(c); marca(op.x,op.y); } break; }
    case 'altura': {
      const P=pDe(panelDeXY(op.x,op.y),true), c=claveXY(op.x,op.y), antes=P.alturas.get(c);
      if(op.d===0) P.alturas.delete(c); else P.alturas.set(c,op.d);
      inv={t:'altura',x:op.x,y:op.y,d:antes===undefined?0:antes}; reindexar(); marca(op.x,op.y); break; }
    case 'objeto+': {
      const P=pDe(panelDeXY(op.x,op.y),true), o=Object.assign({},op.objeto,{x:op.x,y:op.y});
      if(typeof o.k!=='string') throw new Error('objeto sin tipo');
      const i=P.agregar.findIndex(a=>a.x===op.x&&a.y===op.y);
      inv=i<0?{t:'objeto-',x:op.x,y:op.y}:{t:'objeto+',x:op.x,y:op.y,objeto:P.agregar[i]};
      if(i<0) P.agregar.push(o); else P.agregar[i]=o; marcaObj(op.x,op.y); break; }
    case 'objeto-': {
      const P=pDe(panelDeXY(op.x,op.y),true), i=P.agregar.findIndex(a=>a.x===op.x&&a.y===op.y);
      if(i>=0){ inv={t:'objeto+',x:op.x,y:op.y,objeto:P.agregar[i]}; P.agregar.splice(i,1); }
      else { P.quitar.add(claveXY(op.x,op.y)); inv={t:'objeto-restaurar',x:op.x,y:op.y}; }
      marcaObj(op.x,op.y); break; }
    case 'objeto-restaurar': {
      const P=pDe(panelDeXY(op.x,op.y)); if(P&&P.quitar.delete(claveXY(op.x,op.y))){ inv={t:'objeto-',x:op.x,y:op.y}; marcaObj(op.x,op.y); } break; }
    case 'rasgo+': {
      const r=op.rasgo; validar({formato:FORMATO,semilla:NVe.CONFIG.seed,paneles:{},rasgos:[r]});
      const i=D.rasgos.findIndex(q=>q.id===r.id), previo=i<0?null:D.rasgos[i];
      const nuevo={id:r.id,tipo:r.tipo||'camino',puntos:r.puntos.map(p=>[p[0],p[1]]),ancho:r.ancho,material:r.material};
      if(i<0) D.rasgos.push(nuevo); else D.rasgos[i]=nuevo;
      inv=previo?{t:'rasgo+',rasgo:previo}:{t:'rasgo-',id:r.id};
      for(const q of nuevo.puntos.concat(previo?previo.puntos:[])) marca(Math.floor(q[0]),Math.floor(q[1]));
      /* un tramo largo toca los paneles de en medio: se marcan todos los que cubre su caja */
      for(const rr of [nuevo,previo]) if(rr){
        const xs=rr.puntos.map(q=>q[0]), ys=rr.puntos.map(q=>q[1]), m=rr.ancho/2+1;
        for(let pj=Math.floor((Math.min(...ys)-m)/L);pj<=Math.floor((Math.max(...ys)+m)/L);pj++)
          for(let pi=Math.floor((Math.min(...xs)-m)/L);pi<=Math.floor((Math.max(...xs)+m)/L);pi++)
            for(const k of vecinos(clavePanel(pi,pj))) toca.add(k);
      }
      break; }
    case 'rasgo-': {
      const i=D.rasgos.findIndex(q=>q.id===op.id);
      if(i>=0){ const previo=D.rasgos.splice(i,1)[0]; inv={t:'rasgo+',rasgo:previo};
        const xs=previo.puntos.map(q=>q[0]), ys=previo.puntos.map(q=>q[1]), m=previo.ancho/2+1;
        for(let pj=Math.floor((Math.min(...ys)-m)/L);pj<=Math.floor((Math.max(...ys)+m)/L);pj++)
          for(let pi=Math.floor((Math.min(...xs)-m)/L);pi<=Math.floor((Math.max(...xs)+m)/L);pi++)
            for(const k of vecinos(clavePanel(pi,pj))) toca.add(k); }
      break; }
    case 'camino': {
      /* poner (datos) o quitar (datos:null) UN camino, entero. Su inversa es lo que había: así sirve para crear,
         editar y borrar, y deshacer es volver a poner el estado anterior. No toca paneles: se pinta por encima. */
      if(typeof op.id!=='string') throw new Error('camino sin nombre');
      if(op.datos){ validarCamino(op.datos); if(op.datos.id!==op.id) throw new Error('el camino no es el que dice ser'); }
      const i=D.caminos.findIndex(q=>q.id===op.id), previo=i<0?null:D.caminos[i];
      if(op.datos){ const n=JSON.parse(JSON.stringify(op.datos)); if(i<0) D.caminos.push(n); else D.caminos[i]=n; }
      else if(i>=0) D.caminos.splice(i,1);
      if(!previo&&!op.datos) break;
      inv={t:'camino',id:op.id,datos:previo?JSON.parse(JSON.stringify(previo)):null};
      toca.caminos=true; break; }
    case 'terreno': {
      /* poner (datos) o quitar (datos:null) UN sector de terreno entero; la inversa es lo que había. Se pinta por encima: no toca paneles. */
      if(typeof op.id!=='string') throw new Error('sector sin nombre');
      if(op.datos){ validarTerreno(op.datos); if(op.datos.id!==op.id) throw new Error('el sector no es el que dice ser'); }
      const i=D.terreno.findIndex(q=>q.id===op.id), previo=i<0?null:D.terreno[i];
      if(op.datos){ const n=JSON.parse(JSON.stringify(op.datos)); if(i<0) D.terreno.push(n); else D.terreno[i]=n; }
      else if(i>=0) D.terreno.splice(i,1);
      if(!previo&&!op.datos) break;
      inv={t:'terreno',id:op.id,datos:previo?JSON.parse(JSON.stringify(previo)):null};
      toca.terreno=true; break; }
    case 'panel': {
      const k=clavePanel(op.pi,op.pj);
      if(op.def!==null&&(!op.def||typeof op.def.bioma!=='string')) throw new Error('def sin bioma');
      const P=pDe(k,true); inv={t:'panel',pi:op.pi,pj:op.pj,def:P.def};
      P.def=op.def?JSON.parse(JSON.stringify(op.def)):null; for(const c of vecinos(k)) toca.add(c); break; }
    default: throw new Error('operación desconocida: '+op.t);
  }
  return inv;
}
function editar(op){
  if(!D) D=datosVacios();
  const toca=new Set(); toca.soloObjetos=true;
  const inv=aplicarUna(op,toca);
  if(toca.size) tocar(toca,!toca.soloObjetos);
  if(toca.caminos){ version++; avisarCaminos(); for(const f of oyentes) f([]); }
  if(toca.terreno){ version++; avisarTerreno(); for(const f of oyentes) f([]); }
  return inv;
}
/* el motor de caminos guarda su propia red (con índices); acá sólo se le avisa qué datos hay */
function avisarTerreno(){ if(NVe.terreno&&NVe.terreno.sincronizar) NVe.terreno.sincronizar(D?D.terreno:[]); }
function avisarCaminos(){ if(NVe.caminos&&NVe.caminos.sincronizar) NVe.caminos.sincronizar(D?D.caminos:[]); }

/* ---------- cargar, exportar, borrador ---------- */
function cargar(o){
  D=desdeArchivo(o); reindexar();
  const todos=new Set(); for(const k of NVe.cachePaneles.keys()) todos.add(k);
  tocar(todos); avisarCaminos(); avisarTerreno();
}
const exportar=()=>aArchivo(D||datosVacios());
const texto=()=>JSON.stringify(exportar());
/* el contenido de src/mundo/mundo-datos.js: lo que se sube al repositorio para que todos entren al mismo mundo */
const comoScript=()=>'/* Nativa Online — EL MUNDO EDITADO (archivo de datos). Lo escribe el Modo Dios; ver docs/DISENO.md. */\nwindow.NV.MUNDO_DATOS='+JSON.stringify(exportar(),null,1)+';\n';
const vacio=()=>{ const o=exportar(); return !Object.keys(o.paneles).length&&!o.rasgos.length&&!o.caminos.length&&!o.terreno.length; };
function importarTexto(t){
  t=String(t).trim().replace(/^[\s\S]*?NV\.MUNDO_DATOS\s*=\s*/,'').replace(/;\s*$/,'');
  cargar(JSON.parse(t));
}
/* el borrador vive en el navegador de quien edita y es SEPARADO del guardado del jugador */
const CLAVE_BORRADOR='nativa.mundo.v1';
function guardarBorrador(){
  try{ localStorage.setItem(CLAVE_BORRADOR,JSON.stringify({semilla:NVe.CONFIG.seed,ts:Date.now(),mundo:exportar()})); return true; }catch(e){ return false; }
}
function cargarBorrador(){
  let b=null; try{ b=JSON.parse(localStorage.getItem(CLAVE_BORRADOR)||'null'); }catch(e){}
  if(!b||b.semilla!==NVe.CONFIG.seed) return false;
  try{ cargar(b.mundo); return true; }catch(e){ return false; }
}
function borrarBorrador(){ try{ localStorage.removeItem(CLAVE_BORRADOR); }catch(e){} }
/* bajar el archivo para subirlo al repositorio (sólo en un navegador) */
function descargar(nombre){
  if(typeof document==='undefined'||!document.createElement||typeof Blob==='undefined') return false;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([comoScript()],{type:'text/javascript'}));
  a.download=nombre||'mundo-datos.js'; if(a.click) a.click(); return true;
}

/* ---------- consultas para el resto del juego ---------- */
const deltaAltura=(mx,my)=>idxAlt.size?(idxAlt.get(kAlt(mx,my))||0):0;
const defDe=k=>{ const P=D&&D.pan.get(k); return P&&P.def||null; };
const clavesDefinidas=()=>D?Array.from(D.pan.entries()).filter(([,P])=>P.def).map(([k])=>k):[];
const alCambiar=f=>{ oyentes.push(f); return ()=>{ const i=oyentes.indexOf(f); if(i>=0) oyentes.splice(i,1); }; };
const estadisticas=()=>{ const d=D||datosVacios(); let suelo=0,agregar=0,quitar=0,alt=0; for(const P of d.pan.values()){ suelo+=P.suelo.size; agregar+=P.agregar.length; quitar+=P.quitar.size; alt+=P.alturas.size; }
  return {paneles:d.pan.size,suelo,agregar,quitar,alturas:alt,rasgos:d.rasgos.length,caminos:d.caminos.length,version}; };

/* ---------- arranque: el archivo del mundo, si trae algo ---------- */
D=datosVacios();
if(NVe.MUNDO_DATOS){
  try{ D=desdeArchivo(NVe.MUNDO_DATOS); reindexar(); }
  catch(e){ console.warn('mundo-datos.js ignorado: '+e.message); D=datosVacios(); }
}

/* cuánto, a los lados, llega el objeto editado más ancho (una formación): el dibujo mira esos metros de más para no
   perderla cuando su centro queda fuera de la pantalla. 0 sin objetos anchos, así que el juego sin ediciones no cambia. */
let _mv=-1,_mD=null,_mm=0;
let _av=-1,_aD=null,_am=0;
const margenAlto=()=>{
  if(_av!==version||_aD!==D){ _av=version; _aD=D; _am=0; if(D) for(const P of D.pan.values()) for(const a of P.agregar) if((a.dy||0)>_am) _am=a.dy; }
  return _am;
};
const margenAncho=()=>{
  if(_mv!==version||_mD!==D){ _mv=version; _mD=D; _mm=0; if(D) for(const P of D.pan.values()) for(const a of P.agregar) if((a.fx||0)>_mm) _mm=a.fx; }
  return _mm>4?_mm:0;
};
NVe.mundo={FORMATO,aplicar,margenAncho,margenAlto,editar,cargar,exportar,texto,comoScript,importarTexto,vacio,descargar,
  guardarBorrador,cargarBorrador,borrarBorrador,deltaAltura,defDe,clavesDefinidas,alCambiar,estadisticas,
  validar:o=>{ validar(o); return true; },version:()=>version,
  caminosDatos:()=>D?D.caminos:[],
  terrenoDatos:()=>D?D.terreno:[]};
