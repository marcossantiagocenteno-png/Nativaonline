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
const AGUA_U_ORILLA='aAPEskLlObyK';   // el agua y todo lo que la bordea
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
  return g==='g'||g==='G'||g==='h'||g==='n'||g==='N'||g==='D'||g==='k';
};

/* ---------- la proporción de pasto largo, mezclada entre paneles ----------
   Cada bioma quería su propia proporción de pasto largo (G) contra corto (g), y
   la costura entre dos paneles la partía en seco: 83 % de un lado y 50 % del
   otro, una raya de textura en medio del prado. Ahora el umbral de cada panel es
   el suyo en el centro y se va acercando al del vecino hacia la costura; en la
   costura misma los dos lados valen lo mismo, así que no hay escalón.
   La mezcla es sólo del DIBUJO del suelo: no consume el azar del generador, así
   que no mueve ni un árbol ni una piedra. */
const UMBRAL_G={ '0,0':0.50, '-1,0':0.44, '1,0':0.52, '0,-1':0.38, '0,1':0.56,
                 '-1,-1':0.46, '1,-1':0.46, '-1,1':0.46, '1,1':0.46 };
/* Cuántos árboles quiere cada panel (probabilidad base de que nazca uno en una
   celda apta). Es la MISMA mezcla que el pasto largo: sin ella, entre el claro
   (0,009) y el filo del desierto (0,030) el bosque pasaba de ralo a tupido en
   una línea recta. Las esquinas continúan lo que tienen al lado. */
const DENSIDAD_ARBOL={ '0,0':0.009, '-1,0':0.016, '1,0':0.007, '0,-1':0.030, '0,1':0.020,
                       '-1,-1':0.016, '1,-1':0.016, '-1,1':0.014, '1,1':0.014 };
const BANDA_G=24;                                   // metros desde la costura
/* El valor de una tabla por panel en un punto del mundo: el propio del panel en
   el centro, acercándose al del vecino hacia la costura (a medias en la costura). */
function mezclaPanel(tabla,gx,gy,L,def){
  const pi=Math.floor(gx/L), pj=Math.floor(gy/L);
  const propio=tabla[pi+','+pj];
  if(propio===undefined) return def;
  const u=gx-pi*L, v=gy-pj*L;
  const dx=Math.min(u,L-u), dy=Math.min(v,L-v);      // a la costura más cercana, en cada eje
  const nx=u<L/2?pi-1:pi+1, ny=v<L/2?pj-1:pj+1;
  const T=(a,b)=>{ const t=tabla[a+','+b]; return t===undefined?propio:t; };   // fuera del mundo: el propio
  const wx=dx<BANDA_G?0.5*(1-dx/BANDA_G):0, wy=dy<BANDA_G?0.5*(1-dy/BANDA_G):0;
  return (1-wx)*(1-wy)*propio + wx*(1-wy)*T(nx,pj) + (1-wx)*wy*T(pi,ny) + wx*wy*T(nx,ny);
}
const umbralG=(gx,gy,L)=>mezclaPanel(UMBRAL_G,gx,gy,L,0.5);
const densidadArboles=(gx,gy,L)=>mezclaPanel(DENSIDAD_ARBOL,gx,gy,L,0.01);
NVg.densidadArboles=densidadArboles;
NVg.umbralG=umbralG;

/* ---------- el claro, 0:0 ---------- */
function bioClaro(p,L,ox,oy,rnd){
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++) fila += ruidoA(ox+x,oy+y,4,0.05)>umbralG(ox+x,oy+y,L)?'G':'g';
    p.ground.push(fila);
  }
  arroyo(p,L,ox,oy,true);
  arboles(p,L,ox,oy,rnd,{claro:true});
  piedrasYtroncos(p,L,ox,oy,rnd,34,12);
}

/* ---------- pasto: la hoja en blanco. Sólo pasto, sin un árbol, una piedra ni una gota de agua ----------
   Es el mundo de partida desde que se borró todo para volver a editar desde cero. El punto de inicio es el centro. */
function bioPasto(p,L){
  const fila='g'.repeat(L);
  for(let y=0;y<L;y++) p.ground.push(fila);
  p.inicio={x:L>>1,y:L>>1};
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
      fila += ruidoA(gx,oy+y,4,0.05)>umbralG(gx,oy+y,L)?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{viejos:true});
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

/* ---------- las cuatro esquinas ----------
   El mundo eran cinco paneles en cruz, pero la cámara se mueve dentro del
   rectángulo que los contiene: caminando en diagonal se llegaba a donde no hay
   panel y la pantalla quedaba negra. Las esquinas continúan lo que tienen al
   lado, y cada cosa sigue por donde corresponde: el corte del desierto y la
   nieve corren de este a oeste, así que vienen del norte y del sur; la costa
   corre de norte a sur, así que viene del este. Las dos esquinas de la derecha
   llevan las dos cosas. */
