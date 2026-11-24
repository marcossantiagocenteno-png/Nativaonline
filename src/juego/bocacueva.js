/* Nativa Online — ENTRADAS DE CUEVA: la boca vista desde afuera.
   Un objeto del mundo {k:'bocacueva', r:receta, fx, fy:0, hx}: una pared de roca de frente (mirando al sur, hacia quien llega) con un
   arco oscuro al pie. Es sólo el dibujo y el cuerpo sólido: la pared bloquea el paso (ediciones.OCUPAN) y el hueco del arco queda libre
   (`hx`, ver huella en ediciones.js) para que se pueda entrar. Lo que hace que entrar lleve a una cueva es el UMBRAL (subescenas.js),
   que se pone sobre el hueco.

   Receta r = {mat, ancho, alto, boca, edad, musgo, sem}. Todo en metros; `ancho` y `boca` son impares (cuentan casillas enteras).
   Se pinta por columnas de la pared: silueta de lomo, estratos, arco con labio, musgo arriba y en el labio, y el interior casi negro.
   La imagen de cada receta se hornea una vez por resolución (cache), después sólo se copia. Pruebas: pruebas/subescenas.js */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ID='bocacueva:entrada';
const MATS=['caliza','basalto','arenisca','hielo'];
const H2=(a,b,c)=>{ let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483629); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
const sm=u=>u*u*(3-2*u);
function ruido(x,s){ const i=Math.floor(x), f=sm(x-i); return H2(i,0,s)*(1-f)+H2(i+1,0,s)*f; }
const impar=(n,a,b)=>{ n=Math.round(+n)||a; n=clamp(n,a,b); return n%2?n:n+1>b?n-1:n+1; };
const azar=()=>(((NV.azarEditor||Math.random)()*1e6)|0)+1;
const MATERIALES=()=>(NV.cuevas&&NV.cuevas.MATERIALES)||{caliza:{ramp:['.',':','-','=','%','M'],pal:[[12,12,15],[58,55,56],[130,121,110],[172,160,142]],estrato:1}};

function limpiar(r){
  r=r||{};
  return {mat:MATS.indexOf(r.mat)>=0?r.mat:'caliza', ancho:impar(r.ancho==null?9:r.ancho,5,21), alto:clamp(+r.alto||4.4,2.6,9),
    boca:impar(r.boca==null?3:r.boca,1,5), edad:clamp(r.edad==null?0.5:+r.edad,0,1), musgo:clamp(r.musgo==null?0.4:+r.musgo,0,1), sem:(r.sem|0)||azar()};
}
const base=()=>limpiar({});
const aObjeto=spec=>{ const r=limpiar(spec); return {k:'bocacueva',h:1,s:r.sem,r,fx:(r.ancho-1)/2,fy:0,hx:(r.boca-1)/2}; };
const deObjeto=o=>({id:ID,spec:limpiar(o.r)});

function pal(p,t){ const n=p.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=p[i], b=p[i+1]; return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]; }
const PAL_MUSGO=[[10,34,26],[20,58,40],[34,88,52],[58,122,66],[92,156,84]], MUSGO_G=['°','*','°',';'];
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);

/* ---- la imagen de una receta a una resolución: glifos y colores por (columna, fila) con la fila 0 al pie ---- */
const CACHE=new Map();
function hornear(r,CPM,HPM){
  const clave=JSON.stringify(r)+'|'+CPM+'|'+HPM;
  let I=CACHE.get(clave); if(I) return I;
  if(CACHE.size>40) CACHE.clear();
  const M=MATERIALES()[r.mat]||MATERIALES().caliza, mitad=r.ancho/2, W=Math.ceil(r.ancho*CPM), H=Math.ceil(r.alto*HPM)+2;
  const G=new Uint16Array(W*H), C=new Int32Array(W*H), c0=Math.floor(W/2);
  const wm=r.boca/2, ha=Math.min(r.alto*0.82,r.boca*0.95+1.1), hs=ha*0.38;
  const ramp=M.ramp, nR=ramp.length;
  for(let c=0;c<W;c++){
    const u=(c-c0)/CPM, au=Math.abs(u), q=clamp(au/mitad,0,1);
    /* lomo: más alto al centro, con relieve; los bordes bajan en escalones irregulares */
    const lomo=r.alto*(0.58+0.42*Math.pow(Math.max(0,1-q*q),0.55))*(0.9+0.2*ruido(u*0.8+r.sem*0.01,r.sem));
    for(let row=0;row<H;row++){
      const v=row/HPM; if(v>lomo) break;
      const i=row*W+c;
      /* ¿dentro del arco? recto abajo, medio óvalo arriba */
      const enArco=au<=wm&&(v<=hs||(au*au)/(wm*wm)+((v-hs)*(v-hs))/((ha-hs)*(ha-hs))<1);
      const labio=!enArco&&(au<=wm+0.55&&(v<=hs||(au*au)/((wm+0.55)*(wm+0.55))+((v-hs)*(v-hs))/((ha+0.55-hs)*(ha+0.55-hs))<1));
      if(enArco){
        /* el interior: casi negro, apenas se adivina la roca en los bordes del arco y un poco de luz a ras del piso */
        const borde=clamp(1-(wm-au)/(wm*0.6+0.001),0,1), t=0.05+0.10*borde+(row<2?0.10:0)+0.04*H2(c,row,r.sem);
        const cc=pal(M.pal,t); G[i]=(t>0.14?':':'.').charCodeAt(0); C[i]=pack(cc[0]*0.7,cc[1]*0.7,cc[2]*0.75); continue;
      }
      const n1=ruido(u*1.7+v*0.9,r.sem+3), est=Math.sin(v*5.2+ruido(u*0.5,r.sem+9)*4)*0.12*(M.estrato||1);
      let t=0.50+est+(n1-0.5)*0.30+(H2(c,row,r.sem)-0.5)*0.18-0.11*(u/mitad)-0.14*Math.exp(-v/0.55)+0.10*(v/lomo);
      if(labio) t+=0.12;
      t-=0.10*r.edad*H2(c>>2,row>>1,r.sem+5);
      t=clamp(t,0.04,0.97);
      let g=ramp[clamp(Math.floor(t*nR),0,nR-1)], cc=pal(M.pal,t);
      /* musgo: arriba, en el labio del arco y donde la roca está más húmeda al pie */
      const hum=0.35*(v/lomo)+(labio?0.45:0)+0.25*Math.exp(-v/0.5);
      const pr=r.musgo*hum*(0.5+ruido(u*2.3+v*1.9,r.sem+31))-0.16;
      if(H2(c,row,r.sem+7)<pr*1.2){ const mc=pal(PAL_MUSGO,clamp(0.25+t*0.75,0,1)); g=MUSGO_G[(H2(c,row,r.sem+11)*4)|0]; cc=mc; }
      G[i]=g.charCodeAt(0); C[i]=pack(cc[0],cc[1],cc[2]);
    }
  }
  I={W,H,c0,G,C}; CACHE.set(clave,I); return I;
}

