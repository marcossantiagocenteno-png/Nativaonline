/* Nativa Online — TALLER de árboles. Esto NO entra al juego todavía.
   Se dibuja con el mismo contrato que el motor —put(c,r,codigo,color)— y las
   mismas familias de color, así que lo que se ve acá es lo que el motor puede
   pintar. Todo se mide en metros; la grilla traduce.

   Reglas del diccionario que se respetan (sección 9 del diseño):
   mayúscula = denso o cerca, minúscula = ralo o lejos; cada material es una
   rampa de ralo a tupido y la luz elige el escalón; el extremo ralo ". ," se
   comparte y la identidad vive en el extremo denso. */
(function(global){
const T={};

/* ---------- azar siempre positivo ---------- */
function h3(a,b,c){
  let x=((a|0)*374761393+(b|0)*668265263+(c|0)*2246822519)>>>0;
  x=((x^(x>>>13))*1274126177)>>>0;
  return ((x^(x>>>16))>>>0)&0x7fffffff;
}
const r01=(a,b,c)=>(h3(a,b,c)%1000)/1000;

/* ---------- follaje: rampa de ralo a tupido, por especie ---------- */
const HOJA={
  /* el pino tiene aguja: puntos y asteriscos, nada redondo */
  pino:  {copa:['.',':',';','*','A','#'], borde:['.',':','^'],
          fam:'pino',  famS:'pino',   sombra:0.40, umbral:0.20, gamma:0.66, grumo:2},
  /* el encino tiene hoja ancha y lobulada: todo redondo */
  encino:{copa:['.',',','o','e','8','@'], borde:['.',',','`','o'],
          fam:'verde', famS:'verdeO', sombra:0.46, umbral:0.26, gamma:0.92, grumo:1},
  /* el álamo tiene hoja chica que tiembla: comillas y uves */
  alamo: {copa:['.','"','v','o','8'],     borde:['.','"','v'],
          fam:'alamo', famS:'verde',  sombra:0.52, umbral:0.30, gamma:1.10, grumo:1}
};
/* ---------- corteza: glifo, veta, nudo y familia ---------- */
const CORTEZA={
  /* placas gruesas, rojizas */
  pino:  {fam:'corteza',       placa:['H','#','%'], veta:'|', nudo:['0','o'], luz:1.00},
  /* surcos profundos, oscura */
  encino:{fam:'corteza',       placa:['H','%','#'], veta:'|', nudo:['@','0'], luz:0.88},
  /* lisa y clara, con lenticelas oscuras */
  alamo: {fam:'cortezaClara',  placa:['l','|','I'], veta:'-', nudo:['o','0'], luz:1.15}
};

/* ---------- los nueve modelos ----------
   Todo en metros. El tronco sube hasta la HORQUETA y ahí se corta; de la
   horqueta salen ramas trazadas una por una hasta el centro de cada mancha de
   follaje. Las manchas se dibujan chicas y separadas para que entre cielo. */
const MODELOS=[
 { id:'pino-1', sp:'pino', n:'Pino joven, cerrado hasta abajo', s:101,
   alto:5.2, ancho:2.4, grosor:0.20, horqueta:0.96, inclina:0,
   pisos:{desde:0.14, n:8, cae:0.34, p:0.85}, nudos:[], muertas:[] },
 { id:'pino-2', sp:'pino', n:'Pino adulto, fuste limpio', s:202,
   alto:6.4, ancho:2.7, grosor:0.24, horqueta:0.96, inclina:0.03,
   pisos:{desde:0.48, n:6, cae:0.40, p:0.80}, nudos:[0.22,0.33,0.42],
   muertas:[0.46] },
 { id:'pino-3', sp:'pino', n:'Pino viejo, descopado', s:303,
   alto:5.8, ancho:3.4, grosor:0.28, horqueta:0.90, inclina:-0.05,
   pisos:{desde:0.42, n:5, cae:0.16, p:0.40}, nudos:[0.26,0.36,0.46,0.56],
   muertas:[0.44,0.60] },

 { id:'encino-1', sp:'encino', n:'Encino de copa en dos lóbulos', s:404,
   alto:4.2, ancho:4.0, grosor:0.34, horqueta:0.34, inclina:0,
   lider:0.86, manchas:[[-1.35,2.70,0.86],[1.25,3.05,0.94],[-0.10,3.55,0.70]],
   nudos:[0.20], muertas:[] },
 { id:'encino-2', sp:'encino', n:'Encino bifurcado desde abajo', s:505,
   alto:3.8, ancho:4.4, grosor:0.38, horqueta:0.22, inclina:0,
   manchas:[[-1.70,2.05,0.88],[1.55,2.35,0.84],[-0.45,3.00,0.74],
            [0.70,3.15,0.70]],
   nudos:[], muertas:[] },
 { id:'encino-3', sp:'encino', n:'Encino viejo, copa despareja', s:606,
   alto:4.6, ancho:4.8, grosor:0.42, horqueta:0.38, inclina:0.05,
   lider:0.90, manchas:[[-1.90,2.45,0.66],[0.85,3.25,1.04],[2.00,2.25,0.58],
            [0.05,4.00,0.58]],
   nudos:[0.24,0.32], muertas:[0.42] },

 { id:'alamo-1', sp:'alamo', n:'Álamo columnar joven', s:707,
   alto:5.0, ancho:1.4, grosor:0.15, horqueta:0.92, inclina:0,
   columna:{desde:0.26, n:7, llama:0}, nudos:[], muertas:[] },
 { id:'alamo-2', sp:'alamo', n:'Álamo adulto, copa en llama', s:808,
   alto:5.8, ancho:2.0, grosor:0.18, horqueta:0.90, inclina:0.02,
   columna:{desde:0.30, n:8, llama:1}, nudos:[0.28,0.38], muertas:[] },
 { id:'alamo-3', sp:'alamo', n:'Álamo ladeado, copa rala', s:909,
   alto:5.4, ancho:1.9, grosor:0.17, horqueta:0.88, inclina:0.20,
   columna:{desde:0.28, n:7, llama:1, rala:0.68}, nudos:[0.32],
   muertas:[0.44] }
];

/* ---------- dibujo ----------
   G = {CPM, HPM, baseC, baseR}: columnas por metro a lo ancho, filas por metro
   de altura, y dónde está el pie del árbol. */
T.dibujar=function(m,G,put,col){
  const H=HOJA[m.sp], C=CORTEZA[m.sp];
  const celdas=new Map(), K=(c,r)=>r*8192+c+4096;
  function poner(c,r,g,color,clase,sobre){
    const k=K(c,r);
    if(celdas.has(k) && !sobre) return;
    celdas.set(k,{g:g,col:color,cl:clase});
  }
  const aC=x=>Math.round(G.baseC + x*G.CPM);
  const aR=y=>Math.round(G.baseR - y*G.HPM);
  const yH=m.alto*m.horqueta;                       // altura de la horqueta
  /* Hasta dónde sube el tronco. Cuando la especie tiene guía central sigue
     subiendo por arriba de la horqueta, afinándose: antes se cortaba de golpe y
     arriba quedaba un palito de un carácter de ancho. */
  const yT=m.alto*(m.lider||m.horqueta);

  /* ===== 1. tronco, hasta la horqueta ===== */
  function tronco(y){
    const t=clamp(y/m.alto,0,1);
    let hw=(m.grosor*(1-0.46*Math.pow(t,0.7)))/2;
    if(m.lider && y>yH) hw*=Math.max(0.22,1-(y-yH)/(yT-yH)*0.78);
    if(y<0.22) hw*=1+(0.22-y)*2.2;                  // el pie se abre
    return {cx:m.inclina*y, hw:hw};
  }
  for(let r=aR(0);r>=aR(yT);r--){
    const y=(G.baseR-r)/G.HPM;
    if(y>yT+0.02) continue;
    const tr=tronco(y), t=clamp(y/m.alto,0,1);
    const ci=Math.max(0,Math.round(tr.hw*G.CPM));
    for(let c=-ci;c<=ci;c++){
      const este=ci?c/ci:0;
      /* La corteza no es estática: son CRESTAS VERTICALES. El glifo lo elige la
         columna, no la celda, y se mantiene varias filas seguidas; cada tanto se
         corta y empieza otra. Antes se sorteaba celda por celda y salía ruido. */
      const banda=Math.floor(r/(m.sp==='alamo'?7:4));
      const hh=h3(m.s+c*31, banda, 1);
      const cresta=h3(m.s+c*31,0,5)%3;              // esta columna es cresta o surco
      /* En un tronco de tres celdas no hay crestas que mostrar: dos columnas
         de veta lo dejaban como un caño de cañería. Ahí la textura va por
         bandas a lo alto. */
      let g;
      if(ci<=1){ g=C.placa[(hh>>6)%C.placa.length]; }
      else { g=C.placa[(cresta+((hh>>6)%2))%C.placa.length];
             if(cresta===2 && este<0.55) g=C.veta; }
      if(t>0.55 && g===C.placa[0]) g=(m.sp==='alamo'?'i':'h');
      /* la luz entra del este, y el surco queda más oscuro que la cresta */
      let luz=(0.26+0.80*((este+1)/2))*C.luz*(g===C.veta?0.74:1)
             *(0.94+0.12*r01(m.s,banda,c+9));
      if(m.sp==='alamo' && (h3(m.s+c,r,3)%37)===0) g='-';   // lenticela
      poner(aC(tr.cx)+c, r, g, col(C.fam,luz), 'tronco', true);
    }
    if(y<0.14){                                     // dos raíces, no más
      poner(aC(tr.cx)-ci-1, r, '/', col(C.fam,0.34), 'tronco', false);
      poner(aC(tr.cx)+ci+1, r, '\\', col(C.fam,0.92), 'tronco', false);
    }
  }
  /* ===== 2. nudos: la cicatriz de una rama que se cayó ===== */
  for(const hn of (m.nudos||[])){
    const y=m.alto*hn, tr=tronco(y);
    const lado=r01(m.s,Math.round(hn*100),7)>0.5?1:-1;
    const ci=Math.max(1,Math.round(tr.hw*G.CPM));
    const c0=aC(tr.cx)+lado*Math.max(0,ci-1), r0=aR(y);
    poner(c0,   r0,   C.nudo[0], col(C.fam, lado>0?0.44:0.22), 'nudo', true);
    poner(c0,   r0-1, '~',       col(C.fam, lado>0?1.18:0.62), 'nudo', true);
    poner(c0,   r0+1, '_',       col(C.fam, 0.20),             'nudo', true);
  }
  /* ===== 3. ramas y manchas de follaje ===== */
  const ramas=[], manchas=[];
  if(m.pisos){                                      /* pino: pisos de ramas */
    const P=m.pisos;
    const sep=m.alto*(0.95-P.desde)/Math.max(1,P.n-1);   // qué separa dos pisos
    for(let i=0;i<P.n;i++){
      const t=i/(P.n-1);
      const y=m.alto*(P.desde+(0.95-P.desde)*t);
      const largo=(m.ancho/2)*Math.pow(1-t,P.p)*(0.82+0.30*r01(m.s,i,2));
      if(largo<0.12) continue;
      const cx=m.inclina*y;
      for(const lado of [-1,1]){
        const L=largo*(lado>0?0.92+0.20*r01(m.s,i,3):1);
        ramas.push({x0:cx,y0:y,x1:cx+lado*L,y1:y-L*P.cae,g:0.8-t*0.5});
        manchas.push({x:cx+lado*L*0.60,y:y-L*P.cae*0.55,
                      rx:L*0.72,ry:L*0.34,d:1});
      }
      /* la masa del eje llega hasta el piso de arriba: si no, el tronco se veía
         entero entre piso y piso como una línea trazada con regla */
      manchas.push({x:cx,y:y+sep*0.30,rx:largo*0.46,
                    ry:Math.max(largo*0.26,sep*0.62),d:0.9});
    }
    manchas.push({x:m.inclina*m.alto,y:m.alto*0.95,       // la punta
                  rx:m.ancho*0.10,ry:m.alto*0.05,d:1});
  } else if(m.manchas){                              /* encino: una rama por mancha */
    for(let i=0;i<m.manchas.length;i++){
      const M=m.manchas[i];
      /* la rama entra en el lóbulo y muere adentro: así lo que queda a la vista
         por debajo de la copa es corto, no un abanico de barras */
      ramas.push({x0:m.inclina*yH,y0:yH,x1:M[0]*0.92,y1:M[1]-M[2]*0.18,
                  g:1.25-i*0.12,recta:1});
      manchas.push({x:M[0],y:M[1],rx:M[2],ry:M[2]*0.82,d:1});
    }
  } else {                                           /* álamo: cortas y paradas */
    const Q=m.columna;
    for(let i=0;i<Q.n;i++){
      const t=i/(Q.n-1);
      const y=m.alto*(Q.desde+(0.95-Q.desde)*t);
      let rx=(m.ancho/2)*(Q.llama
            ? Math.sqrt(Math.max(0.06,1-Math.pow(t*1.8-0.80,2)*0.92))
            : Math.sqrt(Math.max(0.06,1-t*t*0.58)));
      rx*=0.84+0.30*r01(m.s,i,8);
      const cx=m.inclina*y, lado=i%2?1:-1;
      ramas.push({x0:cx,y0:y-0.18,x1:cx+lado*rx*0.55,y1:y+0.10,g:0.45});
      manchas.push({x:cx+lado*rx*0.14,y:y,rx:rx,ry:rx*1.05,d:Q.rala||1});
    }
  }
  for(const rm of ramas) trazar(rm,false);
  for(const hm of (m.muertas||[])){
    const y=m.alto*hm, lado=r01(m.s,Math.round(hm*100),8)>0.5?1:-1;
    trazar({x0:m.inclina*y,y0:y,x1:m.inclina*y+lado*(m.ancho/2)*0.80,
            y1:y-0.30,g:0.5,recta:1},true);
  }
  function trazar(rm,seca){
    const dx=rm.x1-rm.x0, dy=rm.y1-rm.y0;
    const pasos=Math.max(3,Math.round(Math.hypot(dx*G.CPM,dy*G.HPM)));
    const pend=Math.abs(dy*G.HPM)/Math.max(1,Math.abs(dx*G.CPM));
    for(let i=1;i<=pasos;i++){
      const t=i/pasos;
      const k=rm.recta?t:Math.pow(t,0.88);
      const x=rm.x0+dx*k, y=rm.y0+dy*(rm.recta?t:Math.pow(t,1.3));
      let g;
      if(pend>2.2)        g='|';
      else if(pend<0.40)  g='-';
      else if((dx>0)===(dy>0)) g='/';
      else                g='\\';
      if(seca && t>0.72) g='.';
      const luz=(seca?0.56:0.24+0.78*((dx>0?1:-1)+1)/2)*(1-t*0.20)*C.luz;
      const cc=aC(x), rr=aR(y);
      poner(cc,rr,g,col(seca?'hoja':C.fam,luz),'rama',true);
      /* La rama tiene grosor y se afina: junto a la horqueta ocupa dos o tres
         celdas, en la punta una sola. Antes era una barra de un carácter y se
         leía como una raya dibujada, no como madera. */
      const gr=rm.g*(1-t*0.86);
      if(!seca && gr>0.42){
        const der=pend>1.6?1:0;                        // la gruesa crece a lo ancho
        poner(cc+(der?1:0), rr+(der?0:1), g, col(C.fam,luz*0.58), 'rama', false);
        if(gr>0.92) poner(cc-(der?1:0), rr+(der?0:-1), g, col(C.fam,luz*0.74), 'rama', false);
      }
    }
  }
  /* ===== 4. follaje ===== */
  for(const ma of manchas){
    const c0=aC(ma.x), r0=aR(ma.y);
    const ri=Math.max(1,Math.round(ma.rx*G.CPM)), rj=Math.max(1,Math.round(ma.ry*G.HPM));
    for(let j=-rj;j<=rj;j++) for(let i=-ri;i<=ri;i++){
      const u=Math.hypot(i/ri,j/rj);
      if(u>1.0) continue;
      const c=c0+i, r=r0+j, hh=h3(m.s+c,r,2);
      /* densidad: llena en el medio, deshilachada en el borde, con grumos */
      /* El hueco se agrupa: el azar se sortea por bloques de 2×2 y no por celda,
         así el cielo entra en claros y no salpicado como sal y pimienta. */
      const gb=H.grumo;
      const grumo=0.42+0.96*r01(m.s*3+(c>>gb), r>>gb, 9);
      let d=(1-Math.pow(u,2.1))*ma.d*grumo;
      /* gamma por especie: la aguja del pino es masa tupida y oscura, la hoja
         del álamo es rala y deja pasar el cielo. El mismo cálculo con otro
         exponente da las dos cosas. */
      d=Math.pow(clamp(d,0,1),H.gamma);
      if(d<H.umbral) continue;                       // acá se ve el cielo
      const este=i/ri, arriba=-j/rj;
      let luz=0.26+0.56*((este+1)/2)+0.38*Math.max(0,arriba);
      luz*=0.86+0.28*((hh>>5)%100)/100;
      const familia=(este<-0.12||arriba<-0.40)?H.famS:H.fam;
      const rampa=u>0.70?H.borde:H.copa;
      const g=rampa[clamp(Math.round(d*(rampa.length-1)),0,rampa.length-1)];
      if(g===' ') continue;
      const hay=celdas.get(K(c,r));
      /* Abajo de la horqueta el tronco siempre gana: es lo que sostiene al
         árbol y verlo tapado por hojas sería mentira. Adentro de la copa, en
         cambio, la hoja lo tapa casi siempre y sólo lo deja asomar a veces. */
      if(hay && hay.cl==='nudo') continue;
      if(hay && hay.cl==='tronco'){
        if(r>aR(yH) || ((hh>>13)%100)<34) continue;
      }
      /* sobre una rama la hoja tapa sólo a veces: así se ve el esqueleto adentro */
      if(hay && hay.cl==='rama' && ((hh>>11)%100)<58) continue;
      poner(c,r,g,col(familia,luz),'hoja',true);
    }
  }
  /* ===== 5. volcado ===== */
  celdas.forEach((v,k)=>{
    const r=Math.floor((k-4096)/8192), c=k-4096-r*8192;
    put(c,r,v.g,v.col,v.cl);
  });
};
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

T.MODELOS=MODELOS; T.HOJA=HOJA; T.CORTEZA=CORTEZA;
global.NVT=T;
})(typeof window!=='undefined'?window:global);
if(typeof module!=='undefined') module.exports=global.NVT||NVT;