function bioEsquina(p,L,ox,oy,rnd,op){
  const borde=62;
  for(let y=0;y<L;y++){
    let fila='';
    for(let x=0;x<L;x++){
      const gx=ox+x, gy=oy+y;
      /* primero la costa, que manda sobre todo lo demás */
      if(op.costa){
        const filo = borde + Math.round(ruidoC(gy*5,0,3,0.05)*5-2.5);
        if(x>filo+11){ fila+='O'; continue; }
        if(x>filo+7) { fila+='E'; continue; }
        if(x>filo+2) { fila+='V'; continue; }
        if(x>filo-1) { fila+='M'; continue; }
        if(x>filo-5) { fila+='d'; continue; }
      }
      if(op.ns==='norte'){
        const corte = 44 + ruidoC(gx,0,3,0.03)*26-13;
        if(y < corte){ fila += ruidoB(gx+9,gy,2,0.10)>0.72?'k':'D'; continue; }
        if(y < corte+2){ fila += 's'; continue; }
        const seco=(corte+16-y)/18 + ruidoB(gx+400,gy,3,0.06)*0.7-0.35;
        if(seco>0.30){ fila += seco>0.62?'h':(ruidoA(gx,gy,3,0.07)>0.5?'h':'g'); continue; }
      } else {
        const nieve = (y-30)/70 + ruidoC(gx,gy,3,0.04)*0.45-0.22;
        if(nieve>0.52){ fila+='N'; continue; }
        if(nieve>0.34){ fila+= ruidoB(gx,gy,2,0.09)>0.5?'N':'n'; continue; }
        if(nieve>0.20){ fila+= 'n'; continue; }
      }
      fila += ruidoA(gx,gy,4,0.05)>umbralG(gx,gy,L)?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,op.ns==='sur'?{soloPino:true}
                                     :{hasta:op.costa?borde-9:L});
  piedrasYtroncos(p,L,ox,oy,rnd,24,9);
  gigantes(p,L,ox,oy,rnd,3);
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
      /* En la desembocadura la orilla ya es de mar: arena mojada, y canto
         rodado grueso donde el oleaje la revuelve. Tierra adentro vuelve a ser
         barro y arena de río. */
      const mar=x/borde;
      if(d<ancho+2.4) { fila+= mar>0.55?'y':(ruidoB(gx+700,gy,2,0.12)>0.42?'b':'s'); continue; }
      if(d<ancho+3.6) { fila+= mar>0.62?'y':'s'; continue; }
      if(d<ancho+5)   { fila+= mar>0.70?'K':'k'; continue; }
      fila += ruidoA(gx,gy,4,0.05)>umbralG(gx,gy,L)?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{hasta:borde-9});
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
      /* Cerca del desierto el pasto está seco, y se va poniendo verde hacia el
         sur. La frontera la pone el mismo ruido que dibuja el corte, así que no
         queda una raya recta entre lo seco y lo verde. */
      const seco=(corte+16-y)/18 + ruidoB(gx+400,gy,3,0.06)*0.7-0.35;
      if(seco>0.30){ fila += seco>0.62?'h':(ruidoA(gx,gy,3,0.07)>0.5?'h':'g'); continue; }
      fila += ruidoA(gx,gy,4,0.05)>umbralG(gx,gy,L)?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{desde:'corte'});
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
      /* Entre el pasto y la nieve hay una franja donde la nieve cubre pero las
         briznas todavía asoman: eso es el pasto nevado, y es lo que hace que la
         nieve no empiece de golpe. */
      if(nieve>0.34){ fila+= ruidoB(gx,gy,2,0.09)>0.5?'N':'n'; continue; }
      if(nieve>0.20){ fila+= 'n'; continue; }
      fila += ruidoA(gx,gy,4,0.05)>umbralG(gx,gy,L)?'G':'g';
    }
    p.ground.push(fila);
  }
  arboles(p,L,ox,oy,rnd,{soloPino:true, raleando:true});
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
    /* La orilla, de dentro hacia fuera: corriente, agua somera, barro mojado,
       arena y guijarral. El barro es la franja que se moja y se seca con el
       agua, y es lo que hacía falta para que la arena no empiece pegada al
       agua. En el vado no hay barro: ahí el fondo es piedra y por eso se pasa. */
    poner(p,L,x,y, (pr>0.58&&!vado)?'A'
                 : pr>0.34?'a'
                 : pr>0.24?(vado?'k':(ruidoB(gx+700,gy,2,0.12)>0.40?'b':'s'))
                 : pr>0.12?'s' : 'k');
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
    if(rnd()>densidadArboles(gx,gy,L)*(0.5+f)*6) continue;
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
    p.trees.push({x,y,h:h,k:'roca',s:(rnd()*1e6)|0,fx:an,fy:1});   // fx,fy: medio ancho y medio alto de lo que ocupa (el editor lo usa para liberarlo)
    puestas++;
  }
  circuloMenhires(p,L,ox,oy);
}
/* Un claro con menhires: cuatro o cinco columnas en rueda floja, como la
   referencia. Usa su PROPIO generador (por panel) y no toca el del panel, para
   que agregarlo no mueva nada de lo que se sortea después. Va tras los árboles:
   sólo se planta donde todo está libre. 'ms' termina en 3 o 4 para caer en los
   dos modelos de menhir (gig-4 y gig-5; la lista tiene cinco). */
