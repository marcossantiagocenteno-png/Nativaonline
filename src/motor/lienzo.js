/* Nativa Online — lienzo: grilla, capas y volcado.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- canvas ---------- */
/* El paso de la grilla es MENOR que el tamaño del glifo: los caracteres se
   solapan y dejan de leerse como letras sueltas. OVX/OVY controlan cuánto. */
const OVX=0.70, OVY=0.54;
const ASPECTO=OVY/(0.6*OVX);          // alto de celda respecto del ancho
const METROS_MIN=9, METROS_MAX=72;    // la escala completa: cuánto mundo entra a lo ancho
/* La escala completa es de 9 a 72 metros, pero el jugador sólo recorre del 20 al
   40% de ella. Tan cerca como 9 m la letra se ve como un bloque y tan lejos como
   72 cada cosa queda en un puñado de celdas: ni uno ni otro sirve para jugar.
   El porcentaje se mide en escala LOGARÍTMICA, que es como el ojo lee un zoom
   (pasar de 10 a 9 se siente igual que de 40 a 36): 0% es 9 m, 100% es 72 m. */
/* El zoom estándar sale de la muestra de referencia: ahí una persona mide unos 55 px
   de alto en una pantalla de 1.200 de ancho, que en este motor son 28 metros a lo
   ancho. El jugador sólo puede acercarse o alejarse un 15 % de eso, y nada más. */
const ZOOM_BASE=28, ZOOM_MARGEN=0.15;
const enPorcentaje=m=>Math.log(m/METROS_MIN)/Math.log(METROS_MAX/METROS_MIN);
const ZOOM_CERCA=ZOOM_BASE*(1-ZOOM_MARGEN), ZOOM_LEJOS=ZOOM_BASE*(1+ZOOM_MARGEN);
const ZOOM_USO=[enPorcentaje(ZOOM_CERCA),enPorcentaje(ZOOM_LEJOS)];
const ZOOM_INI=ZOOM_BASE;
/* Cuánto se puede alejar depende del ancho real de la pantalla: en un teléfono
   vertical, pedir 72 metros dejaría cada metro en cinco píxeles y las letras en
   dos. El tope se calcula para que el carácter nunca baje de ~2,7 px de ancho. */
/* En el Modo Dios el zoom es libre: de 9 m (lo más cerca de la escala) a 200 m, para abarcar mucho y editar rápido.
   Fuera del Modo Dios vuelve al margen de siempre. */
const ZOOM_LIBRE_MAX=200; let zoomLibre=false;
function metrosMaximos(anchoPx){ if(zoomLibre) return ZOOM_LIBRE_MAX; return Math.max(ZOOM_CERCA, Math.min(ZOOM_LEJOS, clamp(anchoPx/(4*2.7), 18, METROS_MAX))); }
/* Cuánto mundo entra a lo ancho al empezar. El detalle de cualquier cosa son
   las celdas que ocupa, y las celdas son su tamaño en pantalla: a 28 metros el
   personaje medía doce filas de las cuarenta y cinco que tiene dibujadas. A 21
   mide diecisiete, que es un 40% más de celdas en cada eje. */
let metrosVista=ZOOM_INI, metrosDestino=ZOOM_INI;

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
  metrosDestino=clamp(m,zoomLibre?METROS_MIN:ZOOM_CERCA,tope);
}
NV.zoomLibre=function(b){ zoomLibre=!!b; zoomAbsoluto(metrosDestino); };
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
    fbG=new Uint16Array(cols*rowsN); fbC=new Int32Array(cols*rowsN); fbL=new Uint8Array(cols*rowsN); fbO=new Uint16Array(cols*rowsN);
    fbP=new Uint16Array(cols*rowsN);        // qué objeto escribió cada celda (sólo se llena en Modo Dios)
  }
  if(!colAlza||colAlza.length!==cols) colAlza=new Int16Array(cols);
  animMsBase = cols*rowsN>90000?340:cols*rowsN>45000?240:160;
  if(animMs!==animMsBase){
    animMs=animMsBase; restartAnim();
  }
}


/* El calor de un fuego sobre el OBJETO que se está dibujando. Se activa con
   NV.tinteFuego(k, filaDeLaBase) antes de dibujarlo y se apaga después, y
   entonces cada glifo que escribe recibe su parte de naranja. Una hoguera al
   nivel del suelo alumbra el pie de un tronco, no la copa: a la altura
   TINTE_ALT el calor ya vale la mitad y sigue cayendo con el cuadrado. */
let tK=0, tBr=0;
/* APUNTAR: en Modo Dios cada celda recuerda el objeto que la escribió (0 = ninguno o suelo), para saber
   qué hay bajo el cursor y resaltar su silueta exacta. Apagado cuesta una comparación por celda escrita. */
