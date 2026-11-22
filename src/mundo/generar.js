/* Nativa Online — generación del mundo.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

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

  /* mapa general: un glifo por objeto, el pasto no se dibuja */
  const shade=new Float32Array(W*H).fill(1);
  const mapG=[];
  for(let y=0;y<H;y++) mapG.push(' '.repeat(W));
  for(const t of trees){
    if(t.k==='arbol') put(mapG,t.x,t.y,'T');
    else if(t.k==='roca') put(mapG,t.x,t.y,'o');
    else if(t.k==='caido') for(let k=0;k<(t.len||2);k++) put(mapG,t.x+k,t.y,'=');
  }
  return {name:cfg.name,w:W,h:H,ground,mid,trees,shade,occ,mapG,flow,cfg};
}
function calcularSombras(Wd){
  const W=Wd.w,H=Wd.h, shade=Wd.shade, S=NV.cielo?NV.cielo.sombra:{dx:-1,dy:0,porMetro:1.7};
  shade.fill(1);
  if(S.porMetro<=0.02){                      // de noche no hay sombra proyectada
    for(const t of Wd.trees){ const i=t.y*W+t.x; shade[i]=Math.min(shade[i],0.5); }
    return;
  }
  for(const t of Wd.trees){
    const L=Math.max(1,Math.round(t.h*S.porMetro));
    const ancho=t.k==='arbol'?1:0, span=t.k==='caido'?(t.len||1):1;
    for(let sx=0;sx<span;sx++) for(let d=0;d<=L;d++){
      const x=Math.round(t.x+sx+S.dx*d), y=Math.round(t.y+S.dy*d);
      if(x<0||y<0||x>=W||y>=H) break;
      const str=0.32+0.58*(d/L);
      for(let j=-ancho;j<=ancho;j++){
        const yy=y+j; if(yy<0||yy>=H) continue;
        const v=j===0?str:str+0.22, i=yy*W+x;
        if(v<shade[i]) shade[i]=v;
      }
    }
    const i0=t.y*W+t.x; shade[i0]=Math.min(shade[i0],0.28);
  }
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

NV.build=build; NV.calcularSombras=calcularSombras; NV.findSpawn=findSpawn; NV.solidAt=solidAt; NV.groundAt=groundAt;
