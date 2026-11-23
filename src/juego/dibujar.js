/* Nativa Online — dibujo del mundo.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* metros de más que se dibujan hacia el norte este cuadro (ver draw_) */
let _extN=0;
function extNorte(){ return _extN; }
function draw(){
  try{ draw_(); }
  catch(err){
    const Wp=cv.width/dpr,Hp=cv.height/dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#05070a'; ctx.fillRect(0,0,Wp,Hp);
    ctx.fillStyle='#d9a24a'; ctx.textAlign='left'; ctx.font='13px '+MONO;
    ctx.fillText('Error al dibujar: '+err.message,14,24);
    ctx.textAlign='center';
    if(NV.avisarError) NV.avisarError('✗ al dibujar: '+err.message+
      (err.stack?'\n   '+err.stack.split('\n')[1].trim():''));
    if(animTimer){ clearInterval(animTimer); animTimer=null; }
  }
}
function draw_(){
  if(!world||!ctx) return;
  const t0=performance.now();
  const colsM=Math.ceil(cols/CPM), rowsM=Math.ceil(rowsN/RPM);
  const LIM=NV.limites();
  /* La cámara persigue al jugador sin saltos: guarda su posición con decimales
     y el dibujo se corre los píxeles que falten. */
  const destX=clamp(me.x-colsM/2+0.5, LIM.x0, Math.max(LIM.x0,LIM.x1-colsM));
  const destY=clamp(me.y-rowsM/2+0.5, LIM.y0, Math.max(LIM.y0,LIM.y1-rowsM));
  if(NV.camXf===undefined){ NV.camXf=destX; NV.camYf=destY; }
  const sigue=0.30;
  NV.camXf += (destX-NV.camXf)*sigue;
  NV.camYf += (destY-NV.camYf)*sigue;
  if(Math.abs(destX-NV.camXf)<0.01) NV.camXf=destX;
  if(Math.abs(destY-NV.camYf)<0.01) NV.camYf=destY;
  camX=Math.floor(NV.camXf); camY=Math.floor(NV.camYf);
  NV.desplaceX=-(NV.camXf-camX)*CPM*cw;
  /* La vista sube con el jugador: sin esto, al trepar una loma se iría hacia el borde
     de arriba de la pantalla. Se amortigua para que subir no sacuda la cámara. */
  const pp=NV.posDibujo?NV.posDibujo(Date.now()):me;
  const alzaJ=NV.alturaEn(pp.x+0.5,pp.y+0.5)*HPM;
  if(NV.camAlz===undefined) NV.camAlz=alzaJ;
  NV.camAlz+=(alzaJ-NV.camAlz)*0.12;
  if(Math.abs(alzaJ-NV.camAlz)<0.05) NV.camAlz=alzaJ;
  const liftF=Math.floor(NV.camAlz);
  NV.desplaceY=-(NV.camYf-camY)*RPM*chh+(NV.camAlz-liftF)*chh;
  NV.camQuieta = NV.camXf===destX && NV.camYf===destY;
  fbG.fill(0); fbL.fill(0); fbO.fill(0);
  _ft.clear(); _ftX0=camX-3; _ftN=colsM+10;
  const t=frame*0.11;
  prepararLuna(colsM,rowsM);
  const lastRow=Math.min(LIM.y1-1,camY+rowsM+22);
  /* Con altura, un metro del norte puede caer más abajo en pantalla (la vista sube con
     el jugador) y uno del sur más arriba (una loma lo levanta). Sólo se dibujan los
     metros de más que hacen falta: al norte, lo que baja la vista; al sur, lo que
     sube la loma más alta de la franja de abajo. En un llano son dos. */
  const extN=_extN=Math.ceil(NV.camAlz/RPM)+2;
  let hS=0;
  for(let x=camX;x<=camX+colsM;x+=3) for(let y=camY+rowsM;y<=camY+rowsM+10;y+=3) hS=Math.max(hS,NV.alturaEn(x,y));
  const extS=Math.min(14,Math.ceil(hS*HPM/RPM)+2);
  const objetos=NV.objetosEn(camX-2, camY-extN-2, camX+colsM+2, lastRow+2);
  let ti=0; while(ti<objetos.length&&objetos[ti].y<camY-extN) ti++;
  liftR=liftF; NV.liftFila=liftF;

  for(let my=camY-extN;my<=lastRow;my++){
    const rBase=(my-camY)*RPM+RPM-1;                       // fila del suelo
    const haze=0.60+0.40*(Math.max(0,my-camY)/Math.max(1,rowsM));
    ordR=my-camY+extN+1;
    layer=0;
    if(my<camY+rowsM+extS) drawGroundRow(my,rBase,haze,t);
    layer=2;
    while(ti<objetos.length&&objetos[ti].y<=my){ if(objetos[ti].y===my) drawTree(objetos[ti],haze,t); ti++; }
    layer=3;
    /* Los personajes se dibujan en la fila que les toca, igual que los
       árboles: así el que está más al sur tapa al que está más al norte.

       La fila es la de donde está PISANDO, no la de la casilla a la que va.
       Dibujado en la casilla de destino, al caminar hacia el norte el
       personaje queda medio metro al sur de su fila, y el pasto y los árboles
       de las filas siguientes —que se pintan después— le pasan por encima. Eso
       se ve como glifos sueltos encima de la figura mientras camina. */
    if(my===Math.round(pp.y)){ alzaR=Math.round(alzaJ); drawPlayer(haze); alzaR=0; }
    const otros=NV.personajes;
    if(otros&&otros.length){
      const Wc=Math.max(3,Math.round(0.55*CPM));
      for(let q=0;q<otros.length;q++){
        const o=otros[q];
        if(Math.round(NV.posPersonaje(o,Date.now()).y)!==my) continue;
        layer=3;
        const po=NV.posPersonaje(o,Date.now());
        alzaR=Math.round(NV.alturaEn(po.x+0.5,po.y+0.5)*HPM);
        if(!NV.dibujarPersonaje(o,haze,t,lienzoDe(Wc))) figuraRespaldo(o,haze);
        alzaR=0;
      }
    }
  }
  dibujarParticulas(Date.now()/1000,objetos,colsM,rowsM);
  if(NV.destino){                       // adónde se va, mientras se va
    const d=NV.destino;
    ordR=65535; alzaR=Math.round(NV.alturaEn(d.x+0.5,d.y+0.5)*HPM);
    const c0=(d.x-camX)*CPM+Math.floor(CPM/2), r0=(d.y-camY)*RPM+RPM-1;
    const pulso=0.6+0.4*Math.sin(Date.now()/230);
    const col=packc(120+120*pulso, 220, 150+80*pulso);
    layer=3;
    for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,col);
    layer=0; alzaR=0;
  }
  liftR=0; alzaR=0; usaCol=false; ordR=65535;
  flush();
  /* el viento y el rumbo, en una línea */
  $('st2').textContent='viento '+(wind<0.5?'calmo':wind<0.95?'suave':'racheado')
          +' · mirando al '+facing;
  const dt=performance.now()-t0;
  lastMs=lastMs*0.7+dt*0.3;
  if(lastMs>34&&calidad>0.42) calidad=Math.max(0.42,calidad-0.08);
  else if(lastMs<15&&calidad<1) calidad=Math.min(1,calidad+0.04);
  if(dt>46&&animMs<520){ animMs=Math.min(520,Math.round(animMs*1.4)); restartAnim(); }
}

/* El fuego no es constante: late. */
function titilar(t){
  return 0.80 + 0.20*Math.sin(t*9.3) + 0.14*Math.sin(t*23.7+1.4) + 0.08*Math.sin(t*41.1);
}

/* ---------- LA LUZ DEL FUEGO, CASILLA POR CASILLA ----------
   El suelo se dibuja por metros, y a cada metro le tocaba un solo valor de
   calor: la hoguera salía en anillos cuadrados. Los metros que tienen fuego a
   la vista guardan acá los nueve valores de su vecindad y cada casilla
   interpola el suyo. Los demás metros no pagan nada. */
const _fa=new Float32Array(9);
let _fL0=0,_fGF=1,_fFam='',_fAg=1, _lz=0,_cal=0,_col=0;
function prepararFuego(mx,my,light0,ganancia,fam,agua){
  for(let j=0;j<3;j++) for(let i=0;i<3;i++) _fa[j*3+i]=NV.fuegoEn(mx-1+i,my-1+j);
  _fL0=light0; _fGF=ganancia; _fFam=fam; _fAg=agua;
}
/* El metro ocupa [1,2) en la vecindad de 3×3 y los valores viven en los
   centros (0.5, 1.5, 2.5): una casilla en (u,v) del metro cae en 0.5+u. */
function afinar(k,sy){
  const x=0.5+(k+0.5)/CPM, y=0.5+(sy+0.5)/RPM;
  const i=x|0, j=y|0, fx=x-i, fy=y-j, o=j*3+i;
  const f=(_fa[o]*(1-fx)+_fa[o+1]*fx)*(1-fy)+(_fa[o+3]*(1-fx)+_fa[o+4]*fx)*fy;
  _cal=f*_fGF;
  _lz=clamp(_fL0+_cal*0.85,0,2.0);
  _col=packs(_fFam,_lz*_fAg,_cal*0.75);
}

/* ---------- EL AGUA ----------
   Ver la sección del agua en el diccionario: todo sale de un campo de olas, y
   de ahí la altura elige el glifo, la pendiente hacia el este decide dónde pega
   el reflejo del sol, y la espuma aparece donde la cresta es alta Y empinada a
   la vez. Sólo alta da una tela corrugada.

   wx, wy vienen en metros del mundo, fraccionarios: el agua se resuelve CELDA
   POR CELDA y no por metro, que es lo que le da la onda continua. */
const olaRuido=makeNoise(mulberry(70113));
const texRuido=makeNoise(mulberry(31771));
/* Dos octavas: un manchón grande que le da forma y un temblor fino que lo
   desarma. Con una sola el suelo sale a cuadros.

   Las coordenadas van en METROS DEL MUNDO y la escala también. En celdas, que
   es como estaba, la textura cambiaba de tamaño con el zoom —porque CPM cambia—
   y además quedaba estirada tres veces a lo alto, porque un metro son CPM
   columnas pero sólo RPM filas. */
const tex2=(wx,wy,e)=>0.66*texRuido(wx/e,wy/e,1,1)
                     +0.34*texRuido(wx/(e*0.42)+37,wy/(e*0.42),1,1);
/* La luna en el agua quieta: un disco de glifos claros, estirado a lo ancho por la
   perspectiva y cortado en franjas, que se ve donde haya agua en el lugar de la
   pantalla que le toca. Es una sola luna, fija en la pantalla (reflejo y espectador
   se mueven juntos); su sitio y su fuerza salen de luz-de-lunas/luz.js. */