let pickOn=false, pickId=0;
NV.pick=on=>{ pickOn=!!on; pickId=0; };
const TINTE_ALT=1.8;                       // metros
NV.tinteFuego=(k,filaBase)=>{ tK=k||0; tBr=filaBase||0; };
/* Grabadora: mientras está encendida, cada casilla que escribe put se anota,
   para poder redibujar el objeto espejado en el agua (los reflejos). */
const GMAX=60000;
const gB=new Int32Array(GMAX*4);
let gn=0, gr=false;
NV.grabar=on=>{ gr=!!on; if(on) gn=0; };
NV.grabados={B:gB, n:()=>gn};
function put(c,r,code,col){
  const r0=r;                       // sin alza ni vista: es lo que anota la grabadora
  if(c>=0&&c<cols) r+=liftR-alzaR-(usaCol?colAlza[c]:0);
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  const i=r*cols+c;
  if(fbG[i]&&(fbO[i]>ordR||(fbO[i]===ordR&&fbL[i]>layer))) return;
  if(tK){
    const h=(tBr-r)/HPM, q=h>0?h/TINTE_ALT:0, k=tK/(1+q*q);
    if(k>0.02){
      const w=k>1.2?1.2:k;
      col=packc(((col>>16)&255)+168*w, ((col>>8)&255)+84*w, (col&255)+22*w);
    }
  }
  if(gr&&gn<GMAX){ const q=gn*4; gB[q]=c; gB[q+1]=r0; gB[q+2]=code; gB[q+3]=col; gn++; }
  fbG[i]=code; fbC[i]=col; fbL[i]=layer; fbO[i]=ordR;
  if(pickOn) fbP[i]=pickId;
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

/* El pintor por GPU (motor/pincel.js) hace lo mismo que el de texto de abajo con un atlas de glifos. Si no está activo
   o falla, se usa el de siempre. */
function flushGPU(Wp,Hp,L){
  ctx.font=fontSize+'px '+MONO;
  const adv=ctx.measureText('W').width;
  const g=NV.pincel.pintar({ctx,fbG,fbC,fbL,cols,rows:rowsN,cw,chh,fontSize,mono:MONO,dpr,W:Wp,H:Hp,dx:NV.desplaceX||0,dy:NV.desplaceY||0,adv,
    fArte,nArte,bg:[Math.round(5*L.r+2),Math.round(7*L.g+2),Math.round(10*L.b+3)]});
  nArte=0;
  if(g) ctx.drawImage(g,0,0,Wp,Hp);
}
function flush(){
  const t0=performance.now();
  const Wp=cv.width/dpr,Hp=cv.height/dpr;
  const L=NV.luz;
  let hecho=false;
  if(NV.pincel&&NV.pincel.activo){ try{ flushGPU(Wp,Hp,L); hecho=true; }catch(e){ NV.pincel.apagar(); NV.pincel.motivo='falló al pintar: '+e.message; } }
  if(!hecho) flushTexto(Wp,Hp,L);
  const amb=clamp(NV.luz.amb,0,1.1);
  const vista=0.10+0.26*amb;
  const cierre=Math.min(0.97, 0.95-0.37*amb);
  const g=ctx.createRadialGradient(Wp/2,Hp/2,Math.min(Wp,Hp)*vista,Wp/2,Hp/2,Math.max(Wp,Hp)*0.80);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,'+cierre.toFixed(2)+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,Wp,Hp);
  if(NV.fluidez) NV.fluidez.fase('pintar',performance.now()-t0);
}
function flushTexto(Wp,Hp,L){
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
}

NV.layout=layout; NV.aplicarEscala=aplicarEscala;
NV.zoomAbsoluto=zoomAbsoluto; NV.zoomRelativo=zoomRelativo;
NV.ZOOM={cerca:ZOOM_CERCA, lejos:ZOOM_LEJOS, ini:ZOOM_INI, uso:ZOOM_USO, escala:[METROS_MIN,METROS_MAX]};
/* en qué punto de la escala completa (0 a 1) está un ancho de vista en metros */
NV.zoomPorcentaje=m=>Math.log(m/METROS_MIN)/Math.log(METROS_MAX/METROS_MIN);
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
/* pintor: por defecto el de memoria ('cpu'); ?pincel=texto vuelve al de siempre, ?pincel=gl prueba WebGL */
try{ { const m=/[?&]pincel=(gl|cpu|texto)/.exec(location.search); if(!m||m[1]!=='texto') NV.pincel.iniciar(m?m[1]:'cpu'); } }catch(e){}
NV.packc=packc; NV.packs=packs;
