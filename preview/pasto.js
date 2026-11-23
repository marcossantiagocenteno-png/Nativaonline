/* Nativa Online — VISTA PREVIA DEL PASTO (independiente del juego).
   No se carga desde index.html ni toca ningún archivo del juego: usa SOLO la base del
   motor (src/motor/base.js: paletas FAM, hash3 de 31 bits, ruido y semillas) y arma su
   propia grilla de glifos con la misma geometría del juego (13 columnas y 4 filas por
   metro, celdas que se solapan como en motor/lienzo.js).

   Dos generadores, para comparar:
     · generarActual — reproduce el pasto que dibuja hoy el juego (drawGroundRow).
     · generarNuevo  — la propuesta: sotobosque denso de marcas chicas + matas de
       briznas en abanico + destellos, con profundidad, manchas de abundancia y un
       balanceo lento. Solo trazos | / \ y marcas chicas; nada de números ni de blanco. */
(function(){
'use strict';
const NV=window.NV;
const CPM=13, RPM=4, HPM=RPM*1.7;               // el zoom estándar del juego
const ASP=1.393;                                // alto de celda / ancho (lienzo.js: TILT·CPM/RPM)
const FONT_K=1/0.42;                            // fontSize = cw/(0.6·OVX)
const LUZ={r:0.518, g:0.72, b:0.634};           // luz-de-lunas: amb 0,72 × (0,72 · 1,00 · 0,88)
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hash3=NV.hash3;
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);

/* igual que packs() de lienzo.js, más un multiplicador de intensidad */
function color(fam,s,k){
  const c=NV.step(fam,s), m=0.72+(s>1.18?1.18:s)*0.5;
  return pack(c[0]*m*LUZ.r*k, c[1]*m*LUZ.g*k, c[2]*m*LUZ.b*k);
}
const nueva=(cols,rows)=>({cols,rows,G:new Uint16Array(cols*rows),C:new Int32Array(cols*rows)});
const poner=(g,c,r,ch,col)=>{ if(c<0||c>=g.cols||r<0||r>=g.rows) return; const i=r*g.cols+c; g.G[i]=ch; g.C[i]=col; };

/* ======================== ACTUAL: el pasto de hoy ======================== */
function generarActual(o){
  const g=nueva(o.cols,o.rows), S=o.semilla|0, k=o.k, t=o.t||0;
  const tn=NV.makeNoise(NV.mulberry(S*104729+7));
  const tex2=(x,y,e)=>0.66*tn(x/e,y/e,1,1)+0.34*tn(x/(e*0.42)+37,y/(e*0.42),1,1);
  const TONOS=[0.70,1,1.30];
  const mxN=Math.ceil(o.cols/CPM), myN=Math.ceil(o.rows/RPM)+2;
  for(let my=0;my<myN;my++) for(let mx=0;mx<mxN;mx++){
    const lp=0.58+tex2(mx+9.5,my+3.5,6)*0.80;
    const light=clamp(lp,0,1.3);
    const densMata=clamp(0.70*(0.30+1.45*tex2(mx+0.5,my+0.5,1.6)),0,1.4);
    const w=(0.5+0.5*Math.sin(t*1.25+mx*0.33+my*0.10))*(0.35+tn(mx*0.12+t*1.6,my*0.12,2,0.5)*1.15);
    const bend=w>1.02?2:w>0.66?1:0;
    const base=mx*CPM;
    for(let sy=0;sy<RPM;sy++){
      const rb=my*RPM+sy;
      const nf=CPM*0.12*o.dens*clamp(0.20+densMata*1.10,0.12,1.7)*clamp(0.10+light*1.15,0.14,1.5);
      const n=Math.floor(nf)+((hash3(mx*53+sy,my*71,19)%1000)<(nf%1)*1000?1:0);
      for(let b=0;b<n;b++){
        const hb=hash3(mx*997+b,my*131+sy*37,7);
        const c0=base+((hb%(CPM*8))/8|0);
        const ti=(hb>>17)%3;
        const colT=color('verde',light*1.3*TONOS[ti],k), colM=color('verdeO',light*0.95*TONOS[ti],k), colB=color('verdeO',light*0.55*TONOS[ti],k);
        const mAlto=0.16+(((hb>>5)%100)/100)*0.50;
        const alto=Math.max(2,Math.round(mAlto*HPM));
        const own=((((hb>>9)%9)-4)/4)*0.95;
        const lean=clamp(own-bend*0.70,-2.4,2.4);
        const span=Math.max(1,alto-1);
        const flor=(hb>>21)%100<14;
        for(let r=0;r<alto;r++){
          const f=r/span, dx=Math.round(lean*(f*f*0.62+f*0.38)*alto*0.55), tip=(r===alto-1);
          let ch;
          if(Math.abs(lean)<0.26) ch='|'; else if(lean<0) ch=(r>0)?'\\':'|'; else ch=(r>0)?'/':'|';
          if(tip&&flor) poner(g,c0+dx,rb-r,'@eo'.charCodeAt((hb>>25)%3),pack(235*k,245*k,238*k));
          else poner(g,c0+dx,rb-r,ch.charCodeAt(0),tip?colT:f<0.5?colB:colM);
        }
      }
      const hp=hash3(mx,my*RPM+sy,29)%140;
      if(hp<9) poner(g,base+(hash3(mx,my+sy,31)%CPM),rb-((sy*5)%3),'@eo'.charCodeAt(hp%3),
                     hp<5?pack(225*k,240*k,230*k):pack(170*k,200*k,195*k));
    }
  }
  return g;
}

/* ======================== NUEVO: la propuesta ========================
   Tres capas, de la más lejana a la más cercana, todas deterministas (semilla):
   1. SOTOBOSQUE: casi todas las celdas llevan una marca chica y oscura (, . : ; ' ` - ~ ! i l).
      Cierra los huecos negros y da la textura continua.
   2. MATAS: grupos de 2 a 8 briznas que nacen juntas y se abren en abanico (la brizna de la
      izquierda se inclina a la izquierda y la de la derecha a la derecha). Más largas y claras
      cuanto más cerca de la cámara; algunas rematan en un destello verde.
   3. DESTELLOS: marcas sueltas, verdes y claras, muy pocas.
   La abundancia y el tono (verde bosque / verde azulado / musgo) varían por manchas de varios
   metros, así que hay zonas más tupidas y zonas más ralas. */
const SOTO="..,,,::;;''``\"\"--~~!ilt";
function generarNuevo(o){
  const g=nueva(o.cols,o.rows), cols=o.cols, rows=o.rows, S=o.semilla|0, dens=o.dens, k=o.k, t=o.t||0;
  const rn=NV.makeNoise(NV.mulberry(S*7919+13));
  const zona=(x,y)=>clamp((rn(x+11.3,y+4.1,3,0.32)-0.30)/0.40,0,1);     // abundancia, manchas de ~3 m
  const famDe=(x,y)=>{ const v=rn(x+50.7,y+20.9,2,0.55); return v<0.38?'verdeO':v<0.55?'pino':v<0.78?'verde':'musgo'; };

  /* 1 · sotobosque */
  for(let r=0;r<rows;r++){
    const d=r/rows, y=r/RPM;
    for(let c=0;c<cols;c++){
      const x=c/CPM, z=zona(x,y);
      const h=hash3(c,r,S+1);
      if((h%1000)/1000>=clamp((0.62+0.34*z)*dens,0,0.985)) continue;
      const s=(0.22+0.42*(((h>>18)%100)/100))*(0.60+0.40*d)*(0.75+0.45*z);
      poner(g,c,r,SOTO.charCodeAt((h>>10)%SOTO.length),color(famDe(x,y),s,k));
    }
  }
  /* 2 · matas de briznas (de arriba abajo: lo cercano tapa lo lejano).
     Cada brizna se inclina según la CORRIENTE de su zona (manchas de varios metros donde
     el pasto "mira" para un lado) más un poco de azar propio: nada de abanicos simétricos. */
  const TW=4, TH=2;
  for(let ty=-3;ty<=Math.ceil(rows/TH)+3;ty++) for(let tx=-3;tx<=Math.ceil(cols/TW)+3;tx++){
    const h=hash3(tx,ty,S+2);
    const cx=tx*TW+(h%TW), cy=ty*TH+((h>>6)%TH);
    const x=cx/CPM, y=cy/RPM, z=zona(x,y);
    if(((h>>12)%1000)/1000>=clamp((0.40+0.58*z)*dens*1.20,0,0.99)) continue;
    const d=clamp(cy/rows,0,1);
    const nb=2+((h>>3)%4)+(dens>1.25?1:0);
    const fam=famDe(x,y);
    const corriente=rn(x+90.1,y+33.7,2,0.22)-0.5;                  // -0,5..0,5: hacia dónde mira esta zona
    let sw=0;                                                     // balanceo lento, cambia de lado cada varios segundos
    if(o.anim){ const w=Math.sin(t*0.20+cx*0.040+cy*0.025); sw=w>0.72?1:w<-0.72?-1:0; }     // ola lenta: pocas matas cambian a la vez
    for(let b=0;b<nb;b++){
      const hb=hash3(tx*31+b,ty*17,S+3);
      const ox=(hb%5)-2;
      const L=Math.max(2,Math.round(((1.6+((hb>>5)%4))+3.0*d)*(0.55+0.60*z)*(0.75+0.35*dens)));
      const q=((hb>>8)%100)/100+corriente*0.55;                    // 0..1 sesgado por la corriente
      const lean=clamp((q<0.30?-1:q>0.70?1:0)+(L>=4?sw:0),-1,1);          // sólo se mecen las briznas largas
      const bc=cx+ox, br=cy+((hb>>9)%2);
      const dim=0.62+0.38*d, brillo=((hb>>12)%100)<20;
      for(let j=0;j<L;j++){
        const f=j/(L-1||1), tip=(j===L-1);
        const ch=lean>0?'/':lean<0?'\\':(tip&&(hb>>16)%2?"'":'|');
        let s=(0.42+0.55*f)*dim*(0.82+0.40*z), fm=fam;
        if(brillo&&j>=L-2){ s=0.98+0.22*d; fm=(hb>>14)%2?'verde':'musgo'; }
        poner(g,bc+Math.round(lean*j*j*0.16),br-j,ch.charCodeAt(0),color(fm,s,k));
      }
    }
  }
  /* 3 · destellos */
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const h=hash3(c,r,S+4);
    if((h%10000)/10000>=0.0075*dens) continue;
    poner(g,c,r,"`'.*".charCodeAt((h>>14)%4),color((h>>20)&1?'verde':'musgo',1.0+0.2*(((h>>8)%10)/10),k));
  }
  return g;
}

