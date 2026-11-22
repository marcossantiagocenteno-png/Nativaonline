/* Nativa Online — TALLER de suelos. Esto NO entra al juego todavía.
   Mismo contrato que el motor: put(c,r,glifo,color) y col(familia,luz).

   El suelo del juego se sortea celda por celda: cada celda saca su densidad de
   un hash propio. Eso da estática. La arena de verdad tiene ONDAS, la tierra
   tiene TERRONES y GRIETAS, el pasto crece en MATAS y la nieve se acumula en
   MANCHONES. Todo eso es coherencia espacial, y un hash por celda no la tiene.
   Acá la densidad sale de un ruido suave de dos octavas en coordenadas de
   celda, más lo que cada material tenga de propio. */
(function(global){
const T={};
function h3(a,b,c){
  let x=((a|0)*374761393+((b|0)*668265263)+((c|0)*2246822519))>>>0;
  x=((x^(x>>>13))*1274126177)>>>0;
  return ((x^(x>>>16))>>>0)&0x7fffffff;
}
const r01=(a,b,c)=>(h3(a,b,c)%1000)/1000;
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
/* ruido suave de dos dimensiones, por interpolación de esquinas */
function ruido(s,x,y){
  const i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j;
  const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=r01(s+i,j,41), b=r01(s+i+1,j,41);
  const c=r01(s+i,j+1,41), d=r01(s+i+1,j+1,41);
  return (a+(b-a)*ux)+((c+(d-c)*ux)-(a+(b-a)*ux))*uy;
}
const ruido2=(s,x,y,e)=>0.66*ruido(s,x/e,y/e)+0.34*ruido(s+7,x/(e*0.42),y/(e*0.42));
const pick=(ramp,t)=>ramp[clamp(Math.round(t*(ramp.length-1)),0,ramp.length-1)];

/* ---------- los materiales ----------
   ramp va de ralo a tupido; el extremo ralo ". ," se comparte y la identidad
   vive en el denso, como manda la regla 3. */
const SUELO={
 /* --- pasto --- */
 'pasto-ralo':   {n:'Pasto corto ralo, de suelo seco', clase:'pasto', largo:0,
                  fam:'verde', fam2:'verde', mata:0.42, altoM:[0.10,0.26],
                  alfombra:0.30, base:'tierra'},
 'pasto-parejo': {n:'Pasto corto parejo, del claro', clase:'pasto', largo:0,
                  fam:'verde', fam2:'verde', mata:0.72, altoM:[0.13,0.34],
                  alfombra:0.52},
 'pasto-vega':   {n:'Pasto corto tupido, de la vega', clase:'pasto', largo:0,
                  fam:'musgo', fam2:'verde', mata:0.94, altoM:[0.16,0.40],
                  alfombra:0.74},
 'largo-viento': {n:'Pasto largo al viento', clase:'pasto', largo:1,
                  fam:'verdeO', fam2:'verde', mata:0.70, altoM:[0.45,1.25],
                  alfombra:0.40, viento:1.3},
 'largo-quieto': {n:'Pasto largo quieto', clase:'pasto', largo:1,
                  fam:'verdeO', fam2:'verde', mata:0.70, altoM:[0.45,1.25],
                  alfombra:0.40, viento:0},
 'largo-vega':   {n:'Pasto largo muy alto, de la vega', clase:'pasto', largo:1,
                  fam:'verdeO', fam2:'musgo', mata:0.92, altoM:[0.70,1.70],
                  alfombra:0.52, viento:0.5},
 /* --- pasto nevado: lo que manda es cuánto manto hay --- */
 'nieve-primera':{n:'Primera nevada: las briznas asoman', clase:'nieve',
                  fam:'nieve', fam2:'verde', manto:0.42, altoM:[0.30,0.80]},
 'nieve-manto':  {n:'Manto parejo', clase:'nieve',
                  fam:'nieve', fam2:'verde', manto:0.86, altoM:[0.30,0.80]},
 'nieve-manchon':{n:'Derretido a manchones', clase:'nieve',
                  fam:'nieve', fam2:'verde', manto:0.55, parche:1, altoM:[0.30,0.80]},
 /* --- pasto seco --- */
 'seco-amarillo':{n:'Pasto seco amarillento', clase:'pasto', largo:1,
                  fam:'hoja', fam2:'hoja', mata:0.66, altoM:[0.35,0.95],
                  alfombra:0.42, viento:0.8, tendido:0.5},
 'seco-calvas':  {n:'Quemado por el sol, con calvas', clase:'pasto', largo:1,
                  fam:'hoja', fam2:'arena', mata:0.40, altoM:[0.30,0.80],
                  alfombra:0.26, viento:0.8, tendido:0.6, base:'tierra'},
 'seco-tendido': {n:'Pisado y tendido', clase:'pasto', largo:1,
                  fam:'hoja', fam2:'hoja', mata:0.58, altoM:[0.20,0.50],
                  alfombra:0.60, viento:0.4, tendido:1.5},
 /* --- arena --- */
 'arena-rio':    {n:'Arena de río, fina, con ondas cortas', clase:'arena',
                  fam:'arena', ramp:['.','.',':','\u00b0',';'],
                  onda:{largo:0.8, angulo:0.0, fuerza:0.62}},
 'arena-duna':   {n:'Arena de duna, ondas largas', clase:'arena',
                  fam:'arena', ramp:['.','.',':',';',';'],
                  onda:{largo:2.6, angulo:0.42, fuerza:0.74}},
 'arena-mar':    {n:'Arena de mar, mojada', clase:'arena',
                  fam:'roca2', ramp:['.',':','\u00b0','=','='], mojada:1,
                  onda:{largo:1.6, angulo:0.10, fuerza:0.34}},
 /* --- tierra --- */
 'tierra-suelta':{n:'Tierra suelta', clase:'tierra',
                  fam:'tierra', ramp:['.',',','-','_','='],
                  terron:0.48, grieta:0},
 'tierra-sendero':{n:'Tierra apisonada del sendero', clase:'tierra',
                  fam:'tierra', ramp:['.','.',',','-','_'],
                  terron:0.18, grieta:0, pisada:1},
 'tierra-terrones':{n:'Tierra con terrones y grietas', clase:'tierra',
                  fam:'tierra', ramp:['.',',','-','=','#'],
                  terron:0.70, grieta:1.0},
 /* --- barro --- */
 'barro-fresco': {n:'Barro fresco, brilloso', clase:'barro',
                  fam:'tierra', ramp:[':','-','=','~','='],
                  charco:0.62, brillo:1, costra:0},
 'barro-seco':   {n:'Barro seco y agrietado', clase:'barro',
                  fam:'tierra', ramp:['.',',','-','=','#'],
                  charco:0.08, brillo:0, costra:1.0},
 'barro-pisado': {n:'Barro pisoteado, con charcos', clase:'barro',
                  fam:'tierra', ramp:[':',',','-','=','~'],
                  charco:0.40, brillo:1, costra:0.4, pisada:1}
};

/* ---------- las dos costas ----------
   Una costa no es un material: es una SECUENCIA. Lo que hay que juzgar es el
   orden de las bandas y cómo se tocan, no cada banda por separado. */
const COSTAS={
 rio:{n:'Costa de río', bandas:[
   {m:'agua-honda', an:1.6}, {m:'agua-corriente', an:2.0}, {m:'agua-somera', an:1.2},
   {m:'arena-mar', an:0.9}, {m:'arena-rio', an:1.8}, {m:'guijarral', an:1.6},
   {m:'pasto-vega', an:1.4}, {m:'largo-vega', an:2.0}]},
 mar:{n:'Costa de mar', bandas:[
   {m:'mar-honda', an:2.2}, {m:'espuma', an:2.0}, {m:'arena-mar', an:1.8},
   {m:'arena-duna', an:2.4}, {m:'guijarral-grueso', an:1.6},
   {m:'seco-amarillo', an:1.6}, {m:'pasto-parejo', an:1.6}]}
};
/* los materiales que sólo viven en las costas */
const EXTRA={
 'agua-honda':     {n:'agua honda', clase:'agua', fam:'honda', ramp:['~','=','_','_','_'], luzMul:0.62, flujo:'y'},
 'agua-corriente': {n:'corriente',  clase:'agua', fam:'agua',  ramp:['-','~','~','=','~'], luzMul:1.00, flujo:'y'},
 'agua-somera':    {n:'agua somera',clase:'agua', fam:'agua',  ramp:[' ','.','-','~','-'], luzMul:1.22, flujo:'y'},
 'mar-honda':      {n:'mar abierto',clase:'agua', fam:'honda', ramp:['~','=','_','_','_'], luzMul:0.58, flujo:'x', ola:1},
 'espuma':         {n:'la rompiente',clase:'espuma',fam:'espuma',ramp:['-','~','=','*','#'], luzMul:1.25},
 'guijarral':      {n:'guijarral',  clase:'guija', fam:'piedra', ramp:['.',':','\u00b0','o','c'], calibre:0.5},
 'guijarral-grueso':{n:'canto rodado de mar', clase:'guija', fam:'piedra', ramp:[':','\u00b0','o','c','O'], calibre:1}
};
for(const k in EXTRA) SUELO[k]=EXTRA[k];

/* ---------- dibujo ---------- */
/* G = {CPM, RPM, HPM, c0, r0}: c0/r0 es la esquina de arriba a la izquierda.
   Se dibuja de norte a sur, como el motor: lo de más al sur tapa. */
T.pintarMetro=function(clave,G,put,col,mx,my,luz,t){
  const m=SUELO[clave];
  if(!m) return;
  const CPM=G.CPM, RPM=G.RPM, HPM=G.HPM;
  const sem=clave.length*613+clave.charCodeAt(0)*7;
  const baseC=G.c0+(mx-G.mx0)*CPM, baseR=G.r0+(my-G.my0+1)*RPM-1;
  const top=baseR-(RPM-1);

  /* --- lo que se rellena celda por celda: arena, tierra, barro, agua, guija --- */
  if(m.clase!=='pasto'&&m.clase!=='nieve'){
    for(let sy=0;sy<RPM;sy++) for(let k=0;k<CPM;k++){
      const cx=mx*CPM+k, cy=my*RPM+sy;
      let d=0.42+0.52*ruido2(sem,cx,cy,7);        // el manchón de fondo
      let fam=m.fam, lz=luz*(m.luzMul||1), g=null;
      if(m.clase==='arena'){
        /* La onda: una sinusoide en la dirección del viento o de la corriente,
           con la cresta corrida por el ruido para que no salga peinada. El largo
           va en METROS y hay que pasarlo a celdas: puesto en celdas daba un
           período de dos caracteres, que no se lee como onda sino como
           alternancia. Y la coordenada norte-sur se escala, porque un metro a
           lo alto son RPM filas y a lo ancho CPM columnas. */
        const O=m.onda, ca=Math.cos(O.angulo), sa=Math.sin(O.angulo);
        const lc=O.largo*CPM;
        const u=(cx*ca+cy*(CPM/RPM)*sa)/lc + ruido2(sem+3,cx,cy,11)*0.9;
        const cr=0.5+0.5*Math.sin(u*6.283);
        d=clamp(0.30+Math.pow(cr,1.5)*O.fuerza+ruido2(sem+5,cx,cy,4)*0.22,0,1);
        if(m.mojada){ lz*=0.78; if(cr>0.93&&(h3(cx,cy,9)%7)===0){ g='-'; lz*=1.5; } }
      } else if(m.clase==='tierra'){
        const te=ruido2(sem+11,cx,cy,3.2);
        d=clamp(0.18+te*m.terron*0.92+ruido2(sem+13,cx,cy,9)*0.26,0,1);
        if(m.pisada) d=clamp(d*0.62+0.14,0,1);
        if(m.grieta){
          /* La grieta corre por donde el ruido pasa justo por el medio: ahí es
             una línea fina. El umbral tiene que ser chico; con 0,06 la grieta
             tomaba una celda de cada diez y la tierra quedaba enrejada. */
          const gq=Math.abs(ruido2(sem+17,cx,cy,5.0)-0.5);
          if(gq<0.016*m.grieta && te>0.42){ g='|'; lz*=0.34; }
        }
      } else if(m.clase==='barro'){
        const ch=ruido2(sem+19,cx,cy,4.4);
        const enCharco=ch<m.charco;
        d=clamp(enCharco?0.72+ch*0.5:0.28+ch*0.46,0,1);
        if(enCharco){ lz*=m.brillo?1.34:0.82; if(m.brillo&&(h3(cx,cy,23)%11)===0){ g='~'; lz*=1.5; } }
        else if(m.costra){
          /* la costra del barro seco se parte en placas: la misma línea fina */
          const gq=Math.abs(ruido2(sem+29,cx,cy,3.0)-0.5);
          if(gq<0.020*m.costra){ g='|'; lz*=0.30; }
        }
        if(m.pisada&&(h3((cx/3)|0,(cy/2)|0,31)%17)===0){ d=1; lz*=0.70; }
      } else if(m.clase==='agua'){
        const este=m.flujo==='x';
        const fase=este?cx*0.09:cy*0.26;
        const rip=0.5+0.5*Math.sin(t*2.2-fase+(este?sy*0.3:k*0.05));
        d=clamp(0.30+rip*0.65,0,1);
        if(m.ola){ const ol=0.5+0.5*Math.sin(t*0.9-cy*0.5); d=clamp(d*(0.6+ol*0.7),0,1); }
      } else if(m.clase==='espuma'){
        const rip=0.5+0.5*Math.sin(t*2.6-cx*0.20+sy*0.45);
        d=clamp(0.14+Math.pow(rip,2.4)*1.35,0,1);
      } else if(m.clase==='guija'){
        /* el canto se calibra: cerca del agua chico, lejos grueso */
        const gr=ruido2(sem+37,cx,cy,2.6);
        d=clamp(0.18+gr*(0.55+m.calibre*0.55),0,1);
      }
      if(!g) g=pick(m.ramp,d);
      if(g!==' ') put(baseC+k,top+sy,g,col(fam,clamp(lz*(0.86+d*0.30),0,1.4)),m.clase);
    }
    return;
  }

  /* --- pasto y nieve: matas, no alfombra pareja --- */
  const esNieve=m.clase==='nieve';
  /* cuánta mata hay en este metro: un ruido suave, para que el pasto crezca a
     parches y no parejo como una cancha */
  const densMata=esNieve?1:clamp(m.mata*(0.45+1.05*ruido2(sem+41,mx*3,my*3,2.2)),0,1.3);
  for(let sy=0;sy<RPM;sy++){
    const rb=top+sy;
    if(esNieve){
      /* el manto: cuánto cubre, y por dónde asoma lo de abajo */
      for(let k=0;k<CPM;k++){
        const cx=mx*CPM+k, cy=my*RPM+sy;
        const cu=m.parche ? ruido2(sem+43,cx,cy,5.5) : ruido2(sem+43,cx,cy,12);
        const cubre=cu<m.manto;
        const d=clamp(0.3+ruido2(sem+47,cx,cy,3)*0.8,0,1);
        if(cubre) put(baseC+k,rb,d>0.72?'*':(d>0.4?'\u00b0':'.'),
                      col('nieve',luz*(0.92+d*0.36)),'nieve');
        else if((h3(cx,cy,53)%100)<34)
          put(baseC+k,rb,'\u00b0',col('verdeO',luz*0.72),'asoma');
      }
    } else if(m.base&&(h3(mx*7+sy,my*11,57)%100)<28){
      /* la tierra que se ve entre las matas ralas */
      for(let k=0;k<CPM;k+=1){
        const cx=mx*CPM+k, cy=my*RPM+sy;
        if(ruido2(sem+59,cx,cy,4)>0.52) continue;
        put(baseC+k,rb,pick(['.',',','-'],ruido2(sem+61,cx,cy,3)),
            col('tierra',luz*0.80),'base');
      }
    }
    if(!esNieve){
      /* la alfombra: lo que se ve del pasto bajo, repartido en toda la franja */
      for(let k=0;k<CPM;k+=2){
        const cx=mx*CPM+k, cy=my*RPM+sy;
        if(ruido2(sem+67,cx,cy,3.4)*densMata < 0.34) continue;
        put(baseC+k,rb,m.largo?'|':'\u00b0',col(m.fam,luz*0.94),'alfombra');
      }
    }
    /* las briznas */
    const nPer=Math.max(2,Math.round(CPM*(m.largo||esNieve?0.15:0.09)));
    const n=Math.round(nPer*clamp(0.45+densMata*0.75,0.2,1.5));
    const colT=col(m.fam2||m.fam,luz*1.12), colM=col(m.fam,luz*0.95);
    for(let b=0;b<n;b++){
      const hb=h3(mx*997+b,my*131+sy*37,7);
      const c0=baseC+((hb%(CPM*8))/8|0);
      const mA=m.altoM[0]+(((hb>>5)%100)/100)*(m.altoM[1]-m.altoM[0]);
      const alto=Math.max(2,Math.round(mA*HPM));
      const propio=((((hb>>9)%9)-4)/4)*0.95;
      const lean=clamp(propio-(m.viento||0)*0.70+(m.tendido||0)*((hb>>13)%2?1:-1),-2.4,2.4);
      const span=Math.max(1,alto-1);
      for(let r=0;r<alto;r++){
        const f=r/span, dx=Math.round(lean*(f*f*0.62+f*0.38)*alto*0.55);
        const tip=(r===alto-1);
        let g;
        if(m.largo||esNieve){
          if(Math.abs(lean)<0.26) g='|';
          else g=(r>0)?(lean<0?'\\':'/'):'|';
        } else g=tip?'*':'\u00b0';
        put(c0+dx,rb-r,g,tip?colT:colM,'brizna');
      }
    }
  }
};
T.SUELO=SUELO; T.COSTAS=COSTAS;
global.NVS=T;
})(typeof window!=='undefined'?window:global);
if(typeof module!=='undefined') module.exports=global.NVS||NVS;