/* copia la imagen al lienzo. put(c,r,código,color); (bc,br) = centro de la casilla de la boca, a ras de suelo */
function pintarCara(r,CPM,HPM,put,bc,br,haze,cols){
  const I=hornear(r,CPM,HPM), hz=haze==null?1:haze;
  for(let c=0;c<I.W;c++){
    const cc=bc+c-I.c0; if(cc<0||(cols!=null&&cc>=cols)) continue;
    for(let row=0;row<I.H;row++){
      const k=row*I.W+c, g=I.G[k]; if(!g) continue;
      const col=I.C[k]; put(cc,br-row,g,hz<0.999?pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz):col);
    }
  }
}

NV.dibujarBocaCueva=function(tr,haze){
  if(!tr.r) return;
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1, r=limpiar(tr.r);
  if(bc+r.ancho*CPM/2<-4||bc-r.ancho*CPM/2>cols+4) return;
  const a=alzaR; alzaR=Math.round(NV.alturaEn(tr.x+0.5,tr.y+0.5)*HPM);
  try{ pintarCara(r,CPM,HPM,put,bc,br,haze,cols); } finally{ alzaR=a; }
};

/* ---- la ventana de diseño del Modo Dios ---- */
let ULTIMO=null;
const CAMPOS=[
  {ruta:'mat',etq:'Roca',tipo:'sel',opciones:MATS.map(m=>[m,m[0].toUpperCase()+m.slice(1)]),grupo:'Entrada de cueva'},
  {ruta:'ancho',etq:'Ancho de la pared (m)',tipo:'rng',min:5,max:21,paso:2,grupo:'Entrada de cueva'},
  {ruta:'alto',etq:'Altura (m)',tipo:'rng',min:2.6,max:9,paso:0.2,grupo:'Entrada de cueva'},
  {ruta:'boca',etq:'Ancho de la boca (m)',tipo:'rng',min:1,max:5,paso:2,grupo:'Entrada de cueva'},
  {ruta:'edad',etq:'Desgaste',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Aspecto'},
  {ruta:'musgo',etq:'Musgo',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Aspecto'}];
const resumen=o=>'Entrada de cueva · '+((o.r&&o.r.mat)||'caliza');
function previa(spec){
  const r=limpiar(spec), z=r.ancho>13?0.7:1, CPM=13*z, HPM=6.8*z, RPM=4*z;
  const mw=r.ancho+4, mh=(r.alto*HPM)/RPM+2.5;
  return {mw,mh,z,S:{W:mw},detalle:'vista de frente · el hueco queda libre para pasar',
    items:[{x:mw/2,y:mh-1,pintar:ctx=>pintarCara(r,ctx.CPM,ctx.HPM,ctx.put,ctx.bc,ctx.br,1,ctx.cols)}]};
}

if(NV.motores) NV.motores.registrar({id:'bocacueva',nombre:'Entradas de cueva (exterior)',estado:'integrado',
  archivo:'src/juego/bocacueva.js',prueba:'pruebas/subescenas.js',
  caras:{
    objetos:{
      catalogo:()=>[{id:ID,nombre:'Entrada de cueva (diseñar)',etiqueta:'Entrada de cueva',k:'bocacueva',disenar:true,encaja:o=>o.k==='bocacueva'}],
      crear:()=>aObjeto(ULTIMO||base()),
      variar:o=>aObjeto(Object.assign({},limpiar(o.r),{sem:azar()}))
    },
    creador:{
      titulo:()=>'Diseñar una entrada de cueva',
      campos:()=>CAMPOS,
      nuevo:()=>Object.assign(base(),ULTIMO||{},{sem:azar()}),
      variar:spec=>Object.assign({},limpiar(spec),{sem:azar()}),
      aObjeto, deObjeto, idDe:()=>ID,
      recordar:(id,spec)=>{ ULTIMO=limpiar(spec); },
      previa, resumen
    }
  }});

NV.bocaCueva={limpiar,aObjeto,deObjeto,hornear,pintarCara,previa,MATS};
})(window.NV);
