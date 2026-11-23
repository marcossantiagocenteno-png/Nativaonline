/* Nativa Online — DEMO INDEPENDIENTE DEL VIENTO GLOBAL.
   No toca el juego. Usa:
     · src/motor/base.js (paletas, azar, ruido) — sólo lectura;
     · preview/pasto.js  — la textura de pasto APROBADA (variante C), sin regenerarla: en reposo
       es la misma; sólo se le pide que entregue sus trazos para que el viento los incline;
     · preview/viento-motor.js — el motor de viento global (NVViento).
   Escena: pasto, tres árboles (tronco, ramas, hojas), arbustos y flores, todos consultando el
   MISMO motor. Cada tipo responde distinto por sus propiedades registradas.
   Cómo se mueve cada cosa sin saltos: el motor entrega un desplazamiento continuo (en celdas) y
   cada celda lo redondea con su propio "dado" fijo, así el movimiento avanza celda a celda,
   cada una a su momento, en lugar de saltar todas a la vez; y nada se mueve al azar. */
(function(){
'use strict';
window.__PASTO_SIN_UI=true;
const NV=window.NV, P=window.PastoPreview, V=window.NVViento;
const {nueva,poner,pintar,pack,clamp,hash3,CPM,RPM,ASP,FONT_K}=P;
const GL=s=>s.charCodeAt(0);
const rnd=(a,b,c)=>hash3(a|0,b|0,c|0)%10000/10000;

/* ---------- colores de la escena (la hoja y el pasto, en la paleta azulada aprobada) ---------- */
const HOJA=[[26,56,54],[40,84,74],[58,112,92],[84,142,116],[128,190,164],[96,116,96]];
const TRONCO=[[84,66,54],[112,90,70],[140,114,90]];
const rgb=(c,m,k)=>pack(c[0]*m*k,c[1]*m*k,c[2]*m*k);

/* ---------- objetos de la escena: partes con posición de reposo y pesos de respuesta ---------- */
/* una "parte" = una celda: dx,dy relativos a la base; g glifo; c color; t tipo (0 tronco,1 rama,2 hoja);
   b rama; w peso propio (cuánto se mueve respecto a lo que tiene debajo); a peso del tronco que la sostiene;
   d dado fijo; f fase del temblor */
function nuevoObj(tipo,x,y,esc){ return {tipo,x,y,esc,n:0,dx:[],dy:[],g:[],c:[],t:[],b:[],w:[],a:[],d:[],f:[],ramas:0,lag:rnd(x,y,3)*0.5}; }
function add(o,dx,dy,g,c,t,b,w,a,sd){
  o.dx.push(dx); o.dy.push(dy); o.g.push(g); o.c.push(c); o.t.push(t); o.b.push(b); o.w.push(w); o.a.push(a);
  o.d.push(rnd(sd,o.n,7)); o.f.push(rnd(sd,o.n,9)*6.283); o.n++;
}
function linea(x0,y0,x1,y1,fn){            // Bresenham
  let dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, e=dx+dy, i=0;
  for(;;){ fn(x0,y0,i++); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){e+=dy;x0+=sx;} if(e2<=dx){e+=dx;y0+=sy;} }
}
const HOJAS=['"','*','o','%','&','^',':',';','\'','"'];

function crearArbol(x,y,esc,k,sd){
  const o=nuevoObj('arbol',x,y,esc), H=Math.round(36*esc), Ht=Math.round(15*esc);
  /* tronco: dos columnas, ensanchado en la base */
  for(let j=0;j<Ht;j++){
    const w=(j/Ht)*(j/Ht), m=1.3+0.5*rnd(sd,j,1);
    add(o,-2,-j,GL('|'),rgb(TRONCO[1],m,k),0,0,w,0,sd); add(o,-1,-j,GL('|'),rgb(TRONCO[1],m,k),0,0,w,0,sd); add(o,1,-j,GL('|'),rgb(TRONCO[0],m,k),0,0,w,0,sd);
    add(o, 0,-j,GL(j%3?'|':'!'),rgb(TRONCO[0],m,k),0,0,w,0,sd);
    if(j<3){ add(o,-3-(j<1),-j,GL('/'),rgb(TRONCO[2],m,k),0,0,w,0,sd); add(o,2+(j<1),-j,GL('\\'),rgb(TRONCO[2],m,k),0,0,w,0,sd); }
  }
  /* lóbulos de la copa: cada uno cuelga de su propia rama */
  const L=[[-0.55,0.55,0.94],[0.60,0.62,0.96],[0.0,0.95,1.10],[-0.15,0.34,0.84],[0.72,0.30,0.70]];
  L.forEach((lb,i)=>{
    const cx=Math.round(lb[0]*36*esc), cy=-Math.round(lb[1]*H*0.92), rx=Math.round(19*esc*lb[2]), ry=Math.round(9*esc*lb[2]);
    const at=-Math.round(Ht*(0.55+0.07*i)), aw=(-at/Ht)*(-at/Ht)*0.55;
    o.ramas=i+1;
    const dist=Math.hypot(cx,cy-at);
    linea(0,at,cx,cy+Math.round(ry*0.5),(px,py,s)=>{
      const f=Math.min(1,s/Math.max(1,dist)), dxx=cx-0, ch=Math.abs(dxx)<2?'|':(dxx<0?'\\':'/');
      add(o,px,py,GL(py>at-3&&Math.abs(px)<2?'|':ch),rgb(TRONCO[(s+i)%3],1.4,k),1,i,0.25+0.75*f,aw,sd+i);
    });
    for(let dy=-ry;dy<=ry;dy++) for(let dx=-rx;dx<=rx;dx++){
      const u=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry); if(u>=1) continue;
      const hh=rnd(sd+i*37+dx*3,cy+dy,11);
      if(hh>0.97-0.22*u){ add(o,cx+dx,cy+dy,32,0,2,i,1,aw,sd+i); continue; }      // hueco entre hojas: tapa el pasto de atrás
      const luz=clamp(1.15+0.5*(-dy/ry)*0.8-0.2*(dx/rx)+0.4*(hh-0.5),0.8,1.9);
      const tono=hh<0.12?4:hh<0.45?3:hh<0.75?2:1;
      add(o,cx+dx,cy+dy,GL(HOJAS[(hh*977|0)%HOJAS.length]),rgb(HOJA[tono],luz,k),2,i,1,aw,sd+i);
    }
  });
  o.alto=H; return o;
}
function crearArbusto(x,y,esc,k,sd){
  const o=nuevoObj('arbusto',x,y,esc), rx=Math.round(19*esc), ry=Math.round(8*esc);
  for(let dy=-ry;dy<=0;dy++) for(let dx=-rx;dx<=rx;dx++){
    const u=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry); if(u>=1) continue;
    const hh=rnd(sd+dx*5,dy+y,13);
    if(hh>0.98-0.20*u){ add(o,dx,dy,32,0,2,0,0.6,0,sd); continue; }
    const borde=clamp(0.30+0.55*Math.abs(dx)/rx+0.65*(-dy/ry),0.2,1.5);        // los extremos y la punta se doblan más
    const luz=clamp(1.0+0.6*(-dy/ry)-0.15*(dx/rx)+0.4*(hh-0.5),0.7,1.7);
    add(o,dx,dy,GL(HOJAS[(hh*911|0)%HOJAS.length]),rgb(HOJA[hh<0.15?4:hh<0.5?2:1],luz,k),2,0,borde,0,sd);
  }
  return o;
}
function crearFlores(x,y,esc,k,sd){
  const o=nuevoObj('flor',x,y,esc), n=4+(sd%3);
  for(let i=0;i<n;i++){
    const bx=Math.round((rnd(sd,i,1)-0.5)*16*esc), by=Math.round((rnd(sd,i,2)-0.5)*3), H=Math.round((7+rnd(sd,i,3)*5)*esc);
    const cab='@o*'.charCodeAt((rnd(sd,i,4)*3)|0), ccab=[[250,244,220],[236,214,250],[250,214,214]][i%3];
    o.ramas=n;
    for(let j=0;j<=H;j++){
      const w=Math.pow((j+0.5)/(H+0.5),1.5);
      if(j===H) add(o,bx,by-j,cab,pack(ccab[0]*k,ccab[1]*k,ccab[2]*k),2,i,1.35,0,sd+i*17);
      else add(o,bx,by-j,GL('|'),rgb(HOJA[3],1.3,k),0,i,w,0,sd+i*17);
      if(j===(H>>1)||j===H-1){
        add(o,bx-1,by-j,GL('\\'),rgb(HOJA[4],1.2,k),2,i,w*1.2,0,sd+i*17+1);
        add(o,bx+1,by-j,GL('/'),rgb(HOJA[4],1.2,k),2,i,w*1.2,0,sd+i*17+2);
      }
    }
  }
  return o;
}

