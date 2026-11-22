/* Bosque ASCII 2.5D — rampas de densidad, viento del este, sol al este. */

const MONO='ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';

/* proyección: 6 caracteres por metro E-O, 2 filas por metro N-S, 3.4 filas por metro de altura */
/* Cada nivel tiene su propia resolución: de lejos menos caracteres por metro,
   de cerca más. Así la cámara puede alejarse sin que la pantalla reviente. */
const LODS=[
  {cpm:9,  rpm:3,  fs:5},    // 1 · muy lejos
  {cpm:18, rpm:6,  fs:6},    // 2 · media
  {cpm:36, rpm:12, fs:8}     // 3 · cerca
];
let CPM=18, RPM=6, HPM=10.2;

const CONFIG={ name:'Claro del norte', seed:'bosque-02', w:100, h:100,
               treeDensity:0.009, clearing:true, sunElev:30 };

/* ---------- DICCIONARIO ----------
   Regla 1: mayúscula = grande, cerca o denso; minúscula = chico, lejos o ralo.
   Regla 2: cada material es una rampa de ralo a tupido; la luz elige el escalón.
   Regla 3: el extremo ralo de toda rampa es ". ," y eso se comparte; la identidad
            vive en el extremo denso, que sí es exclusivo dentro de su capa.
   Regla 4: entre capas distintas (suelo / sotobosque / copa) un glifo puede repetirse:
            la altura y el color ya los separan. */