let _luna=null;
function prepararLuna(colsM,rowsM){
  const Lz=NV.LUZ_LUNAS&&NV.LUZ_LUNAS.luna;
  if(!Lz){ _luna=null; return; }
  const cx=NV.camXf===undefined?camX:NV.camXf, cy=NV.camYf===undefined?camY:NV.camYf;
  _luna={x:cx+colsM*Lz.x, y:cy+rowsM*Lz.y, f:Lz.fuerza, rx:Lz.rx, ry:Lz.ry};
}
const _ola={g:0,fam:'agua',lz:1};
function celdaOla(est,wx,wy,t){
  const A=NV.OLAS[est]||NV.OLAS.rio;
  const rp=A.reposo===undefined?1:A.reposo;
  let h=0, dx=0, dy=0, amp=0;
  for(let i=0;i<A.olas.length;i++){
    const o=A.olas[i];
    const kx=NV.cosn(o.dir)/o.largo, ky=NV.sen(o.dir)/o.largo;
    /* el frente se desordena con ruido: una ola perfecta se lee como corrugado */
    const des=A.quiebre?(olaRuido(wx*0.42+i*7,wy*0.42,1,1)-0.5)*A.quiebre*1.7:0;
    const f=(wx*kx+wy*ky-t*rp*o.vel/o.largo+des)*6.28318;     // más quieta, más lenta
    h+=NV.sen(f)*o.amp;
    const c=NV.cosn(f)*o.amp*6.28318;           // la pendiente: la derivada
    dx+=c*kx; dy+=c*ky;
    amp+=o.amp;
  }
  h=h/amp*rp;                                   // el reposo achata la ola
  dx*=rp; dy*=rp;
  const pend=Math.sqrt(dx*dx+dy*dy)/amp;
  const subida=h*0.5+0.5;                       // 0 valle, 1 cresta
  let g, fam=A.hondo>0.55?A.famH:A.fam;
  let lz=(0.46+0.70*subida)*(1.12-A.hondo*0.46);
  const rompe = subida>A.espuma && dx>0;
  if(rompe){
    g=(hash3((wx*7)|0,(wy*7)|0,3)%3)?42:35;     // * #
    fam='espuma'; lz=1.05+0.30*subida;
  } else {
    g=A.rampa[clamp(Math.round(subida*(A.rampa.length-1)),0,A.rampa.length-1)].charCodeAt(0);
  }
  if(!rompe && A.brillo){
    /* el reflejo: pega donde la cara mira al este y está parada */
    const esp=clamp(dx/(pend+0.001),0,1)*clamp(pend*0.9,0,1)*A.brillo;
    if(esp>0.62 && (hash3((wx*11)|0,(wy*11)|0,5)%100)<58){
      g = esp>0.95?42:176; fam='espuma'; lz=1.00+esp*0.42;
    }
  }
  /* el agua quieta de la muestra es casi negra y rala: rayitas sueltas y mucho
     vacío, no una trama pareja. Más reposo, más vacío y más oscuro. */
  if(rp<=0.6 && !rompe && g!==42 && g!==176){
    lz*=0.72;
    if((hash3((wx*5)|0,(wy*9)|0,89)%100)<(subida<0.5?52:36)) g=32;
  }
  /* el cielo en el agua quieta: de noche las estrellas se ven reflejadas, apenas
     más tenues que arriba y alargadas hacia abajo. Fijas en el mundo (no en la
     pantalla) y con un titilar lento; las nubes y el mal tiempo las tapan. */
  if(rp<=0.6 && !rompe){
    const noche=NV.LUZ_LUNAS?NV.LUZ_LUNAS.estrellas:0;
    if(noche>0.05){
      const hq=hash3((wx*9)|0,(wy*7)|0,83)%1000;
      if(hq<26*noche){
        const tit=0.55+0.45*NV.sen(t*0.8+hq*0.9);
        g=(hq&1)?58:46; fam='nieve'; lz=(0.40+0.75*tit)*(hq<8?1.3:1);
      }
    }
  }
  if(_luna && rp<=0.6 && !rompe){
    const ux=(wx-_luna.x)/_luna.rx, uy=(wy-_luna.y)/_luna.ry, d2=ux*ux+uy*uy*0.55;
    if(d2<1 && NV.sen(wy*9+t*0.7)>-0.6){
      const q=(1-d2)*_luna.f, hq=hash3((wx*13)|0,(wy*9)|0,97)%100;
      if(hq<30+70*q){ g=q>0.6?(hq%3?56:35):q>0.3?111:58; fam='nieve'; lz=0.5+0.9*q; }
    }
  }
  if(A.rocio && subida>0.80 && (hash3((wx*13)|0,(wy*13)|0,7)%100)<16){
    g=39; fam='espuma'; lz=1.25;                // el rocío que arranca el viento
  }
  _ola.g=g; _ola.fam=fam; _ola.lz=lz;
  return _ola;
}
/* El mar siempre está en calma: ya no hay tiempo que lo revuelva. */
function estadoDelMar(){ return 'mar-calma'; }

/* ---------- EL BORDE ENTRE DOS MATERIALES ----------
   El motor decide el material por METRO: sueloEn devuelve una letra por metro y
   después se rellenan las CPM×RPM celdas de ese metro con ella. Mientras la
   orilla es recta no se nota. En cuanto el río dobla, el borde sale como una
   escalera de un metro de paso: diez o catorce caracteres por escalón. Ninguna
   textura arregla eso, porque el defecto no está en la textura sino en dónde se
   toma la decisión.

   La salida: en los metros que tocan a otro material —y sólo en ésos, que son
   pocos— se decide CELDA POR CELDA. Cerca del límite se sortea entre el
   material propio y el del vecino, con probabilidad según de qué lado cae la
   celda. El borde deja de ser una línea y se vuelve una franja entreverada de
   unos centímetros, que es como se entreveran de verdad la arena y el
   guijarral. Medido sobre un río curvo, el escalón mayor pasa de catorce celdas
   a tres.

   El metro sigue mandando para caminar y para el camino que busca el personaje.
   Lo que cambia es sólo quién decide el color de cada letra. */
const MEZCLA=0.55;                   // cuánto se mezcla justo en el límite
/* Las tres filas de material que hacen falta —la de arriba, la propia y la de
   abajo— se traen UNA VEZ por fila y se guardan acá. Preguntándolas de nuevo
   por celda, el cuadro pasaba de 24 a 31 ms: cada consulta busca su panel. */
let _fN=[], _fC=[], _fS=[], _f0=0;
function traerFilas(my,desde,hasta){
  _f0=desde;
  const n=hasta-desde+1;
  if(_fC.length<n){ _fN=new Array(n); _fC=new Array(n); _fS=new Array(n); }
  for(let i=0;i<n;i++){
    const mx=desde+i;
    _fN[i]=NV.sueloEn(mx,my-1); _fC[i]=NV.sueloEn(mx,my); _fS[i]=NV.sueloEn(mx,my+1);
  }
}
function tocaOtro(i,type){
  const o=_fC[i-1], e=_fC[i+1], n=_fN[i], s=_fS[i];
  return (!!o&&o!==type)||(!!e&&e!==type)||(!!n&&n!==type)||(!!s&&s!==type);
}
function vecinoDe(i,type,u,v,cx,cy){
  const h=(hash3(cx,cy,61)%1000)/1000;
  let acc=0, t2;
  t2=_fC[i-1];
  if(t2&&t2!==type){ const p=Math.max(0,0.5-u)*2; acc+=p*p*MEZCLA; if(h<acc) return t2; }
  t2=_fC[i+1];
  if(t2&&t2!==type){ const p=Math.max(0,u-0.5)*2; acc+=p*p*MEZCLA; if(h<acc) return t2; }
  t2=_fN[i];
  if(t2&&t2!==type){ const p=Math.max(0,0.5-v)*2; acc+=p*p*MEZCLA; if(h<acc) return t2; }
  t2=_fS[i];
  if(t2&&t2!==type){ const p=Math.max(0,v-0.5)*2; acc+=p*p*MEZCLA; if(h<acc) return t2; }
  return type;
}

/* ---------- LA ORILLA: UNA CURVA, NO UNA ESCALERA ----------
   vecinoDe suelta el borde de la grilla, pero la línea de agua sigue siendo la
   del metro: la costa se define con una letra por metro y por mucho que se
   entreveren las casillas, la frontera pasa por donde cambia la letra. Una
   orilla que dobla sale como escalera de un metro de paso.

   Acá se decide por CAMPO. Cada metro tiene un 0 (tierra) o un 1 (agua); cada
   esquina del metro recibe el promedio ponderado de los metros que la rodean
   (el binomial 1-3-3-1 en cada eje), y dentro del metro se interpola entre las
   cuatro esquinas. La orilla es donde ese campo vale un medio. Una recta sigue
   donde estaba, pero una escalera se vuelve diagonal y una curva se vuelve
   curva. Un ruido en coordenadas del mundo la hace serpentear unos decímetros.

   Con el campo se deduce la distancia a la orilla, y de ahí salen dos cosas: la
   franja de espuma, que respira con la marea corta, y la arena mojada del lado
   de tierra. */
const _ft=new Map();               // una fila de letras del suelo, una vez por cuadro
let _ftX0=0, _ftN=0;
function filaT(y){
  let a=_ft.get(y);
  if(!a){ a=new Array(_ftN); for(let i=0;i<_ftN;i++) a[i]=NV.sueloEn(_ftX0+i,y); _ft.set(y,a); }
  return a;
}
const esAgua=t=>{ const q=MAT[t]; return !!(q&&q.ola); };
const _W=[1,3,3,1];
let _C0=0,_C1=0,_C2=0,_C3=0, _oL=[null,null,null,null], _oT='', _ob=0;
function prepararOrilla(mx,my,type){
  const i=mx-_ftX0;
  const R=[filaT(my-2),filaT(my-1),filaT(my),filaT(my+1),filaT(my+2)];
  let agua=false, tierra=false;
  for(let a=1;a<=3;a++) for(let b=-1;b<=1;b++){
    const t=R[a][i+b]; if(!t) continue;
    if(t==='V') return false;              // la caída del acantilado no es orilla
    if(esAgua(t)) agua=true; else tierra=true;
  }
  if(!agua||!tierra) return false;
  const propia=esAgua(type)?1:0;
  const M=(a,b)=>{ const t=R[b][i+a]; return t?(esAgua(t)?1:0):propia; };
  const esq=(cx,cy)=>{
    let acc=0;
    for(let b=0;b<4;b++) for(let a=0;a<4;a++) acc+=_W[a]*_W[b]*M(cx-2+a, cy-2+b+2);
    return acc/64;
  };
  _C0=esq(0,0); _C1=esq(1,0); _C2=esq(0,1); _C3=esq(1,1);
  _oL[0]=R[2][i-1]; _oL[1]=R[2][i+1]; _oL[2]=R[1][i]; _oL[3]=R[3][i];
  _oT=type;
  return true;
}
/* la letra del vecino más cercano a la casilla que sea de la clase pedida */
function letraDeClase(agua,u,v){
  if(esAgua(_oT)===agua) return _oT;
  const d=[u,1-u,v,1-v];
  let mejor=-1, md=9;
  for(let k=0;k<4;k++){
    const t=_oL[k];
    if(!t||esAgua(t)!==agua||t==='V') continue;
    if(d[k]<md){ md=d[k]; mejor=k; }
  }
  return mejor<0?_oT:_oL[mejor];
}
function decidirOrilla(u,v,wx,wy){
  const m=(_C0*(1-u)+_C1*u)*(1-v)+(_C2*(1-u)+_C3*u)*v;
  const umbral=0.5+(tex2(wx*1.3,wy*1.3,0.7)-0.5)*0.12;
  /* El campo no sube igual en todas partes: en una recta sube unos 0,5 por
     metro, pero en una diagonal o en una esquina sube mucho menos. Medida
     directamente en unidades del campo, la franja de espuma salía el doble de
     gruesa donde la costa es oblicua. Se divide por la pendiente para tener la
     distancia a la orilla en METROS. */
  const gu=(1-v)*(_C1-_C0)+v*(_C3-_C2), gv=(1-u)*(_C2-_C0)+u*(_C3-_C1);
  const g=Math.sqrt(gu*gu+gv*gv);
  _ob=(m-umbral)/(g>0.12?g:0.12);          // metros; >0 del lado del agua
  return letraDeClase(_ob>0,u,v);
}
/* ---------- detalle suelto del suelo: flores, guijarros, hojarasca ----------
   Ver DET en el diccionario. Cada metro calcula una sola vez, para cada detalle,
   16 valores de mancha (un cuarto de metro de paso): cuánto adentro de una mancha
   cae cada cuarto, y de qué color es la mancha. Después cada celda sólo tira un
   dado contra esa cifra. La densidad se da por metro cuadrado y se reparte entre
   las celdas que haya, así que no cambia con el zoom. */
const _gT=[0,0,0], _gM=[0,0,0], _gB=[0,0,0];     // colores de brizna por tono, se reusan

/* ---------- PASTO COMPACTO (variante C de preview/pasto.js, aprobada por Marcos) ----------
   Superficie continua de marcas chicas: casi cada celda lleva un caracter (: ; ' ` - ~ " ! i , .)
   y encima trazos | / \ de 1 a 3 caracteres, nunca briznas largas. Seis tonos: bosque azulado
   muy oscuro, musgo triste, verde grisáceo frío, oliva apagado, reflejo claro y gris discreto.
   Las manchas de tono y de luminosidad vienen de ruido del mundo, medido una vez por franja
   de metro y no por celda. Las flores son pocas y van en grupitos, no sueltas. */
const PC_PAL=[[14,32,34, 22,46,48],[38,66,58, 54,88,76],[66,86,86, 84,106,106],
              [72,80,62, 90,98,76],[96,150,138, 134,184,170],[98,108,112, 120,130,134]];
