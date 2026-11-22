/* Nativa Online — lienzo: grilla, capas y volcado.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- canvas ---------- */
/* El paso de la grilla es MENOR que el tamaño del glifo: los caracteres se
   solapan y dejan de leerse como letras sueltas. OVX/OVY controlan cuánto. */
const OVX=0.70, OVY=0.54;
const ASPECTO=OVY/(0.6*OVX);          // alto de celda respecto del ancho
const METROS_MIN=9, METROS_MAX=72;    // cuánto mundo entra a lo ancho
/* Cuánto se puede alejar depende del ancho real de la pantalla: en un teléfono
   vertical, pedir 72 metros dejaría cada metro en cinco píxeles y las letras en
   dos. El tope se calcula para que el carácter nunca baje de ~2,7 px de ancho. */
function metrosMaximos(anchoPx){ return clamp(anchoPx/(4*2.7), 18, METROS_MAX); }
/* Cuánto mundo entra a lo ancho al empezar. El detalle de cualquier cosa son
   las celdas que ocupa, y las celdas son su tamaño en pantalla: a 28 metros el
   personaje medía doce filas de las cuarenta y cinco que tiene dibujadas. A 21
   mide diecisiete, que es un 40% más de celdas en cada eje. */
let metrosVista=21, metrosDestino=21;

/* El zoom no cambia el tamaño de la letra: cambia cuántas letras entran en un
   metro. Así se puede parar en cualquier punto entre el mínimo y el máximo sin
   saltos de escala, y el carácter se ve siempre igual de grande.

   Dos cuidados para que no se sientan escalones:

   CPM y RPM tienen que ser enteros —son cuántos caracteres se escriben por
   metro—, pero lo que el ojo mide es cuántos píxeles ocupa un metro, y eso sí
   puede ser continuo. El error está en que la ALTURA de celda estaba atada al
   ancho: cuando RPM pasaba de 2 a 3, el metro pasaba de medir dos filas a medir
   tres y el terreno se estiraba un 50% en un solo cuadro. Después 3→4 era 33%,
   4→5 era 25%; al alejarse esos saltos caen uno encima del otro. Ahora la altura
   de celda se calcula al revés —a partir de los píxeles por metro y dividida por
   RPM—, así la escala vertical del mundo es continua y lo que cambia con el
   redondeo es cuánto se solapan las letras, que es textura y no geometría.

   Y CPM se elige con histéresis: justo en el límite entre dos valores, el
   redondeo iba y venía cuadro a cuadro y la textura titilaba. */