const MAT={                                   // capa SUELO, en uso
  g:{n:'pasto corto', fam:'verde',  ramp:[' ','\u00b0','\u00b0','*','*']},
  G:{n:'pasto largo', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde'},
  s:{n:'arena de río',fam:'arena',  ramp:['.','.',':','\u00b0',':']},
  k:{n:'guijarral',   fam:'piedra', ramp:['.',':','\u00b0','o','c']},
  a:{n:'agua somera', fam:'agua',   ramp:[' ','.','-','~','-'], agua:1.22},
  A:{n:'corriente',   fam:'agua',   ramp:['-','~','~','=','~'], agua:1.00}
};
const MID={};                                 // sotobosque: vacío por ahora
/* Reservado: acordado, fuera del mundo actual. */
const RESERVA={
  musgo:'\u00b0 o', tierra:'\u00b0 *', hojarasca:'v u', charco:'- = ~',
  helecho:'f F', zarza:'x X', hongos:'n m', juncos:'! j', flores:'*'
};
/* Tres especies, cada una con su silueta, su rampa de follaje y su corteza. */
const SPECIES={
  pino:{  n:'pino',   fam:'pino',   corteza:'corteza',
          copa:[' ','.',':',';','*','A','#'], borde:[' ','.',':','^'],
          w:0.42, troncoFrac:0.46, tiers:4, sway:0.5, alto:[4.5,6.5]},
  encino:{n:'encino', fam:'verde',  corteza:'corteza',
          copa:[' ','.',',','o','e','8','@'], borde:[' ','.',',','`','o'],
          w:0.80, troncoFrac:0.24, tiers:0, sway:1.0, alto:[3.0,4.6]},
  alamo:{ n:'álamo',  fam:'alamo',  corteza:'cortezaClara',
          copa:[' ','.','"','v','o','8'], borde:[' ','.','"','v'],
          w:0.38, troncoFrac:0.40, tiers:0, sway:1.8, alto:[4.0,5.6]}
};
const WOOD={ tronco:['t','h','H'], rama:['y','Y'], tocon:['o','0','U'], caido:['h','H'] };
const RAMP={
  copa:  [' ','.',',','o','e','8','@'],
  borde: [' ','.',',','`','o'],
  punta: ['I','I','i'],
  tronco: WOOD.tronco, rama: WOOD.rama
};
/* 4 escalones de luz por familia, nada de degradado continuo */
const FAM={
  verde:  ['#17401f','#245a2b','#357f3b','#58a84f'],
  verdeO: ['#12351a','#1d4a24','#2a6b33','#3f8a42'],   // follaje en sombra propia
  corteza:['#3a2a19','#4f3a23','#6a4e30','#8a6940'],
  piedra: ['#3b4042','#565b5e','#767c80','#949b9f'],
  tierra: ['#4a3f2d','#67583f','#857252','#a08a64'],
  flor:   ['#6b3a53','#8e4d6d','#b56389','#d07da3'],
  musgo:  ['#1b3d18','#2a5a22','#3d7a2e','#55993c'],
  hoja:   ['#4a3a1e','#6b5429','#8e7238','#b0914b'],
  agua:   ['#1d3c4a','#2f6478','#4a93a8','#6fbdcf'],
  arena:  ['#5a5140','#7d7158','#a39a7a','#c6bda2'],
  hongo:  ['#5a4a3a','#7d6a52','#a08c6e','#c4b093'],
  pino:        ['#10281c','#17402a','#215c3b','#2f7c50'],
  alamo:       ['#3b5620','#577f31','#7aa743','#a0c660'],
  cortezaClara:['#4e4e46','#737266','#9c9b8c','#c2c1b1'],
  piel:   ['#8d9a93','#b9c6bd','#dfe9e2','#f4faf5']
};

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash3(x,y,z){ let h=(x*374761393+y*668265263+z*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)&0x7fffffff; }
function makeNoise(rnd){
  const s=256,g=new Float64Array(s*s);
  for(let i=0;i<g.length;i++) g[i]=rnd();
  const at=(x,y)=>g[((y&255)*s)+(x&255)], sm=t=>t*t*(3-2*t);
  function val(x,y){
    const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const a=at(xi,yi),b=at(xi+1,yi),c=at(xi,yi+1),d=at(xi+1,yi+1);
    const u=sm(xf),v=sm(yf);
    return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
  }
  return (x,y,oct,sc)=>{ let s2=0,amp=1,f=sc,t=0; for(let i=0;i<oct;i++){s2+=val(x*f,y*f)*amp;t+=amp;amp*=0.5;f*=2;} return s2/t; };
}
function rgbOf(hex){ const v=parseInt(hex.slice(1),16); return [(v>>16)&255,(v>>8)&255,v&255]; }
const RGB={};
for(const k in FAM) RGB[k]=FAM[k].map(rgbOf);
function step(fam,s){ /* s 0..1 -> escalón 0..3 */
  const f=RGB[fam]||RGB.piedra;
  return f[clamp(Math.round(s*3.4-0.2),0,3)];
}
function pick(ramp,t){ return ramp[clamp(Math.round(t*(ramp.length-1)),0,ramp.length-1)]; }

/* ---------- estado ---------- */
let world=null, me={x:50,y:62}, facing='norte';
let cv,ctx,dpr=1,cw=6,chh=9,cols=0,rowsN=0,camX=0,camY=0;
let fontSize=11, animOn=true, frame=0, animTimer=null, animMs=120;
let fbG=null,fbC=null,fbL=null, db=null,userNs=null,docRef=null;
let layer=0, calidad=1, pend=false, lastMs=16;
const patch=makeNoise(mulberry(41099));
const gustN=makeNoise(mulberry(7717));

/* ---------- mundo ---------- */
function build(cfg){
  const rnd=mulberry(hashStr(cfg.seed)), n=makeNoise(rnd);
  const W=cfg.w,H=cfg.h;
  const ground=[], mid=[];
  for(let y=0;y<H;y++){
    let row='', mr='';
    for(let x=0;x<W;x++){
      row += n(x,y,4,0.055)>0.50?'G':'g';
      mr+=' ';
    }
    ground.push(row); mid.push(mr);
  }
  const put=(arr,x,y,c)=>{ if(x<0||y<0||x>=W||y>=H) return; arr[y]=arr[y].slice(0,x)+c+arr[y].slice(x+1); };

  /* objetos: árboles, piedras grandes y troncos caídos */
  const trees=[], occ=new Uint8Array(W*H), cx=W/2, cy=H/2;
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
    let f=n(x+90,y+90,3,0.035);
    if(cfg.clearing){ const d=Math.hypot(x-cx,y-cy); f-=Math.max(0,1-d/22)*0.55; }
    if(f<0.46) continue;
    if(rnd()>cfg.treeDensity*(0.5+f)*6) continue;
    const gq=ground[y][x];
    if(gq!=='g'&&gq!=='G') continue;
    let near=false;
    for(let j=-1;j<=1&&!near;j++) for(let i=-1;i<=1;i++) if(occ[(y+j)*W+(x+i)]){ near=true; break; }
    if(near) continue;
    occ[y*W+x]=1;
    const wet=n(x+3000,y+3000,3,0.040), alt=n(x+770,y+120,2,0.030);
    const sp = wet>0.58?'alamo' : alt>0.54?'pino' : 'encino';
    const A=SPECIES[sp].alto;
    trees.push({x,y,h:A[0]+rnd()*(A[1]-A[0]),k:'arbol',sp,s:(rnd()*1e6)|0});
  }
  for(let i=0;i<34;i++){
    const x=2+((rnd()*(W-4))|0), y=2+((rnd()*(H-4))|0);
    if(occ[y*W+x]) continue;
    occ[y*W+x]=1;
    trees.push({x,y,h: rnd()<0.35?1.2+rnd()*0.9:0.5+rnd()*0.5, k:'roca', s:(rnd()*1e6)|0});
  }
  for(let i=0;i<12;i++){
    const L=2+((rnd()*3)|0), x=3+((rnd()*(W-8))|0), y=2+((rnd()*(H-4))|0);
    let ok=true;
    for(let k=0;k<L;k++) if(occ[y*W+x+k]) ok=false;
    if(!ok) continue;
    for(let k=0;k<L;k++) occ[y*W+x+k]=1;
    trees.push({x,y,h:0.6,k:'caido',len:L,s:(rnd()*1e6)|0});
  }
  /* río de norte a sur, con un brazo al este y un remanso */
  const flow=new Uint8Array(W*H);
  const ejeX=[], anchoY=[];
  for(let y=0;y<H;y++){
    ejeX.push(W*0.34 + n(y*3,0,3,0.020)*26 - 13 + Math.sin(y*0.07)*4);
    anchoY.push(1.4 + n(0,y*5,2,0.03)*1.9);
  }
  const bifY=Math.round(H*0.46);
  const ejeY=[], anchoX=[];
  for(let x=0;x<W;x++){
    ejeY.push(bifY + n(x*4,900,3,0.022)*18 - 9);
    anchoX.push(1.1 + n(x*6,300,2,0.035)*1.6);
  }
  const remX=Math.round(ejeX[bifY]), remY=bifY, remR=6.0;
  const prof=new Float32Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    let p=0;
    const d1=Math.abs(x-ejeX[y]), w1=anchoY[y];
    if(d1<w1+3.8) p=Math.max(p,1-d1/(w1+3.8));
    if(x>=remX-1){
      const d2=Math.abs(y-ejeY[x]), w2=anchoX[x];
      if(d2<w2+3.4&&1-d2/(w2+3.4)>p){ p=1-d2/(w2+3.4); flow[y*W+x]=1; }
    }
    const dr=Math.hypot(x-remX,(y-remY)*1.25);
    if(dr<remR) p=Math.max(p,(1-dr/remR)*0.72);
    prof[y*W+x]=p;
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const p=prof[y*W+x];
    if(p<=0) continue;
    const c = p>0.58?'A' : p>0.34?'a' : p>0.12?'s' : 'k';
    put(ground,x,y,c);
  }
  /* grandes rocas en el remanso y en las orillas */
  for(let i=0;i<22;i++){
    const ang=rnd()*Math.PI*2, rad=remR*(0.35+rnd()*0.95);
    const x=Math.round(remX+Math.cos(ang)*rad), y=Math.round(remY+Math.sin(ang)*rad*0.8);
    if(x<1||y<1||x>=W-1||y>=H-1) continue;
    if(occ[y*W+x]) continue;
    occ[y*W+x]=1;
    trees.push({x,y,h:1.1+rnd()*1.5,k:'roca',s:(rnd()*1e6)|0});
  }
  for(let i=0;i<90;i++){
    const y=1+((rnd()*(H-2))|0);
    const lado=rnd()<0.5?-1:1;
    const x=Math.round(ejeX[y]+lado*(anchoY[y]+1.6+rnd()*2));
    if(x<1||x>=W-1||occ[y*W+x]) continue;
    const gg=ground[y][x];
    if(gg!=='k'&&gg!=='s'&&gg!=='g'&&gg!=='G') continue;
    occ[y*W+x]=1;
    trees.push({x,y,h:0.4+rnd()*0.7,k:'roca',s:(rnd()*1e6)|0});
  }
  trees.sort((a,b)=>a.y-b.y);

  /* sombras: sol al este y bajo, se estiran al oeste */
  const shade=new Float32Array(W*H).fill(1);
  const len1=1/Math.tan(cfg.sunElev*Math.PI/180);
  for(const t of trees){
    const L=Math.max(1,Math.round(t.h*len1)), wide=t.k==='arbol'?1:0;
    const span=t.k==='caido'?(t.len||1):1;
    for(let sx=0;sx<span;sx++) for(let d=0;d<=L;d++){
      const x=t.x+sx-d; if(x<0) break;
      const str=0.32+0.58*(d/L);
      for(let j=-wide;j<=wide;j++){
        const y=t.y+j; if(y<0||y>=H) continue;
        const s=j===0?str:str+0.22, i=y*W+x;
        if(s<shade[i]) shade[i]=s;
      }
    }
    const i0=t.y*W+t.x; shade[i0]=Math.min(shade[i0],0.28);
  }

  /* mapa general: un glifo por objeto, el pasto no se dibuja */
  const mapG=[];
  for(let y=0;y<H;y++) mapG.push(' '.repeat(W));
  for(const t of trees){
    if(t.k==='arbol') put(mapG,t.x,t.y,'T');
    else if(t.k==='roca') put(mapG,t.x,t.y,'o');
    else if(t.k==='caido') for(let k=0;k<(t.len||2);k++) put(mapG,t.x+k,t.y,'=');
  }
  return {name:cfg.name,w:W,h:H,ground,mid,trees,shade,occ,mapG,flow,cfg};
}
function findSpawn(Wd){
  const cx=Math.round(Wd.w/2), cy=Math.round(Wd.h/2);
  const libre=(x,y)=>{
    if(x<2||y<2||x>=Wd.w-2||y>=Wd.h-2) return false;
    const g=Wd.ground[y][x];
    if(g!=='g'&&g!=='G') return false;
    for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++){
      const xx=x+i, yy=y+j;
      if(xx<0||yy<0||xx>=Wd.w||yy>=Wd.h) continue;
      if(Wd.occ[yy*Wd.w+xx]) return false;
    }
    return true;
  };
  for(let r=0;r<Math.max(Wd.w,Wd.h);r++)
    for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){
      if(Math.max(Math.abs(i),Math.abs(j))!==r) continue;
      if(libre(cx+i,cy+j)) return {x:cx+i,y:cy+j};
    }
  return {x:cx,y:cy};
}
const solidAt=(x,y)=>(!world||x<0||y<0||x>=world.w||y>=world.h)?true:!!world.occ[y*world.w+x];
const groundAt=(x,y)=>(x<0||y<0||x>=world.w||y>=world.h)?'g':world.ground[y][x];

