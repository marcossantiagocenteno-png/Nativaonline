/* Nativa Online — EL PINTOR POR GPU (WebGL).

   Por qué existe: medido en Chrome real, 78 % del tiempo de un cuadro se iba en pintar texto con fillText
   (unos 45 000 tramos por cuadro) y en armar esos tramos. Los motores gráficos suman un 10 %. Este pintor
   hace exactamente lo mismo que el de `flush` (el tablero de celdas que escriben los motores) pero con un
   atlas de glifos y UNA llamada instanciada: cada celda es un rectángulo con su glifo y su color.

   · No toca los motores: leen y escriben el mismo tablero (fbG, fbC, fbL) por `put`.
   · Misma posición que el pintor de texto: el glifo arranca en col·cw + (cw − adv)/2 y se centra en la fila, con
     posiciones FRACCIONARIAS (el desplazamiento y el zoom no saltan de píxel).
   · El atlas se dibuja una vez por tamaño con fillText (la misma fuente) y se escala con filtro lineal; los tamaños
     son escalones de 1,3× como mucho, así que el zoom continuo no cambia la nitidez de golpe.
   · Si el navegador no da WebGL2, o el contexto se pierde, `activo` vuelve a false y `flush` usa el pintor de siempre.
   · Dibuja en un lienzo aparte y `flush` lo copia con un solo drawImage; el resto (viñeta, etc.) sigue igual.
   El orden de pintado es el de siempre: capas 0 a 3, y dentro de cada capa de arriba abajo y de izquierda a derecha.

   DOS modos (NV.pincel.iniciar('cpu'|'gl')):
     · 'cpu'  mezcla en memoria cada glifo desde una lista dispersa de píxeles (atlas con 4 fases horizontales) y sube el
              cuadro con UN putImageData. No depende de la tarjeta de vídeo ni de la aceleración del navegador: es el mismo
              costo en cualquier equipo, y es el que se mide en pruebas.
     · 'gl'   WebGL2 instanciado: una llamada por cuadro; ideal con GPU de verdad, lento si el navegador la emula por software. */
