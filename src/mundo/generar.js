/* Nativa Online — generación del terreno, panel por panel.
   El ruido se muestrea en coordenadas del mundo, no del panel, así que el
   terreno continúa de un panel al siguiente sin costura. */

const NVg = window.NV;

/* un solo campo de ruido para todo el mundo */
const semillaMundo = NVg.hashStr(NVg.CONFIG.seed);
const ruidoA = NVg.makeNoise(NVg.mulberry(semillaMundo));
const ruidoB = NVg.makeNoise(NVg.mulberry(semillaMundo^0x9e37));
const ruidoC = NVg.makeNoise(NVg.mulberry(semillaMundo^0x5f1d));

/* El arroyo baja de norte a sur por el tercio oeste del claro y echa un brazo
   al este. Como se define en coordenadas del mundo, el panel de al lado lo
   continúa solo. */
const ejeArroyo = gy => 34 + ruidoA(gy*3,0,3,0.020)*26-13 + Math.sin(gy*0.07)*4;
const anchoArroyo = gy => 1.4 + ruidoA(0,gy*5,2,0.03)*1.9;
const BIFY = 46;                                   // altura del brazo al este
const ejeBrazo = gx => BIFY + ruidoA(gx*4,900,3,0.022)*18-9;

/* ---------- senderos ----------
   Dos caminos cruzan el mundo entero, uno de este a oeste y otro de norte a
   sur, y se cortan en el claro. Como se definen en coordenadas del mundo, pasan
   de un panel al siguiente sin juntura. Son de tierra pisada en el medio y de
   hierba corta en los bordes, que es como se hace un sendero de verdad: no lo
   dibuja nadie, lo gasta el que pasa. */
const SENDERO={ ancho:1.6, orilla:1.5 };
function sendero(gx,gy){
  /* el que va al este serpentea en y; el que va al sur, en x */
  const ey = 52 + ruidoC(gx*2.5, 400, 3, 0.016)*22-11;
  const ex = 50 + ruidoC(600, gy*2.5, 3, 0.016)*22-11;
  const d = Math.min(Math.abs(gy-ey), Math.abs(gx-ex));
  if(d < SENDERO.ancho) return 2;            // tierra pisada
  if(d < SENDERO.ancho+SENDERO.orilla) return 1;  // hierba gastada
  return 0;
}
function marcarSenderos(p,L,ox,oy){
  for(let y=0;y<L;y++) for(let x=0;x<L;x++){
    const g=p.ground[y][x];
    if(g!=='g'&&g!=='G'&&g!=='N'&&g!=='D') continue;   // no pisa el agua ni la roca
    const v=sendero(ox+x, oy+y);
    if(v===2) poner(p,L,x,y,'d');
    else if(v===1) poner(p,L,x,y,'g');
  }
}

function nuevoPanel(L){
  return {ground:[], occ:new Uint8Array(L*L), trees:[],
          flow:new Uint8Array(L*L), fuego:new Float32Array(L*L),
          shade:new Float32Array(L*L).fill(1)};
}
const poner=(p,L,x,y,c)=>{ if(x<0||y<0||x>=L||y>=L) return;
  p.ground[y]=p.ground[y].slice(0,x)+c+p.ground[y].slice(x+1); };
/* ¿Hay agua u orilla a la vuelta? Los árboles no nacen con los pies en el agua
   ni en la arena y el guijarral que la bordean. */
const AGUA_U_ORILLA='aAPEsk';
function cercaDelAgua(p,L,x,y,r){
  for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){
    const xx=x+i, yy=y+j;
    if(xx<0||yy<0||xx>=L||yy>=L) continue;
    if(AGUA_U_ORILLA.indexOf(p.ground[yy][xx])>=0) return true;
  }
  return false;
}
const libre=(p,L,x,y)=>{
  if(x<1||y<1||x>=L-1||y>=L-1) return false;
  if(p.occ[y*L+x]) return false;
  const g=p.ground[y][x];
  return g==='g'||g==='G'||g==='N'||g==='D'||g==='k';
};