/* ---------- viento: ráfagas que entran por el este y viajan al oeste ---------- */
let wind=0;
function windAt(mx,my,t){
  const wave=0.5+0.5*Math.sin(t*1.25 + mx*0.33 + my*0.10);
  const gust=gustN(mx*0.12+t*1.6, my*0.12, 2, 0.5);
  return wave*(0.35+gust*1.15);
}

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
  animMs = cols*rowsN>90000?340:cols*rowsN>45000?240:160;
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
const packs=(fam,s)=>{ const c=step(fam,s); const m=0.72+s*0.5;
  return packc(c[0]*m,c[1]*m,c[2]*m); };

function draw(){
  try{ draw_(); }
  catch(err){
    const Wp=cv.width/dpr,Hp=cv.height/dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#05070a'; ctx.fillRect(0,0,Wp,Hp);
    ctx.fillStyle='#d9a24a'; ctx.textAlign='left'; ctx.font='12px '+MONO;
    ctx.fillText('Error al dibujar: '+err.message,14,22);
    ctx.textAlign='center';
    if(animTimer){ clearInterval(animTimer); animTimer=null; }
  }
}
function draw_(){
  if(!world||!ctx) return;
  const t0=performance.now();
  const colsM=Math.ceil(cols/CPM), rowsM=Math.ceil(rowsN/RPM);
  camX=clamp(Math.round(me.x-colsM/2),0,Math.max(0,world.w-colsM));
  camY=clamp(Math.round(me.y-rowsM/2),0,Math.max(0,world.h-rowsM));
  fbG.fill(0); fbL.fill(0);
  const t=frame*0.11, W=world.w;
  const lastRow=Math.min(world.h-1,camY+rowsM+22);
  let ti=0; while(ti<world.trees.length&&world.trees[ti].y<camY) ti++;

  for(let my=camY;my<=lastRow;my++){
    const rBase=(my-camY)*RPM+RPM-1;                       // fila del suelo
    const haze=0.60+0.40*((my-camY)/Math.max(1,rowsM));
    layer=0;
    if(my<camY+rowsM) drawGroundRow(my,rBase,haze,t,W);
    layer=2;
    while(ti<world.trees.length&&world.trees[ti].y===my){ drawTree(world.trees[ti],haze,t); ti++; }
    layer=3;
    if(my===me.y) drawPlayer(haze);
  }
  flush();
  $('st1').textContent='x '+me.x+' m · y '+me.y+' m';
  $('st2').textContent='viento '+(wind<0.5?'calmo':wind<0.95?'suave':'racheado');
  const dt=performance.now()-t0;
  lastMs=lastMs*0.7+dt*0.3;
  if(lastMs>34&&calidad>0.42) calidad=Math.max(0.42,calidad-0.08);
  else if(lastMs<15&&calidad<1) calidad=Math.min(1,calidad+0.04);
  if(dt>46&&animMs<520){ animMs=Math.min(520,Math.round(animMs*1.4)); restartAnim(); }
}