const TILT=ASPECTO/3;          // píxeles verticales por metro, respecto de los horizontales
const HIST=0.18;               // cuánto hay que pasarse para que CPM cambie
function aplicarEscala(anchoPx){
  const tope=metrosMaximos(anchoPx);
  if(metrosDestino>tope) metrosDestino=tope;
  if(metrosVista>tope) metrosVista=tope;
  const pxm=anchoPx/metrosVista;                       // píxeles por metro
  const ideal=clamp(pxm/3.2,6,48);
  if(!CPM || ideal<CPM-0.5-HIST || ideal>CPM+0.5+HIST) CPM=clamp(Math.round(ideal),6,48);
  cw=pxm/CPM;
  RPM=Math.max(2,Math.round(CPM/3));                   // la inclinación de la cámara
  chh=pxm*TILT/RPM;
  HPM=RPM*1.7;
  fontSize=cw/(0.6*OVX);
}
function zoomAbsoluto(m){
  const tope=metrosMaximos(($('stage')||{clientWidth:1200}).clientWidth||1200);
  metrosDestino=clamp(m,METROS_MIN,tope);
}
function zoomRelativo(f){ zoomAbsoluto(metrosDestino*f); }
function layout(){
  const st=$('stage');
  dpr=Math.min(2,window.devicePixelRatio||1);
  const w=st.clientWidth,h=st.clientHeight;
  cv.width=Math.max(1,Math.floor(w*dpr)); cv.height=Math.max(1,Math.floor(h*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  aplicarEscala(w);
  ctx.font=fontSize+'px '+MONO; ctx.textBaseline='middle'; ctx.textAlign='center';
  cols=Math.max(20,Math.floor(w/cw)+2); rowsN=Math.max(12,Math.floor(h/chh)+2);
  if(cols*rowsN>150000){ const k=Math.sqrt(150000/(cols*rowsN)); cols=Math.floor(cols*k); rowsN=Math.floor(rowsN*k); }
  /* el zoom llama acá en cada cuadro: no reservar memoria si el tamaño no cambió */
  if(!fbG || fbG.length!==cols*rowsN){
    fbG=new Uint16Array(cols*rowsN); fbC=new Int32Array(cols*rowsN); fbL=new Uint8Array(cols*rowsN);
  }
  animMsBase = cols*rowsN>90000?340:cols*rowsN>45000?240:160;
  if(animMs!==animMsBase && !(NV.cielo&&NV.cielo.clima&&NV.cielo.clima.tormenta)){
    animMs=animMsBase; restartAnim();
  }
}


/* El calor de un fuego sobre el OBJETO que se está dibujando. Se activa con
   NV.tinteFuego(k, filaDeLaBase) antes de dibujarlo y se apaga después, y
   entonces cada glifo que escribe recibe su parte de naranja. Una hoguera al
   nivel del suelo alumbra el pie de un tronco, no la copa: a la altura
   TINTE_ALT el calor ya vale la mitad y sigue cayendo con el cuadrado. */
let tK=0, tBr=0;
const TINTE_ALT=1.8;                       // metros
NV.tinteFuego=(k,filaBase)=>{ tK=k||0; tBr=filaBase||0; };
function put(c,r,code,col){
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  const i=r*cols+c;
  if(fbG[i]&&fbL[i]>layer) return;
  if(tK){
    const h=(tBr-r)/HPM, q=h>0?h/TINTE_ALT:0, k=tK/(1+q*q);
    if(k>0.02){
      const w=k>1.2?1.2:k;
      col=packc(((col>>16)&255)+168*w, ((col>>8)&255)+84*w, (col&255)+22*w);
    }
  }
  fbG[i]=code; fbC[i]=col; fbL[i]=layer;
}
const packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
/* El multiplicador tiene techo. step() ya elige el escalón más claro de la
   familia cuando la luz pasa de uno; si además se sigue multiplicando, el color
   se va a blanco y se pierde todo el dibujo. Pasaba con la cara iluminada de
   las rocas, que llegaba a 1,67. */
const TECHO=1.18;
const packs=(fam,s,calor)=>{
  const c=step(fam,s), m=0.72+(s>TECHO?TECHO:s)*0.5, L=NV.luz;
  let r=c[0]*m*L.r, g=c[1]*m*L.g, b=c[2]*m*L.b;
  if(calor){ const k=Math.min(1.2,calor); r+=168*k; g+=84*k; b+=22*k; }
  return packc(r,g,b);
};

function flush(){
  const Wp=cv.width/dpr,Hp=cv.height/dpr;
  const L=NV.luz;
  ctx.fillStyle='rgb('+Math.round(5*L.r+2)+','+Math.round(7*L.g+2)+','+Math.round(10*L.b+3)+')';
  ctx.fillRect(0,0,Wp,Hp);
  ctx.font=fontSize+'px '+MONO;
  ctx.save();
  ctx.translate(NV.desplaceX||0, NV.desplaceY||0);
  /* los fondos de los sprites van antes que todas las letras */
  for(let i=0;i<nArte;i+=2){
    const p=fArte[i], col=fArte[i+1];
    const r=(p/cols)|0, c=p-r*cols;
    ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
    ctx.fillRect(c*cw, r*chh, cw+0.6, chh+0.6);
  }
  nArte=0;
  const adv=ctx.measureText('W').width;
  const canRun = ('letterSpacing' in ctx);
  if(canRun){ ctx.textAlign='left'; ctx.letterSpacing=(cw-adv).toFixed(2)+'px'; }
  const x0=canRun?(cw-adv)/2:cw/2;
  for(let L=0;L<4;L++){
    for(let r=0;r<rowsN;r++){
      let start=-1, col=0, buf='';
      const y=r*chh+chh/2;
      for(let c=0;c<=cols;c++){
        const i=r*cols+c, ok=c<cols&&fbG[i]&&fbL[i]===L;
        if(ok&&(start<0||fbC[i]===col)){
          if(start<0){ start=c; col=fbC[i]; buf=''; }
          buf+=String.fromCharCode(fbG[i]);
          continue;
        }
        if(start>=0){
          ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
          if(canRun) ctx.fillText(buf,start*cw+x0,y);
          else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],(start+q)*cw+x0,y);
          start=-1;
        }
        if(ok){ start=c; col=fbC[i]; buf=String.fromCharCode(fbG[i]); }
      }
    }
  }
  if(canRun){ ctx.textAlign='center'; ctx.letterSpacing='0px'; }
  ctx.restore();
  const amb=clamp(NV.luz.amb,0,1.1);
  const vis=((NV.cielo&&NV.cielo.visibilidad)||1)*(1-((NV.cielo&&NV.cielo.nieblaAqui)||0)*0.55);
  const vista=(0.10+0.26*amb)*vis;                    // de noche se ve mucho menos lejos
  const cierre=Math.min(0.97, 0.95-0.37*amb+(1-vis)*0.35);
  const g=ctx.createRadialGradient(Wp/2,Hp/2,Math.min(Wp,Hp)*vista,Wp/2,Hp/2,Math.max(Wp,Hp)*0.80);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,'+cierre.toFixed(2)+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,Wp,Hp);
}