/* ---------- el claro, 0:0 ---------- */
function bioClaro(p,L,ox,oy,rnd){
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++) fila += ruidoA(ox+x,oy+y,4,0.055)>0.50?'G':'g';
    p.ground.push(fila);
  }
  arroyo(p,L,ox,oy,true);
  arboles(p,L,ox,oy,rnd,{densidad:0.009, claro:true});
  piedrasYtroncos(p,L,ox,oy,rnd,34,12);
}

/* ---------- oeste, -1:0 — bosque viejo, lago, ruinas y la pared de roca ---------- */
function bioOeste(p,L,ox,oy,rnd){
  const lago={x:46,y:52,r:19};
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++){
      const gx=ox+x;
      /* el borde oeste del mundo es roca viva: no se pasa */
      const pared = 16 - ruidoB(gx,oy+y,3,0.07)*9;
      if(x < pared){ fila += 'M'; continue; }
      if(x < pared+4 && ruidoB(gx+7,oy+y,2,0.12)>0.45){ fila += 'M'; continue; }
      const d=Math.hypot(x-lago.x,(y-lago.y)*1.2);
      if(d<lago.r-3) { fila+='L'; continue; }        /* agua quieta */
      if(d<lago.r)   { fila+= d<lago.r-1?'l':'k'; continue; }
      if(d<lago.r+2) { fila+='s'; continue; }
      fila += ruidoA(gx,oy+y,4,0.05)>0.44?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{densidad:0.016, viejos:true});
  /* el árbol místico, solo, al borde del lago */
  for(const [dx,dy] of [[22,-4],[24,6],[20,10],[26,-10]]){
    const x=lago.x+dx, y=lago.y+dy;
    if(!libre(p,L,x,y)) continue;
    p.occ[y*L+x]=1;
    p.trees.push({x,y,h:8.2,k:'arbol',sp:'mistico',s:777});
    break;
  }
  /* ruinas: cuatro muros caídos de piedra */
  for(let i=0;i<4;i++){
    const rx=24+((rnd()*52)|0), ry=14+((rnd()*70)|0);
    const an=4+((rnd()*7)|0), al=3+((rnd()*5)|0);
    for(let j=0;j<al;j++) for(let k=0;k<an;k++){
      const borde=(j===0||k===0||j===al-1||k===an-1);
      if(!borde || rnd()<0.35) continue;            // muros rotos, no cajas
      const x=rx+k, y=ry+j;
      if(x<1||y<1||x>=L-1||y>=L-1) continue;
      if(p.ground[y][x]==='P'||p.ground[y][x]==='M') continue;
      poner(p,L,x,y,'R'); p.occ[y*L+x]=1;
    }
  }
  piedrasYtroncos(p,L,ox,oy,rnd,46,16);
  gigantes(p,L,ox,oy,rnd,2);
}

/* ---------- este, 1:0 — el río ancho, el acantilado y el mar ---------- */
function bioEste(p,L,ox,oy,rnd){
  const borde=62;                                   // dónde empieza el acantilado
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++){
      const gx=ox+x, gy=oy+y;
      /* De tierra adentro hacia el mar: tierra pelada, el filo de roca,
         el vacío de la caída, la rompiente y el mar abierto. */
      const filo = borde + Math.round(ruidoC(gy*5,0,3,0.05)*5-2.5);
      if(x>filo+11){ fila += 'O'; continue; }   /* mar abierto */
      if(x>filo+7) { fila += 'E'; continue; }
      if(x>filo+2) { fila += 'V'; continue; }
      if(x>filo-1) { fila += 'M'; continue; }
      if(x>filo-5) { fila += 'd'; continue; }
      /* el río, que viene del brazo del claro y se ensancha hacia el mar */
      const eje=ejeBrazo(gx);
      const ancho=2.2 + (x/borde)*7.5 + ruidoA(gx*6,300,2,0.035)*2;
      const d=Math.abs(y-eje);
      if(d<ancho*0.55){ fila+='P'; p.flow[y*L+x]=1; continue; }
      if(d<ancho)     { fila+='A'; p.flow[y*L+x]=1; continue; }
      if(d<ancho+1.6) { fila+='a'; continue; }
      if(d<ancho+3.4) { fila+='s'; continue; }
      if(d<ancho+5)   { fila+='k'; continue; }
      fila += ruidoA(gx,gy,4,0.05)>0.52?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{densidad:0.007, hasta:borde-9});
  piedrasYtroncos(p,L,ox,oy,rnd,30,8);
}