const PC_CUM=[0.28,0.48,0.63,0.80,0.94,1.0];
const PC_MICRO=':;\'`-~"!i,.:;'.split('').map(ch=>ch.charCodeAt(0));
const PC_COBERTURA=0.965, PC_TRAZO=0.30, PC_ZONA=0.55;
function pcColor(tono,u,lum,lf,calor){
  const p=PC_PAL[tono], m=lum*lf;
  let r=(p[0]+(p[3]-p[0])*u)*m, g=(p[1]+(p[4]-p[1])*u)*m, b=(p[2]+(p[5]-p[2])*u)*m;
  if(calor){ const k=Math.min(1.2,calor)*0.6; r+=168*k; g+=84*k; b+=22*k; }
  return packc(r,g,b);
}
/* los grupitos de flores de UN metro: baldosas de 6 m, un grupo en 1 de cada 9, de 3 a 6 flores */
const _flC=[0,0,0,0,0,0,0,0], _flS=[0,0,0,0,0,0,0,0], _flG=[0,0,0,0,0,0,0,0]; let _flN=0;
function floresDelMetro(mx,my){
  _flN=0;
  const TS=6, tx=Math.floor(mx/TS), ty=Math.floor(my/TS), hh=hash3(tx+500,ty+500,9);
  if(hh%100>=11) return;
  const cx=tx*TS+1.2+((hh>>8)%100)/100*3.6, cy=ty*TS+1.2+((hh>>16)%100)/100*3.6, n=3+((hh>>3)%4);
  for(let i=0;i<n;i++){
    const hi=hash3(tx+500,ty+500,40+i);
    const fx=cx+(((hi%100)/100)-0.5)*2.2, fy=cy+((((hi>>8)%100)/100)-0.5)*1.1;
    if(Math.floor(fx)!==mx||Math.floor(fy)!==my) continue;
    _flC[_flN]=Math.min(CPM-1,Math.floor((fx-mx)*CPM));
    _flS[_flN]=Math.min(RPM-1,Math.floor((fy-my)*RPM));
    _flG[_flN]='@eo'.charCodeAt((hi>>16)%3); _flN++;
  }
}
const _zn=[], _zf=[];
function prepararDetalle(mx,my,lista){
  for(let d=0;d<lista.length;d++){
    const D=lista[d], z=_zn[d]||(_zn[d]=new Float32Array(16)), f=_zf[d]||(_zf[d]=new Uint8Array(16));
    for(let j=0;j<4;j++) for(let i=0;i<4;i++){
      const wx=mx+(i+0.5)/4, wy=my+(j+0.5)/4;
      const n=tex2(wx+D.sem,wy,D.escala);
      z[j*4+i]= clamp((n-D.corte)/D.borde,0,1);
      f[j*4+i]= D.fam.length>1 ? Math.min(D.fam.length-1,Math.floor(tex2(wx+D.sem+91,wy+37,D.escala*2.2)*D.fam.length)) : 0;
    }
  }
}
function detallar(lista,k,sy,cx,cyb,base,rb,light,calor){
  const sub=((sy*4/RPM)|0)*4+((k*4/CPM)|0);
  for(let d=0;d<lista.length;d++){
    const z=_zn[d][sub]; if(z<=0) continue;
    const D=lista[d];
    const h=hash3(cx,cyb,D.sem);
    if((h%100000)>=D.porM2*z/(CPM*RPM)*100000) continue;
    const col=packs(D.fam[_zf[d][sub]],clamp(light*1.12,0,1.4),calor*0.75);
    put(base+k,rb-(D.alza?((h>>17)%2):0),D.glifo.charCodeAt(0),col);
  }
}
/* la franja de espuma: ancha y angosta con el vaivén, y entrecortada */
function espumar(wx,wy,cx,cyb,calor,t){
  const banda=0.13+0.09*(0.5+0.5*NV.sen((wx*1.7+wy*1.3)*6.28318-t*1.3));   // metros
  if(_ob>=banda) return;
  if((hash3(cx,cyb,71)%100)>=84) return;
  const f=_ob/banda;
  _cg = f<0.30?42 : f<0.65?61 : 45;      // * = -
  _cc = packs('espuma',1.05+0.30*(1-f),calor*0.75);
}
/* una celda de relleno de cualquier material, con su propio color */
let _cg=0,_cc=0;
function celdaSuelo(mt,wx,wy,cx,cyb,light,calor,t){
  if(mt.ola){
    const est = mt.ola==='mar' ? estadoDelMar() : mt.ola;
    const o=celdaOla(est,wx,wy,t);
    _cg=o.g; _cc=packs(o.fam,clamp(o.lz*light,0,1.4),calor*0.75);
    return true;
  }
  let dens=0.42+0.52*tex2(wx,wy,0.50), g=null, lz=light;
  if(mt.onda){
    const O=mt.onda;
    const u=(wx*NV.cosn(O.angulo)+wy*NV.sen(O.angulo))/O.largo+tex2(wx,wy,0.80)*0.9;
    const cr=0.5+0.5*NV.sen(u*6.28318);
    dens=clamp(0.30+Math.pow(cr,1.5)*O.fuerza+tex2(wx+7,wy,0.30)*0.22,0,1);
    if(mt.mojada){ lz*=0.78; if(cr>0.93&&(hash3(cx,cyb,9)%7)===0){ g='-'; lz*=1.5; } }
  } else if(mt.terron){
    const te=tex2(wx,wy,0.26);
    dens=clamp(0.18+te*mt.terron*0.92+tex2(wx+4,wy,0.70)*0.26,0,1);
  } else if(mt.charco!==undefined){
    const ch=tex2(wx,wy,0.36);
    if(ch<mt.charco){
      dens=clamp(0.72+ch*0.5,0,1); lz*=mt.brillo?1.34:0.82;
      if(mt.brillo&&(hash3(cx,cyb,23)%11)===0){ g='~'; lz*=1.5; }
    } else {
      dens=clamp(0.28+ch*0.46,0,1);
      if(mt.costra){
        const gq=Math.abs(tex2(wx+1.3,wy,0.24)-0.5);
        if(gq<0.020*mt.costra){ g='|'; lz*=0.30; }
      }
    }
  } else if(mt.calibre){
    dens=clamp(0.18+tex2(wx,wy,0.20)*(0.55+mt.calibre*0.55),0,1);
  } else if(mt.manto){
    dens=clamp(0.3+tex2(wx,wy,0.24)*0.8,0,1);
  } else {
    dens=clamp(0.34+light*(0.80+dens*0.42)*0.78,0,1);
  }
  if(!g) g=pick(mt.ramp,dens);
  if(g===' ') return false;
  _cg=g.charCodeAt(0); _cc=packs(mt.fam,clamp(lz*(mt.agua||1),0,1.4),calor*0.75);
  return true;
}

/* Filas que sube cada columna de celdas de un metro (_a0) y las que subirá el metro
   de al sur (_a1). Se mide en la línea media del metro, interpolando entre sus
   esquinas, así que entre una celda y la siguiente no hay escalón. */
const _a0=[], _a1=[];
function fijarAlza(mx,my,base){
  const P=(x,y)=>NV.alturaEn(x,y);
  const h00=P(mx,my), h10=P(mx+1,my), h01=P(mx,my+1), h11=P(mx+1,my+1), h02=P(mx,my+2), h12=P(mx+1,my+2);
  const L0=(h00+h01)/2, R0=(h10+h11)/2, L1=(h01+h02)/2, R1=(h11+h12)/2;
  for(let k=0;k<CPM;k++){
    const u=(k+0.5)/CPM, c=base+k;
    _a0[k]=Math.round((L0+(R0-L0)*u)*HPM);
    _a1[k]=Math.round((L1+(R1-L1)*u)*HPM);
    if(c>=0&&c<cols) colAlza[c]=_a0[k];
  }
}
/* La cara de una pared: roca en estratos. Las bandas van a ALTURA ABSOLUTA (z, en metros):
   atadas a la fila se correrían de una columna a la otra y la pared saldría rayada al
   revés. Hay dos tonos de piedra que se alternan en manchones. */
function caraDeRoca(c,r,wx,z,haze){
  if(fbO[r*cols+c]>ordR) return;
  const banda=patch(wx*0.7, z*2.6, 3, 0.30);
  const lz=clamp((0.58+banda*0.95)*0.85*haze,0.25,1.2);
  const fam=patch(wx*0.25, z*0.25, 2, 0.09)>0.5?'roca2':'piedra';
  const dens=clamp(0.25+lz*0.45+(hash3(c,r,41)%100)/100*0.35,0,1);
  const g=pick(MAT.M.ramp,dens);
  const i=r*cols+c;
  fbG[i]=g.charCodeAt(0); fbC[i]=packs(fam,lz); fbL[i]=0; fbO[i]=ordR;
}
/* Si el terreno baja hacia el sur queda un hueco entre este metro y el siguiente:
   es la cara de la pendiente, y se rellena con el mismo suelo estirado hacia abajo.
   Donde el de al sur sube, simplemente lo tapa. */
/* desde cuántos metros de desnivel por metro de fondo la cara es de roca y no suelo estirado:
   es el mismo número que vuelve sólido el metro (MESETA.pared), así lo que se ve como pared
   no se pisa y lo que se pisa no se ve como pared. */