/* la escena para un ancho dado, en fracciones del cuadro; los tres paneles de comparación usan una más corta */
function escena(cols,rows,k,sd){
  const esc=clamp(cols/300,0.62,1.35), L=[];
  const R=(f)=>Math.round(rows*f), C=(f)=>Math.round(cols*f);
  L.push(crearArbol(C(0.30),R(0.60),esc,k,sd+1));
  if(cols>=300){ L.push(crearArbol(C(0.66),R(0.72),esc*1.1,k,sd+2)); L.push(crearArbol(C(0.90),R(0.56),esc*0.85,k,sd+3)); }
  L.push(crearArbusto(C(cols>=300?0.12:0.74),R(0.84),esc,k,sd+4));
  L.push(crearArbusto(C(cols>=300?0.48:0.12),R(0.90),esc*1.15,k,sd+5));
  if(cols>=300) L.push(crearArbusto(C(0.82),R(0.88),esc,k,sd+6));
  L.push(crearFlores(C(cols>=300?0.22:0.55),R(0.94),esc,k,sd+7));
  L.push(crearFlores(C(cols>=300?0.58:0.30),R(0.58),esc,k,sd+8));
  if(cols>=300){ L.push(crearFlores(C(0.78),R(0.78),esc,k,sd+9)); L.push(crearFlores(C(0.40),R(0.80),esc,k,sd+10)); }
  L.sort((a,b)=>a.y-b.y);
  return L;
}