/* ---------- norte, 0:1 — bosque frondoso y corte seco al desierto ---------- */
function bioNorte(p,L,ox,oy,rnd){
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++){
      const gx=ox+x, gy=oy+y;
      /* el corte no es recto: serpentea, pero es abrupto */
      const corte = 44 + ruidoC(gx,0,3,0.03)*26-13;
      if(y < corte){ fila += ruidoB(gx+9,gy,2,0.10)>0.72?'k':'D'; continue; }   // duna, con algún pedregal
      if(y < corte+2){ fila += 's'; continue; }                  // la franja donde el bosque se corta
      fila += ruidoA(gx,gy,4,0.05)>0.38?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{densidad:0.030, desde:'corte'});
  piedrasYtroncos(p,L,ox,oy,rnd,26,10);
  gigantes(p,L,ox,oy,rnd,4);
}

/* ---------- sur, 0:-1 — pinos que se separan, frío y nieve ---------- */
function bioSur(p,L,ox,oy,rnd){
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++){
      const gx=ox+x, gy=oy+y;
      const nieve = (y-30)/70 + ruidoC(gx,gy,3,0.04)*0.45-0.22;
      if(nieve>0.52){ fila+='N'; continue; }
      if(nieve>0.34){ fila+= ruidoB(gx,gy,2,0.09)>0.5?'N':'g'; continue; }
      fila += ruidoA(gx,gy,4,0.05)>0.56?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{densidad:0.020, soloPino:true, raleando:true});
  piedrasYtroncos(p,L,ox,oy,rnd,24,14);
  gigantes(p,L,ox,oy,rnd,5);
}

/* ---------- piezas comunes ---------- */
function arroyo(p,L,ox,oy,conBrazo){
  for(let y=0;y<L;y++) for(let x=0;x<L;x++){
    const gx=ox+x, gy=oy+y;
    let pr=0, este=false;
    const d1=Math.abs(gx-ejeArroyo(gy)), w1=anchoArroyo(gy);
    if(d1<w1+3.8) pr=1-d1/(w1+3.8);
    if(conBrazo && gx>=34){
      const d2=Math.abs(gy-ejeBrazo(gx)), w2=1.1+ruidoA(gx*6,300,2,0.035)*1.6;
      if(d2<w2+3.4 && 1-d2/(w2+3.4)>pr){ pr=1-d2/(w2+3.4); este=true; }
    }
    if(pr<=0) continue;
    /* donde el sendero cruza el agua, el fondo sube: eso es un vado, y es
       por donde se pasa */
    const vado = sendero(gx,gy)>0;
    poner(p,L,x,y, (pr>0.58&&!vado)?'A' : pr>0.34?(vado?'a':'a') : pr>0.12?'s' : 'k');
    if(pr>0.34) p.flow[y*L+x]=este?1:0;
  }
}
function arboles(p,L,ox,oy,rnd,op){
  const cx=L/2, cy=L/2;
  for(let y=1;y<L-1;y++) for(let x=1;x<L-1;x++){
    const gx=ox+x, gy=oy+y;
    let f=ruidoA(gx+90,gy+90,3,0.035);
    if(op.claro){ const d=Math.hypot(x-cx,y-cy); f-=Math.max(0,1-d/22)*0.55; }
    if(op.hasta && x>op.hasta) continue;
    if(op.raleando) f -= (y/L)*0.45;                 // hacia el sur, cada vez menos
    if(f<0.46) continue;
    const g=p.ground[y][x];
    if(g!=='g'&&g!=='G'&&!(op.soloPino&&g==='N')) continue;
    if(cercaDelAgua(p,L,x,y,2)) continue;          // ni dentro del agua ni en la orilla
    if(sendero(gx,gy)) continue;                   // ni en medio del camino
    if(rnd()>op.densidad*(0.5+f)*6) continue;
    let cerca=false;
    for(let j=-1;j<=1&&!cerca;j++) for(let i=-1;i<=1;i++) if(p.occ[(y+j)*L+(x+i)]){ cerca=true; break; }
    if(cerca) continue;
    p.occ[y*L+x]=1;
    let sp;
    if(op.soloPino) sp='pino';
    else {
      const hum=ruidoB(gx+3000,gy+3000,3,0.040), alt=ruidoC(gx+770,gy+120,2,0.030);
      sp = hum>0.58?'alamo' : alt>0.54?'pino' : 'encino';
    }
    const A=NVg.SPECIES[sp].alto;
    let h=A[0]+rnd()*(A[1]-A[0]);
    if(op.viejos) h*=1.55;                           // el bosque viejo es alto
    p.trees.push({x,y,h,k:'arbol',sp,s:(rnd()*1e6)|0});
  }
}
/* Las gigantes del pie de monte. Ocupan lo que miden: una de seis metros es
   casi ocho de ancho, así que se marca todo su pie como macizo y no se puede
   pasar por adentro. */
