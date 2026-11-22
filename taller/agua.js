/* Nativa Online — TALLER de agua. Esto NO entra al juego todavía.

   El agua no es una textura: es una SUPERFICIE CON ALTURA. Todo sale de un
   campo de olas —la suma de dos o tres sinusoides que viajan, más ruido— y de
   ahí se deducen las tres cosas que hacen que se lea como agua:

     la ALTURA elige el glifo (cresta tupida, valle liso),
     la PENDIENTE hacia el este decide dónde pega el reflejo del sol,
     y la ESPUMA aparece donde la cresta es alta Y empinada a la vez.

   El reflejo es lo que más vende el agua. Sin él, cualquier campo de ondas
   parece una tela corrugada.

   La función que importa es celda(estado, wx, wy, t): recibe una posición del
   mundo en METROS FRACCIONARIOS, no en celdas ni en metros enteros. Eso es a
   propósito: así el mismo código sirve para pintar por metro, como hace el
   motor hoy, y para pintar celda por celda, que es lo que hace falta para que
   una orilla curva no salga como una escalera. */
(function(global){
const T={};
function h3(a,b,c){
  let x=((a|0)*374761393+((b|0)*668265263)+((c|0)*2246822519))>>>0;
  x=((x^(x>>>13))*1274126177)>>>0;
  return ((x^(x>>>16))>>>0)&0x7fffffff;
}
const r01=(a,b,c)=>(h3(a,b,c)%1000)/1000;
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function ruido(s,x,y){
  const i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j;
  const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=r01(s+i,j,41), b=r01(s+i+1,j,41);
  const c=r01(s+i,j+1,41), d=r01(s+i+1,j+1,41);
  const ab=a+(b-a)*ux, cd=c+(d-c)*ux;
  return ab+(cd-ab)*uy;
}

/* ---------- los ocho estados ----------
   olas  : cada una con su largo en metros, su dirección en radianes (0 = hacia
           el este), su velocidad en metros por segundo y su amplitud
   prof   : qué familia de color le toca, de somera a honda
   espuma: a partir de qué altura de cresta rompe
   brillo: cuánto reflejo deja; el mar en calma espeja, el revuelto no
   quiebre: cuánto rompe el ruido la forma de la ola (una piedra, una orilla) */
const AGUA={
 'tranquila':{n:'Agua tranquila', fam:'agua', famH:'honda', hondo:0.30,
   olas:[{largo:5.0,dir:0.30,vel:0.22,amp:0.55},{largo:2.1,dir:1.40,vel:0.15,amp:0.30}],
   espuma:9, brillo:1.35, quiebre:0.10, rampa:['_','_','-','-','~']},
 'riachuelo':{n:'Riachuelo', fam:'agua', famH:'agua', hondo:0.05,
   olas:[{largo:0.75,dir:0.08,vel:1.35,amp:0.70},{largo:0.30,dir:-0.30,vel:1.80,amp:0.45}],
   espuma:0.74, brillo:0.85, quiebre:0.85, rampa:['.','-','~','~','=']},
 'rio':{n:'Río', fam:'agua', famH:'agua', hondo:0.35,
   olas:[{largo:2.2,dir:0.04,vel:0.95,amp:0.60},{largo:0.8,dir:0.30,vel:1.25,amp:0.34}],
   espuma:0.90, brillo:1.00, quiebre:0.35, rampa:['-','~','~','=','=']},
 'rio-profundo':{n:'Río profundo', fam:'honda', famH:'honda', hondo:0.85,
   olas:[{largo:4.0,dir:0.02,vel:0.55,amp:0.45},{largo:1.5,dir:0.40,vel:0.70,amp:0.22}],
   espuma:9, brillo:0.70, quiebre:0.12, rampa:['_','_','=','=','~']},
 'mar-calma':{n:'Mar en calma', fam:'honda', famH:'honda', hondo:0.70,
   olas:[{largo:14.0,dir:1.55,vel:1.60,amp:0.70},{largo:3.0,dir:1.20,vel:0.70,amp:0.22}],
   espuma:9, brillo:1.45, quiebre:0.08, rampa:['_','_','-','-','~']},
 'mar-olas':{n:'Mar con olas', fam:'honda', famH:'honda', hondo:0.62,
   olas:[{largo:9.0,dir:1.57,vel:2.30,amp:1.00},{largo:3.2,dir:1.30,vel:1.30,amp:0.40},
         {largo:1.1,dir:1.80,vel:1.10,amp:0.18}],
   espuma:0.82, brillo:1.05, quiebre:0.30, rampa:['-','~','~','=','=']},
 'mar-tormenta':{n:'Mar con tormenta', fam:'honda', famH:'honda', hondo:0.55,
   olas:[{largo:7.0,dir:1.57,vel:3.40,amp:1.25},{largo:2.6,dir:1.05,vel:2.40,amp:0.75},
         {largo:0.9,dir:2.10,vel:2.00,amp:0.40}],
   espuma:0.60, brillo:0.55, quiebre:0.80, rampa:['~','=','=','#','#'], rocio:1},
 'rompiente':{n:'La rompiente', fam:'espuma', famH:'espuma', hondo:0.10,
   olas:[{largo:6.0,dir:1.57,vel:2.60,amp:1.10},{largo:1.4,dir:1.40,vel:1.60,amp:0.50}],
   espuma:0.30, brillo:1.20, quiebre:0.70, rampa:['-','~','=','*','#']}
};

/* ---------- una celda de agua ----------
   wx, wy en metros del mundo, fraccionarios. t en segundos. */
const _out={g:'~',fam:'agua',lz:1};
T.celda=function(clave,wx,wy,t){
  const A=AGUA[clave];
  if(!A) return null;
  let h=0, dx=0, dy=0, amp=0;
  for(let i=0;i<A.olas.length;i++){
    const o=A.olas[i];
    const kx=Math.cos(o.dir)/o.largo, ky=Math.sin(o.dir)/o.largo;
    /* el frente se desordena con ruido: una ola perfecta se lee como corrugado */
    const des=A.quiebre?(ruido(i*31+7,wx/2.4,wy/2.4)-0.5)*A.quiebre*1.7:0;
    const f=(wx*kx+wy*ky-t*o.vel/o.largo+des)*6.28318;
    h+=Math.sin(f)*o.amp;
    /* la pendiente: la derivada de la misma suma */
    const c=Math.cos(f)*o.amp*6.28318;
    dx+=c*kx; dy+=c*ky;
    amp+=o.amp;
  }
  h/=amp;                                           // -1 a 1
  const pend=Math.hypot(dx,dy)/amp;
  const subida=h*0.5+0.5;                           // 0 valle, 1 cresta
  let g, fam=A.hondo>0.55?A.famH:A.fam, lz;
  /* el color: la cresta aclara, el valle oscurece */
  lz=(0.46+0.70*subida)*(1.12-A.hondo*0.46);
  /* la espuma: alta y empinada a la vez. Sólo alta da una tela corrugada. */
  const rompe = subida>A.espuma && dx>0;
  if(rompe){
    g=(h3((wx*7)|0,(wy*7)|0,3)%3)?'*':'#';
    fam='espuma'; lz=1.05+0.30*subida;
  } else {
    g=A.rampa[clamp(Math.round(subida*(A.rampa.length-1)),0,A.rampa.length-1)];
  }
  /* el reflejo del sol, que entra del este: pega donde la cara mira al este y
     está parada. Es lo que más vende el agua; sin él es una tela corrugada. */
  if(!rompe && A.brillo){
    const cara=dx/(pend+0.001);
    const esp=clamp(cara,0,1)*clamp(pend*0.9,0,1)*A.brillo;
    if(esp>0.62 && (h3((wx*11)|0,(wy*11)|0,5)%100)<58){
      g = esp>0.95?'*':'°';
      fam='espuma'; lz=1.00+esp*0.42;
    }
  }
  /* rocío: el viento arranca agua de la cresta y la tira por arriba */
  if(A.rocio && subida>0.80 && (h3((wx*13)|0,(wy*13)|0,7)%100)<16){
    g='\''; fam='espuma'; lz=1.25;
  }
  _out.g=g; _out.fam=fam; _out.lz=lz;
  return _out;
};
T.AGUA=AGUA;
T.ruido=ruido; T.h3=h3; T.r01=r01;
global.NVA=T;
})(typeof window!=='undefined'?window:global);
if(typeof module!=='undefined') module.exports=global.NVA||NVA;