(function(){
'use strict';
const NV=window.NV;
const P=NV.pincel={activo:false,motivo:'sin iniciar',stats:{celdas:0,ms:0,atlas:0,tier:0}};
const TIERS=[10,13,17,22,29,38,50,64];
const SLOTS_X=16, MAX_FILAS=64;
let glc=null, gl=null, prog=null, U={}, vbo=null, vao=null, qbuf=null;
let buf=null, f32=null, u32=null, cap=0;
const atlas=new Map();          // tier → {cv,ctx,tex,gw,gh,pad,filas,slot:Int16Array,n,sucio,adv}
let tierActual=0;

const VS=`#version 300 es
in vec2 q; in vec2 i_pos; in float i_g; in vec4 i_col;
uniform vec2 u_res; uniform vec2 u_size; uniform vec2 u_cell; uniform float u_cols;
out vec2 v_uv; out vec4 v_col;
void main(){
  vec2 p=i_pos+q*u_size;
  gl_Position=vec4(p.x/u_res.x*2.0-1.0, 1.0-p.y/u_res.y*2.0, 0.0, 1.0);
  float gy=floor((i_g+0.5)/u_cols), gx=i_g-gy*u_cols;
  v_uv=(vec2(gx,gy)+q)*u_cell; v_col=i_col;
}`;
const FS=`#version 300 es
precision mediump float;
in vec2 v_uv; in vec4 v_col;
uniform sampler2D u_tex; uniform float u_solid;
out vec4 o;
void main(){
  float a=u_solid>0.5?1.0:texture(u_tex,v_uv).a;
  o=vec4(v_col.rgb*a,a);
}`;
function compilar(t,src){ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

P.iniciar=function(modo){
  P.modo=modo||'cpu';
  if(P.modo==='cpu'){ P.activo=true; P.motivo='activo (CPU, sin depender de la GPU)'; return true; }
  try{
    glc=document.createElement('canvas'); glc.width=glc.height=8;
    gl=glc.getContext('webgl2',{alpha:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!gl){ P.motivo='el navegador no da WebGL2'; return false; }
    prog=gl.createProgram(); gl.attachShader(prog,compilar(gl.VERTEX_SHADER,VS)); gl.attachShader(prog,compilar(gl.FRAGMENT_SHADER,FS));
    gl.bindAttribLocation(prog,0,'q'); gl.bindAttribLocation(prog,1,'i_pos'); gl.bindAttribLocation(prog,2,'i_g'); gl.bindAttribLocation(prog,3,'i_col');
    gl.linkProgram(prog); if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    for(const n of ['u_res','u_size','u_cell','u_cols','u_tex','u_solid']) U[n]=gl.getUniformLocation(prog,n);
    qbuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,qbuf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
    vbo=gl.createBuffer(); vao=gl.createVertexArray();
    glc.addEventListener('webglcontextlost',e=>{ e.preventDefault(); P.activo=false; P.motivo='se perdió el contexto de WebGL'; });
    glc.addEventListener('webglcontextrestored',()=>{ atlas.clear(); P.iniciar(); });
    P.activo=true; P.motivo='activo'; return true;
  }catch(e){ P.activo=false; P.motivo='falló WebGL: '+e.message; return false; }
};
P.apagar=function(){ P.activo=false; P.motivo='apagado'; };

/* el atlas de un tamaño: una cuadrícula de casillas con los glifos blancos sobre transparente */
function atlasDe(tier,mono){
  let A=atlas.get(tier); if(A) return A;
  const pad=Math.ceil(tier*0.14)+1, gw=Math.ceil(tier*0.62)+2*pad, gh=Math.ceil(tier*1.3)+2;
  A={tier,pad,gw,gh,filas:4,slot:new Int16Array(65536).fill(-1),n:1,sucio:true,mono,cv:document.createElement('canvas'),tex:gl.createTexture()};
  A.cv.width=SLOTS_X*gw; A.cv.height=A.filas*gh; A.ctx=A.cv.getContext('2d');
  prepararCtx(A); A.ctx.fillStyle='#fff'; A.ctx.fillRect(0,0,gw,gh);          // la casilla 0 es un bloque sólido (fondos)
  gl.bindTexture(gl.TEXTURE_2D,A.tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  atlas.set(tier,A);
  for(let c=33;c<127;c++) glifo(A,c);                                            // ASCII visible de entrada
  return A;
}
function prepararCtx(A){ const c=A.ctx; c.font=A.tier+'px '+A.mono; c.textBaseline='middle'; c.textAlign='left'; c.fillStyle='#fff'; }
function crecer(A){
  const filas=Math.min(MAX_FILAS,A.filas*2); if(filas===A.filas) return false;
  const v=document.createElement('canvas'); v.width=A.cv.width; v.height=A.cv.height; v.getContext('2d').drawImage(A.cv,0,0);
  A.filas=filas; A.cv.width=SLOTS_X*A.gw; A.cv.height=filas*A.gh; A.ctx=A.cv.getContext('2d'); A.ctx.drawImage(v,0,0); prepararCtx(A); return true;
}
function glifo(A,code){
  let s=A.slot[code]; if(s>=0) return s;
  if(A.n>=SLOTS_X*A.filas&&!crecer(A)) return (A.slot[code]=0);                 // atlas lleno: se dibuja como bloque
  s=A.n++; A.slot[code]=s;
  const x=(s%SLOTS_X)*A.gw, y=((s/SLOTS_X)|0)*A.gh;
  A.ctx.clearRect(x,y,A.gw,A.gh); A.ctx.fillText(String.fromCharCode(code),x+A.pad,y+A.gh/2);
  A.sucio=true; return s;
}
function subir(A){ gl.bindTexture(gl.TEXTURE_2D,A.tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,A.cv); A.sucio=false; }

function reservar(n){
  if(cap>=n) return;
  cap=Math.max(n,cap*2,4096); buf=new ArrayBuffer(cap*16); f32=new Float32Array(buf); u32=new Uint32Array(buf);
}


/* ======================================================= modo CPU ======================================================= */
const FASES=4;
const cpu={tam:0,gw:0,gh:0,pad:0,glifos:new Map(),cv:null,ctx:null,img:null,d32:null,W:0,H:0,mono:''};
const cachesCPU=new Map();
/* Los tamaños de letra se agrupan en escalones geométricos del 3 %: con el zoom continuo la letra cambia cada cuadro, y un
   atlas nuevo por cada medio píxel se reconstruía todo el tiempo (medido: picos de 240 ms al hacer zoom). Con escalones, el
   error de tamaño de la letra es de ±1,5 %, que no se ve, y el mismo atlas sirve a varios cuadros seguidos. */
const PASO_TAM=1.03, TAM0=6;
const escalon=px=>TAM0*Math.pow(PASO_TAM,Math.round(Math.log(Math.max(px,TAM0)/TAM0)/Math.log(PASO_TAM)));
function cpuAtlas(tam,mono){
  const clave=tam+'|'+mono; let A=cachesCPU.get(clave); if(A) return A;
  const pad=Math.ceil(tam*0.14)+2, gw=Math.ceil(tam*0.62)+2*pad+1, gh=Math.ceil(tam*1.3)+2;
  A={tam,pad,gw,gh,mono,mapa:new Map(),dir:new Array(256*FASES).fill(null),cv:null,ctx:null};
  /* se hornea de una vez todo el ASCII visible (94 glifos × 4 fases) en UN lienzo y se lee UNA sola vez */
  const NC=32, n=94*FASES, filas=Math.ceil(n/NC), cv=document.createElement('canvas'); cv.width=NC*gw; cv.height=filas*gh;
  const c=cv.getContext('2d',{willReadFrequently:true}); c.font=tam+'px '+mono; c.textBaseline='middle'; c.textAlign='left'; c.fillStyle='#fff';
  for(let ci=0;ci<94;ci++) for(let f=0;f<FASES;f++){ const k=ci*FASES+f, x=(k%NC)*gw, y=((k/NC)|0)*gh; c.fillText(String.fromCharCode(33+ci),x+pad+f/FASES,y+gh/2); }
  const W=cv.width, d=c.getImageData(0,0,cv.width,cv.height).data;
  for(let ci=0;ci<94;ci++) for(let f=0;f<FASES;f++){
    const k=ci*FASES+f, x0=(k%NC)*gw, y0=((k/NC)|0)*gh, pos=[], alfa=[];
    for(let y=0;y<gh;y++){ let o=((y0+y)*W+x0)*4+3; for(let x=0;x<gw;x++,o+=4){ const a=d[o]; if(a>=6){ pos.push(y*gw+x); alfa.push(a); } } }
    { const g={n:pos.length,pos:Int32Array.from(pos),a:Uint8Array.from(alfa)}; A.mapa.set((33+ci)*FASES+f,g); A.dir[(33+ci)*FASES+f]=g; }
  }
  /* los demás (acentos, bloques…) se piden de a uno cuando aparecen */
  A.cv=document.createElement('canvas'); A.cv.width=gw; A.cv.height=gh; A.ctx=A.cv.getContext('2d',{willReadFrequently:true});
  A.ctx.font=tam+'px '+mono; A.ctx.textBaseline='middle'; A.ctx.textAlign='left'; A.ctx.fillStyle='#fff';
  cachesCPU.set(clave,A); if(cachesCPU.size>48) cachesCPU.delete(cachesCPU.keys().next().value);
  return A;
}
/* un glifo en una fase (0..3 cuartos de píxel a la derecha): lista dispersa [posición, alfa] */
function cpuGlifo(A,code,fase){
  const k=code*FASES+fase; let g=A.mapa.get(k); if(g) return g;
  const c=A.ctx; c.clearRect(0,0,A.gw,A.gh); c.fillText(String.fromCharCode(code),A.pad+fase/FASES,A.gh/2);
  const d=c.getImageData(0,0,A.gw,A.gh).data; const pos=[],alfa=[];
  for(let y=0;y<A.gh;y++) for(let x=0;x<A.gw;x++){ const a=d[(y*A.gw+x)*4+3]; if(a>=6){ pos.push(y*A.gw+x); alfa.push(a); } }
  g={n:pos.length,pos:Int32Array.from(pos),a:Uint8Array.from(alfa)}; A.mapa.set(k,g); if(code<256) A.dir[k]=g; return g;
}
function pintarCPU(T){
  const t0=performance.now(), dpr=T.dpr, Wd=Math.max(1,Math.round(T.W*dpr)), Hd=Math.max(1,Math.round(T.H*dpr)), ctx=T.ctx;
  if(!cpu.img||cpu.W!==Wd||cpu.H!==Hd){ cpu.img=ctx.createImageData(Wd,Hd); cpu.d32=new Uint32Array(cpu.img.data.buffer); cpu.W=Wd; cpu.H=Hd; }
  const d32=cpu.d32, bg=T.bg;
  d32.fill((255<<24)|(bg[2]<<16)|(bg[1]<<8)|bg[0]);
  /* fondos de los sprites */
  for(let j=0;j<T.nArte;j+=2){ const p=T.fArte[j], col=T.fArte[j+1], r=(p/T.cols)|0, c=p-r*T.cols;
    const px=(255<<24)|((col&255)<<16)|(col&0xff00)|((col>>16)&255);
    const x0=Math.max(0,Math.round((c*T.cw+T.dx)*dpr)), x1=Math.min(Wd,Math.round((c*T.cw+T.cw+0.6+T.dx)*dpr));
    const y0=Math.max(0,Math.round((r*T.chh+T.dy)*dpr)), y1=Math.min(Hd,Math.round((r*T.chh+T.chh+0.6+T.dy)*dpr));
    for(let y=y0;y<y1;y++) d32.fill(px,y*Wd+x0,y*Wd+Math.max(x0,x1)); }
  const fontDev=T.fontSize*dpr, tam=escalon(fontDev), A=cpuAtlas(tam,T.mono);
  const x0g=(T.cw-T.adv)/2, {fbG,fbC,fbL,cols,rows}=T, N=cols*rows, gw=A.gw, ghalf=A.gh/2, pad=A.pad;
  let celdas=0;
  for(let L=0;L<4;L++){
    for(let i=0;i<N;i++){
      const code=fbG[i]; if(!code||fbL[i]!==L) continue;
      const r=(i/cols)|0, c=i-r*cols;
      const xf=(c*T.cw+x0g+T.dx)*dpr-pad, yf=(r*T.chh+T.chh/2+T.dy)*dpr-ghalf;
      let xi=Math.floor(xf); const fase=Math.min(FASES-1,Math.floor((xf-xi)*FASES)), yi=Math.round(yf);
      if(xi+gw<=0||xi>=Wd||yi+A.gh<=0||yi>=Hd) continue;
      const g=(code<256&&A.dir[code*FASES+fase])||cpuGlifo(A,code,fase), col=fbC[i], cr=(col>>16)&255, cg=(col>>8)&255, cb=col&255, base=yi*Wd+xi, pos=g.pos, al=g.a;
      const dentro=xi>=0&&xi+gw<=Wd&&yi>=0&&yi+A.gh<=Hd;
      /* los desplazamientos de cada píxel ya traducidos al ancho del lienzo: sin división por píxel */
      if(g.relW!==Wd){ const rl=new Int32Array(g.n); for(let q=0;q<g.n;q++){ const o=pos[q], yy=(o/gw)|0; rl[q]=yy*Wd+(o-yy*gw); } g.rel=rl; g.relW=Wd; }
      const rel=g.rel;
      for(let q=0;q<g.n;q++){
        let idx;
        if(dentro) idx=base+rel[q];
        else{ const o=pos[q], yy=(o/gw)|0, X=xi+(o-yy*gw), Y=yi+yy; if(X<0||X>=Wd||Y<0||Y>=Hd) continue; idx=Y*Wd+X; }
        const a=al[q];
        if(a>=250){ d32[idx]=(255<<24)|(cb<<16)|(cg<<8)|cr; continue; }
        const dpx=d32[idx], ia=255-a, rr=(((dpx&255)*ia+cr*a)*257)>>16, gg=((((dpx>>8)&255)*ia+cg*a)*257)>>16, bb=((((dpx>>16)&255)*ia+cb*a)*257)>>16;
        d32[idx]=(255<<24)|(bb<<16)|(gg<<8)|rr;
      }
      celdas++;
    }
  }
  const t1=performance.now();
  ctx.putImageData(cpu.img,0,0);
  P.stats.celdas=celdas; P.stats.tier=tam; P.stats.atlas=A.mapa.size; P.stats.ms=t1-t0; P.stats.subida=performance.now()-t1;
}

/* Pinta el tablero en el lienzo de WebGL y devuelve ese lienzo (flush lo copia).
   T: {fbG,fbC,fbL,cols,rows,cw,chh,fontSize,mono,dpr,W,H (CSS),dx,dy (desplazamiento),adv,fArte,nArte,bg:[r,g,b]} */
P.pintar=function(T){
  if(P.modo==='cpu'){ pintarCPU(T); return null; }
  const t0=performance.now();
  const dpr=T.dpr, Wd=Math.max(1,Math.round(T.W*dpr)), Hd=Math.max(1,Math.round(T.H*dpr));
  if(glc.width!==Wd||glc.height!==Hd){ glc.width=Wd; glc.height=Hd; }
  const fontDev=T.fontSize*dpr; let tier=TIERS[TIERS.length-1];
  for(const t of TIERS) if(t>=fontDev*0.97){ tier=t; break; }
  const A=atlasDe(tier,T.mono); tierActual=tier;
  const s=fontDev/tier, x0=(T.cw-T.adv)/2;
  const gwD=A.gw*s, ghD=A.gh*s, padD=A.pad*s;
  const {fbG,fbC,fbL,cols,rows}=T, N=cols*rows;
  reservar(N+(T.nArte>>1)+8);
  /* 1) los fondos de los sprites, 2) los glifos por capa */
  let k=0; const nb=T.nArte>>1;
  for(let j=0;j<nb;j++){
    const p=T.fArte[j*2], col=T.fArte[j*2+1], r=(p/cols)|0, c=p-r*cols, o=k*4;
    f32[o]=(c*T.cw+T.dx)*dpr; f32[o+1]=(r*T.chh+T.dy)*dpr; f32[o+2]=0;
    u32[o+3]=((col>>16)&255)|(col&0xff00)|((col&255)<<16)|0xff000000; k++;
  }
  const nGlifo0=k;
  for(let L=0;L<4;L++){
    for(let i=0;i<N;i++){
      const g=fbG[i]; if(!g||fbL[i]!==L) continue;
      let sl=A.slot[g]; if(sl<0) sl=glifo(A,g);
      const r=(i/cols)|0, c=i-r*cols, col=fbC[i], o=k*4;
      f32[o]=(c*T.cw+x0+T.dx)*dpr-padD; f32[o+1]=(r*T.chh+T.chh/2+T.dy)*dpr-ghD/2; f32[o+2]=sl;
      u32[o+3]=((col>>16)&255)|(col&0xff00)|((col&255)<<16)|0xff000000; k++;
    }
  }
  if(A.sucio) subir(A);
  gl.viewport(0,0,Wd,Hd);
  gl.clearColor(T.bg[0]/255,T.bg[1]/255,T.bg[2]/255,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog); gl.bindVertexArray(vao);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo); gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(buf,0,k*16),gl.STREAM_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,qbuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.vertexAttribDivisor(0,0);
  gl.uniform2f(U.u_res,Wd,Hd); gl.uniform2f(U.u_cell,1/SLOTS_X,1/A.filas); gl.uniform1f(U.u_cols,SLOTS_X);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,A.tex); gl.uniform1i(U.u_tex,0);
  const atr=(off)=>{ gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,off); gl.vertexAttribDivisor(1,1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,1,gl.FLOAT,false,16,off+8); gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,16,off+12); gl.vertexAttribDivisor(3,1); };
  if(nGlifo0>0){ atr(0); gl.uniform1f(U.u_solid,1); gl.uniform2f(U.u_size,(T.cw+0.6)*dpr,(T.chh+0.6)*dpr);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,nGlifo0); }
  if(k>nGlifo0){ atr(nGlifo0*16); gl.uniform1f(U.u_solid,0); gl.uniform2f(U.u_size,gwD,ghD);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,k-nGlifo0); }
  P.stats.celdas=k-nGlifo0; P.stats.tier=tier; P.stats.atlas=A.n; P.stats.ms=performance.now()-t0;
  return glc;
};
})();
