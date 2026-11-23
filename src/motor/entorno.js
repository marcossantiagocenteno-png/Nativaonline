/* Nativa Online — ENTORNO: lo que los motores comparten (viento, luz y sombras).
   No es un motor nuevo de viento ni de luz: no calcula ninguno de los dos. Es la CONEXIÓN. Cada motor
   especializado (árboles, rocas, y después pasto, arbustos, flores, agua, caminos) le pide acá lo que
   necesita, y acá se contesta preguntándole al motor que corresponde:

     viento(tipo,x,y,t)   -> NV.viento.respuesta(...)      {mov, osc, I, f}   (lo calcula src/mundo/viento.js)
     luz(x,y,t)           -> NV.luz + NV.LUZ_LUNAS         color, cantidad, dirección del sol, largo de sombra
     sobreCara(n,luz)     cuánta luz recibe una superficie según hacia dónde mira (rocas, copas, troncos)
     sombra.huella(...)   la sombra que un cuerpo (elipsoides) proyecta sobre el suelo, para CUALQUIER objeto
     contorno.silueta(..) la línea negra fina alrededor de una silueta irregular, para CUALQUIER objeto

   Reglas del proyecto que esto respeta:
     · Ningún motor trae su propio viento ni su propia luz: preguntan por acá.
     · Los motores aprobados no se tocan (viento.js, luz.js, pasto.js...). Esto sólo los LEE.
     · Un motor se prueba solo: `NV.entorno.usar(NV.entorno.simulado({...}))` reemplaza el viento y la luz
       reales por unos de mentira (un sol que se mueve con un deslizador, una ráfaga fija), y los
       laboratorios y las pruebas lo usan. En el juego rige el proveedor real.
     · Los cambios se propagan: `version.luz` sube cuando cambia la luz y cada objeto invalida lo que
       guardó; el viento es continuo y se consulta en cada cuadro (con memo, para no repetir la cuenta).
     · Todo lo que se ajusta (intensidad del viento, ángulo y largo de la sombra, cantidad de luz) está
       declarado en la cara `editor` del motor 'entorno', para que el Modo Dios lo administre.

   Coordenadas: x al este, y al SUR, altura hacia arriba, todo en metros. Una sombra cae hacia (dx,dy). */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const CERO=Object.freeze({mov:0,osc:0,I:0,f:0});

/* ------------------------------------------------------------------ ajustes (Modo Dios) ----
   Son un barniz por encima de lo real: viven acá y sólo los ven los motores conectados. No
   escriben en LUZ_LUNAS ni en la configuración del viento. null = lo que diga el motor real. */
const ajustes={ viento:{intensidad:1}, luz:{amb:null, dx:null, dy:null, porMetro:null} };
const version={luz:0, viento:0};
const oyentes=[];
const avisar=(que)=>{ for(const f of oyentes.slice()) f(que); };

/* ------------------------------------------------------------------------- LA LUZ ---- */
let _luz=null, _luzFirma='';
function derivar(S,amb,c){
  const hd=Math.hypot(S.dx,S.dy)||1, dxn=S.dx/hd, dyn=S.dy/hd;
  const largoM=S.porMetro*hd;                         // metros de sombra por metro de altura
  const alto=largoM>0.02, tanE=alto?1/largoM:50, elev=Math.atan(tanE), cosE=Math.cos(elev), sinE=Math.sin(elev);
  /* L: de la superficie hacia el sol, en (este, sur, arriba). El sol está del lado contrario a donde cae la sombra */
  return {amb, r:c.r, g:c.g, b:c.b, dx:S.dx, dy:S.dy, porMetro:S.porMetro,
    sx:S.dx*S.porMetro, sy:S.dy*S.porMetro,           // metros de sombra por metro de altura, hacia el este y hacia el sur
    elev, L:{x:alto?-dxn*cosE:0, y:alto?-dyn*cosE:0, z:alto?sinE:1}, firma:''};
}
function luzReal(){
  const base=NV.LUZ_LUNAS||{}, S0=Object.assign({dx:1,dy:0.3,porMetro:1.7},base.sombra), L0=NV.luz||{amb:1,r:1,g:1,b:1};
  const A=ajustes.luz;
  const S={dx:A.dx!=null?A.dx:S0.dx, dy:A.dy!=null?A.dy:S0.dy, porMetro:A.porMetro!=null?A.porMetro:S0.porMetro};
  const amb=A.amb!=null?A.amb:L0.amb, k=L0.amb>0?amb/L0.amb:0;
  const firma=[S.dx,S.dy,S.porMetro,amb,L0.r,L0.g,L0.b].join('|');
  if(_luz&&firma===_luzFirma) return _luz;
  _luz=derivar(S,amb,{r:L0.r*k,g:L0.g*k,b:L0.b*k}); _luz.firma=firma; _luzFirma=firma;
  return _luz;
}
/* cuánta luz recibe una superficie con la normal n=(este,sur,arriba), sin color ni cantidad: 0,4 en sombra a 1,3 de frente.
   Hay una luz de relleno hacia la cámara: lo que mira al jugador nunca queda negro. */