/* ======================== PINTADO (igual que flush de lienzo.js) ======================== */
function pintar(ctx,g,cw,chh,ox,oy,c0,c1){
  const adv=ctx.measureText('W').width, canRun=('letterSpacing' in ctx);
  if(canRun){ ctx.textAlign='left'; ctx.letterSpacing=(cw-adv).toFixed(2)+'px'; } else ctx.textAlign='center';
  const x0=canRun?(cw-adv)/2:cw/2;
  for(let r=0;r<g.rows;r++){
    const y=oy+r*chh+chh/2;
    let start=-1, col=0, buf='';
    for(let c=c0;c<=c1;c++){
      const i=r*g.cols+c, hay=c<c1&&c<g.cols&&g.G[i];
      if(hay&&(start<0||g.C[i]===col)){ if(start<0){ start=c; col=g.C[i]; buf=''; } buf+=String.fromCharCode(g.G[i]); continue; }
      if(start>=0){
        ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
        if(canRun) ctx.fillText(buf,ox+start*cw+x0,y);
        else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],ox+(start+q)*cw+x0,y);
        start=-1;
      }
      if(hay){ start=c; col=g.C[i]; buf=String.fromCharCode(g.G[i]); }
    }
  }
}


/* ======================== COMPACTO: tres variantes de superficie continua ========================
   Segunda propuesta (pedida tras ver la primera): nada de briznas largas. Casi cada celda lleva
   una marca de 1 caracter (. , ' ` : ; - ~ " ! i); sobre eso, trazos | / \ de 1 a 3 caracteres
   como mucho, de orientación entrelazada. Cubre 90-96 % de las celdas; los huecos que quedan
   son sueltos y chicos. Seis tonos: bosque muy oscuro, musgo, gris verdoso, oliva apagado,
   reflejo verde claro y un gris discreto. Las florecitas van en grupitos y escasas.
     A · muy alta, microscópica     B · extrema, pequeños trazos entrelazados
     C · extrema, más variación de tono y de luminosidad por manchas */