function rellenarFrente(base,rBase,mx,haze){
  for(let k=0;k<CPM;k++){
    const c=base+k; if(c<0||c>=cols) continue;
    const g=_a0[k]-_a1[k]; if(g<=0) continue;
    const fondo=rBase-_a0[k]+liftR;                 // la última fila de este metro, en pantalla
    const roca=g>=NV.ALTURA.meseta.pared*HPM;
    for(let j=1;j<=g;j++){
      const r=fondo+j; if(r<0||r>=rowsN) continue;
      if(roca){ caraDeRoca(c,r,mx+(k+0.5)/CPM,(_a0[k]-j)/HPM,haze); continue; }
      const rs=fondo-((j-1)%RPM); if(rs<0||rs>=rowsN) continue;
      const si=rs*cols+c, di=r*cols+c;
      if(fbO[di]>ordR) continue;
      fbG[di]=fbG[si]; fbC[di]=fbC[si]; fbL[di]=0; fbO[di]=ordR;
    }
  }
}
const MANCHAS_DE_TIERRA=false;     // las manchas de tierra del pasto, apagadas mientras haya un solo pasto
function drawGroundRow(my,rBase,haze,t){
  const colsM=Math.ceil(cols/CPM);
  traerFilas(my,camX-1,camX+colsM+1);
  let wsum=0,wn=0;
  const top=rBase-(RPM-1);                 // un metro de fondo ocupa RPM filas
  for(let mx=camX;mx<=camX+colsM;mx++){
    const type=NV.sueloEn(mx,my);
    if(!type) continue;                         // más allá del mundo conocido
    const mt=MAT[type]||MAT.g;
    const sh=NV.sombraEn(mx,my);
    let lp=0.58+patch(mx,my,3,0.08)*0.80;      // charcos de sombra y claros: más contraste que antes (0,84 + 0,40)
    let fam=mt.fam, grieta=0;
    if(mt.textura==='roca'){
      /* estratos: bandas horizontales de distinta dureza, como la roca de
         verdad, y dos tonos de piedra que se alternan en manchas grandes */
      lp *= 0.58 + patch(mx*0.7, my*2.6, 3, 0.30)*0.95;
      fam = patch(mx*0.25, my*0.25, 2, 0.09)>0.5 ? 'roca2' : 'piedra';
      grieta = patch(mx*1.4+50, my*1.4, 2, 0.5);
    } else if(mt.textura==='tierra'){
      lp *= 0.76 + patch(mx*0.9, my*1.3, 3, 0.22)*0.62;
    } else if(mt.textura==='caida'){
      lp *= 0.30;
    }
    if(!mt.ola) lp*=NV.luzRelieve(mx+0.5,my+0.5);      // lomas y hondonadas: sólo por la luz
    let light=clamp(sh*lp*haze,0,1.3);
    const light0=light;
    /* resplandor de la hoguera: más fuerte cuanto más oscuro esté todo.
       Los metros con fuego cerca lo recalculan casilla por casilla (afinar). */
    const gananciaFuego=(1.55-Math.min(1,NV.luz.amb)*0.95)*titilar(t);
    const cerca=NV.calorCerca(mx,my);
    const fg0=NV.fuegoEn(mx,my);
    let calor = fg0 ? fg0*gananciaFuego : 0;
    if(calor) light=clamp(light+calor*0.85,0,2.0);
    const w=windAt(mx,my,t); wsum+=w; wn++;
    const bend = w>1.02?2 : w>0.66?1 : 0;
    let colG=packs(fam,light*(mt.agua||1)*(mt.mata?0.62:1),calor*0.75);   // el suelo del pasto, oscuro: que las briznas resalten
    if(cerca) prepararFuego(mx,my,light0,gananciaFuego,fam,mt.agua||1);
    const base=(mx-camX)*CPM;
    const grass=!!mt.mata;
    const mezclar=tocaOtro(mx-_f0,type);
    const bw=mezclar&&!grass&&prepararOrilla(mx,my,type);
    /* cuánta mata hay en este metro: un ruido suave, para que el pasto crezca a
       parches y no parejo como una cancha */
    /* manchas de tierra oscura: claros pelados dentro del pasto, de unos cinco
       metros, donde la mata ralea y asoma el suelo (como en la referencia) */
    const mancha=(MANCHAS_DE_TIERRA&&grass)?clamp((tex2(mx+40.5,my-24.5,5.5)-0.60)/0.10,0,1):0;   // apagadas: un solo pasto
    const densMata=grass?clamp(mt.mata*(0.30+1.45*tex2(mx+0.5,my+0.5,1.6))*(1-0.78*mancha),0,1.4):0;
    /* el detalle no va en los metros que tocan otro material: ahí las celdas
       pueden ser de la arena o del agua de al lado, y una flor en el agua no */
    const det=(grass&&!mezclar&&mt.detalle)?mt.detalle:null;
    if(det) prepararDetalle(mx,my,det);

    /* altura: cada columna de celdas sube lo que sube el terreno ahí */
    fijarAlza(mx,my,base);
    usaCol=true;
    if(grass&&(mt.largo||type==='G')) floresDelMetro(mx,my); else _flN=0;
    /* las RPM franjas se recorren de norte a sur: lo de más al sur tapa */
    for(let sy=0;sy<RPM;sy++){
      const rb=top+sy;
      if(!grass){
        /* en los metros que tocan otro material se decide celda por celda */
        if(mezclar){
          const wy2=my+(sy+0.5)/RPM, v=(sy+0.5)/RPM;
          for(let k=0;k<CPM;k++){
            const u=(k+0.5)/CPM, cx=mx*CPM+k, cyb=my*RPM+sy;
            if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
            const tc=bw?decidirOrilla(u,v,mx+u,wy2):vecinoDe(mx-_f0,type,u,v,cx,cyb);
            const mc=(tc===type)?mt:(MAT[tc]||mt);
            if(mc.mata) continue;                  // el pasto lo pone su propia pasada
            /* del lado de tierra, la arena justo al borde está mojada */
            const lk=(bw&&_ob<=0&&_ob>-0.24&&!mc.ola)?light*0.72:light;
            if(celdaSuelo(mc,mx+u,wy2,cx,cyb,lk,calor,t)){
              if(bw&&_ob>0&&mc.ola) espumar(mx+u,wy2,cx,cyb,calor,t);
              put(base+k,rb,_cg,_cc);
            }
          }
          continue;
        }
        /* el agua se resuelve celda por celda, con su campo de olas */
        if(mt.ola){
          const est = mt.ola==='mar' ? estadoDelMar() : mt.ola;
          const wy=my+(sy+0.5)/RPM;
          for(let k=0;k<CPM;k++){
            if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
            const o=celdaOla(est, mx+(k+0.5)/CPM, wy, t);
            put(base+k,rb,o.g,packs(o.fam,clamp(o.lz*light,0,1.4),calor*0.75));
          }
          continue;
        }
        /* el relleno: la densidad sale de un ruido suave en coordenadas de
           celda, más lo que cada material tenga propio. Ver la sección del
           suelo en el diccionario. */
        const wy=my+(sy+0.5)/RPM;
        for(let k=0;k<CPM;k++){
          if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
          const wx=mx+(k+0.5)/CPM, cx=mx*CPM+k, cyb=my*RPM+sy;
          let dens=0.42+0.52*tex2(wx,wy,0.50);
          let g=null, lz=light;
          if(mt.onda){
            const O=mt.onda;
            const u=(wx*NV.cosn(O.angulo)+wy*NV.sen(O.angulo))/O.largo
                   + tex2(wx,wy,0.80)*0.9;
            const cr=0.5+0.5*NV.sen(u*6.28318);
            dens=clamp(0.30+Math.pow(cr,1.5)*O.fuerza+tex2(wx+7,wy,0.30)*0.22,0,1);
            if(mt.mojada){ lz*=0.78; if(cr>0.93&&(hash3(cx,cyb,9)%7)===0){ g='-'; lz*=1.5; } }
          } else if(mt.terron){
            const te=tex2(wx,wy,0.26);
            dens=clamp(0.18+te*mt.terron*0.92+tex2(wx+4,wy,0.70)*0.26,0,1);
          } else if(mt.charco!==undefined){
            const ch=tex2(wx,wy,0.36);
            if(ch<mt.charco){
              dens=clamp(0.72+ch*0.5,0,1); lz*=mt.brillo?1.34:0.82;
              if(mt.brillo&&(hash3(cx,cyb,23)%11)===0){ g='~'; lz*=1.5; }
            } else {
              dens=clamp(0.28+ch*0.46,0,1);
              if(mt.costra){
                const gq=Math.abs(tex2(wx+1.3,wy,0.24)-0.5);
                if(gq<0.020*mt.costra){ g='|'; lz*=0.30; }
              }
            }
          } else if(mt.calibre){
            dens=clamp(0.18+tex2(wx,wy,0.20)*(0.55+mt.calibre*0.55),0,1);
          } else if(mt.manto){
            dens=clamp(0.3+tex2(wx,wy,0.24)*0.8,0,1);
          } else {
            dens=clamp(0.34+light*(0.80+dens*0.42)*0.78,0,1);
          }
          if(!g) g=pick(mt.ramp,dens);
          if(g===' ') continue;
          put(base+k,rb,g.charCodeAt(0),
              (lz===light)?colG:packs(fam,clamp(lz*(mt.agua||1),0,1.4),calor*0.75));
        }
        continue;
      }
      /* en el borde, el material de al lado asoma por debajo de las briznas:
         eso es lo que deshace el escalón del lado del pasto */
      if(mezclar){
        const wy2=my+(sy+0.5)/RPM, v=(sy+0.5)/RPM;
        for(let k=0;k<CPM;k++){
          const u=(k+0.5)/CPM, cx=mx*CPM+k, cyb=my*RPM+sy;
          if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
          const tc=vecinoDe(mx-_f0,type,u,v,cx,cyb);
          if(tc===type) continue;
          const mc=MAT[tc];
          if(!mc||mc.mata) continue;
          if(celdaSuelo(mc,mx+u,wy2,cx,cyb,light,calor,t)) put(base+k,rb,_cg,_cc);
        }
      }
      /* el manto de nieve va primero: después las briznas lo atraviesan */
      if(mt.manto){
        const cyb=my*RPM+sy;
        const wyn=my+(sy+0.5)/RPM;
        for(let k=0;k<CPM;k++){
          if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
          const cx=mx*CPM+k, wxn=mx+(k+0.5)/CPM;
          if(tex2(wxn,wyn,0.9)<mt.manto){
            const d=clamp(0.3+tex2(wxn+2,wyn,0.26)*0.8,0,1);
            put(base+k,rb,d>0.72?42:(d>0.4?176:46),packs('nieve',light*(0.92+d*0.36)));
          } else if((hash3(cx,cyb,53)%100)<34)
            put(base+k,rb,176,packs('verdeO',light*0.72));
        }
      }
      /* la tierra de la mancha: terrones y guijas bajo las briznas que quedan */
      if(mancha>0.04){
        const colE=packs('tierra',light*0.70);
        for(let k=0;k<CPM;k++){
          const hq=hash3(mx*CPM+k,my*RPM+sy,41);
          if((hq%100)>=mancha*88) continue;
          put(base+k,rb,[46,58,176,46,58][(hq>>8)%5],colE);   // sin la coma: es la hojarasca del detalle
        }
      }
      /* alfombra dispersa en TODAS las franjas: no hay línea de base */
      if(!mt.manto && !(mt.largo||type==='G')) for(let k=0;k<CPM;k+=2){
        if(tex2(mx+(k+0.5)/CPM,my+(sy+0.5)/RPM,0.34)*densMata<0.34) continue;
        if(cerca){ afinar(k,sy); light=_lz; calor=_cal; colG=_col; }
        put(base+k,rb,mt.largo||type==='G'?124:176,colG);
      }
      /* briznas: base repartida en la profundidad, altura mayor que el paso
         de la grilla para que la mata se enlace de un metro al siguiente */
      const largo=mt.largo||type==='G';
      if(largo){
        /* superficie compacta: una marca por celda casi siempre, trazos cortos encima */
        const y0=my+(sy+0.5)/RPM, cyb=my*RPM+sy;
        const lumZ=tex2(mx+0.5,y0,3.0), tonZ=tex2(mx+9.5,y0+5.3,2.2), corr=tex2(mx+17.5,y0-3.1,4.5);
        const cob=Math.min(0.985,PC_COBERTURA*(0.78+0.22*calidad));
        for(let k=0;k<CPM;k++){
          const cx=mx*CPM+k, h=hash3(cx,cyb,23);
          if((h%1000)>=cob*1000) continue;
          let lf, cal=calor;
          if(cerca){ afinar(k,sy); lf=_lz; cal=_cal; } else lf=light;
          lf=clamp(0.25+0.75*lf,0.2,1.4);
          let ro=clamp(((h>>10)%1000)/1000+(tonZ-0.5)*PC_ZONA*1.4,0,0.999), tono=0;
          while(tono<5&&ro>=PC_CUM[tono]) tono++;
          const u=((h>>20)%100)/100;
          let lum=(0.80+0.55*(((h>>4)%100)/100))*0.86*(1+(lumZ-0.45)*PC_ZONA*1.6);
          lum=clamp(tono>=4?Math.max(lum,0.85):lum,0.35,1.5);
          const col=pcColor(tono,u,lum,lf,cal);
          if(((h>>14)%100)/100<PC_TRAZO){
            const q=((h>>24)%100)/100, lr=((h>>8)%100)/100;
            const l0=corr+0.10*Math.sin(t*0.22+cx*0.5+cyb*0.3)-bend*0.05;
            const lean=q<0.22?-1:q>0.78?1:(l0<0.40?-1:l0>0.60?1:0);
            const L=lr<0.70?1:lr<0.94?2:3;
            const ch=(lean>0?'/':lean<0?'\\':'|').charCodeAt(0);
            for(let j=0;j<L;j++)
              put(base+k+Math.round(lean*j*0.6),rb-j,ch,(j===L-1&&L>1)?pcColor(Math.max(tono,1),u,Math.min(1.5,lum*1.1),lf,cal):col);
          } else put(base+k,rb,PC_MICRO[(h>>6)%PC_MICRO.length],col);
        }
        for(let f=0;f<_flN;f++) if(_flS[f]===sy) put(base+_flC[f],rb,_flG[f],packc(205,218,208));
      } else {
      /* pocas briznas, largas y finas sobre el fondo oscuro, como la muestra: menos de una
         por franja y metro, así que el número se reparte con un dado en vez de redondear */
      const nPer=CPM*(largo?0.12:0.09)*calidad;      // el triple de la primera versión rala y un poco más
      /* más pasto donde hay luz y menos en la sombra: la luz de la fila (sombras, manchas de claridad) manda */
      const nf=nPer*clamp(0.20+densMata*1.10,0.12,1.7)*clamp(0.10+light0*1.15,0.14,1.5);
      const n=Math.floor(nf)+((hash3(mx*53+sy,my*71,19)%1000)<(nf%1)*1000?1:0);
      /* tres tonos de verde por brizna (oscuro, medio, claro): el prado no es de un solo color */
      const TONOS=[0.70,1,1.30];
      for(let i=0;i<3;i++){
        _gT[i]=packs(mt.fam2||mt.fam,light*1.3*TONOS[i]);
        _gM[i]=packs(mt.fam,light*0.95*TONOS[i]);
        _gB[i]=packs(mt.fam,light*0.55*TONOS[i]);    // la base de la brizna, en sombra
      }
      for(let b=0;b<n;b++){
        const hb=hash3(mx*997+b,my*131+sy*37,7);
        const c0=base+((hb%(CPM*8))/8|0);
        const ti=(hb>>17)%3;
        let colT=_gT[ti], colM=_gM[ti], colB=_gB[ti];
        if(cerca){ afinar(c0-base,sy); colT=packs(mt.fam2||mt.fam,_lz*1.3*TONOS[ti]); colM=packs(mt.fam,_lz*0.95*TONOS[ti]); colB=packs(mt.fam,_lz*0.55*TONOS[ti]); }
        const mAlto=(largo?0.16:0.13)+(((hb>>5)%100)/100)*(largo?0.50:0.27);      // pasto corto: 0,16 a 0,66 m
        const alto=Math.max(2,Math.round(mAlto*HPM));
        const own=((((hb>>9)%9)-4)/4)*0.95;
        /* el pasto seco o pisado se acuesta: la brizna sale tendida y no parada */
        const tend=mt.tendido?mt.tendido*((hb>>13)%2?1:-1):0;
        const lean=clamp(own-bend*0.70+tend,-2.4,2.4);
        const span=Math.max(1,alto-1);
        const flor=largo&&(hb>>21)%100<14;      // una de cada siete remata en flor blanca
        for(let r=0;r<alto;r++){
          const f=r/span, dx=Math.round(lean*(f*f*0.62+f*0.38)*alto*0.55);
          const tip=(r===alto-1);
          let g;
          if(largo){
            /* el pasto es sólo | / \ , de distintos largos y tonos: la inclinación de la brizna
               decide cuál */
            if(Math.abs(lean)<0.26) g='|';
            else if(lean<0)         g=(r>0)?'\\':'|';
            else                    g=(r>0)?'/':'|';
          } else {
            g = tip?'*':'\u00b0';
          }
          if(largo&&tip&&flor) put(c0+dx,rb-r,'@eo'.charCodeAt((hb>>25)%3),packc(235,245,238));
          else put(c0+dx,rb-r,g.charCodeAt(0),tip?colT:(largo&&f<0.5)?colB:colM);   // base oscura, punta clara
        }
      }
      }
      if(det){
        const cyb=my*RPM+sy;
        for(let k=0;k<CPM;k++){
          if(cerca){ afinar(k,sy); light=_lz; calor=_cal; }
          detallar(det,k,sy,mx*CPM+k,cyb,base,rb,light,calor);
        }
      }
      /* puntitos claros en el pasto (flores diminutas, luciérnagas quietas): en la
         referencia hay muchos y se leen sobre el verde oscuro. Fijos, sin parpadeo. */
      if(!largo){ const hp=hash3(mx,my*RPM+sy,29)%140;
        if(hp<9) put(base+((hash3(mx,my+sy,31))%CPM),rb-((sy*5)%3),'@eo'.charCodeAt(hp%3),
                     hp<5?packc(225,240,230):packc(170,200,195)); }
    }
    usaCol=false;
    rellenarFrente(base,rBase,mx,haze);

  }
  if(wn) wind=wsum/wn;
}