function sobreCara(ne,ns,nu,luz){
  const l=Math.hypot(ne,ns,nu)||1, L=luz.L;
  const lamb=Math.max(0,(ne*L.x+ns*L.y+nu*L.z)/l);
  return 0.40+0.80*lamb+0.12*Math.max(0,ns/l);
}

/* ---------------------------------------------------------------------- EL VIENTO ---- */
const memo=new Map(); let memoK=-1;
function vientoReal(tipo,x,y,t,opt){
  const V=NV.viento; if(!V||!V.tipos[tipo]) return CERO;
  const tt=NV.tViento!==undefined?NV.tViento:t, k=Math.floor(tt*30);
  if(k!==memoK){ memo.clear(); memoK=k; }
  const key=tipo+'|'+Math.round(x*20)+'|'+Math.round(y*20)+(opt&&opt.lag?'|'+opt.lag:'');
  let r=memo.get(key); if(r) return r;
  V.cfg.intensidad=(NV.vientoFactor!==undefined?NV.vientoFactor:1)*ajustes.viento.intensidad;
  r=V.respuesta(tipo,x,y,tt,opt); memo.set(key,r); return r;
}
const proveedorReal={nombre:'juego', viento:vientoReal, luz:luzReal};
let prov=proveedorReal;

/* Un entorno de mentira para laboratorios y pruebas. Lo que no se pasa, queda en calma y con el sol de la tabla.
     viento: {valor:0..1.2 fijo, ciclo:segundos (opcional: sube y baja 0..valor), perfil de tipos: los de NV.viento}
     luz:    {dx,dy,porMetro,amb,r,g,b} */
function simulado(cfg){
  cfg=cfg||{}; const V=cfg.viento||{}, Lz=cfg.luz||{};
  const tipos=()=>(NV.viento&&NV.viento.tipos)||{};
  const out={nombre:'simulado', cfg,
    viento(tipo,x,y,t){
      const P=tipos()[tipo]; if(!P) return CERO;
      let I=V.valor||0;
      if(V.ciclo){ const u=((t%V.ciclo)+V.ciclo)%V.ciclo/V.ciclo; I*=0.5-0.5*Math.cos(6.2832*u); }
      const Ie=P.expo===1?I:Math.pow(I,P.expo), mov=P.amp*Ie*(ajustes.viento.intensidad);
      return {mov, osc:P.oscila?P.oscila.amp*Math.pow(I,0.7):0, I, f:P.oscila?P.oscila.f:0};
    },
    luz(){
      const S0=Object.assign({dx:1,dy:0.45,porMetro:0.8},(NV.LUZ_LUNAS||{}).sombra);
      const S={dx:Lz.dx!=null?Lz.dx:S0.dx, dy:Lz.dy!=null?Lz.dy:S0.dy, porMetro:Lz.porMetro!=null?Lz.porMetro:S0.porMetro};
      const amb=Lz.amb!=null?Lz.amb:1;
      const l=derivar(S,amb,{r:(Lz.r!=null?Lz.r:1)*amb,g:(Lz.g!=null?Lz.g:0.98)*amb,b:(Lz.b!=null?Lz.b:0.86)*amb});
      l.firma=[S.dx,S.dy,S.porMetro,amb,Lz.r,Lz.g,Lz.b].join('|'); return l;
    }};
  return out;
}

