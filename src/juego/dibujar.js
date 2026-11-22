/* Nativa Online — dibujo del mundo.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

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
  dibujarLluvia(t);
  flush();
  const c=NV.cielo;
  $('st1').textContent=c.nombre+(c.deNoche&&c.brilloLunar>0.55?' · lunas altas':'');
  $('st3').textContent=c.estacion+' · día '+c.dia;
  $('st2').textContent='mirando al '+facing;
  $('st2').textContent='viento '+(wind<0.5?'calmo':wind<0.95?'suave':'racheado');
  const dt=performance.now()-t0;
  lastMs=lastMs*0.7+dt*0.3;
  if(lastMs>34&&calidad>0.42) calidad=Math.max(0.42,calidad-0.08);
  else if(lastMs<15&&calidad<1) calidad=Math.min(1,calidad+0.04);
  if(dt>46&&animMs<520){ animMs=Math.min(520,Math.round(animMs*1.4)); restartAnim(); }
}

/* Lluvia: hilos que caen inclinados por el viento, delante de todo. */
function dibujarLluvia(t){
  const cl=NV.cielo&&NV.cielo.clima;
  if(!cl||cl.lluvia<0.06) return;
  layer=3;
  const n=Math.round(cols*rowsN*0.010*cl.lluvia*calidad);
  const sesgo=cl.tormenta?2:1;
  const largo=cl.tormenta?4:3;
  const col=packc(150,178,196), col2=packc(96,120,140);
  for(let i=0;i<n;i++){
    const h=hash3(i,0,7);
    const c0=h%cols;
    const r0=((h>>7)%rowsN + Math.round(t*42+((h>>3)%17)))%rowsN;
    for(let k=0;k<largo;k++)
      put(c0-k*sesgo, r0-k, sesgo>1?92:124, k?col2:col);
  }
  layer=0;
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

NV.draw=draw; NV.draw_=draw_;
