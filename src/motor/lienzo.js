/* Nativa Online — lienzo: grilla, capas y volcado.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- canvas ---------- */
/* El paso de la grilla es MENOR que el tamaño del glifo: los caracteres se
   solapan y dejan de leerse como letras sueltas. OVX/OVY controlan cuánto. */
const OVX=0.70, OVY=0.54;
let zi=1;
function layout(){
  const st=$('stage');
  dpr=Math.min(2,window.devicePixelRatio||1);
  const w=st.clientWidth,h=st.clientHeight;
  cv.width=Math.max(1,Math.floor(w*dpr)); cv.height=Math.max(1,Math.floor(h*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.font=fontSize+'px '+MONO; ctx.textBaseline='middle'; ctx.textAlign='center';
  const fw=ctx.measureText('W').width;
  cw=Math.max(2,fw*OVX);
  chh=Math.max(2.4,fontSize*OVY);
  cols=Math.max(20,Math.floor(w/cw)); rowsN=Math.max(12,Math.floor(h/chh));
  if(cols*rowsN>150000){ const k=Math.sqrt(150000/(cols*rowsN)); cols=Math.floor(cols*k); rowsN=Math.floor(rowsN*k); }
  fbG=new Uint16Array(cols*rowsN); fbC=new Int32Array(cols*rowsN); fbL=new Uint8Array(cols*rowsN);
  animMsBase = cols*rowsN>90000?340:cols*rowsN>45000?240:160;
  animMs = animMsBase;
  restartAnim();
  draw();
}
function applyLOD(){
  const L=LODS[zi];
  CPM=L.cpm; RPM=L.rpm; HPM=RPM*1.7; fontSize=L.fs;
}
function setZoom(d){
  const v=clamp(zi+d,0,LODS.length-1);
  if(v===zi) return;
  zi=v; applyLOD();
  for(const b of document.querySelectorAll('.zb')) b.classList.toggle('on',+b.dataset.z===zi);
  layout();
}
function put(c,r,code,col){
  if(c<0||r<0||c>=cols||r>=rowsN) return;
  const i=r*cols+c;
  if(fbG[i]&&fbL[i]>layer) return;
  fbG[i]=code; fbC[i]=col; fbL[i]=layer;
}
const packc=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
const packs=(fam,s,calor)=>{
  const c=step(fam,s), m=0.72+s*0.5, L=NV.luz;
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
  const amb=clamp(NV.luz.amb,0,1.1);
  const vis=((NV.cielo&&NV.cielo.visibilidad)||1)*(1-((NV.cielo&&NV.cielo.nieblaAqui)||0)*0.55);
  const vista=(0.10+0.26*amb)*vis;                    // de noche se ve mucho menos lejos
  const cierre=Math.min(0.97, 0.95-0.37*amb+(1-vis)*0.35);
  const g=ctx.createRadialGradient(Wp/2,Hp/2,Math.min(Wp,Hp)*vista,Wp/2,Hp/2,Math.max(Wp,Hp)*0.80);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,'+cierre.toFixed(2)+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,Wp,Hp);
}

NV.layout=layout; NV.setZoom=setZoom; NV.put=put; NV.flush=flush;
NV.packc=packc; NV.packs=packs; NV.applyLOD=applyLOD;