function drawGroundRow(my,rBase,haze,t,W){
  const colsM=Math.ceil(cols/CPM);
  let wsum=0,wn=0;
  const top=rBase-(RPM-1);                 // un metro de fondo ocupa RPM filas
  for(let mx=camX;mx<=camX+colsM;mx++){
    if(mx<0||mx>=W) continue;
    const type=groundAt(mx,my), mt=MAT[type]||MAT.g;
    const sh=world.shade[my*W+mx];
    const lp=0.84+patch(mx,my,3,0.08)*0.40;
    const light=clamp(sh*lp*haze,0,1.3);
    const w=windAt(mx,my,t); wsum+=w; wn++;
    const bend = w>1.02?2 : w>0.66?1 : 0;
    const colG=packs(mt.fam,light*(mt.agua||1));
    const base=(mx-camX)*CPM;
    const grass=(type==='G'||type==='g'||type==='f');

    /* las RPM franjas se recorren de norte a sur: lo de más al sur tapa */
    for(let sy=0;sy<RPM;sy++){
      const rb=top+sy;
      if(!grass){
        for(let k=0;k<CPM;k++){
          const hc=hash3(mx*CPM+k,my*RPM+sy,5);
          const jit=0.80+((hc>>3)%100)/100*0.42;
          let dens=clamp(0.34+light*jit*0.78,0,1);
          if(mt.agua){
            const este=world.flow[my*W+mx]===1;
            const fase=este ? (mx*CPM+k)*0.09 : (my*RPM+sy)*0.26;
            const rip=0.5+0.5*Math.sin(t*2.2-fase+(este?sy*0.3:k*0.05));
            dens=clamp(0.30+rip*0.65,0,1);
          }
          const g=pick(mt.ramp,dens);
          if(g!==' ') put(base+k,rb,g.charCodeAt(0),colG);

        }
        continue;
      }
      /* alfombra dispersa en TODAS las franjas: no hay línea de base */
      for(let k=0;k<CPM;k+=2){
        const hc=hash3(mx*CPM+k,my*RPM+sy,5);
        if((hc%100)<52*clamp(light,0.2,1.2)) put(base+k,rb,type==='G'?124:176,colG);
      }
      /* briznas: base repartida en la profundidad, altura mayor que el paso
         de la grilla para que la mata se enlace de un metro al siguiente */
      const nPer=Math.max(2,Math.round(CPM*(type==='G'?0.15:0.09)*calidad));
      const n=Math.round(nPer*clamp(0.5+light*0.7,0.3,1.4));
      const colT=packs(mt.fam2||mt.fam,light*1.1);
      const colM=packs(mt.fam,light*0.95);
      for(let b=0;b<n;b++){
        const hb=hash3(mx*997+b,my*131+sy*37,7);
        const c0=base+((hb%(CPM*8))/8|0);
        const mAlto=(type==='G'?0.45:0.13)+(((hb>>5)%100)/100)*(type==='G'?0.80:0.27);
        const alto=Math.max(2,Math.round(mAlto*HPM));
        const own=((((hb>>9)%9)-4)/4)*0.95;
        const lean=clamp(own-bend*0.70,-1.8,1.8);
        const span=Math.max(1,alto-1);
        for(let r=0;r<alto;r++){
          const f=r/span, dx=Math.round(lean*(f*f*0.62+f*0.38)*alto*0.55);
          const tip=(r===alto-1);
          let g;
          if(type==='G'){
            if(Math.abs(lean)<0.26) g='|';
            else if(lean<0)         g=(r>0)?'\\':'|';
            else                    g=(r>0)?'/':'|';
          } else {
            g = tip?'*':'\u00b0';
          }
          put(c0+dx,rb-r,g.charCodeAt(0),tip?colT:colM);
        }
      }
      if(mt.extra){
        for(let k=0;k<CPM;k+=2){
          const hc=hash3(mx*CPM+k,my*RPM+sy,23);
          if((hc%100)<4) put(base+k,rb-1-((hc>>7)%2),mt.extra.charCodeAt(0),packs(mt.efam||mt.fam,light*1.1));
        }
      }
      if((hash3(mx,my*RPM+sy,29)%140)<3) put(base+((hash3(mx,my+sy,31))%CPM),rb-((sy*5)%3),46,packc(205,230,215));
    }

  }
  if(wn) wind=wsum/wn;
}