function gigantes(p,L,ox,oy,rnd,n){
  /* En un bosque cerrado casi nunca hay ocho metros libres seguidos, así que se
     insiste: hasta diez tiros por cada gigante que se quiera plantar. */
  let puestas=0;
  for(let i=0;i<n*10&&puestas<n;i++){
    const h=4.2+rnd()*3.3;
    const an=Math.max(2,Math.round(h*0.65));          // medio ancho, en metros
    const x=an+2+((rnd()*(L-2*an-4))|0), y=3+((rnd()*(L-6))|0);
    let ok=true;
    for(let dy=-1;dy<=1&&ok;dy++) for(let dx=-an;dx<=an;dx++)
      if(!libre(p,L,x+dx,y+dy)) ok=false;
    if(!ok) continue;
    for(let dy=-1;dy<=1;dy++) for(let dx=-an;dx<=an;dx++) p.occ[(y+dy)*L+x+dx]=1;
    p.trees.push({x,y,h:h,k:'roca',s:(rnd()*1e6)|0});
    puestas++;
  }
}
function piedrasYtroncos(p,L,ox,oy,rnd,nPiedras,nTroncos){
  for(let i=0;i<nPiedras;i++){
    const x=2+((rnd()*(L-4))|0), y=2+((rnd()*(L-4))|0);
    if(!libre(p,L,x,y)) continue;
    p.occ[y*L+x]=1;
    /* Las tres medidas, cada una con su tanda de modelos en el diccionario:
       canto chico, piedra media y bloque grande. Antes el sorteo no pasaba de
       2,1 m y los modelos grandes no salían nunca. */
    const d=rnd();
    const h = d<0.55 ? 0.35+rnd()*0.38      // chica
            : d<0.85 ? 0.80+rnd()*0.90      // media
                     : 1.90+rnd()*1.40;     // grande
    p.trees.push({x,y,h:h, k:'roca', s:(rnd()*1e6)|0});
  }
  for(let i=0;i<nTroncos;i++){
    const len=2+((rnd()*3)|0), x=3+((rnd()*(L-8))|0), y=2+((rnd()*(L-4))|0);
    let ok=true;
    for(let k=0;k<len;k++) if(!libre(p,L,x+k,y)) ok=false;
    if(!ok) continue;
    for(let k=0;k<len;k++) p.occ[y*L+x+k]=1;
    p.trees.push({x,y,h:0.6,k:'caido',len,s:(rnd()*1e6)|0});
  }
}