function circuloMenhires(p,L,ox,oy){
  const r=NVg.mulberry(NVg.hashStr('menhires:'+ox+','+oy));
  if(r()<0.45) return;
  for(let intento=0;intento<40;intento++){
    const cx=9+((r()*(L-18))|0), cy=9+((r()*(L-18))|0), n=4+((r()*2)|0);
    const lug=[];
    for(let i=0;i<n;i++){
      const a=(i/n)*6.283+r()*0.7, rad=4+r()*3.5;
      lug.push([Math.round(cx+Math.cos(a)*rad*1.3), Math.round(cy+Math.sin(a)*rad*0.8), 4.6+r()*1.8, 5*((r()*1e5)|0)+3+(i%2)]);
    }
    let ok=true;
    for(const q of lug) for(let dy=-1;dy<=1&&ok;dy++) for(let dx=-1;dx<=1;dx++)
      if(!libre(p,L,q[0]+dx,q[1]+dy)){ ok=false; break; }
    if(!ok) continue;
    for(const q of lug){
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) p.occ[(q[1]+dy)*L+q[0]+dx]=1;
      p.trees.push({x:q[0],y:q[1],h:q[2],k:'roca',s:q[3],fx:1,fy:1});
    }
    return;
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
  if(def.bioma==='esquina') bioEsquina(p,L,ox,oy,rnd,def.esq);
  else if(def.bioma==='pasto') bioPasto(p,L);
  else ({claro:bioClaro, oeste:bioOeste, este:bioEste, norte:bioNorte, sur:bioSur}[def.bioma])(p,L,ox,oy,rnd);
  if(def.bioma!=='pasto') marcarSenderos(p,L,ox,oy);      // la hoja en blanco no trae ni senderos

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
  /* Sin árboles (NV.CONFIG.arboles=false): se generan igual, para que el azar de
     las piedras y de todo lo demás no se mueva, y se quitan al final junto con la
     casilla que ocupaban. Con arboles:true vuelven tal cual estaban. */
  if(NVg.CONFIG.arboles===false){
    for(const t of p.trees) if(t.k==='arbol') p.occ[t.y*L+t.x]=0;
    p.trees=p.trees.filter(t=>t.k!=='arbol');
  }
  calcularSombras(p,L);
  return p;
}

/* Sombras del panel. El sol las mueve; de noche no hay. */
function calcularSombras(p,L){
  const S=NVg.LUZ_LUNAS?NVg.LUZ_LUNAS.sombra:{dx:1,dy:0.30,porMetro:1.7};
  p.shade.fill(1);
  if(S.porMetro<=0.02){
    for(const t of p.trees){ if(t.k==='rocoso'||t.k==='arbolnv'||t.k==='tope') continue; const i=t.y*L+t.x; p.shade[i]=Math.min(p.shade[i],0.5); }
    return;
  }
  for(const t of p.trees){
    if(t.k==='rocoso'||t.k==='arbolnv'||t.k==='tope') continue;  // los motores de rocas y de árboles proyectan su propia sombra al dibujar
    const largo=Math.max(1,Math.round(t.h*S.porMetro));
    const ancho=t.k==='arbol'?1:0, span=t.k==='caido'?(t.len||1):1;
    for(let sx=0;sx<span;sx++) for(let d=0;d<=largo;d++){
      const x=Math.round(t.x+sx+S.dx*d), y=Math.round(t.y+S.dy*d);
      if(x<0||y<0||x>=L||y>=L) break;
      const str=0.16+0.66*(d/largo);       // sombra larga y honda, como la de la referencia
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

NVg.bioEsquina=bioEsquina;
NVg.gigantes=gigantes;
NVg.sendero=sendero;
NVg.generarPanel=generarPanel; NVg.calcularSombras=calcularSombras;
NVg.buscarClaro=buscarClaro; NVg.ejeArroyo=ejeArroyo;