/* ---------- pasto: textura aprobada + trazos que el viento inclina ---------- */
const cache={};
function pastoBase(cols,rows,sem,dens,k){
  const key=[cols,rows,sem,dens,k].join('|');
  if(cache.key===key) return cache;
  const o={cols,rows,semilla:sem,dens,k,t:0,separar:true,sinFlores:true,trazos:[]};
  const g=P.generarCompacto(o,'C');
  const nz=o.trazos.length/7, GW=Math.ceil(cols/(CPM*V.SECTOR))+1;
  const gi=new Int32Array(nz);
  for(let i=0;i<nz;i++){ const c=o.trazos[i*7], r=o.trazos[i*7+1]; gi[i]=Math.floor(c/(CPM*V.SECTOR))+GW*Math.floor(r/(RPM*V.SECTOR)); }
  Object.assign(cache,{key,G:g.G,C:g.C,trazos:o.trazos,nz,gi,GW,GH:Math.ceil(rows/(RPM*V.SECTOR))+1,cols,rows});
  return cache;
}

/* ---------- un panel completo ---------- */
const ESTADO={semilla:20260,dens:1,k:1,objs:{}};
function panel(cols,rows,perfil,t,clave){
  const b=pastoBase(cols,rows,ESTADO.semilla,ESTADO.dens,ESTADO.k);
  const g=nueva(cols,rows); g.G.set(b.G); g.C.set(b.C);
  /* PASTO: cada sector de 1,7 m pide su empuje al motor; cada trazo lo aplica con su dado */
  const D=new Float32Array(b.GW*b.GH), tr=b.trazos;
  for(let gy=0;gy<b.GH;gy++) for(let gx=0;gx<b.GW;gx++)
    D[gx+b.GW*gy]=V.respuesta('pasto',(gx+0.5)*V.SECTOR,(gy+0.5)*V.SECTOR,t,{perfil}).mov;
  for(let i=0;i<b.nz;i++){
    const o=i*7, c=tr[o], r=tr[o+1], base=tr[o+2], L=tr[o+3], d=D[b.gi[i]];
    /* inclinación continua: el reposo (la textura aprobada) menos el empuje hacia el oeste; el dado
       de cada trazo desfasa el momento exacto en que cambia, y nunca hacia el este por el viento */
    const v=base-d*(1+0.45*(tr[o+6]-0.5));
    const lean=v<-0.5?-1:v>0.5?1:0;
    const ch=lean>0?47:lean<0?92:124;
    for(let j=0;j<L;j++) poner(g,c+Math.round(lean*j*0.6),r-j,ch,j===L-1&&L>1?tr[o+5]:tr[o+4]);
  }
  /* OBJETOS: de atrás hacia adelante */
  const objs=ESTADO.objs[clave]||(ESTADO.objs[clave]=escena(cols,rows,ESTADO.k,ESTADO.semilla));
  for(const ob of objs) dibujarObj(g,ob,t,perfil);
  return g;
}