NV.layout=layout; NV.aplicarEscala=aplicarEscala;
NV.zoomAbsoluto=zoomAbsoluto; NV.zoomRelativo=zoomRelativo;
NV.metrosVista=()=>metrosVista;
NV.CPM=()=>CPM; NV.HPM=()=>HPM;
/* Fondo por celda, sólo para los sprites. El fondo de pantalla entera se
   probó y se descartó por costo; acá son los mil rectángulos de un personaje
   y sin ellos un dibujo hecho de puntos y comas no se ve sobre el negro. */
let fArte=[], nArte=0;
NV.fondoArte=function(c,r,col){
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  fArte[nArte++]=(r*cols+c); fArte[nArte++]=col;
};
/* Para las pruebas: cuántos píxeles ocupa un metro a lo ancho y a lo alto. Son
   las dos cifras que tienen que moverse sin saltos cuando se hace zoom. */
NV.medidas=()=>({metros:metrosVista,CPM:CPM,RPM:RPM,cw:cw,chh:chh,
                 pxmX:CPM*cw, pxmY:RPM*chh, letra:fontSize});
NV.metrosMaximos=metrosMaximos;
/* El zoom se acerca a su destino de a poco: nunca salta. */
/* El acercamiento se amortigua en escala logarítmica, no en metros: pasar de 40
   a 36 metros y de 10 a 9 se siente igual, que es como lo lee el ojo. Antes, con
   un amortiguado lineal, lejos lurcheaba y cerca se arrastraba.
   Y tiene techo de velocidad: por más rápido que se gire la ruedita, el zoom
   nunca avanza más de un 4,5% por cuadro. El destino se acumula igual, así que
   un giro largo se recorre entero pero planeando. */
const ZCAP=0.045;
NV.acercarZoom=function(){
  const d0=Math.log(metrosDestino/metrosVista);
  if(Math.abs(d0)<0.0025){
    if(metrosVista!==metrosDestino){ metrosVista=metrosDestino; layout(); }
    return false;
  }
  metrosVista*=Math.exp(clamp(d0*0.20,-ZCAP,ZCAP));
  layout();
  return true;
}; NV.put=put; NV.flush=flush;
NV.packc=packc; NV.packs=packs;