function drawTree(tr,haze,t){
  const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
  if(tr.k==='roca'){
    const hgt=Math.max(3,Math.round(tr.h*HPM*0.85));
    const hw=Math.max(2,(tr.h*CPM*0.95)/2);
    const LUZ=['#','%','8','0'], SOM=['c','o',':','.'], lean=((tr.s%7)-3)/9;
    let prevCi=-1;
    for(let r=0;r<hgt;r++){
      const tN=r/Math.max(1,hgt-1);
      /* perfil escalonado: hombros planos en vez de curva lisa */
      let rad=hw*Math.sqrt(Math.max(0,1-tN*tN*0.78));
      const pasos=3+(tr.s%3);
      rad=hw*(Math.round((rad/hw)*pasos)/pasos);
      rad*=0.86+((hash3(tr.s,r,6)%28)/100);
      const ci=Math.max(1,Math.round(rad));
      const cen=Math.round(lean*tN*hw*0.8);
      const corte=-0.12+((tr.s%5)-2)/22;            // dónde cae el filo de luz
      for(let c=-ci;c<=ci;c++){
        const este=c/ci, hh=hash3(tr.s+c,r,4);
        const borde=Math.abs(c)>=ci-0.2;
        const techo=(prevCi>=0&&Math.abs(c)>prevCi)||r===hgt-1;
        const iluminado=este>corte;
        let g;
        if(techo&&!borde)      g='_';
        else if(borde)         g = c<0?'/':'\\';
        else                   g = iluminado?LUZ[hh%LUZ.length]:SOM[(hh>>4)%SOM.length];
        let lit = iluminado?1.02:0.40;
        if(techo) lit*=1.18;
        lit*=(0.92+((hh>>9)%100)/100*0.16)*haze;
        put(bc+cen+c,br-r,g.charCodeAt(0),packs('piedra',lit));
      }
      prevCi=ci;
    }
    return;
  }
  if(tr.k==='caido'){
    const L=(tr.len||2)*CPM, rows=2;
    for(let r=0;r<rows;r++) for(let c=0;c<L;c++){
      const g=(c%3===0)?WOOD.caido[1]:WOOD.caido[0];
      const lit=(r===0?0.95:0.60)*haze*(0.85+((hash3(tr.s+c,r,3)%100)/100)*0.3);
      put(bc-2+c,br-r,g.charCodeAt(0),packs('corteza',lit));
    }
    return;
  }
  const sp=SPECIES[tr.sp]||SPECIES.encino;
  const isB=tr.k==='arbusto';
  const tall=Math.max(3,Math.round(tr.h*HPM));
  const trunkR=isB?0:Math.max(2,Math.round(tall*sp.troncoFrac));
  const canR=tall-trunkR;
  const maxHW=Math.max(1.5,(tr.h*CPM*(isB?0.7:sp.w))/2);
  const sway=windAt(tr.x,tr.y,t*0.8)*(isB?0.8:sp.sway);
  const copa=isB?SPECIES.encino.copa:sp.copa, borde=isB?SPECIES.encino.borde:sp.borde;
  const famC=isB?'verdeO':sp.fam;
  for(let r=0;r<canR;r++){
    const sr=br-trunkR-r;
    if(sr<-3||sr>=rowsN+3) continue;
    const tN=r/Math.max(1,canR-1);                     // 0 abajo, 1 arriba
    let hw;
    if(sp.tiers){                                       // cónica, por pisos
      hw=maxHW*Math.pow(1-tN,0.85);
      hw*=0.72+0.30*Math.abs(Math.sin(tN*Math.PI*sp.tiers));
      hw=Math.max(hw,0.6);
    } else if(tr.sp==='alamo'){                         // columnar, en llama
      hw=maxHW*Math.sqrt(Math.max(0,1-Math.pow(tN*1.9-0.9,2)*0.72))*(1-tN*0.25);
    } else {                                            // redondeada
      hw=maxHW*Math.sqrt(Math.max(0,1-Math.pow(2*tN-1,2)*0.92));
    }
    hw=Math.max(0.7,hw);
    const ci=Math.round(hw), topSway=Math.round(sway*(0.3+tN));
    for(let c=-ci;c<=ci;c++){
      const u=Math.abs(c)/Math.max(0.7,hw);
      if(u>1) continue;
      const hh=hash3(tr.s+c,r,0), east=c/Math.max(1,ci);
      let lit=0.48+0.62*((east+1)/2)+0.20*tN;
      lit*=(0.88+((hh>>7)%100)/100*0.26)*haze;
      const dens=clamp((1-u*0.72)*lit*1.45,0,1);
      const g=u>0.78?pick(borde,dens*1.1):pick(copa,dens);
      if(g===' ') continue;
      put(bc+c-topSway,sr,g.charCodeAt(0),packs(east<-0.15?(famC==='verde'?'verdeO':famC):famC,lit));
    }
  }
  if(trunkR>0){
    const tw=tr.h>4.5?3:2, fam=sp.corteza;
    for(let r=0;r<trunkR;r++){
      const sr=br-r;
      const g=r<trunkR*0.35?WOOD.tronco[2]:r<trunkR*0.75?WOOD.tronco[1]:WOOD.tronco[0];
      for(let c=0;c<tw;c++){
        const lit=(0.60+0.42*(c/(tw-1||1)))*(0.82+0.3*(r/trunkR))*haze;
        put(bc+c-1,sr,g.charCodeAt(0),packs(fam,lit));
      }
    }
    if(!sp.tiers){
      const hy=br-trunkR;
      put(bc-1,hy,WOOD.rama[0].charCodeAt(0),packs(sp.corteza,0.7*haze));
      put(bc+1,hy,WOOD.rama[1].charCodeAt(0),packs(sp.corteza,0.95*haze));
    }
  }
}

