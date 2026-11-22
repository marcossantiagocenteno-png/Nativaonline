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
let metrosVista=28, metrosDestino=28;

/* El zoom no cambia el tamaño de la letra: cambia cuántas letras entran en un
   metro. Así se puede parar en cualquier punto entre el mínimo y el máximo sin
   saltos de escala, y el carácter se ve siempre igual de grande. */
function aplicarEscala(anchoPx){
  const tope=metrosMaximos(anchoPx);
  if(metrosDestino>tope) metrosDestino=tope;
  if(metrosVista>tope) metrosVista=tope;
  const pxm=anchoPx/metrosVista;                       // píxeles por metro
  CPM=clamp(Math.round(pxm/3.2),6,48);
  cw=pxm/CPM;
  chh=cw*ASPECTO;
  RPM=Math.max(2,Math.round(CPM/3));                   // la inclinación de la cámara
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
    fbG=new Uint16Array(cols*rowsN); fbC=new Int32Array(cols*rowsN);
    fbL=new Uint8Array(cols*rowsN);  fbB=new Int32Array(cols*rowsN);
  }
  animMsBase = cols*rowsN>90000?340:cols*rowsN>45000?240:160;
  if(animMs!==animMsBase && !(NV.cielo&&NV.cielo.clima&&NV.cielo.clima.tormenta)){
    animMs=animMsBase; restartAnim();
  }
}


function put(c,r,code,col){
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  const i=r*cols+c;
  if(fbG[i]&&fbL[i]>layer) return;
  fbG[i]=code; fbC[i]=col; fbL[i]=layer;
}
/* El fondo del suelo se pinta por bloques de un metro, no celda por celda: un
   metro entero es del mismo color, así que un solo rectángulo alcanza y el
   volcado pasa de dieciséis mil rectángulos a unos pocos miles. */
let bloques=[], nBloques=0;
function fondoBloque(c,r,anchoCeldas,altoCeldas,col){
  bloques[nBloques++]=[c,r,anchoCeldas,altoCeldas,col];
}

/* El fondo de la celda: lo que hay detrás de la letra. Es la mitad de la
   información de cada celda y lo que convierte un dibujo de signos sueltos en
   una materia continua. Se guarda como color+1 para que el cero signifique
   "sin fondo". */
function fondo(c,r,col){
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  const i=r*cols+c;
  if(fbB[i]&&fbL[i]>layer) return;
  /* El fondo se redondea a saltos de 12 por canal. No se nota —son colores
     apagados y detrás de una letra— y hace que celdas vecinas compartan color,
     con lo que el volcado los pinta de a tiradas largas en vez de uno por uno.
     Sin esto son veinte mil rectángulos por cuadro; con esto, la cuarta parte. */
  fbB[i]=1+((((col>>16)&255)/12|0)*12<<16 | (((col>>8)&255)/12|0)*12<<8 | ((col&255)/12|0)*12);
}
const packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
/* frio: cuánta de esta celda está en sombra. Una sombra no es sólo oscuridad;
   lo que la llena es la luz del cielo, que es azul. Esto es lo que más hace que
   una imagen deje de verse plana. */
const packs=(fam,s,calor,frio)=>{
  const c=step(fam,s), m=0.72+s*0.5, L=NV.luz;
  let r=c[0]*m*L.r, g=c[1]*m*L.g, b=c[2]*m*L.b;
  if(frio){
    const l=(r+g+b)/3, k=Math.min(0.85,frio);
    r+=(l*0.58-r)*k; g+=(l*0.84-g)*k; b+=(l*1.30-b)*k;
  }
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

  /* primero los bloques de suelo, de un metro cada uno */
  for(let i=0;i<nBloques;i++){
    const b=bloques[i], k=b[4];
    ctx.fillStyle='rgb('+((k>>16)&255)+','+((k>>8)&255)+','+(k&255)+')';
    ctx.fillRect(b[0]*cw, b[1]*chh, b[2]*cw+0.6, b[3]*chh+0.6);
  }

  /* después los fondos de lo que se levanta, en tiradas horizontales */
  for(let r=0;r<rowsN;r++){
    let ini=-1, col=0;
    const y=r*chh;
    for(let c=0;c<=cols;c++){
      const v=c<cols?fbB[r*cols+c]:0;
      if(v&&(ini<0||v===col)){ if(ini<0){ ini=c; col=v; } continue; }
      if(ini>=0){
        const k=col-1;
        ctx.fillStyle='rgb('+((k>>16)&255)+','+((k>>8)&255)+','+(k&255)+')';
        ctx.fillRect(ini*cw, y, (c-ini)*cw+0.6, chh+0.6);
        ini=-1;
      }
      if(v){ ini=c; col=v; }
    }
  }

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
NV.metrosMaximos=metrosMaximos;
/* El zoom se acerca a su destino de a poco: nunca salta. */
NV.acercarZoom=function(){
  if(Math.abs(metrosDestino-metrosVista)<0.02){ metrosVista=metrosDestino; return false; }
  metrosVista += (metrosDestino-metrosVista)*0.24;
  layout();
  return true;
}; NV.put=put; NV.fondo=fondo; NV.fondoBloque=fondoBloque; NV.flush=flush;
NV.packc=packc; NV.packs=packs;