/* ---------- PIEDRA ----------
   La categoría la elige la altura y la variante la semilla, igual que los
   árboles. Los modelos están medidos en fracciones del alto, así que se estiran
   solos. Ver la sección de piedra en el diccionario. */
function categoriaRoca(h){
  return h<0.75?'pequena' : h<1.75?'media' : h<3.5?'grande' : 'gigante';
}
/* La silueta se parte en CADENA IZQUIERDA y CADENA DERECHA: el perfil viene de
   la base izquierda, sube por arriba y baja a la base derecha, así que el punto
   más alto lo corta en dos. Tomar el mínimo y el máximo de todos los cortes
   rellena las concavidades y mata el voladizo; con cadenas el voladizo existe. */
const _cad=new Map();
function cadenas(perfil){
  let ch=_cad.get(perfil);
  if(ch) return ch;
  let k=0; for(let i=1;i<perfil.length;i++) if(perfil[i][1]>perfil[k][1]) k=i;
  ch={izq:perfil.slice(0,k+1), der:perfil.slice(k).reverse()};
  _cad.set(perfil,ch); return ch;
}
function enCadena(c,y){
  for(let i=0;i<c.length-1;i++){
    const a=c[i], b=c[i+1];
    if((a[1]<=y&&b[1]>=y)||(b[1]<=y&&a[1]>=y)){
      const d=b[1]-a[1];
      return Math.abs(d)<1e-9?b[0]:a[0]+(b[0]-a[0])*(y-a[1])/d;
    }
  }
  return null;
}
function drawRoca(tr,haze,t){
  const R=NV.ROCAS[categoriaRoca(tr.h)];
  const m=R[tr.s%R.length], tex=NV.TEX[m.tex], h=tr.h;
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  const sem=tr.s, med=(h/2)*CPM;
  const aC=x=>bc+Math.round(x*med);
  const aR=y=>br-Math.round(y*h*HPM);
  const filas=Math.max(2,Math.round(h*HPM));
  const CH=cadenas(m.perfil);
  const musgoAlto=0.16+((hash3(sem,5,7)%100)/100)*0.20;     // cuánto sube el musgo
  const span=y=>{
    const a=enCadena(CH.izq,y), b=enCadena(CH.der,y);
    return (a===null||b===null)?null:(a<b?[a,b]:[b,a]);
  };
  const claro=tex.claro, oscuro=tex.oscuro;
  /* La textura se mide en coordenadas DE LA PIEDRA, no de la pantalla. Atada a
     la pantalla, el manchón se arrastraba por encima de la roca al caminar y
     cambiaba de forma al hacer zoom: la piedra parecía otra cada vez. Acá
     cuántas celdas de textura tiene la roca a lo ancho y a lo alto es fijo, así
     que el dibujo es el mismo a cualquier tamaño. */
  const eU=Math.round(26/tex.grano), eV=Math.round(54/tex.grano);
  /* --- derrumbe al pie: va primero, lo tapa la piedra --- */
  if(m.pie){
    const n=Math.round(m.pie*h*CPM*0.9);
    for(let i=0;i<n;i++){
      const hh=hash3(sem+i,7,1);
      put(aC((-1+2*((hh%1000)/1000))*1.14),
          br-Math.round((((hh>>10)%100)/100)*m.pie*0.45*h*HPM),
          GUIJA[(hh>>5)%5], packs('piedra',(0.30+0.5*((hh>>17)%100)/100)*haze));
    }
  }
  /* --- la masa, fila por fila --- */
  for(let f=0;f<=filas;f++){
    const y=f/filas, sp=span(y);
    if(!sp) continue;
    const r=aR(y);
    if(r<-2||r>=rowsN+2) continue;
    const spA=span(y+1/filas<=1?y+1/filas:1);
    const cI=aC(sp[0]), cD=aC(sp[1]);
    const cAI=spA?aC(spA[0]):0, cAD=spA?aC(spA[1]):-1;
    /* contorno: una celda casi negra pegada a la silueta, como la orla oscura que
       separa la piedra del pasto en la referencia. Va primero: la masa la pisa. */
    put(cI-1,r,35,ORLA); put(cD+1,r,35,ORLA);
    if(!spA) for(let c=cI;c<=cD;c++) put(c,r-1,35,ORLA);
    /* el filo entre caras se quiebra, pero con la altura de la piedra y no con
       la fila de pantalla: si no, tiembla distinto según dónde esté la cámara */
    const tv=(y*eV)|0, tvF=(y*eV*2.6)|0;
    const tiemble=((hash3(sem,(y*70)|0,21)%100)/100-0.5)*0.07;
    for(let c=cI;c<=cD;c++){
      if(c<0||c>=cols) continue;
      const xr=(c-bc)/med;
      let luz=m.caras[0][1];
      for(let k=0;k<m.caras.length;k++) if(xr>=m.caras[k][0]+tiemble) luz=m.caras[k][1];
      /* el grano va en dos octavas: un manchón que le da forma y un temblor
         celda a celda que lo desarma. En una sola octava salía a cuadros. */
      const tu=((xr+1.6)*eU)|0, tuF=((xr+1.6)*eU*2.6)|0;
      const v=clamp((hash3(sem+tu,tv,2)%100)*0.007
                   +(hash3(sem+tuF,tvF,12)%100)*0.003,0,1);
      let lz=luz*(0.88+0.24*v);
      const rampa=luz>0.62?claro:oscuro;
      let g=rampa[clamp(Math.round(v*(rampa.length-1)),0,rampa.length-1)];
      if(!spA||c<cAI||c>cAD){                       // el filo de arriba
        const dIz=spA?Math.abs(cAI-cI):9, dDe=spA?Math.abs(cAD-cD):9;
        g=(c<cI+1&&dIz>1)?'/':(c>cD-1&&dDe>1)?'\\':((hash3(sem+tu,tv,4)%5)?'_':'-');
        lz=luz*1.34;
      }
      /* la silueta se lee por el color, no por un paréntesis en cada fila */
      else if(c<=cI+1) lz=luz*0.46;
      else if(c>=cD-1) lz=luz*1.22;
      /* musgo al pie: sube más o menos según la piedra, y se ralea hacia arriba.
         Sale de coordenadas DE LA PIEDRA, no de la pantalla (como el grano). */
      let famP=tex.fam;
      if(spA&&y<musgoAlto&&(hash3(sem+tu,tv,15)%100)<82*(1-y/musgoAlto)+6){
        g=MUSGO[hash3(sem+tuF,tvF,16)%MUSGO.length]; famP='musgo'; lz*=0.9;
      }
      put(c,r,g.charCodeAt(0),packs(famP,lz*haze));
    }
  }
  /* --- estratos: una repisa con su filo encendido y su socavón --- */
  const tilt=m.inclinaEstrat||0, pasos=Math.round(h*CPM);
  for(let ie=0;ie<(m.estrat||[]).length;ie++){
    const e=m.estrat[ie];
    for(let k=0;k<=pasos;k++){
      const xr=-1.2+2.4*k/Math.max(1,pasos), y=e+tilt*xr;
      if(y<=0.02||y>=0.99) continue;
      const sp=span(y);
      if(!sp||xr<sp[0]+0.02||xr>sp[1]-0.02) continue;
      const c=aC(xr), r=aR(y), hh=hash3(sem+(((xr+1.6)*eU)|0),Math.round(e*100),3);
      if((hh%100)<14) continue;
      let luz=m.caras[0][1];
      for(let q=0;q<m.caras.length;q++) if(xr>=m.caras[q][0]) luz=m.caras[q][1];
      put(c,r,(hh>>7)%4?61:126,packs(tex.fam,luz*0.46*haze));
      if(luz>0.62&&(hh>>9)%3) put(c,r-1,176,packs(tex.fam,luz*1.28*haze));
      if((hh>>11)%3===0) put(c,r+1,95,packs(tex.fam,luz*0.30*haze));
    }
  }
  /* --- grietas --- */
  for(const gr of (m.grietas||[])){
    for(let k=0;k<gr.length-1;k++){
      const a=gr[k], b=gr[k+1];
      const n=Math.max(2,Math.round(Math.abs(b[1]-a[1])*h*HPM));
      for(let i=0;i<=n;i++){
        const u=i/n;
        const x=a[0]+(b[0]-a[0])*u+((hash3(sem+i,3,4)%100)/100-0.5)*0.04;
        const y=a[1]+(b[1]-a[1])*u, sp=span(y);
        if(!sp||x<sp[0]+0.03||x>sp[1]-0.03) continue;
        put(aC(x),aR(y),(hash3(sem+i,5,6)%4)?124:33,packs(tex.fam,0.13*haze));
      }
    }
  }
  /* --- liquen: agarra en la cara que da al sol --- */
  for(const lq of (m.liquen||[])){
    const ri=Math.max(1,Math.round(lq[2]*med)), rj=Math.max(1,Math.round(lq[2]*h*HPM*0.8));
    const c0=aC(lq[0]), r0=aR(lq[1]);
    for(let j=-rj;j<=rj;j++){
      const r=r0+j;
      if(r<0||r>=rowsN) continue;
      for(let i=-ri;i<=ri;i++){
        const u=Math.hypot(i/ri,j/rj);
        if(u>1) continue;
        /* el liquen también en coordenadas de la mancha, no de la pantalla */
        const hh=hash3(sem+i*7,j*7,8);
        if((1-u)*(0.5+0.9*((hh%100)/100))<0.42) continue;
        const y=(br-r)/(h*HPM), sp=span(clamp(y,0,1));
        if(!sp) continue;
        const x=(c0+i-bc)/med;
        if(x<sp[0]+0.04||x>sp[1]-0.04) continue;
        put(c0+i,r,LIQ[(hh>>6)%LIQ.length],
            packs('musgo',(0.42+0.5*((hh>>11)%100)/100)*haze));
      }
    }
  }
  /* --- la sombra al pie, cortada: lo que la apoya en el suelo --- */
  const sp0=span(0.004);
  if(sp0) for(let c=aC(sp0[0]);c<=aC(sp0[1]);c++){
    const hh=hash3(sem+((((c-bc)/med+1.6)*eU)|0),0,9);
    if((hh%100)<26) continue;
    put(c,br+1,(hh>>5)%3?95:46,packs(tex.fam,0.11*haze));
  }
}
const ORLA=packc(5,8,11);                            // la orla de la piedra: casi negro
const GUIJA=[46,58,176,111,99];                      // . : ° o c
const LIQ=[176,176,42,42];
const MUSGO=['\u00b0','*','\u00b0',';'];               // musgo al pie de la piedra                           // ° ° * *

/* ---------- EL ACANTILADO ----------
   El filo de la costa corre norte-sur, así que el muro se dibuja en TAJADAS:
   una por cada metro de norte a sur, y cada tajada sube los metros que le toca.
   El ruido se muestrea en coordenadas DEL MUNDO a lo largo del eje del filo, así
   que dos tajadas vecinas calzan y la cara sale continua, sin que se note el
   molde. Donde el ruido sube hay un contrafuerte que recibe luz, donde baja hay
   una canaleta en sombra: eso es lo que le da volumen a una pared. */