/* ------------------------------------------------------------- SOMBRA PROYECTADA ----
   Un cuerpo es una lista de elipsoides {e,h,s,re,rh,rs}: centro (este, altura, sur) respecto al pie del objeto,
   y radios. Cada uno se proyecta sobre el suelo en la dirección de la sombra: el centro se corre
   (sx,sy) metros por cada metro de altura y la mancha se ensancha un poco con la altura (penumbra).
   Devuelve una rejilla {c0,r0,w,h,k} en celdas (c0,r0 = esquina respecto al pie, k de 0 a fuerza). Es la misma para
   un árbol, una roca o lo que venga: cada uno sólo describe su cuerpo.
   opt: {CPM,RPM,fuerza, despl(h)->metros al este que el viento corre ese punto} */
function huella(cuerpos,luz,opt){
  opt=opt||{}; const CPM=opt.CPM||13, RPM=opt.RPM||4, F=opt.fuerza==null?0.55:opt.fuerza, despl=opt.despl;
  const P=[]; let c0=1e9,c1=-1e9,r0=1e9,r1=-1e9;
  for(const q of cuerpos){
    const w=despl?despl(q.h):0, pen=1+0.07*Math.max(0,q.h);
    const ge=q.e+w+luz.sx*q.h, gs=q.s+luz.sy*q.h;
    /* un elipsoide proyectado por un sol oblicuo se estira a lo largo de la sombra: lo que sube más, más lejos cae */
    const re=q.re*pen+Math.abs(luz.sx)*q.rh*0.55, rs=Math.max(q.rs,q.re*0.35)*pen+Math.abs(luz.sy)*q.rh*0.55;
    const a=Math.floor((ge-re)*CPM)-1, b=Math.ceil((ge+re)*CPM)+1, c=Math.floor((gs-rs)*RPM)-1, d=Math.ceil((gs+rs)*RPM)+1;
    P.push({ge,gs,re,rs,f:q.f==null?1:q.f});
    if(a<c0)c0=a; if(b>c1)c1=b; if(c<r0)r0=c; if(d>r1)r1=d;
  }
  if(!P.length) return {c0:0,r0:0,w:0,h:0,k:new Float32Array(0)};
  const w=c1-c0+1, h=r1-r0+1, k=new Float32Array(w*h);
  for(const p of P){
    const a=Math.floor((p.ge-p.re)*CPM)-1, b=Math.ceil((p.ge+p.re)*CPM)+1, c=Math.floor((p.gs-p.rs)*RPM)-1, d=Math.ceil((p.gs+p.rs)*RPM)+1;
    for(let r=c;r<=d;r++) for(let q=a;q<=b;q++){
      const dx=((q+0.5)/CPM-p.ge)/p.re, dy=((r+0.5)/RPM-p.gs)/p.rs, d2=dx*dx+dy*dy;
      if(d2>=1) continue;
      const v=F*p.f*Math.pow(1-d2,0.55), i=(r-r0)*w+(q-c0);
      if(v>k[i]) k[i]=v;
    }
  }
  return {c0,r0,w,h,k};
}

/* ------------------------------------------------------------------------ CONTORNO ----
   La línea negra fina de todo objeto. `G` es la rejilla (w×h) de lo dibujado (0 = vacío). El contorno son las
   celdas vacías EXTERIORES —alcanzables desde el borde sin cruzar el objeto— pegadas a la silueta por arriba, abajo, izquierda
   o derecha: un solo grosor, respeta lo irregular, y no se mete en los huecos cerrados de una copa. Devuelve un Uint8Array
   con 1 donde va una celda de contorno. La rejilla necesita al menos una celda libre alrededor. */