const PAL=[ [[16,42,30],[24,60,42]],       // 0 verde bosque muy oscuro
            [[44,82,44],[62,106,54]],      // 1 musgo
            [[70,94,80],[90,114,98]],      // 2 verde grisáceo
            [[80,90,46],[102,112,58]],      // 3 oliva apagado
            [[104,166,104],[146,204,138]],// 4 reflejo verde claro
            [[100,110,106],[124,132,126]] ]; // 5 gris discreto
const VAR={
  A:{cover:0.93, trazo:0.07, largo:[1,2], pesos:[0.44,0.20,0.12,0.14,0.07,0.03], micro:":;'`-,.:;~", zona:0.15},
  B:{cover:0.965,trazo:0.36, largo:[1,3], pesos:[0.34,0.20,0.12,0.16,0.12,0.06], micro:":;'`-~\"!i,.:;", zona:0.25},
  C:{cover:0.965,trazo:0.30, largo:[1,3], pesos:[0.28,0.20,0.15,0.17,0.14,0.06], micro:":;'`-~\"!i,.:;", zona:0.55}
};
function generarCompacto(o,v){
  const V=VAR[v], g=nueva(o.cols,o.rows), cols=o.cols, rows=o.rows, S=(o.semilla|0)+(v==='A'?0:v==='B'?101:202);
  const dens=o.dens, k=o.k, t=o.t||0;
  const rn=NV.makeNoise(NV.mulberry(S*7919+17));
  const cum=[]; let acc=0; for(const w of V.pesos){ acc+=w; cum.push(acc); }
  const col=(tono,u,lum)=>{ const a=PAL[tono][0], b=PAL[tono][1];
    return pack((a[0]+(b[0]-a[0])*u)*lum*k,(a[1]+(b[1]-a[1])*u)*lum*k,(a[2]+(b[2]-a[2])*u)*lum*k); };
  for(let r=0;r<rows;r++){
    const d=r/rows, y=r/RPM;
    for(let c=0;c<cols;c++){
      const x=c/CPM, h=hash3(c,r,S+3);
      const lumZ=rn(x+31.7,y+8.3,3,0.30);                        // manchas de ~3 m: más claras o más oscuras
      const tonZ=rn(x+77.1,y+52.9,2,0.45);                       // manchas de tono
      if(((h%1000)/1000)>=clamp(V.cover*dens,0,0.985)) continue;
      /* tono: sorteo por pesos, desplazado por la mancha de tono (tanto más cuanto más variación) */
      let ro=((h>>10)%1000)/1000;
      ro=clamp(ro+(tonZ-0.5)*V.zona*1.4,0,0.999);
      let tono=0; while(tono<5&&ro>=cum[tono]) tono++;
      const u=((h>>20)%100)/100;
      let lum=(0.80+0.55*(((h>>4)%100)/100))*(0.72+0.28*d)*(1+(lumZ-0.45)*V.zona*1.6);
      if(tono>=4) lum=Math.max(lum,0.85);
      const colr=col(tono,u,clamp(lum,0.35,1.5));
      const lean0=rn(x+90.1,y+33.7,2,0.22)+0.10*Math.sin(t*0.22+c*0.5+r*0.3);   // corriente suave (+ balanceo lento)
      const rr=((h>>14)%100)/100;
      if(rr<V.trazo){
        /* trazo corto de 1 a 3 caracteres, de orientación entrelazada */
        const q=((h>>24)%100)/100;
        const lean=(q<0.22?-1:q>0.78?1:(lean0<0.40?-1:lean0>0.60?1:0));
        const lr=((h>>8)%100)/100;
        const L=V.largo[1]>=3?(lr<0.70?1:lr<0.94?2:3):(lr<0.75?1:2);
        for(let j=0;j<L;j++){
          const ch=lean>0?'/':lean<0?'\\':'|';
          poner(g,c+Math.round(lean*j*0.6),r-j,ch.charCodeAt(0),j===L-1&&L>1?col(Math.max(tono,1),u,Math.min(1.5,lum*1.1)):colr);
        }
      } else {
        poner(g,c,r,V.micro.charCodeAt((h>>6)%V.micro.length),colr);
      }
    }
  }
  /* florecitas: escasas y en grupitos. Un grupo cada cierto tramo del suelo, no en todos. */
  const TW=6*CPM/3, TH=6*RPM/1.7;                                // baldosas de ~4-5 m
  for(let ty=-1;ty<=Math.ceil(rows/TH);ty++) for(let tx=-1;tx<=Math.ceil(cols/TW);tx++){
    const h=hash3(tx+500,ty+500,S+9);
    if(h%100>=11) continue;                                       // ~1 de cada 9 baldosas tiene grupito
    const cx=(tx+((h>>8)%100)/100)*TW, cy=(ty+((h>>16)%100)/100)*TH;
    const n=3+((h>>3)%4);                                         // 3 a 6 flores
    for(let i=0;i<n;i++){
      const hi=hash3(tx+500,ty+500,S+40+i);
      const fx=Math.round(cx+(((hi%100)/100)-0.5)*7), fy=Math.round(cy+((((hi>>8)%100)/100)-0.5)*3.2);
      poner(g,fx,fy,'@eo'.charCodeAt((hi>>16)%3),pack(205*k,218*k,208*k));
    }
  }
  return g;
}

