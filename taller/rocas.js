/* Nativa Online — TALLER de rocas. Esto NO entra al juego todavía.
   Mismo contrato que el motor: put(c,r,glifo,color) y col(familia,luz) los da
   quien lo use. Todo en metros; la grilla traduce. La luz entra del este.

   Un árbol es tronco más follaje. Una roca es otra cosa: es MASA CON CARAS
   PLANAS. Lo que la hace leer como piedra y no como globo es que cada cara
   reciba su propia luz —constante dentro de la cara— y que el filo entre dos
   caras se vea. Un degradado suave da un almohadón; un escalón da una piedra. */
(function(global){
const T={};
function h3(a,b,c){
  let x=((a|0)*374761393+(b|0)*668265263+(c|0)*2246822519)>>>0;
  x=((x^(x>>>13))*1274126177)>>>0;
  return ((x^(x>>>16))>>>0)&0x7fffffff;
}
const r01=(a,b,c)=>(h3(a,b,c)%1000)/1000;
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* ---------- texturas de piedra ----------
   Cada una es una rampa de ralo a tupido, como manda la regla 2. El extremo
   ralo ". :" se comparte; la identidad está en el denso. */
const TEX={
  /* Cinco escalones, no cuatro, y la cara clara arranca en un glifo liviano:
     con cuatro glifos todos densos la cara iluminada salía como un panel macizo
     sin grano. El manchón necesita rango tonal para verse. */
  granito:  {claro:['o','0','8','%','#'], oscuro:['.',':','o','c','%'], fam:'piedra', grano:1},
  /* La arenisca pierde el '=' del grano: ése queda reservado al estrato. Con el
     mismo glifo en los dos, la repisa se perdía adentro de la textura. */
  arenisca: {claro:['-',':','o','8','%'], oscuro:['.','.',':','-','o'], fam:'roca2',  grano:3},
  pulido:   {claro:[':','o','0','0','8'], oscuro:['.','.',':','o','o'], fam:'piedra', grano:3},
  basalto:  {claro:['c','o','%','#','H'], oscuro:['.',':','c','o','%'], fam:'piedra', grano:1}
};
const LIQUEN={glifos:['°','°','*','*'], fam:'musgo'};

/* ---------- los quince modelos ----------
   perfil : la silueta, de la base izquierda subiendo por arriba hasta la base
            derecha. En fracciones del alto: x e y.
   caras  : dónde se corta la silueta en caras verticales y qué luz tiene cada
            una. El salto de luz entre dos caras es el filo.
   estrat : alturas donde hay una línea de estrato, cruzando toda la piedra.
   grietas: polilíneas oscuras.
   liquen : manchas [x, y, r]; sólo agarran en la cara que mira al sol.
   pie    : cuánto derrumbe hay al pie (0 = ninguno). */
const MODELOS={
 pequena:[
  {id:'peq-1', n:'Canto rodado', alto:0.45, tex:'pulido',
   perfil:[[-1.10,0],[-1.16,0.42],[-0.72,0.88],[0,1],[0.76,0.86],[1.14,0.40],[1.08,0]],
   caras:[[-1.2,0.44],[-0.2,0.78],[0.5,1.06]], estrat:[], grietas:[],
   liquen:[[-0.45,0.72,0.30]], pie:0},
  {id:'peq-2', n:'Lajas apiladas', alto:0.55, tex:'arenisca',
   perfil:[[-1.30,0],[-1.34,0.34],[-0.96,0.40],[-1.02,0.72],[-0.50,0.80],
           [0.62,1],[1.20,0.92],[1.26,0.30],[1.18,0]],
   caras:[[-1.4,0.40],[0.1,0.86],[0.7,1.12]],
   estrat:[], grietas:[], liquen:[], pie:0.3}   /* medio metro: la repisa no cabe */,
  {id:'peq-3', n:'Piedra angulosa partida', alto:0.40, tex:'granito',
   perfil:[[-1.25,0],[-0.95,0.62],[-0.30,1],[0.28,0.94],[0.60,0.52],[1.30,0.22],[1.22,0]],
   caras:[[-1.3,0.34],[-0.3,0.72],[0.3,1.14]], estrat:[],
   grietas:[[[-0.30,1],[-0.10,0.30]]], liquen:[], pie:0.2}
 ],
 media:[
  {id:'med-1', n:'Bloque facetado con liquen', alto:1.15, tex:'granito',
   perfil:[[-1.05,0],[-1.12,0.50],[-0.80,0.90],[-0.10,1],[0.62,0.96],[1.00,0.58],[0.96,0]],
   caras:[[-1.2,0.38],[-0.25,0.80],[0.45,1.14]], estrat:[],
   grietas:[[[-0.45,0.95],[-0.20,0.22]]],
   liquen:[[0.40,0.70,0.34],[0.10,0.86,0.22]], pie:0.35},
  {id:'med-2', n:'Piedra hendida en dos', alto:1.30, tex:'basalto',
   perfil:[[-1.00,0],[-1.06,0.56],[-0.62,0.94],[-0.16,0.74],[-0.04,0.98],
           [0.46,1],[0.92,0.62],[0.88,0]],
   caras:[[-1.1,0.36],[-0.10,0.72],[0.40,1.16]], estrat:[],
   grietas:[[[-0.10,0.86],[-0.06,0.10]]], liquen:[], pie:0.4},
  {id:'med-3', n:'Canto grande medio enterrado', alto:0.95, tex:'pulido',
   perfil:[[-1.45,0],[-1.40,0.46],[-0.88,0.86],[0.05,1],[0.95,0.84],[1.42,0.42],[1.38,0]],
   caras:[[-1.5,0.42],[-0.1,0.84],[0.6,1.10]], estrat:[], grietas:[],
   liquen:[[-0.70,0.62,0.36]], pie:0.7}
 ],
 grande:[
  {id:'gra-1', n:'Bloque errático de techo plano', alto:2.40, tex:'granito',
   perfil:[[-0.92,0],[-0.98,0.62],[-0.86,0.96],[-0.20,1],[0.58,0.98],[0.86,0.66],[0.82,0]],
   caras:[[-1.0,0.30],[-0.30,0.74],[0.35,1.16]], estrat:[],
   grietas:[[[-0.55,0.96],[-0.42,0.14]],[[0.30,0.98],[0.46,0.40]]],
   liquen:[[0.00,0.90,0.30]], pie:0.45},
  {id:'gra-2', n:'Roca en voladizo', alto:2.80, tex:'basalto',
   perfil:[[-0.58,0],[-0.66,0.42],[-1.10,0.66],[-1.16,0.92],[-0.30,1],
           [0.52,0.96],[0.70,0.54],[0.52,0]],
   caras:[[-1.2,0.26],[-0.35,0.66],[0.25,1.18]], estrat:[],
   grietas:[[[-0.70,0.92],[-0.55,0.46]]], liquen:[[-0.60,0.84,0.26]], pie:0.5},
  {id:'gra-3', n:'Peñasco de estratos inclinados', alto:2.10, tex:'arenisca',
   perfil:[[-1.20,0],[-1.26,0.40],[-0.95,0.78],[-0.35,1],[0.70,0.82],[1.12,0.44],[1.08,0]],
   caras:[[-1.3,0.38],[-0.20,0.78],[0.50,1.12]],
   /* tres repisas y poca inclinación: con cinco y 0,085 las líneas se cruzaban
      entre ellas y no se leía ninguna */
   estrat:[0.28,0.52,0.78], inclinaEstrat:0.05,
   grietas:[], liquen:[], pie:0.6}
 ],
 gigante:[
  {id:'gig-1', n:'Torreón de grietas verticales', alto:6.00, tex:'basalto',
   perfil:[[-0.46,0],[-0.52,0.34],[-0.44,0.72],[-0.50,0.94],[-0.12,1],
           [0.34,0.96],[0.44,0.70],[0.38,0.30],[0.42,0]],
   caras:[[-0.55,0.26],[-0.18,0.66],[0.18,1.18]], estrat:[],
   grietas:[[[-0.30,0.98],[-0.26,0.06]],[[0.10,0.94],[0.16,0.20]],
            [[-0.05,0.70],[-0.02,0.10]]],
   liquen:[[-0.30,0.40,0.14]], pie:0.9},
  {id:'gig-2', n:'Mole de lomo pulido', alto:7.50, tex:'pulido',
   perfil:[[-0.74,0],[-0.80,0.30],[-0.66,0.64],[-0.34,0.92],[0.08,1],
           [0.50,0.88],[0.70,0.56],[0.72,0.24],[0.66,0]],
   caras:[[-0.85,0.34],[-0.20,0.80],[0.30,1.20]], estrat:[],
   grietas:[[[-0.20,0.90],[-0.10,0.40]]],
   liquen:[[-0.50,0.50,0.22],[-0.30,0.74,0.16]], pie:0.7},
  {id:'gig-3', n:'Amontonamiento de bloques', alto:5.20, tex:'granito',
   perfil:[[-1.05,0],[-1.10,0.32],[-0.72,0.44],[-0.80,0.70],[-0.34,0.80],
           [-0.40,1],[0.18,0.98],[0.26,0.72],[0.72,0.64],[0.66,0.34],[0.98,0.26],[0.94,0]],
   caras:[[-1.15,0.30],[-0.30,0.72],[0.25,1.16]],
   estrat:[], grietas:[[[-0.72,0.44],[-0.78,0.68]],[[-0.34,0.80],[-0.38,0.99]],
            [[0.26,0.72],[0.70,0.65]],[[0.66,0.34],[0.96,0.27]]],
   liquen:[[0.40,0.46,0.20]], pie:1.0}
 ],
 /* Los acantilados NO llevan silueta dibujada a mano: se sintetizan. Un muro
    de dieciséis metros son más de doscientos caracteres de ancho, y una silueta
    a mano ahí da un panel plano con tres bandas. Un acantilado es borde
    superior quebrado, contrafuertes y canaletas, estratos y derrumbe al pie,
    repetible a lo largo de toda la costa. */
 acantilado:[
  {id:'aca-1', n:'Acantilado de estratos horizontales', muro:1, alto:9, ancho:16,
   tex:'arenisca', relieve:0.34, canaleta:5.0, cresta:0.13, crestaEsc:3.2,
   estratoCada:1.05, estratoTilt:0.012, columnas:0, repisas:[], pie:0.55},
  {id:'aca-2', n:'Acantilado de columnas fracturadas', muro:1, alto:12, ancho:14,
   tex:'basalto', relieve:0.22, canaleta:3.0, cresta:0.07, crestaEsc:1.4,
   estratoCada:0, estratoTilt:0, columnas:0.95, repisas:[], pie:0.40},
  {id:'aca-3', n:'Acantilado con repisas y derrumbe', muro:1, alto:7, ancho:18,
   tex:'granito', relieve:0.44, canaleta:6.5, cresta:0.17, crestaEsc:4.0,
   estratoCada:0, estratoTilt:0, columnas:0, repisas:[0.34,0.62,0.84], pie:1.30}
 ]
};

/* ---------- dibujo ----------
   La silueta se parte en CADENA IZQUIERDA y CADENA DERECHA: el perfil viene de
   la base izquierda, sube por arriba y baja a la base derecha, así que el punto
   más alto lo corta en dos. Para cada fila se interpola una x en cada cadena.
   Tomar el mínimo y el máximo de todos los cortes, como se hacía antes, rellena
   las concavidades y mata el voladizo; con cadenas el voladizo existe. */
function cadenas(perfil){
  let k=0; for(let i=1;i<perfil.length;i++) if(perfil[i][1]>perfil[k][1]) k=i;
  return {izq:perfil.slice(0,k+1), der:perfil.slice(k).reverse(), cima:perfil[k]};
}
function enCadena(ch,y){
  for(let i=0;i<ch.length-1;i++){
    const a=ch[i], b=ch[i+1];
    if((a[1]<=y&&b[1]>=y)||(b[1]<=y&&a[1]>=y)){
      const d=b[1]-a[1];
      return Math.abs(d)<1e-9 ? b[0] : a[0]+(b[0]-a[0])*(y-a[1])/d;
    }
  }
  return null;
}
T.dibujar=function(m,G,put,col){
  const tex=TEX[m.tex], h=m.alto;
  const anchoX=m.ancho||h, semilla=m.id.length*97+Math.round(h*10);
  const aC=x=>Math.round(G.baseC + x*(anchoX/2)*G.CPM);
  const aR=y=>Math.round(G.baseR - y*h*G.HPM);
  const filas=Math.max(2,Math.round(h*G.HPM));
  const CH=cadenas(m.perfil);
  const span=y=>{
    const a=enCadena(CH.izq,y), b=enCadena(CH.der,y);
    return (a===null||b===null)?null:[Math.min(a,b),Math.max(a,b)];
  };
  /* La luz de una cara es constante —eso es lo que la hace plana— pero el FILO
     entre dos caras se quiebra fila a fila. Derecho era una raya de regla. */
  const luzEn=(xr,r)=>{
    let luz=m.caras[0][1];
    for(const ca of m.caras) if(xr >= ca[0]+(r01(semilla,r,21)-0.5)*0.07) luz=ca[1];
    return luz;
  };
  /* --- derrumbe al pie: va primero, lo tapa la piedra --- */
  if(m.pie){
    const n=Math.round(m.pie*anchoX*G.CPM*0.9);
    for(let i=0;i<n;i++){
      const hh=h3(semilla+i,7,1);
      const x=(-1+2*((hh%1000)/1000))*1.14;
      const sube=((hh>>10)%100)/100;
      put(aC(x), G.baseR-Math.round(sube*m.pie*0.45*h*G.HPM),
          ['.',':','°','o','c'][(hh>>5)%5],
          col('piedra',0.30+0.5*((hh>>17)%100)/100), 'pie');
    }
  }
  /* --- la masa, fila por fila --- */
  for(let f=0;f<=filas;f++){
    const y=f/filas, sp=span(y);
    if(!sp) continue;
    const spA=span(Math.min(1,y+1/filas));
    const r=aR(y), cI=aC(sp[0]), cD=aC(sp[1]);
    for(let c=cI;c<=cD;c++){
      const xr=(c-G.baseC)/((anchoX/2)*G.CPM);
      const luz=luzEn(xr,r);
      /* el grano va en MANCHONES: el azar se sortea por bloques de dos o tres
         celdas según lo fina que sea la piedra, no celda por celda */
      /* El grano va en dos octavas: un manchón grande que le da forma y un
         temblor celda a celda que lo desarma. Con una sola octava en bloques de
         tres, la piedra salía a cuadros: tiradas de tres glifos iguales. */
      const b=tex.grano;
      const grueso=(h3(semilla+((c/(b+2))|0), (r/(b+1))|0, 2)%100)/100;
      const fino=(h3(semilla+c, r, 12)%100)/100;
      const v=clamp(grueso*0.70+fino*0.30,0,1);
      let lz=luz*(0.88+0.24*v);
      const rampa = luz>0.62 ? tex.claro : tex.oscuro;
      let g=rampa[clamp(Math.round(v*(rampa.length-1)),0,rampa.length-1)];
      /* el filo de arriba: donde la piedra termina y empieza el cielo. El glifo
         sigue la pendiente de la silueta, no se pone un guión siempre. */
      if(!spA || c<aC(spA[0]) || c>aC(spA[1])){
        const dIz=spA?Math.abs(aC(spA[0])-cI):9, dDe=spA?Math.abs(aC(spA[1])-cD):9;
        g = (c<cI+1&&dIz>1) ? '/' : (c>cD-1&&dDe>1) ? '\\'
          : ((h3(semilla+c,r,4)%5)?'_':'-');
        lz=luz*1.34;
      }
      /* la silueta se lee por el color, no por un paréntesis en cada fila:
         el oeste casi negro, el este encendido */
      else if(c<=cI+1) lz=luz*0.46;
      else if(c>=cD-1) lz=luz*1.22;
      put(c, r, g, col(tex.fam, lz), 'masa');
    }
  }
  /* --- estratos: una repisa que cruza la piedra, con su filo iluminado --- */
  const tilt=m.inclinaEstrat||0;
  for(const e of (m.estrat||[])){
    for(let paso=0;paso<=Math.round(anchoX*G.CPM);paso++){
      const xr=-1.2+2.4*paso/Math.max(1,Math.round(anchoX*G.CPM));
      const y=e+tilt*xr;
      if(y<=0.02||y>=0.99) continue;
      const sp=span(y);
      if(!sp||xr<sp[0]+0.02||xr>sp[1]-0.02) continue;
      const c=aC(xr), r=aR(y), hh=h3(semilla+c,Math.round(e*100),3);
      if((hh%100)<14) continue;                      // la línea se corta a veces
      const luz=luzEn(xr,r);
      put(c, r,   (hh>>7)%3?'=':'-', col(tex.fam, luz*0.50), 'estrato');
      if((hh>>9)%4) put(c, r-1, '°', col(tex.fam, luz*1.26), 'estrato');
    }
  }
  /* --- grietas --- */
  for(const gr of (m.grietas||[])){
    for(let k=0;k<gr.length-1;k++){
      const a=gr[k], b=gr[k+1];
      const pasos=Math.max(2,Math.round(Math.abs(b[1]-a[1])*h*G.HPM));
      for(let i=0;i<=pasos;i++){
        const u=i/pasos;
        const x=a[0]+(b[0]-a[0])*u+(r01(semilla+i,3,4)-0.5)*0.04;
        const y=a[1]+(b[1]-a[1])*u;
        const sp=span(y);
        if(!sp||x<sp[0]+0.03||x>sp[1]-0.03) continue;
        put(aC(x), aR(y), (h3(semilla+i,5,6)%4)?'|':'!',
            col(tex.fam,0.13), 'grieta');
      }
    }
  }
  /* --- liquen: agarra en la cara que da al sol y en la mitad de abajo --- */
  for(const lq of (m.liquen||[])){
    const ri=Math.max(1,Math.round(lq[2]*(anchoX/2)*G.CPM));
    const rj=Math.max(1,Math.round(lq[2]*h*G.HPM*0.8));
    const c0=aC(lq[0]), r0=aR(lq[1]);
    for(let j=-rj;j<=rj;j++) for(let i=-ri;i<=ri;i++){
      const u=Math.hypot(i/ri,j/rj);
      if(u>1) continue;
      const hh=h3(semilla+c0+i,r0+j,8);
      if((1-u)*(0.5+0.9*((hh%100)/100))<0.42) continue;
      const y=(G.baseR-(r0+j))/(h*G.HPM), sp=span(clamp(y,0,1));
      if(!sp) continue;
      const x=(c0+i-G.baseC)/((anchoX/2)*G.CPM);
      if(x<sp[0]+0.04||x>sp[1]-0.04) continue;
      put(c0+i, r0+j, LIQUEN.glifos[(hh>>6)%LIQUEN.glifos.length],
          col(LIQUEN.fam, 0.42+0.5*((hh>>11)%100)/100), 'liquen');
    }
  }
  /* --- la sombra al pie, cortada: lo que la apoya en el suelo --- */
  const sp0=span(0.004);
  if(sp0) for(let c=aC(sp0[0]);c<=aC(sp0[1]);c++){
    const hh=h3(semilla+c,0,9);
    if((hh%100)<26) continue;
    put(c, G.baseR+1, (hh>>5)%3?'_':'.', col(tex.fam,0.11), 'apoyo');
  }
};
/* ---------- muro: el acantilado ----------
   Nada está dibujado a mano. Un ruido suave de una dimensión manda sobre el
   borde de arriba y sobre el relieve de la cara: donde el ruido sube hay un
   contrafuerte que recibe luz, donde baja hay una canaleta en sombra. Eso es lo
   que le da volumen a una pared de doscientos caracteres. */
function ruido1(s,x,esc){
  const t=x/esc, i=Math.floor(t), f=t-i;
  const a=(h3(s,i,13)%1000)/1000, b=(h3(s,i+1,13)%1000)/1000;
  return a+(b-a)*(f*f*(3-2*f));
}
T.dibujarMuro=function(m,G,put,col){
  const tex=TEX[m.tex], h=m.alto, W=m.ancho, sem=m.id.length*131+h;
  const cols=Math.round(W*G.CPM);
  const aR=y=>G.baseR-Math.round(y*G.HPM);
  for(let k=0;k<=cols;k++){
    const x=(k/cols-0.5)*W, c=G.baseC+k-Math.round(cols/2);
    /* el borde de arriba, quebrado en dos escalas */
    const cima=h*(1-m.cresta*(0.62*ruido1(sem,x,m.crestaEsc)+0.38*ruido1(sem+3,x,m.crestaEsc*0.35)));
    /* contrafuerte o canaleta */
    let rel=0.55*ruido1(sem+7,x,m.canaleta)+0.45*ruido1(sem+9,x,m.canaleta*0.38);
    /* las columnas del basalto: caras planas de un ancho fijo, con su grieta */
    let enGrieta=false;
    if(m.columnas){
      const u=x/m.columnas, col_=Math.floor(u), f=u-col_;
      rel=rel*0.45+0.55*((h3(sem+col_,0,17)%100)/100);
      enGrieta = f<0.06||f>0.94;
    }
    const luzCol=0.22+1.00*(rel*(1-m.relieve)+m.relieve*0.5);
    const filas=Math.round(cima*G.HPM);
    for(let f=0;f<=filas;f++){
      const y=cima*(f/Math.max(1,filas));
      const r=aR(y);
      /* cuanto más abajo, menos cielo le llega */
      const sombraPie=0.58+0.42*Math.min(1,y/(h*0.55));
      let lz=luzCol*sombraPie;
      const b=tex.grano;
      const grueso=(h3(sem+((c/(b+2))|0),(r/(b+1))|0,2)%100)/100;
      const fino=(h3(sem+c,r,12)%100)/100;
      const v=clamp(grueso*0.70+fino*0.30,0,1);
      const rampa = lz>0.62?tex.claro:tex.oscuro;
      let g=rampa[clamp(Math.round(v*(rampa.length-1)),0,rampa.length-1)];
      if(f===filas){ g=(h3(sem+c,r,4)%4)?'_':'-'; lz*=1.36; }     // el filo del borde
      if(enGrieta && f<filas){ g=(h3(sem+c,r,6)%4)?'|':'!'; lz*=0.22; }
      put(c,r,g,col(tex.fam,lz),'muro');
    }
    /* estratos: la repisa cruza toda la pared, un poco inclinada */
    if(m.estratoCada){
      for(let e=m.estratoCada; e<cima-0.15; e+=m.estratoCada){
        const y=e+m.estratoTilt*x*10;
        if(y<=0.1||y>=cima-0.1) continue;
        const r=aR(y), hh=h3(sem+c,Math.round(e*100),3);
        if((hh%100)<16) continue;
        put(c,r,(hh>>7)%4?'=':'~',col(tex.fam,luzCol*0.46),'estrato');
        if(luzCol>0.62&&(hh>>9)%3) put(c,r-1,'°',col(tex.fam,luzCol*1.30),'estrato');
      }
    }
    /* Repisas: un escalón, encendido arriba y socavado abajo. La altura es
       ABSOLUTA, no una fracción del borde de arriba: atada al borde, que varía
       columna a columna, la repisa se corría de fila en fila y se deshacía en
       una franja de basura. Y aparece a tramos, no cruzando toda la pared. */
    for(let ir=0;ir<(m.repisas||[]).length;ir++){
      const tramo=ruido1(sem+21+ir*5,x,8.5);
      if(tramo<0.38) continue;
      const y=h*m.repisas[ir]+0.30*(ruido1(sem+31+ir,x,6.0)-0.5);
      if(y<=0.2||y>=cima-0.3) continue;
      const r=aR(y), hh=h3(sem+c,ir,5);
      put(c,r,(hh%3)?'=':'-', col(tex.fam,luzCol*1.34),'repisa');
      if((hh>>6)%2) put(c,r+1,'_', col(tex.fam,luzCol*0.24),'repisa');
    }
  }
  /* derrumbe al pie: bloques caídos, más chicos cuanto más lejos */
  const n=Math.round(m.pie*W*G.CPM*1.1);
  for(let i=0;i<n;i++){
    const hh=h3(sem+i,7,1);
    const x=(((hh%1000)/1000)-0.5)*W*1.04;
    const sube=Math.pow(((hh>>10)%100)/100,1.8);
    const c=G.baseC+Math.round(x*G.CPM), r=G.baseR-Math.round(sube*m.pie*2.2*G.HPM);
    const g=sube<0.3?['c','o','%','8'][(hh>>5)%4]:['.',':','°','o'][(hh>>5)%4];
    put(c,r,g,col(tex.fam,0.26+0.46*((hh>>17)%100)/100),'pie');
  }
};
T.MODELOS=MODELOS; T.TEX=TEX;
global.NVR=T;
})(typeof window!=='undefined'?window:global);
if(typeof module!=='undefined') module.exports=global.NVR||NVR;