function dibujarObj(g,ob,t,perfil){
  const X=ob.x/CPM, Y=ob.y/RPM, op={perfil}, n=ob.n;
  let rt=0, rr=null, rh=null, ra=0, rf=null;
  if(ob.tipo==='arbol'){
    rt=V.respuesta('arbol.tronco',X,Y,t,{perfil}).mov;
    rr=[]; for(let i=0;i<ob.ramas;i++) rr.push(V.respuesta('arbol.rama',X+(i-2)*0.9,Y,t,{perfil,lag:i*0.10}).mov);
    rh=V.respuesta('arbol.hoja',X,Y,t,{perfil});
  } else if(ob.tipo==='arbusto'){
    ra=V.respuesta('arbusto',X,Y,t,{perfil,lag:ob.lag});
  } else {
    rf=[]; for(let i=0;i<ob.ramas;i++) rf.push(V.respuesta('flor',X+i*0.15,Y,t,{perfil,lag:(i%4)*0.07}));
  }
  const w2=6.283;
  for(let i=0;i<n;i++){
    const tp=ob.t[i], w=ob.w[i], dado=ob.d[i];
    let s=0;                                              // desplazamiento en celdas hacia el oeste (+)
    if(ob.tipo==='arbol'){
      if(tp===0) s=rt*w;
      else if(tp===1) s=rt*ob.a[i]+rr[ob.b[i]]*w;
      else s=rt*ob.a[i]+rr[ob.b[i]]+rh.mov*0.6+rh.osc*Math.sin(w2*rh.f*t+ob.f[i]+ob.b[i]);
    } else if(ob.tipo==='arbusto'){
      s=ra.mov*w+ra.osc*w*0.7*Math.sin(w2*ra.f*t+ob.f[i]);
    } else {
      const R=rf[ob.b[i]]; s=R.mov*w+(tp===2?R.osc*Math.sin(w2*R.f*t+ob.f[i])*w*0.6:0);
    }
    const shift=-Math.floor(s+dado);                       // negativo = oeste; el dado fijo reparte el momento
    let ch=ob.g[i];
    if(ob.tipo==='flor'&&tp===0) ch= shift<=-1?92:124;     // el tallo se inclina hacia el oeste
    poner(g,ob.x+ob.dx[i]+shift,ob.y+ob.dy[i],ch,ob.c[i]);
  }
}