function ruido1(s,x,esc){
  const u=x/esc, i=Math.floor(u), f=u-i;
  const a=(hash3(s,i,13)%1000)/1000, b=(hash3(s,i+1,13)%1000)/1000;
  return a+(b-a)*(f*f*(3-2*f));
}
function drawMuro(tr,haze,t){
  const A=NV.ROCAS.acantilado, m=A[tr.mod%A.length], tex=NV.TEX[m.tex];
  const h=tr.h, sem=m.id.length*131+((h*10)|0), eje=tr.y;      // el eje: mundo
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  const cima=h*(1-m.cresta*(0.62*ruido1(sem,eje,m.crestaEsc)
                           +0.38*ruido1(sem+3,eje,m.crestaEsc*0.35)));
  let rel=0.55*ruido1(sem+7,eje,m.canaleta)+0.45*ruido1(sem+9,eje,m.canaleta*0.38);
  let enGrieta=false;
  if(m.columnas){                                    // basalto: caras planas
    const u=eje/m.columnas, cl=Math.floor(u), f=u-cl;
    rel=rel*0.45+0.55*((hash3(sem+cl,0,17)%100)/100);
    enGrieta=f<0.10||f>0.90;
  }
  const luzCol=0.22+1.00*(rel*(1-m.relieve)+m.relieve*0.5);
  const filas=Math.round(cima*HPM);
  const b2=tex.grano+2, b1=tex.grano+1;
  const anchoC=Math.max(1,CPM);
  for(let f=0;f<=filas;f++){
    const y=cima*(f/Math.max(1,filas)), r=br-Math.round(y*HPM);
    if(r<-2||r>=rowsN+2) continue;
    const lzBase=luzCol*(0.58+0.42*Math.min(1,y/(h*0.55)));
    for(let k=0;k<anchoC;k++){
      const c=bc-Math.floor(anchoC/2)+k;
      if(c<0||c>=cols) continue;
      /* La textura del muro se mide a lo largo del filo y en metros de altura,
         no en columnas y filas de pantalla: así calza entre tajadas vecinas y
         no se arrastra al caminar ni al hacer zoom. */
      const tu=((eje*5)+((k*5/anchoC)|0))|0, tv=(y*6)|0;
      const v=clamp((hash3(sem+tu,tv,2)%100)*0.007
                   +(hash3(sem+tu*3,(y*16)|0,12)%100)*0.003,0,1);
      let lz=lzBase;
      const rampa=lz>0.62?tex.claro:tex.oscuro;
      let g=rampa[clamp(Math.round(v*(rampa.length-1)),0,rampa.length-1)];
      if(f===filas){ g=(hash3(sem+c,r,4)%4)?'_':'-'; lz*=1.36; }
      else if(enGrieta){ g=(hash3(sem+c,r,6)%4)?'|':'!'; lz*=0.22; }
      put(c,r,g.charCodeAt(0),packs(tex.fam,lz*haze));
    }
  }
  /* estratos y repisas: altura ABSOLUTA. Atadas a una fracción del borde de
     arriba, que varía tajada a tajada, se corrían de fila en fila. */
  if(m.estratoCada) for(let e=m.estratoCada;e<cima-0.15;e+=m.estratoCada){
    const y=e+m.estratoTilt*eje*10;
    if(y<=0.1||y>=cima-0.1) continue;
    const r=br-Math.round(y*HPM);
    for(let k=0;k<anchoC;k++){
      const c=bc-Math.floor(anchoC/2)+k, hh=hash3(sem+c,Math.round(e*100),3);
      if((hh%100)<16) continue;
      put(c,r,(hh>>7)%4?61:126,packs(tex.fam,luzCol*0.46*haze));
      if(luzCol>0.62&&(hh>>9)%3) put(c,r-1,176,packs(tex.fam,luzCol*1.30*haze));
    }
  }
  for(let ir=0;ir<(m.repisas||[]).length;ir++){
    if(ruido1(sem+21+ir*5,eje,8.5)<0.38) continue;   // aparece a tramos
    const y=h*m.repisas[ir]+0.30*(ruido1(sem+31+ir,eje,6.0)-0.5);
    if(y<=0.2||y>=cima-0.3) continue;
    const r=br-Math.round(y*HPM);
    for(let k=0;k<anchoC;k++){
      const c=bc-Math.floor(anchoC/2)+k, hh=hash3(sem+c,ir,5);
      put(c,r,(hh%3)?61:45,packs(tex.fam,luzCol*1.34*haze));
      if((hh>>6)%2) put(c,r+1,95,packs(tex.fam,luzCol*0.24*haze));
    }
  }
  /* derrumbe al pie de la pared */
  const n=Math.round(m.pie*CPM*1.1);
  for(let i=0;i<n;i++){
    const hh=hash3(sem+i+((eje*7)|0),7,1);
    const sube=Math.pow(((hh>>10)%100)/100,1.8);
    put(bc-Math.floor(anchoC/2)+((hh%1000)%anchoC),
        br-Math.round(sube*m.pie*2.2*HPM),
        sube<0.3?GRUESA[(hh>>5)%4]:GUIJA[(hh>>5)%4],
        packs(tex.fam,(0.26+0.46*((hh>>17)%100)/100)*haze));
  }
}
const GRUESA=[99,111,37,56];                         // c o % 8

/* ---------- ÁRBOLES ----------
   Un modelo por árbol, de los tres que tiene su especie en el diccionario. El
   modelo está medido en fracciones del alto, así que se estira solo: el mismo
   modelo sirve para un pino joven y para uno del bosque viejo.

   El orden de dibujo es lo que hace el trabajo, sin llevar cuenta de nada:
   dentro de una capa lo último que se escribe tapa lo anterior. Así que primero
   va el tronco de arriba y las ramas, después el follaje —que los tapa donde es
   tupido y los deja asomar por sus huecos, que es como se ve el esqueleto de un
   árbol— y al final el tronco de abajo de la horqueta y los nudos, que no los
   tapa nada porque son lo que sostiene al árbol. */
const _ramas=[], _manchas=[];                 // se reusan: hay muchos por cuadro
/* El follaje es el lazo más caliente del juego: una copa son miles de celdas y
   hay decenas de copas por cuadro. Tres tablas lo sacan de encima:

   _CAIDA  : cómo baja la densidad del centro al borde. Se indexa con la
             distancia AL CUADRADO, así se evita una raíz por celda.
   _GAMMA  : la curva de cada especie, ya resuelta. Antes eran dos Math.pow por
             celda, que es lo que más costaba.
   _UI,_RU : el perfil de la mancha y el azar de los huecos, calculados una vez
             por mancha y por fila en vez de una vez por celda. */
const _CAIDA=new Float32Array(66), _GAMMA={};
for(let k=0;k<=65;k++) _CAIDA[k]=1-Math.pow(Math.min(1,k/64),1.05);
function tablaGamma(g){
  const t=new Float32Array(66);
  for(let k=0;k<=65;k++) t[k]=Math.pow(Math.min(1,k/64),g);
  return t;
}
let _UI=new Float32Array(256), _RU=new Float32Array(256);

/* ---------- PINO Y ÁLAMO, AL ESTILO DE LA MUESTRA ----------
   Un árbol de glifos: una sola masa oscura hecha de letras y dígitos altos
   (`1 l i t f k b d h`), tenues, con unas pocas motas claras de piedra, y una
   orla casi negra que lo despega del pasto. El pino es tronco angosto bajo una
   copa en pisos de borde dentado; el álamo, una columna en llama. La silueta
   se mide en metros del modelo (m.pisos / m.columna / m.grosor / m.ancho), así
   que el modelo y el zoom siguen mandando. Todo el azar sale de la semilla del
   árbol y de la celda, nunca de la pantalla, y el viento sólo corre la copa. */