let _pila=new Int32Array(1024), _ext=new Uint8Array(0);
function silueta(G,w,h,out){
  const n=w*h; if(_ext.length<n) _ext=new Uint8Array(n); else _ext.fill(0,0,n);
  if(_pila.length<n) _pila=new Int32Array(n);
  out=out&&out.length>=n?out:new Uint8Array(n); out.fill(0,0,n);
  let sp=0; const ext=_ext, pila=_pila;
  const empuja=i=>{ if(!ext[i]&&!G[i]){ ext[i]=1; pila[sp++]=i; } };
  for(let c=0;c<w;c++){ empuja(c); empuja((h-1)*w+c); }
  for(let r=0;r<h;r++){ empuja(r*w); empuja(r*w+w-1); }
  while(sp){
    const i=pila[--sp], c=i%w, r=(i/w)|0;
    if(c>0) empuja(i-1); if(c<w-1) empuja(i+1); if(r>0) empuja(i-w); if(r<h-1) empuja(i+w);
  }
  for(let r=0;r<h;r++) for(let c=0;c<w;c++){
    const i=r*w+c; if(!ext[i]||G[i]) continue;
    if((c>0&&G[i-1])||(c<w-1&&G[i+1])||(r>0&&G[i-w])||(r<h-1&&G[i+w])) out[i]=1;
  }
  return out;
}

/* ----------------------------------------------------------------- CONEXIONES ----
   Cada motor declara qué recibe, para que el Modo Dios y el informe de arquitectura lo listen. */
const conexiones=new Map();
function conectar(id,spec){
  spec=Object.assign({viento:[],luz:false,sombra:false,contorno:false},spec||{});
  for(const t of spec.viento) if(NV.viento&&!NV.viento.tipos[t]) throw new Error(id+': tipo de viento desconocido "'+t+'"');
  conexiones.set(id,Object.freeze(spec)); return spec;
}

/* ---------------------------------------------------------------------- INTERFAZ ---- */
const E={
  version, ajustes,
  viento:(tipo,x,y,t,opt)=>prov.viento(tipo,x,y,t,opt),
  luz:(x,y,t)=>prov.luz(x,y,t),
  sobreCara, huella, sombra:{huella}, contorno:{silueta},
  simulado, real:proveedorReal,
  usar(p){ prov=p||proveedorReal; version.luz++; version.viento++; avisar('proveedor'); return prov; },
  proveedor:()=>prov,
  conectar, conexiones:()=>Array.from(conexiones,([id,s])=>Object.assign({id},s)),
  /* lo que ajusta el Modo Dios: sube la versión y avisa, así cada objeto rehace lo suyo */
  ajustarLuz(p){ Object.assign(ajustes.luz,p); version.luz++; avisar('luz'); },
  ajustarViento(p){ Object.assign(ajustes.viento,p); version.viento++; avisar('viento'); },
  alCambiar(f){ oyentes.push(f); return ()=>{ const i=oyentes.indexOf(f); if(i>=0) oyentes.splice(i,1); }; },
  /* una luz fija y cualquier cosa del cielo de mentira para pruebas rápidas */
  _derivar:derivar
};
NV.entorno=E;

if(NV.motores) NV.motores.registrar({id:'entorno',nombre:'Entorno: viento, luz y sombras compartidos',estado:'pendiente',
  archivo:'src/motor/entorno.js',prueba:'pruebas/entorno.js',
  caras:{ambiente:(x,y,t,tipo)=>tipo==='luz'?prov.luz(x,y,t):prov.viento(tipo||'arbol.rama',x,y,t),
    editor:{parametros:{
      viento:{tipo:'cantidad',min:0,max:2,def:1,aplica:v=>E.ajustarViento({intensidad:v})},
      luzCantidad:{tipo:'cantidad',min:0,max:1.2,def:null,aplica:v=>E.ajustarLuz({amb:v})},
      sombraDx:{tipo:'cantidad',min:-2,max:2,def:null,aplica:v=>E.ajustarLuz({dx:v})},
      sombraDy:{tipo:'cantidad',min:-2,max:2,def:null,aplica:v=>E.ajustarLuz({dy:v})},
      sombraLargo:{tipo:'cantidad',min:0,max:3,def:null,aplica:v=>E.ajustarLuz({porMetro:v})}}}}});
})(window.NV);