/* ======================== LA PÁGINA ======================== */
function iniciar(){
  const css=document.createElement('style');
  css.textContent=
   ':root{--oro:#c8a24a;--oroflojo:#6d5726;--dim:#9c9484}'+
   '*{box-sizing:border-box}html,body{margin:0;height:100%;background:#000;color:#fff;font:12px ui-monospace,Menlo,Consolas,monospace;overflow:hidden}'+
   '#barra{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--oroflojo);background:#000}'+
   '#barra label{display:flex;align-items:center;gap:6px;color:var(--dim)}'+
   '#barra input[type=range]{width:110px;accent-color:var(--oro)}'+
   '#barra button,#barra select{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer}'+
   '#barra button.on{background:var(--oro);color:#000}'+
   '#barra b{color:var(--oro);font-weight:normal}'+
   '#zona{position:relative}#cv{display:block}'+
   '.rotulo{position:absolute;top:6px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}';
  document.head.appendChild(css);
  document.title='Vista previa del pasto — Nativa Online';
  document.body.innerHTML=
   '<div id="barra">'+
    '<label>Vista <select id="modo"><option value="abc">A · B · C</option><option value="abcr">A · B · C · actual</option><option value="vA">solo A</option><option value="vB">solo B</option><option value="vC">solo C</option><option value="lado">actual vs. primera propuesta</option><option value="divisor">divisor</option>'+
      '<option value="nuevo">solo primera propuesta</option><option value="actual">solo actual</option></select></label>'+
    '<label id="lDiv" style="display:none">Divisor <input id="div" type="range" min="5" max="95" value="50"></label>'+
    '<label>Densidad <input id="dens" type="range" min="30" max="200" value="100"></label>'+
    '<label>Escala de caracteres <input id="esc" type="range" min="30" max="90" value="40"></label>'+
    '<label>Intensidad de color <input id="int" type="range" min="40" max="180" value="100"></label>'+
    '<button id="reg">Regenerar</button>'+
    '<button id="ani" class="on">Animación: sí</button>'+
    '<b id="info"></b>'+
   '</div>'+
   '<div id="zona"><canvas id="cv"></canvas><span id="r1" class="rotulo">ACTUAL</span><span id="r2" class="rotulo">NUEVO</span><span id="r3" class="rotulo"></span><span id="r4" class="rotulo"></span></div>';
  const $=id=>document.getElementById(id), cv=$('cv'), ctx=cv.getContext('2d');
  let semilla=(Math.random()*1e6)|0, anim=true, dpr=1, W=0, H=0, sucio=true, tUlt=0;
  const nums=()=>({dens:$('dens').value/100, cw:$('esc').value/10, k:$('int').value/100});

  function dimensionar(){
    const z=$('zona'); dpr=Math.min(2,window.devicePixelRatio||1);
    W=window.innerWidth; H=Math.max(100,window.innerHeight-$('barra').offsetHeight);
    cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px';
    z.style.height=H+'px'; sucio=true;
  }
  function dibujar(ms){
    const n=nums(), cw=n.cw, chh=cw*ASP, modo=$('modo').value, t=anim?ms/1000:0;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; ctx.textBaseline='middle';
    ctx.fillStyle='rgb(5,9,8)'; ctx.fillRect(0,0,W,H);
    const rows=Math.floor(H/chh)+1;
    const o=(cols)=>({cols,rows,semilla,dens:n.dens,k:n.k,t,anim});
    $('r1').style.display=$('r2').style.display=$('r3').style.display=$('r4').style.display='none';
    $('r1').textContent='ACTUAL'; $('r2').textContent='NUEVO';
    if(modo==='abc'||modo==='abcr'||modo[0]==='v'){
      const lista=modo==='abc'?['A','B','C']:modo==='abcr'?['R','A','B','C']:[modo[1]];
      const n=lista.length, pw=Math.floor((W-6*(n-1))/n), cols=Math.floor(pw/cw);
      lista.forEach((v,i)=>{
        const ox=i*(pw+6);
        pintar(ctx,v==='R'?generarActual(o(cols)):generarCompacto(o(cols),v),cw,chh,ox,0,0,cols);
        if(i>0){ ctx.fillStyle='#c8a24a'; ctx.fillRect(ox-4,0,2,H); }
        const r=$('r'+(i+1)); r.textContent=v==='R'?'ACTUAL':v; r.style.cssText='display:block;left:'+(ox+6)+'px';
      });
    } else if(modo==='lado'){
      const pw=Math.floor((W-6)/2), cols=Math.floor(pw/cw);
      pintar(ctx,generarActual(o(cols)),cw,chh,0,0,0,cols);
      pintar(ctx,generarNuevo(o(cols)),cw,chh,pw+6,0,0,cols);
      ctx.fillStyle='#c8a24a'; ctx.fillRect(pw+2,0,2,H);
      $('r1').textContent='ACTUAL'; $('r2').textContent='NUEVO'; $('r1').style.cssText='display:block;left:6px'; $('r2').style.cssText='display:block;left:'+(pw+12)+'px';
    } else {
      const cols=Math.floor(W/cw);
      if(modo==='divisor'){
        const cs=Math.floor(cols*$('div').value/100);
        pintar(ctx,generarActual(o(cols)),cw,chh,0,0,0,cs);
        const gn=generarNuevo(o(cols)); pintar(ctx,gn,cw,chh,0,0,cs,cols);
        ctx.fillStyle='#c8a24a'; ctx.fillRect(cs*cw-1,0,2,H);
        $('r1').style.cssText='display:block;left:6px'; $('r2').style.cssText='display:block;right:6px;left:auto';
      } else {
        pintar(ctx,(modo==='actual'?generarActual:generarNuevo)(o(cols)),cw,chh,0,0,0,cols);
        const r=modo==='actual'?$('r1'):$('r2'); r.style.cssText='display:block;left:6px';
      }
    }
    $('info').textContent='semilla '+semilla;
  }
  function lazo(ms){
    if(sucio||(anim&&ms-tUlt>110)){ tUlt=ms; sucio=false; dibujar(ms); }      // unos 9 cuadros por segundo
    requestAnimationFrame(lazo);
  }
  for(const id of ['modo','div','dens','esc','int']) $(id).addEventListener('input',()=>{ $('lDiv').style.display=$('modo').value==='divisor'?'':'none'; sucio=true; });
  $('reg').onclick=()=>{ semilla=(Math.random()*1e6)|0; sucio=true; };
  $('ani').onclick=()=>{ anim=!anim; $('ani').textContent='Animación: '+(anim?'sí':'no'); $('ani').classList.toggle('on',anim); sucio=true; };
  window.addEventListener('resize',dimensionar);
  /* se puede abrir ya configurado: pasto.html?modo=divisor&dens=150&esc=60&int=120&semilla=7&anim=0 */
  const q=new URLSearchParams(location.search);
  for(const id of ['modo','div','dens','esc','int']) if(q.has(id)) $(id).value=q.get(id);
  if(q.has('semilla')) semilla=+q.get('semilla')|0;
  if(q.get('anim')==='0'){ anim=false; $('ani').textContent='Animación: no'; $('ani').classList.remove('on'); }
  $('lDiv').style.display=$('modo').value==='divisor'?'':'none';
  dimensionar(); requestAnimationFrame(lazo);
}

window.PastoPreview={generarActual,generarNuevo,generarCompacto,CPM,RPM,ASP,FONT_K};
if(!window.__PASTO_SIN_UI) iniciar();
})();