function drawArbolGlifo(tr,haze,t){
  const sp=SPECIES[tr.sp], M=NV.MODELOS[tr.sp];
  const m=M?M[tr.s%M.length]:sp.modelo, G=sp.glifos, luzC=(sp.luzC||1)*(G.tono||1);
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  const h=tr.h, H=Math.max(6,Math.round(h*HPM));
  const viento=windAt(tr.x,tr.y,t*0.8)*sp.sway;
  const grosorC=Math.max(1.2,m.grosor*h*CPM/2), anchoC=Math.max(2,m.ancho*h*CPM/2);
  const desde=m.pisos?m.pisos.desde:m.columna?m.columna.desde:m.horqueta;
  const yT=m.lider||m.horqueta;
  for(let k=0;k<=H;k++){
    const y=k/H, r=br-k;
    if(r<-4||r>=rowsN+4) continue;
    const u=clamp((y-desde)/(0.95-desde),0,1.2);
    let lo,hi;                                            // extremos de la fila, en celdas
    if(m.manchas&&y>=desde){                              // copa de varios lóbulos
      lo=1e9; hi=-1e9;
      for(const Mn of m.manchas){
        const dy=(y-Mn[1])/(Mn[2]*0.82);
        if(dy<-1||dy>1) continue;
        const half=Mn[2]*h*CPM*Math.sqrt(1-dy*dy);
        lo=Math.min(lo,Mn[0]*h*CPM-half); hi=Math.max(hi,Mn[0]*h*CPM+half);
      }
      if(y<=yT){ lo=Math.min(lo,-grosorC); hi=Math.max(hi,grosorC); }
      if(lo>hi) continue;
    } else {
      let hw;
      if(y<desde){                                        // tronco, con el pie abierto
        hw=grosorC*(1+0.9*Math.max(0,1-y/0.07)*(1-y/0.07));
      } else if(u>1){
        hw=Math.max(0.6,grosorC*0.4*(1.2-u)/0.2);         // la punta
      } else if(m.pisos){
        const P=m.pisos, fr=(u*P.n)%1;
        hw=anchoC*Math.pow(1-u,P.p)*(0.62+0.38*(1-fr*0.85));   // pisos que caen
        hw=Math.max(hw,grosorC);
      } else {
        const Q=m.columna;
        hw=anchoC*(Q.llama?Math.sqrt(Math.max(0.06,1-Math.pow(u*1.8-0.80,2)*0.92))
                          :Math.sqrt(Math.max(0.06,1-u*u*0.58)));
        hw=Math.max(hw,grosorC)*(Q.rala?0.86:1);
      }
      lo=-hw; hi=hw;
    }
    const rag=0.90+0.20*((hash3(tr.s,k,6)%100)/100);        // el borde no es una regla
    const mid=(lo+hi)/2, hw2=Math.max(1,(hi-lo)/2*rag);
    const cL=Math.round(mid-hw2), cR=Math.round(mid+hw2);
    const c0=bc+Math.round(m.inclina*y*h*CPM+viento*1.1*Math.pow(clamp(y,0,1),1.3));
    const copa=y>=desde;
    for(let c=cL;c<=cR;c++){
      const este=(c-mid)/hw2, hh=hash3(tr.s+c*17,k>>1,3);
      if(m.manchas&&copa&&(hh>>14)%100<9) continue;       // huecos de cielo entre lóbulos
      const borde=c===cL||c===cR;
      const denso=(hh%100)<(copa?46:34);
      const g=(denso?G.denso:G.ralo)[(hh>>7)%(denso?G.denso.length:G.ralo.length)];
      let luz=(copa?0.34:0.28)+0.26*clamp((este+1)/2,0,1);
      if(borde) luz*=este>0?1.55:0.60;
      const fleco=((hh>>11)%100)<(copa?13:9);
      put(c0+c,r,g.charCodeAt(0),
          packs(fleco?G.fleco:G.fam, (fleco?0.50+0.5*((hh>>3)%10)/10:luz)*luzC*haze));
    }
    put(c0+cL-1,r,35,ORLA); put(c0+cR+1,r,35,ORLA);
    if(k===H) for(let c=cL;c<=cR;c++) put(c0+c,r-1,35,ORLA);
  }
}
function drawArbol(tr,haze,t){
  const sp=SPECIES[tr.sp], M=NV.MODELOS[tr.sp];
  const m=M[tr.s%M.length];
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  const h=tr.h, grosor=m.grosor*h, ancho=m.ancho*h;
  const yH=h*m.horqueta, yT=h*(m.lider||m.horqueta), yPie=h*0.045;
  /* el viento dobla la copa y deja el pie quieto */
  const viento=windAt(tr.x,tr.y,t*0.8)*sp.sway;
  const aC=(x,y)=>bc+Math.round(x*CPM+viento*1.1*Math.pow(clamp(y/h,0,1),1.3));
  const aR=y=>br-Math.round(y*HPM);
  const bandaAlto=tr.sp==='alamo'?7:4;
  const famCort=sp.corteza;

  function troncoHW(y){
    const u=clamp(y/h,0,1);
    let hw=(grosor*(1-0.46*Math.pow(u,0.7)))/2;
    if(m.lider && y>yH) hw*=Math.max(0.22,1-(y-yH)/Math.max(0.01,yT-yH)*0.78);
    if(y<yPie) hw*=1+(yPie-y)/yPie*0.55;        // el pie se abre en raíces
    return hw;
  }
  /* --- tronco: la corteza son CRESTAS VERTICALES, no ruido ---
     el glifo lo elige la columna y se mantiene varias filas; el surco va más
     oscuro que la cresta */
  function pintarTronco(desde,hasta){
    for(let r=aR(desde);r>=aR(hasta);r--){
      const y=(br-r)/HPM;
      if(y<desde-0.04||y>hasta+0.04) continue;
      if(r<-4||r>=rowsN+4) continue;
      const cx=m.inclina*y, ci=Math.max(0,Math.round(troncoHW(y)*CPM));
      const banda=Math.floor(r/bandaAlto), c0=aC(cx,y);
      for(let c=-ci;c<=ci;c++){
        const este=ci?c/ci:0;
        const hh=hash3(tr.s+c*31,banda,1), cresta=hash3(tr.s+c*31,0,5)%3;
        let g;
        if(ci<=1) g=sp.placa[(hh>>6)%sp.placa.length];   // tronco fino: por bandas
        else{ g=sp.placa[(cresta+((hh>>6)%2))%sp.placa.length];
              if(cresta===2&&este<0.55) g=sp.veta; }
        if(tr.sp==='alamo'&&(hash3(tr.s+c,r,3)%37)===0) g='-';   // lenticela
        const luz=(0.26+0.80*((este+1)/2))*sp.luzC*(g===sp.veta?0.74:1)
                 *(0.94+0.12*((hash3(tr.s,banda,c+9)%100)/100));
        put(c0+c,r,g.charCodeAt(0),packs(famCort,luz*haze));
      }
      if(y<yPie*0.8){
        put(c0-ci-1,r,47,packs(famCort,0.34*haze));
        put(c0+ci+1,r,92,packs(famCort,0.92*haze));
      }
    }
  }
  /* --- una rama, con grosor que se afina --- */
  function trazar(x0,y0,x1,y1,gr,seca){
    const dx=x1-x0, dy=y1-y0;
    const pasos=Math.max(3,Math.round(Math.hypot(dx*CPM,dy*HPM)));
    const pend=Math.abs(dy*HPM)/Math.max(1,Math.abs(dx*CPM));
    const gl = pend>2.2?124 : pend<0.40?45 : ((dx>0)===(dy>0)?47:92);
    for(let i=1;i<=pasos;i++){
      const u=i/pasos;
      const x=x0+dx*u, y=y0+dy*(seca?u:Math.pow(u,1.3));
      const rr=aR(y);
      if(rr<-4||rr>=rowsN+4) continue;
      const cc=aC(x,y);
      const luz=(seca?0.56:0.24+0.78*((dx>0?2:0)/2))*(1-u*0.20)*sp.luzC;
      put(cc,rr,seca&&u>0.72?46:gl,packs(seca?'hoja':famCort,luz*haze));
      const g2=gr*(1-u*0.86);
      if(!seca&&g2>0.42){
        const ancha=pend>1.6;
        put(cc+(ancha?1:0),rr+(ancha?0:1),gl,packs(famCort,luz*0.58*haze));
        if(g2>0.92) put(cc-(ancha?1:0),rr-(ancha?0:1),gl,packs(famCort,luz*0.74*haze));
      }
    }
  }
  /* --- el reparto de ramas y manchas, propio de cada especie --- */
  _ramas.length=0; _manchas.length=0;
  if(m.pisos){                                     /* pino: ramas en pisos */
    const P=m.pisos, sep=h*(0.95-P.desde)/Math.max(1,P.n-1);
    for(let i=0;i<P.n;i++){
      const u=i/(P.n-1), y=h*(P.desde+(0.95-P.desde)*u);
      const largo=(ancho/2)*Math.pow(1-u,P.p)*(0.82+0.30*((hash3(tr.s,i,2)%100)/100));
      if(largo<h*0.02) continue;
      const cx=m.inclina*y;
      for(const lado of [-1,1]){
        const L=largo*(lado>0?0.92+0.20*((hash3(tr.s,i,3)%100)/100):1);
        _ramas.push(cx,y,cx+lado*L,y-L*P.cae,0.8-u*0.5,0);
        _manchas.push(cx+lado*L*0.60,y-L*P.cae*0.55,L*0.72,L*0.34,1);
      }
      /* la masa del eje llega hasta el piso de arriba: si no, el tronco se veía
         entero entre piso y piso como una línea trazada con regla */
      _manchas.push(cx,y+sep*0.30,largo*0.46,Math.max(largo*0.26,sep*0.62),0.9);
    }
    _manchas.push(m.inclina*h,h*0.95,ancho*0.10,h*0.05,1);          // la punta
  } else if(m.manchas){                            /* encino: una por lóbulo */
    for(let i=0;i<m.manchas.length;i++){
      const Mn=m.manchas[i], mx=Mn[0]*h, my=Mn[1]*h, mr=Mn[2]*h;
      _ramas.push(m.inclina*yH,yH,mx*0.92,my-mr*0.18,1.25-i*0.12,0);
      _manchas.push(mx,my,mr,mr*0.82,1);
    }
  } else {                                         /* álamo: cortas y paradas */
    const Q=m.columna;
    for(let i=0;i<Q.n;i++){
      const u=i/(Q.n-1), y=h*(Q.desde+(0.95-Q.desde)*u);
      let rx=(ancho/2)*(Q.llama
            ? Math.sqrt(Math.max(0.06,1-Math.pow(u*1.8-0.80,2)*0.92))
            : Math.sqrt(Math.max(0.06,1-u*u*0.58)));
      rx*=0.84+0.30*((hash3(tr.s,i,8)%100)/100);
      const cx=m.inclina*y, lado=i%2?1:-1;
      _ramas.push(cx,y-h*0.035,cx+lado*rx*0.55,y+h*0.02,0.45,0);
      _manchas.push(cx+lado*rx*0.14,y,rx,rx*1.05,Q.rala||1);
    }
  }
  /* 1. el tronco de la horqueta para arriba, y las ramas */
  if(yT>yH) pintarTronco(yH,yT);
  for(let i=0;i<_ramas.length;i+=6)
    trazar(_ramas[i],_ramas[i+1],_ramas[i+2],_ramas[i+3],_ramas[i+4],false);
  for(const hm of (m.muertas||[])){
    const y=h*hm, lado=(hash3(tr.s,Math.round(hm*100),8)%100)>50?1:-1;
    trazar(m.inclina*y,y,m.inclina*y+lado*(ancho/2)*0.80,y-h*0.055,0.5,true);
  }
  /* 2. el follaje, en manchas con cielo entre medio */
  const tg=_GAMMA[tr.sp]||(_GAMMA[tr.sp]=tablaGamma(sp.gamma));
  const umb=sp.umbral, gb=sp.grumo, copa=sp.copa, borde=sp.borde;
  const nC=copa.length-1, nB=borde.length-1;
  const famSol=sp.fam, famSom=sp.famS;
  for(let k=0;k<_manchas.length;k+=5){
    const mx=_manchas[k], my=_manchas[k+1], rx=_manchas[k+2], ry=_manchas[k+3], dd=_manchas[k+4];
    const r0=aR(my), ri=Math.max(1,Math.round(rx*CPM)), rj=Math.max(1,Math.round(ry*HPM));
    if(r0+rj<0||r0-rj>=rowsN) continue;
    const c0=aC(mx,my);
    /* sólo las columnas que están en pantalla: lo de afuera no se calcula */
    let i0=-ri, i1=ri;
    if(c0+i0<0) i0=-c0; if(c0+i1>=cols) i1=cols-1-c0;
    if(i1<i0) continue;
    const n=i1-i0+1;
    if(_UI.length<n){ _UI=new Float32Array(n+64); _RU=new Float32Array(n+64); }
    for(let i=i0;i<=i1;i++){ const u=i/ri; _UI[i-i0]=u*u; }
    const sem=tr.s*3;
    for(let j=-rj;j<=rj;j++){
      const r=r0+j;
      if(r<0||r>=rowsN) continue;
      const vj=(j/rj)*(j/rj);
      if(vj>1) continue;
      const arriba=-j/rj, subida=arriba>0?0.38*arriba:0;
      /* el azar de los huecos se sortea por bloque, no por celda */
      const fb_=r>>gb;
      let ult=-99999;
      for(let i=i0;i<=i1;i++){
        const bi=(c0+i)>>gb;
        if(bi!==ult){ ult=bi; _RU[i-i0]=0.42+0.96*((hash3(sem+bi,fb_,9)%100)/100); }
        else _RU[i-i0]=_RU[i-i0-1];
      }
      for(let i=i0;i<=i1;i++){
        const un=_UI[i-i0]+vj;
        if(un>1) continue;
        let d=_CAIDA[(un*64)|0]*dd*_RU[i-i0];
        d=tg[d>1?64:(d*64)|0];
        if(d<umb) continue;
        const c=c0+i, este=i/ri, hh=hash3(tr.s+c,r,2);
        const luz=(0.26+0.28*(este+1)+subida)*(0.86+0.28*(((hh>>5)%100)/100));
        const g = un>0.49 ? borde[(d*nB+0.5)|0] : copa[(d*nC+0.5)|0];
        if(g===' ') continue;
        put(c,r,g.charCodeAt(0),
            packs((este<-0.12||arriba<-0.40)?famSom:famSol, luz*haze));
      }
    }
  }
  /* 3. el tronco de abajo y los nudos: no los tapa nada */
  pintarTronco(0,yH);
  for(const hn of (m.nudos||[])){
    const y=h*hn, cx=m.inclina*y;
    const lado=(hash3(tr.s,Math.round(hn*100),7)%100)>50?1:-1;
    const ci=Math.max(1,Math.round(troncoHW(y)*CPM));
    const c0=aC(cx,y)+lado*Math.max(0,ci-1), r0=aR(y);
    /* el bulto: oscuro en el centro, con un reborde claro arriba donde pega la luz */
    put(c0,r0,  sp.nudo[0].charCodeAt(0), packs(famCort,(lado>0?0.44:0.22)*haze));
    put(c0,r0-1,126, packs(famCort,(lado>0?1.18:0.62)*haze));
    put(c0,r0+1,95,  packs(famCort,0.20*haze));
  }
}

/* ---------- REFLEJOS ----------
   Un objeto cerca del agua se ve en ella. Mientras se dibuja, put anota cada
   casilla que escribe; después se redibujan espejadas bajo su base, a la misma
   distancia hacia abajo que lo que tenían hacia arriba, y SOLO donde hay agua:
   un árbol a tres metros de la orilla muestra en el agua nada más la parte de
   arriba, que es como se ve de verdad.

   Van en la capa 1, por encima del agua y por debajo de todo lo demás, y se
   oscurecen y se enfrían con la distancia al pie. Las ondas las cortan en
   franjas y las corren de lado: un reflejo quieto parece una calcomanía. */
function reflejable(tr){
  if(tr.k==='hoguera') return false;
  const reach=Math.ceil((tr.h||2)*1.7)+1;
  const i=tr.x-_ftX0;
  if(i<1||i>=_ftN-1) return false;
  for(let y=tr.y+1;y<=tr.y+reach;y++){
    const f=filaT(y);
    if(esAgua(f[i])||esAgua(f[i-1])||esAgua(f[i+1])) return true;
  }
  return false;
}
function dibujarReflejo(tr,br,t){
  const D=NV.grabados, B=D.B, n=D.n();
  if(!n) return;
  const alto=Math.max(4,Math.round((tr.h||2)*HPM));
  const prev=layer, ordObj=ordR; layer=1;
  for(let q=0;q<n;q++){
    const c=B[q*4], r=B[q*4+1], code=B[q*4+2], col=B[q*4+3];
    const h=br-r; if(h<0) continue;
    const r2=br+1+h;
    const fase=r2*0.62+t*1.9;
    if(NV.sen(fase+c*0.05)>0.93) continue;            // la onda corta el reflejo (poco: el agua está quieta)
    const c2=c+Math.round(NV.sen(fase+c*0.02)*0.6);     // y lo corre apenas de lado
    const mx=camX+Math.floor(c2/CPM), my=camY+Math.floor(r2/RPM);
    const letra=filaT(my)[mx-_ftX0];
    if(!letra||!esAgua(letra)) continue;
    ordR=my-camY+extNorte()+1;                  // el reflejo cae sobre el agua de ESA fila
    const f=0.85-0.60*Math.min(1,h/alto);
    /* el brillo propio del agua depende de cuánta luz haya: de noche un árbol
       casi negro no puede salir más claro en el agua que en el aire */
    const a=0.10+0.90*Math.min(1,NV.luz.amb);
    put(c2,r2,code,packc(((col>>16)&255)*f*0.34+4*a, ((col>>8)&255)*f*0.44+9*a, (col&255)*f*0.62+18*a));
  }
  layer=prev; ordR=ordObj;
}

/* Lo que se levanta del suelo —árboles, rocas, muros— también recibe el calor
   de un fuego cercano, y se refleja si hay agua al sur. */