function drawPlayer(haze){
  const H=Math.max(6,Math.round(1.75*HPM));          // 1,75 m de alto
  const Wc=Math.max(3,Math.round(0.55*CPM));         // 55 cm de ancho
  const bc=(me.x-camX)*CPM+Math.floor(CPM/2), br=(me.y-camY)*RPM+RPM-1;
  /* sombra al oeste, tres metros largos */
  const SL=Math.round(3*CPM);
  for(let d=1;d<=SL;d++){
    const sdw=0.30+0.55*(d/SL);
    const an=Math.max(1,Math.round(Wc*(0.5+0.5*d/SL)));
    for(let k=-an;k<=an;k++){
      const c=bc-d+k;
      if(c<0||c>=cols||br<0||br>=rowsN) continue;
      const i=br*cols+c; if(!fbG[i]) continue;
      const col=fbC[i];
      fbC[i]=packc(((col>>16)&255)*sdw,((col>>8)&255)*sdw,(col&255)*sdw);
    }
  }
  const headR=Math.max(1,Math.round(H*0.09));
  const headY=br-H+headR;
  const shoulder=br-Math.round(H*0.76);
  const hip=br-Math.round(H*0.44);
  const put2=(c,r,g,lit)=>put(c,r,g.charCodeAt(0),packs('piel',lit*haze));
  /* cabeza */
  for(let dy=-headR;dy<=headR;dy++) for(let dx=-headR;dx<=headR;dx++){
    const u=(dx*dx)/(headR*headR*1.6)+(dy*dy)/(headR*headR);
    if(u>1) continue;
    put2(bc+dx,headY+dy, u>0.62?'o':'O', 0.70+0.45*((dx+headR)/(2*headR)));
  }
  /* torso */
  const tw=Math.max(1,Math.round(Wc*0.22));
  for(let r=shoulder;r<=hip;r++)
    for(let c=-tw;c<=tw;c++)
      put2(bc+c,r,'|',0.62+0.48*((c+tw)/(2*tw)));
  /* brazos */
  const armL=Math.round(H*0.30);
  for(let a=0;a<armL;a++){
    const dx=Math.round(a*0.55), dy=a;
    put2(bc-tw-dx,shoulder+dy,'\\',0.66);
    put2(bc+tw+dx,shoulder+dy,'/',1.02);
  }
  /* piernas */
  const legL=br-hip;
  for(let a=0;a<=legL;a++){
    const dx=Math.round(a*0.42);
    put2(bc-dx,hip+a,'\\',0.68);
    put2(bc+dx,hip+a,'/',0.98);
  }
}