/* ---------- entrada ---------- */
function generarPanel(pi,pj,def,L){
  const rnd=NVg.mulberry(NVg.hashStr(NVg.CONFIG.seed+':'+pi+','+pj));
  const p=nuevoPanel(L);
  const ox=pi*L, oy=pj*L;
  ({claro:bioClaro, oeste:bioOeste, este:bioEste, norte:bioNorte, sur:bioSur}[def.bioma])(p,L,ox,oy,rnd);
  marcarSenderos(p,L,ox,oy);

  /* la hoguera, solo en el claro */
  if(def.bioma==='claro'){
    const c=buscarClaro(p,L);
    for(const [dx,dy] of [[3,-2],[-3,-2],[3,2],[-3,2],[0,-4],[0,4],[5,0]]){
      const x=c.x+dx, y=c.y+dy;
      if(!libre(p,L,x,y)) continue;
      p.occ[y*L+x]=1;
      p.trees.push({x,y,h:0.9,k:'hoguera',s:4242});
      p.hoguera={x,y};
      const R=16;
      for(let j=-R;j<=R;j++) for(let i=-R;i<=R;i++){
        const fx=x+i, fy=y+j;
        if(fx<0||fy<0||fx>=L||fy>=L) continue;
        const d=Math.hypot(i,j*1.25);
        if(d<=R) p.fuego[fy*L+fx]=Math.pow(1-d/R,1.5)*2.4;
      }
      break;
    }
    p.inicio=c;
  }
  p.trees.sort((a,b)=>a.y-b.y);

  /* mapa general: un glifo por objeto */
  p.mapG=[];
  for(let y=0;y<L;y++) p.mapG.push(' '.repeat(L));
  const pm=(x,y,c)=>{ if(x<0||y<0||x>=L||y>=L) return;
    p.mapG[y]=p.mapG[y].slice(0,x)+c+p.mapG[y].slice(x+1); };
  for(const t of p.trees){
    if(t.k==='arbol') pm(t.x,t.y,t.sp==='mistico'?'Y':'T');
    else if(t.k==='hoguera') pm(t.x,t.y,'f');
  }
  calcularSombras(p,L);
  return p;
}

/* Sombras del panel. El sol las mueve; de noche no hay. */
function calcularSombras(p,L){
  const S=NVg.cielo?NVg.cielo.sombra:{dx:-1,dy:0,porMetro:1.7};
  p.shade.fill(1);
  if(S.porMetro<=0.02){
    for(const t of p.trees){ const i=t.y*L+t.x; p.shade[i]=Math.min(p.shade[i],0.5); }
    return;
  }
  for(const t of p.trees){
    const largo=Math.max(1,Math.round(t.h*S.porMetro));
    const ancho=t.k==='arbol'?1:0, span=t.k==='caido'?(t.len||1):1;
    for(let sx=0;sx<span;sx++) for(let d=0;d<=largo;d++){
      const x=Math.round(t.x+sx+S.dx*d), y=Math.round(t.y+S.dy*d);
      if(x<0||y<0||x>=L||y>=L) break;
      const str=0.32+0.58*(d/largo);
      for(let j=-ancho;j<=ancho;j++){
        const yy=y+j; if(yy<0||yy>=L) continue;
        const v=j===0?str:str+0.22, i=yy*L+x;
        if(v<p.shade[i]) p.shade[i]=v;
      }
    }
    const i0=t.y*L+t.x; p.shade[i0]=Math.min(p.shade[i0],0.28);
  }
}

function buscarClaro(p,L){
  const cx=Math.round(L/2), cy=Math.round(L/2);
  const bien=(x,y)=>{
    if(!libre(p,L,x,y)) return false;
    for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++){
      const xx=x+i, yy=y+j;
      if(xx<0||yy<0||xx>=L||yy>=L) continue;
      if(p.occ[yy*L+xx]) return false;
    }
    return true;
  };
  for(let r=0;r<L;r++) for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){
    if(Math.max(Math.abs(i),Math.abs(j))!==r) continue;
    if(bien(cx+i,cy+j)) return {x:cx+i,y:cy+j};
  }
  return {x:cx,y:cy};
}

NVg.gigantes=gigantes;
NVg.sendero=sendero;
NVg.generarPanel=generarPanel; NVg.calcularSombras=calcularSombras;
NVg.buscarClaro=buscarClaro; NVg.ejeArroyo=ejeArroyo;