function drawTree(tr,haze,t){
  const refl=reflejable(tr);
  let tinte=0;
  if(tr.k!=='hoguera'&&NV.calorCerca(tr.x,tr.y)){
    const f=NV.calorEn(tr.x+0.5,tr.y+0.9);
    const k=f*(1.55-Math.min(1,NV.luz.amb)*0.95)*titilar(t)*0.75;
    if(k>=0.02) tinte=k;
  }
  const br=(tr.y-camY)*RPM+RPM-1;
  alzaR=Math.round(NV.alturaEn(tr.x+0.5,tr.y+0.5)*HPM);
  if(tinte) NV.tinteFuego(tinte,br-alzaR+liftR);
  if(refl) NV.grabar(true);
  try{ drawObjeto(tr,haze,t); }
  finally{ if(tinte) NV.tinteFuego(0,0); if(refl) NV.grabar(false); alzaR=0; }
  if(refl) dibujarReflejo(tr,br,t);
}
function drawObjeto(tr,haze,t){
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  if(tr.k==='muro'){ drawMuro(tr,haze,t); return; }
  if(tr.k==='roca'){ drawRoca(tr,haze,t); return; }
  if(false){
    const hgt=Math.max(3,Math.round(tr.h*HPM*0.85));
    const hw=Math.max(2,(tr.h*CPM*0.95)/2);
    const LUZ=['#','%','8','0'], SOM=['c','o',':','.'], lean=((tr.s%7)-3)/9;
    let prevCi=-1;
    for(let r=0;r<hgt;r++){
      const tN=r/Math.max(1,hgt-1);
      /* perfil escalonado: hombros planos en vez de curva lisa */
      let rad=hw*Math.sqrt(Math.max(0,1-tN*tN*0.78));
      const pasos=3+(tr.s%3);
      rad=hw*(Math.round((rad/hw)*pasos)/pasos);
      rad*=0.86+((hash3(tr.s,r,6)%28)/100);
      const ci=Math.max(1,Math.round(rad));
      const cen=Math.round(lean*tN*hw*0.8);
      const corte=-0.12+((tr.s%5)-2)/22;            // dónde cae el filo de luz
      for(let c=-ci;c<=ci;c++){
        const este=c/ci, hh=hash3(tr.s+c,r,4);
        const borde=Math.abs(c)>=ci-0.2;
        const techo=(prevCi>=0&&Math.abs(c)>prevCi)||r===hgt-1;
        const iluminado=este>corte;
        let g;
        if(techo&&!borde)      g='_';
        else if(borde)         g = c<0?'/':'\\';
        else                   g = iluminado?LUZ[hh%LUZ.length]:SOM[(hh>>4)%SOM.length];
        let lit = iluminado?1.02:0.40;
        if(techo) lit*=1.18;
        lit*=(0.92+((hh>>9)%100)/100*0.16)*haze;
        put(bc+cen+c,br-r,g.charCodeAt(0),packs('piedra',lit));
      }
      prevCi=ci;
    }
    return;
  }
  if(tr.k==='hoguera'){
    const tit=titilar(t);
    const brasa=packc(255,138,46), llama=packc(255,196,92), punta=packc(255,232,170);
    const lena=packs('corteza',0.85);
    /* los leños, cruzados */
    for(let c=-4;c<=4;c++){
      put(bc+c, br, (c%3===0)?72:104, lena);
      if(Math.abs(c)<3) put(bc+c, br-1, 104, lena);
    }
    /* las llamas, más angostas y más claras hacia arriba */
    const alto=Math.max(3,Math.round((2.1+tit*1.3)*HPM*0.42));
    for(let r=2;r<alto;r++){
      const u=(r-2)/(alto-2);
      const an=Math.max(0,Math.round((3.2-u*3.0)*(0.75+tit*0.4)));
      for(let c=-an;c<=an;c++){
        const h=hash3(tr.s+c, r, Math.floor(t*14));
        if((h%100) < 22+u*46) continue;
        const g = u>0.72?'\'':u>0.44?'^':(h%2?'%':'&');
        put(bc+c+Math.round(Math.sin(t*5+r*0.7)*u*2.2), br-r,
            g.charCodeAt(0), u>0.66?punta:u>0.3?llama:brasa);
      }
    }
    /* chispas que suben */
    for(let i=0;i<3;i++){
      const h=hash3(tr.s+i,9,0);
      const sube=((t*7+(h%100)/100)%1);
      put(bc+Math.round(Math.sin(t*3+i)*3), br-Math.round(2+sube*alto*1.8),
          46, punta);
    }
    return;
  }
  if(tr.k==='caido'){
    const L=(tr.len||2)*CPM, rows=2;
    for(let r=0;r<rows;r++) for(let c=0;c<L;c++){
      const g=(c%3===0)?WOOD.caido[1]:WOOD.caido[0];
      const lit=(r===0?0.95:0.60)*haze*(0.85+((hash3(tr.s+c,r,3)%100)/100)*0.3);
      put(bc-2+c,br-r,g.charCodeAt(0),packs('corteza',lit));
    }
    /* orla: arriba, abajo y en las dos puntas, como las piedras */
    for(let c=-1;c<=L;c++){ put(bc-2+c,br-rows,35,ORLA); put(bc-2+c,br+1,35,ORLA); }
    for(let r=0;r<rows;r++){ put(bc-3,br-r,35,ORLA); put(bc-2+L,br-r,35,ORLA); }
    return;
  }
  /* las tres especies del bosque tienen modelo; el místico del lago y los
     arbustos siguen por el camino viejo */
  if(tr.k==='arbol' && SPECIES[tr.sp] && SPECIES[tr.sp].glifos){ drawArbolGlifo(tr,haze,t); return; }
  if(tr.k==='arbol' && NV.MODELOS[tr.sp]){ drawArbol(tr,haze,t); return; }
  const sp=SPECIES[tr.sp]||SPECIES.encino;
  const isB=tr.k==='arbusto';
  const tall=Math.max(3,Math.round(tr.h*HPM));
  const trunkR=isB?0:Math.max(2,Math.round(tall*sp.troncoFrac));
  const canR=tall-trunkR;
  const maxHW=Math.max(1.5,(tr.h*CPM*(isB?0.7:sp.w))/2);
  const sway=windAt(tr.x,tr.y,t*0.8)*(isB?0.8:sp.sway);
  const copa=isB?SPECIES.encino.copa:sp.copa, borde=isB?SPECIES.encino.borde:sp.borde;
  const famC=isB?'verdeO':sp.fam;
  for(let r=0;r<canR;r++){
    const sr=br-trunkR-r;
    if(sr<-3||sr>=rowsN+3) continue;
    const tN=r/Math.max(1,canR-1);                     // 0 abajo, 1 arriba
    let hw;
    if(sp.tiers){                                       // cónica, por pisos
      hw=maxHW*Math.pow(1-tN,0.85);
      hw*=0.72+0.30*Math.abs(Math.sin(tN*Math.PI*sp.tiers));
      hw=Math.max(hw,0.6);
    } else if(tr.sp==='alamo'){                         // columnar, en llama
      hw=maxHW*Math.sqrt(Math.max(0,1-Math.pow(tN*1.9-0.9,2)*0.72))*(1-tN*0.25);
    } else {                                            // redondeada
      hw=maxHW*Math.sqrt(Math.max(0,1-Math.pow(2*tN-1,2)*0.92));
    }
    hw=Math.max(0.7,hw);
    const ci=Math.round(hw), topSway=Math.round(sway*(0.3+tN));
    for(let c=-ci;c<=ci;c++){
      const u=Math.abs(c)/Math.max(0.7,hw);
      if(u>1) continue;
      const hh=hash3(tr.s+c,r,0), east=c/Math.max(1,ci);
      let lit=0.48+0.62*((east+1)/2)+0.20*tN;
      lit*=(0.88+((hh>>7)%100)/100*0.26)*haze;
      const dens=clamp((1-u*0.72)*lit*1.45,0,1);
      const g=u>0.78?pick(borde,dens*1.1):pick(copa,dens);
      if(g===' ') continue;
      put(bc+c-topSway,sr,g.charCodeAt(0),packs(east<-0.15?(famC==='verde'?'verdeO':famC):famC,lit));
    }
    put(bc-ci-1-topSway,sr,35,ORLA); put(bc+ci+1-topSway,sr,35,ORLA);
  }
  if(trunkR>0){
    const tw=tr.h>4.5?3:2, fam=sp.corteza;
    for(let r=0;r<trunkR;r++){
      const sr=br-r;
      const g=r<trunkR*0.35?WOOD.tronco[2]:r<trunkR*0.75?WOOD.tronco[1]:WOOD.tronco[0];
      for(let c=0;c<tw;c++){
        const lit=(0.60+0.42*(c/(tw-1||1)))*(0.82+0.3*(r/trunkR))*haze;
        put(bc+c-1,sr,g.charCodeAt(0),packs(fam,lit));
      }
    }
    if(!sp.tiers){
      const hy=br-trunkR;
      put(bc-1,hy,WOOD.rama[0].charCodeAt(0),packs(sp.corteza,0.7*haze));
      put(bc+1,hy,WOOD.rama[1].charCodeAt(0),packs(sp.corteza,0.95*haze));
    }
  }
}

/* ---------- EL JUGADOR ----------
   Es un personaje más: toda la mecánica —el paso entre casillas, la fundición
   entre poses, el contorno, la sombra, la luz con piso y el fuego de al lado—
   vive en personajes.js y le sirve igual a una nativa, a un lobo o a lo que
   venga. Acá sólo se refleja el estado que lleva jugar.js y se presta lo que
   hace falta del lienzo. */
let _jugador=null;

/* La sombra: una mancha a los pies que se estira al oeste y se desvanece. */
function sombraDe(bc,br,CPMl,RPMl,Wc){
  const SL=Math.max(3,Math.round(1.9*CPMl));
  const SA=Math.max(1,Math.round(0.40*RPMl));
  for(let d=0;d<=SL;d++){
    const u=d/SL, sdw=0.42+0.52*u;
    const an=Math.max(1,Math.round(Wc*(0.62-0.34*u)));
    const alt=Math.max(0,Math.round(SA*(1-u*0.7)));
    for(let j=-alt;j<=alt;j++){
      const r=br+j;
      if(r<0||r>=rowsN) continue;
      for(let k=-an;k<=an;k++){
        const c=bc-d+k;
        if(c<0||c>=cols) continue;
        const i=r*cols+c; if(!fbG[i]) continue;
        const col=fbC[i], f=sdw+(1-sdw)*(Math.abs(j)/(alt+1))*0.8;
        fbC[i]=packc(((col>>16)&255)*f,((col>>8)&255)*f,(col&255)*f);
      }
    }
  }
}
/* Un resplandor apenas perceptible alrededor, para que la figura se despegue
   del pasto sin que parezca que lleva una linterna. */
function haloDe(bc,br,CPMl,RPMl,fuerza){
  const RH=Math.max(2,Math.round(2.2*CPMl)), RV=Math.max(1,Math.round(1.3*RPMl));
  for(let j=-RV;j<=RV;j++){
    const r=br-Math.round(RV*0.6)+j;
    if(r<0||r>=rowsN) continue;
    for(let k=-RH;k<=RH;k++){
      const c=bc+k;
      if(c<0||c>=cols) continue;
      const u=Math.hypot(k/RH,j/RV);
      if(u>1) continue;
      const i=r*cols+c; if(!fbG[i]) continue;
      /* suma, no multiplica: de noche no hay nada que multiplicar */
      const a=(fuerza||0.06)*(1-u)*(1-u)*96;
      const col=fbC[i];
      fbC[i]=packc(((col>>16)&255)+a*1.00,((col>>8)&255)+a*0.92,(col&255)+a*0.80);
    }
  }
}
function lienzoDe(ancho){
  return {RPM:RPM, camX:camX, camY:camY,
          put:put, capa:v=>{layer=v;},
          sombra:(bc,br,c2,r2)=>sombraDe(bc,br,c2,r2,ancho),
          halo:haloDe};
}

function drawPlayer(haze){
  if(!_jugador) _jugador=NV.nuevoPersonaje({arte:null,nombre:'Myrella',alto:1.75});   // sin arte: monito de palitos, hasta reconstruirla
  const p=_jugador;
  p.x=me.x; p.y=me.y;
  p.desdeX=NV.desdeX; p.desdeY=NV.desdeY;
  p.ultimoPaso=NV.ultimoPaso||0; p.pasoMs=NV.pasoMs||186;
  p.andado=NV.andado||0; p.mirando=facing;
  const Wc=Math.max(3,Math.round(0.55*CPM));
  const puesta=NV.dibujarPersonaje(p,haze,frame*0.11,lienzoDe(Wc));
  if(!puesta) figuraRespaldo(p,haze);
}

/* El monito: una figura de palitos, blanca, de 1,75 m. Es lo que se dibuja cuando un
   personaje no tiene arte; hoy es todo lo que hay de Myrella. Cabeza `O`, cuerpo `|`,
   brazos y piernas `/` `\`; al caminar las piernas se abren y se cierran con cada paso. */
function figuraRespaldo(p,haze){
  const H=Math.max(6,Math.round((p.alto||1.75)*HPM));
  const P=NV.posPersonaje(p,Date.now());
  const bc=Math.round((P.x-camX)*CPM+CPM/2), br=Math.round((P.y-camY)*RPM+RPM-1);
  const blanco=packc(236,238,240);
  const q=(c,r,g)=>put(c,r,g.charCodeAt(0),blanco);
  const andando=Date.now()-(p.ultimoPaso||0)<(p.pasoMs||186)+120;
  const abierto=andando?(Math.floor((p.andado||0)*2)%2?1:0):0;
  const headR=Math.max(1,Math.round(H*0.09));
  const headY=br-H+headR;
  const shoulder=br-Math.round(H*0.76), hip=br-Math.round(H*0.44);
  for(let dy=-headR;dy<=headR;dy++) for(let dx=-headR;dx<=headR;dx++){
    const u=(dx*dx)/(headR*headR*1.6)+(dy*dy)/(headR*headR);
    if(u<=1&&u>0.30) q(bc+dx,headY+dy,'O');
  }
  for(let r=headY+headR+1;r<=hip;r++) q(bc,r,'|');
  const armL=Math.round(H*0.30);
  for(let a=0;a<armL;a++){
    const dx=Math.round(a*0.55);
    q(bc-1-dx,shoulder+a,'/'); q(bc+1+dx,shoulder+a,'\\');
  }
  const legL=br-hip;
  for(let a=0;a<=legL;a++){
    const dx=Math.round(a*(0.42+0.30*abierto));
    q(bc-1-dx,hip+a,'/'); q(bc+1+dx,hip+a,'\\');
  }
}


NV.titilar=titilar;
NV.draw=draw; NV.draw_=draw_;