function flush(){
  const Wp=cv.width/dpr,Hp=cv.height/dpr;
  ctx.fillStyle='#05070a'; ctx.fillRect(0,0,Wp,Hp);
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
  const g=ctx.createRadialGradient(Wp/2,Hp/2,Math.min(Wp,Hp)*0.32,Wp/2,Hp/2,Math.max(Wp,Hp)*0.78);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.58)');
  ctx.fillStyle=g; ctx.fillRect(0,0,Wp,Hp);
}

/* ---------- movimiento ---------- */
function move(dx,dy){
  facing=dy<0?'norte':dy>0?'sur':dx>0?'este':'oeste';
  const nx=me.x+dx,ny=me.y+dy;
  if(nx<0||ny<0||nx>=world.w||ny>=world.h){ bubble('El claro termina acá.'); return; }
  if(solidAt(nx,ny)){ bubble('Algo sólido te corta el paso.'); return; }
  const gq=groundAt(nx,ny);
  if(gq==='A') bubble('El agua te llega a los tobillos y arrastra para el sur.');
  else if(gq==='a') bubble('Pisás el arroyo; apenas te moja las botas.');
  me.x=nx; me.y=ny; hide(); requestDraw(); drawMap();
}
function look(){
  let n=0,near=null;
  for(const tr of world.trees){
    const d=Math.abs(tr.x-me.x)+Math.abs(tr.y-me.y);
    if(d<=6){ n++; if(!near||d<near.d) near={t:tr,d}; }
  }
  const g=groundAt(me.x,me.y);
  const suelo='Pisás '+((MAT[g]||MAT.g).n)+'.';
  const arb = n? ('Hay '+n+' '+(n===1?'árbol':'árboles')+' a menos de seis metros'+
                 (near&&near.t.k==='arbol'?'; el más cercano es un '+((SPECIES[near.t.sp]||SPECIES.encino).n)+' de unos '+Math.round(near.t.h)+' metros.':'.'))
              : 'Alrededor solo hay pasto; las sombras vienen de lejos.';
  bubble('<b>Mirás alrededor</b>\n'+esc(suelo+' '+arb+' El viento entra por el este.'));
}
function bubble(h){ const b=$('bubble'); b.innerHTML=h.indexOf('<b>')===0?h:esc(h); b.classList.add('show');
  clearTimeout(bubble._t); bubble._t=setTimeout(hide,5200); }
function hide(){ $('bubble').classList.remove('show'); }
function requestDraw(){
  if(pend) return;
  pend=true;
  requestAnimationFrame(()=>{ pend=false; draw(); });
}
function restartAnim(){
  if(animTimer) clearInterval(animTimer);
  animTimer=null; if(!animOn) return;
  animTimer=setInterval(()=>{ if(!document.hidden){ frame++; requestDraw(); } },animMs);
}

/* ---------- nube (solo lectura) ---------- */
function unwrap(s){
  if(!s) return null;
  if(typeof s.data==='function'){ try{ return s.data(); }catch(e){ return null; } }
  if(s.data&&typeof s.data==='object') return s.data;
  if(s.seed||s.w) return s;
  return null;
}
async function connect(){
  try{ userNs=await window.claude?.use?.('user'); }catch(e){}
  try{ db=await window.claude?.use?.('db'); }catch(e){ db=null; }
  if(!db) return;
  try{
    docRef=db.doc('world/main');
    const apply=d=>{
      if(!d) return;
      const cfg=Object.assign({},CONFIG,d);
      world=build(cfg);
      me=findSpawn(world);
      $('wname').textContent=world.name;
      draw();
    };
    apply(unwrap(await docRef.get()));
    if(docRef.onSnapshot) docRef.onSnapshot(s=>apply(unwrap(s)));
  }catch(e){}
}

/* ---------- mapa ---------- */
let mapOn=false;
function toggleMap(v){
  mapOn = v===undefined?!mapOn:v;
  $('map').classList.toggle('show',mapOn);
  $('bMap').classList.toggle('on',mapOn);
  if(mapOn) drawMap();
}
/* El mapa se resume: cada casilla del minimapa cubre varios metros.
   Las columnas son más que las filas porque el carácter es más alto que ancho:
   así el recuadro sale cuadrado. */