/* ======================== LA PÁGINA ======================== */
function iniciar(){
  const css=document.createElement('style');
  css.textContent=
   ':root{--oro:#c8a24a;--oroflojo:#6d5726;--dim:#9c9484}*{box-sizing:border-box}'+
   'html,body{margin:0;height:100%;background:#000;color:#fff;font:12px ui-monospace,Menlo,Consolas,monospace;overflow:hidden}'+
   '#barra{display:flex;flex-wrap:wrap;gap:5px 14px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--oroflojo)}'+
   '#barra label{display:flex;align-items:center;gap:5px;color:var(--dim);white-space:nowrap}'+
   '#barra input[type=range]{width:92px;accent-color:var(--oro)}#barra input#scrub{width:300px}'+
   '#barra button,#barra select{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 10px;font:inherit;cursor:pointer}'+
   '#barra button.on{background:var(--oro);color:#000}#info{color:var(--oro)}'+
   '#hud{display:block;width:100%;height:92px;border-bottom:1px solid var(--oroflojo);background:#000}'+
   '#zona{position:relative}#cv{display:block}'+
   '.rotulo{position:absolute;top:6px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}';
  document.head.appendChild(css); document.title='Vista previa del viento global — Nativa Online';
  const sl=(id,txt,min,max,val)=>'<label>'+txt+' <input id="'+id+'" type="range" min="'+min+'" max="'+max+'" value="'+val+'"></label>';
  document.body.innerHTML=
   '<div id="barra">'+
   '<button id="play" class="on">⏸ Pausar</button><button id="rein">↺ Reiniciar ciclo</button>'+
   '<label>Velocidad <select id="lento"><option value="1">normal</option><option value="0.5">cámara lenta ×0,5</option><option value="0.25">×0,25</option><option value="0.1">×0,1</option></select></label>'+
   '<label>Perfil <select id="perfil"><option value="B">B · moderado</option><option value="A">A · muy sutil</option><option value="C">C · marcado</option><option value="ABC">comparar A · B · C</option></select></label>'+
   '<label>Tiempo <input id="scrub" type="range" min="0" max="40" step="0.05" value="0"></label><b id="info"></b>'+
   '<span style="flex-basis:100%"></span>'+
   sl('intensidad','Intensidad del viento',0,200,100)+sl('vel','Velocidad de las ráfagas',20,200,80)+sl('amp','Amplitud',20,250,100)+
   sl('hojas','Flexibilidad de hojas',0,250,100)+sl('ramas','Movimiento de ramas',0,250,100)+sl('pasto','Respuesta del pasto',0,250,100)+
   '<button id="restab">Valores iniciales</button></div>'+
   '<canvas id="hud"></canvas><div id="zona"><canvas id="cv"></canvas>'+
   '<span id="r1" class="rotulo"></span><span id="r2" class="rotulo"></span><span id="r3" class="rotulo"></span></div>';
  const $=id=>document.getElementById(id), cv=$('cv'), ctx=cv.getContext('2d'), hud=$('hud'), hx=hud.getContext('2d');
  let dpr=1,W=0,H=0,HH=0, t=0, tv=0, play=true, ultimo=0, semilla=ESTADO.semilla, sucio=true;
  const q=new URLSearchParams(location.search);
  const ESC=5;                                              // ancho de celda en px: más grande que en el juego para que se vea el movimiento
  function cfg(){
    V.cfg.intensidad=$('intensidad').value/100; V.cfg.vel=$('vel').value/10; V.cfg.amplitud=$('amp').value/100;
    V.cfg.hojas=$('hojas').value/100; V.cfg.ramas=$('ramas').value/100; V.cfg.pasto=$('pasto').value/100;
  }
  function dimensionar(){
    dpr=Math.min(2,window.devicePixelRatio||1); W=window.innerWidth;
    HH=$('hud').offsetHeight; H=Math.max(120,window.innerHeight-$('barra').offsetHeight-HH);
    cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px';
    hud.width=Math.floor(W*dpr); hud.height=Math.floor(HH*dpr); sucio=true;
  }
  const FASES=[[0,12,'CALMA','#2b3a3a'],[12,15,'BRISA','#3d5a55'],[15,18,'RÁFAGA','#6a8f86'],[18,20,'REPOSO','#3d5a55']];
  function pintarHud(){
    const e=V.estado(t), tc=e.tc, ciclo=Math.floor(tv/20);
    hx.setTransform(dpr,0,0,dpr,0,0); hx.clearRect(0,0,W,HH); hx.fillStyle='#000'; hx.fillRect(0,0,W,HH);
    const x0=14, x1=Math.min(W-330,860), y0=22, y1=HH-18, wx=u=>x0+(x1-x0)*u/20;
    hx.font='11px ui-monospace,monospace'; hx.textBaseline='middle';
    for(const f of FASES){ hx.fillStyle=f[3]; hx.globalAlpha=0.35; hx.fillRect(wx(f[0]),y0,wx(f[1])-wx(f[0])-1,y1-y0); hx.globalAlpha=1;
      hx.fillStyle='#c8a24a'; hx.textAlign='center'; hx.fillText(f[2]+(f[1]-f[0]>2?'  '+f[0]+'–'+f[1]+' s':''),(wx(f[0])+wx(f[1]))/2,y0-9); }
    /* la curva de intensidad del ciclo (la del punto de referencia, sin variación de sectores) */
    hx.strokeStyle='#9fd2c6'; hx.lineWidth=1.6; hx.beginPath();
    for(let i=0;i<=200;i++){ const u=i/10, y=y1-(y1-y0)*Math.min(1,V.envolvente(u)*V.cfg.intensidad); i?hx.lineTo(wx(u),y):hx.moveTo(wx(u),y); }
    hx.stroke();
    hx.strokeStyle='#c8a24a'; hx.lineWidth=2; hx.beginPath(); hx.moveTo(wx(tc),y0-2); hx.lineTo(wx(tc),y1+2); hx.stroke();
    hx.fillStyle='#c8a24a'; hx.beginPath(); hx.arc(wx(tc),y1-(y1-y0)*Math.min(1,e.intensidad),4,0,6.283); hx.fill();
    /* indicador de tiempo, intensidad y dirección */
    const px=x1+34;
    hx.textAlign='left'; hx.fillStyle='#fff'; hx.font='13px ui-monospace,monospace';
    hx.fillText('ciclo '+(ciclo+1)+' de 2 · '+tc.toFixed(1)+' / 20 s',px,y0+2);
    hx.fillStyle='#9c9484'; hx.font='11px ui-monospace,monospace'; hx.fillText('fase: '+e.fase+'   ·   demo '+tv.toFixed(1)+' / 40 s',px,y0+20);
    hx.fillStyle='#1b1b1b'; hx.fillRect(px,y0+34,220,10); hx.fillStyle='#9fd2c6'; hx.fillRect(px,y0+34,220*Math.min(1,e.intensidad),10);
    hx.strokeStyle='#6d5726'; hx.strokeRect(px,y0+34,220,10); hx.fillStyle='#9c9484'; hx.fillText('intensidad',px+226,y0+39);
    /* dirección: el este es la derecha de la pantalla, el viento va hacia la izquierda */
    const ay=y0+60, ax1=px+220, ax0=ax1-30-190*Math.min(1,e.intensidad);
    hx.strokeStyle='#c8a24a'; hx.fillStyle='#c8a24a'; hx.lineWidth=2.4; hx.beginPath(); hx.moveTo(ax1,ay); hx.lineTo(ax0,ay); hx.stroke();
    hx.beginPath(); hx.moveTo(ax0-8,ay); hx.lineTo(ax0+2,ay-5); hx.lineTo(ax0+2,ay+5); hx.fill();
    hx.fillStyle='#fff'; hx.fillText('ESTE',ax1+6,ay); hx.textAlign='right'; hx.fillStyle='#9c9484'; hx.fillText('OESTE',px-4,ay); hx.textAlign='left';
    hx.fillStyle='#c8a24a'; hx.fillText('ESTE → OESTE',px,ay+16);
  }
  function dibujar(){
    cfg(); tv=((t%40)+40)%40; const cw=ESC, chh=cw*ASP;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; ctx.textBaseline='middle'; ctx.fillStyle='rgb(5,9,8)'; ctx.fillRect(0,0,W,H);
    const rows=Math.floor(H/chh)+1, modo=$('perfil').value;
    ['r1','r2','r3'].forEach(i=>$(i).style.display='none');
    if(modo==='ABC'){
      const pw=Math.floor((W-8)/3), cols=Math.floor(pw/cw); V.cfg.x0=cols/CPM/2;
      ['A','B','C'].forEach((p,i)=>{
        pintar(ctx,panel(cols,rows,p,t,'p'+cols+'_'+rows),cw,chh,i*(pw+4),0,0,cols);
        if(i){ ctx.fillStyle='#c8a24a'; ctx.fillRect(i*(pw+4)-3,0,2,H); }
        const r=$('r'+(i+1)); r.textContent=V.PERFILES[p].nombre; r.style.cssText='display:block;left:'+(i*(pw+4)+6)+'px';
      });
    } else {
      const cols=Math.floor(W/cw); V.cfg.x0=cols/CPM/2; pintar(ctx,panel(cols,rows,modo,t,'u'+cols+'_'+rows),cw,chh,0,0,0,cols);
      const r=$('r1'); r.textContent=V.PERFILES[modo].nombre; r.style.cssText='display:block;left:6px';
    }
    pintarHud(); $('info').textContent=''; $('scrub').value=tv;
  }
  function lazo(ms){
    const dt=ultimo?(ms-ultimo)/1000:0; ultimo=ms;
    if(play){ t+=dt*parseFloat($('lento').value); sucio=true; }
    if(sucio&&(ms-(lazo.u||0)>33||!play)){ lazo.u=ms; sucio=false; dibujar(); }
    requestAnimationFrame(lazo);
  }
  const fijarPlay=v=>{ play=v; $('play').textContent=v?'⏸ Pausar':'▶ Reproducir'; $('play').classList.toggle('on',v); sucio=true; };
  $('play').onclick=()=>fijarPlay(!play);
  $('rein').onclick=()=>{ t=Math.floor(t/20)*20; sucio=true; if(!play) fijarPlay(true); };
  $('scrub').oninput=()=>{ t=Math.floor(t/40)*40+parseFloat($('scrub').value); sucio=true; };
  $('restab').onclick=()=>{ for(const id of ['intensidad','vel','amp','hojas','ramas','pasto']) $(id).value=id==='vel'?80:100; sucio=true; };
  for(const id of ['intensidad','vel','amp','hojas','ramas','pasto','perfil','lento']) $(id).addEventListener('input',()=>{ sucio=true; });
  window.addEventListener('resize',dimensionar);
  if(q.has('perfil')) $('perfil').value=q.get('perfil');
  if(q.has('lento')) $('lento').value=q.get('lento');
  if(q.has('t')) t=parseFloat(q.get('t'))||0;
  if(q.get('pausa')==='1') fijarPlay(false);
  dimensionar(); requestAnimationFrame(lazo);
}
window.VientoDemo={panel,pastoBase,escena,ESTADO};
if(!window.__VIENTO_SIN_UI) iniciar();
})();