const MAPW=26, MAPH=16;
function drawMap(){
  if(!mapOn||!world) return;
  const el=$('mapTx');
  const sx=world.w/MAPW, sy=world.h/MAPH;
  const px=Math.floor(me.x/sx), py=Math.floor(me.y/sy);
  let out='';
  for(let r=0;r<MAPH;r++){
    let line='';
    for(let c=0;c<MAPW;c++){
      if(c===px&&r===py){ line+='<b>X</b>'; continue; }
      let hay=false;
      const y0=Math.floor(r*sy), y1=Math.min(world.h,Math.ceil((r+1)*sy));
      const x0=Math.floor(c*sx), x1=Math.min(world.w,Math.ceil((c+1)*sx));
      for(let y=y0;y<y1&&!hay;y++){
        const row=world.mapG[y];
        for(let x=x0;x<x1;x++) if(row[x]==='T'){ hay=true; break; }
      }
      line += hay?'T':'\u00b7';
    }
    out+=line+'\n';
  }
  el.innerHTML=out;
}

/* ---------- leyenda ---------- */
function buildLegend(){
  const rows=[];
  rows.push(['— suelo —','','']);
  for(const k in MAT){
    const m=MAT[k];
    let gl=m.ramp.join(' ').trim();
    if(m.tip) gl+='   inclinada '+m.tip.join(' ');
    rows.push([m.n,gl,m.tip?'base recta, se curva al subir':'grado ralo, asterisco tupido']);
  }
  rows.push(['— objetos —','','']);
  rows.push(['piedra grande','c o O Q 0','cara este iluminada']);
  rows.push(['tronco caído', WOOD.caido.join(' '),'tendido de este a oeste']);
  rows.push(['tronco en pie', WOOD.tronco.join(' '),'H grueso, h medio, t fino']);
  rows.push(['ramas', WOOD.rama.join(' '),'']);
  rows.push(['— copas —','','']);
  for(const k in SPECIES){
    const e=SPECIES[k];
    rows.push([e.n, e.copa.join(' ').trim()+'   borde '+e.borde.join(' ').trim(),
      k==='pino'?'cónica, por pisos':k==='alamo'?'columnar, se mece mucho':'ancha y redonda']);
  }
  rows.push(['— reservado —','','']);
  for(const k in RESERVA) rows.push([k, RESERVA[k], 'fuera del mundo actual']);
  $('legend').innerHTML=rows.map(r=> r[1]===''
    ? '<div class="lgh">'+esc(r[0])+'</div>'
    : '<div class="lg"><b>'+esc(r[0])+'</b><code>'+esc(r[1])+'</code><i>'+esc(r[2])+'</i></div>').join('');
}

/* ---------- arranque ---------- */
function init(){
  cv=$('cv'); ctx=cv.getContext('2d');
  if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
  applyLOD();
  for(const b of document.querySelectorAll('.zb')) b.classList.toggle('on',+b.dataset.z===zi);
  world=build(CONFIG);
  $('wname').textContent=world.name;
  me=findSpawn(world);
  layout(); restartAnim(); connect();

  addEventListener('resize',()=>{ clearTimeout(init._r); init._r=setTimeout(layout,140); });
  addEventListener('keydown',e=>{
    if(document.querySelector('.modal.show')){ if(e.key==='Escape') closeModals(); return; }
    const k=e.key.toLowerCase();
    if(k==='arrowup'||k==='w'){ move(0,-1); e.preventDefault(); }
    else if(k==='arrowdown'||k==='s'){ move(0,1); e.preventDefault(); }
    else if(k==='arrowleft'||k==='a'){ move(-1,0); e.preventDefault(); }
    else if(k==='arrowright'||k==='d'){ move(1,0); e.preventDefault(); }
    else if(k==='e'||k===' '){ look(); e.preventDefault(); }
    else if(k==='m'){ toggleMap(); e.preventDefault(); }
    else if(k==='+'||k==='='){ setZoom(1); e.preventDefault(); }
    else if(k==='-'||k==='_'){ setZoom(-1); e.preventDefault(); }
  });
  for(const b of $('pad').querySelectorAll('button[data-mv]'))
    b.addEventListener('click',()=>{
      const m=b.dataset.mv;
      if(m==='n') move(0,-1); else if(m==='s') move(0,1);
      else if(m==='w') move(-1,0); else if(m==='e') move(1,0); else look();
    });
  for(const b of document.querySelectorAll('.zb'))
    b.addEventListener('click',()=>setZoom(+b.dataset.z-zi));
  cv.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(e.deltaY<0?1:-1); },{passive:false});
  let pinch=0;
  cv.addEventListener('touchstart',e=>{
    if(e.touches.length===2) pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                                              e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  cv.addEventListener('touchmove',e=>{
    if(e.touches.length!==2||!pinch) return;
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
    if(Math.abs(d-pinch)>26){ setZoom(d>pinch?1:-1); pinch=d; }
    e.preventDefault();
  },{passive:false});
  cv.addEventListener('touchend',()=>{ pinch=0; },{passive:true});
  $('bAnim').addEventListener('click',()=>{ animOn=!animOn; $('bAnim').classList.toggle('on',animOn); restartAnim(); draw(); });
  $('bMap').addEventListener('click',()=>toggleMap());

  for(const b of document.querySelectorAll('[data-close]')) b.addEventListener('click',closeModals);
}
function closeModals(){ for(const m of document.querySelectorAll('.modal')) m.classList.remove('show'); }

init();
