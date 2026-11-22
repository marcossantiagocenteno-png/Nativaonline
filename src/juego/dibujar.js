/* Nativa Online — dibujo del mundo.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

function draw(){
  try{ draw_(); }
  catch(err){
    const Wp=cv.width/dpr,Hp=cv.height/dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#05070a'; ctx.fillRect(0,0,Wp,Hp);
    ctx.fillStyle='#d9a24a'; ctx.textAlign='left'; ctx.font='13px '+MONO;
    ctx.fillText('Error al dibujar: '+err.message,14,24);
    ctx.textAlign='center';
    if(NV.avisarError) NV.avisarError('✗ al dibujar: '+err.message+
      (err.stack?'\n   '+err.stack.split('\n')[1].trim():''));
    if(animTimer){ clearInterval(animTimer); animTimer=null; }
  }
}
function draw_(){
  if(!world||!ctx) return;
  const t0=performance.now();
  const colsM=Math.ceil(cols/CPM), rowsM=Math.ceil(rowsN/RPM);
  const LIM=NV.limites();
  /* La cámara persigue al jugador sin saltos: guarda su posición con decimales
     y el dibujo se corre los píxeles que falten. */
  const destX=clamp(me.x-colsM/2+0.5, LIM.x0, Math.max(LIM.x0,LIM.x1-colsM));
  const destY=clamp(me.y-rowsM/2+0.5, LIM.y0, Math.max(LIM.y0,LIM.y1-rowsM));
  if(NV.camXf===undefined){ NV.camXf=destX; NV.camYf=destY; }
  const sigue=0.30;
  NV.camXf += (destX-NV.camXf)*sigue;
  NV.camYf += (destY-NV.camYf)*sigue;
  if(Math.abs(destX-NV.camXf)<0.01) NV.camXf=destX;
  if(Math.abs(destY-NV.camYf)<0.01) NV.camYf=destY;
  camX=Math.floor(NV.camXf); camY=Math.floor(NV.camYf);
  NV.desplaceX=-(NV.camXf-camX)*CPM*cw;
  NV.desplaceY=-(NV.camYf-camY)*RPM*chh;
  NV.camQuieta = NV.camXf===destX && NV.camYf===destY;
  fbG.fill(0); fbL.fill(0);
  const t=frame*0.11;
  const lastRow=Math.min(LIM.y1-1,camY+rowsM+22);
  const objetos=NV.objetosEn(camX-2, camY-2, camX+colsM+2, lastRow+2);
  let ti=0; while(ti<objetos.length&&objetos[ti].y<camY) ti++;

  for(let my=camY;my<=lastRow;my++){
    const rBase=(my-camY)*RPM+RPM-1;                       // fila del suelo
    const haze=0.60+0.40*((my-camY)/Math.max(1,rowsM));
    layer=0;
    if(my<camY+rowsM) drawGroundRow(my,rBase,haze,t);
    layer=2;
    while(ti<objetos.length&&objetos[ti].y<=my){ if(objetos[ti].y===my) drawTree(objetos[ti],haze,t); ti++; }
    layer=3;
    if(my===me.y) drawPlayer(haze);
  }
  if(NV.destino){                       // adónde se va, mientras se va
    const d=NV.destino;
    const c0=(d.x-camX)*CPM+Math.floor(CPM/2), r0=(d.y-camY)*RPM+RPM-1;
    const pulso=0.6+0.4*Math.sin(Date.now()/230);
    const col=packc(120+120*pulso, 220, 150+80*pulso);
    layer=3;
    for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,col);
    layer=0;
  }
  dibujarLluvia(Date.now()/1000);
  dibujarNiebla(t);
  flush();
  const c=NV.cielo;
  $('st1').textContent=c.nombre+(c.deNoche&&c.brilloLunar>0.55?' · lunas altas':'');
  $('st3').textContent=c.estacion+' · día '+c.diaMes+' del mes '+c.mes;
  $('st2').textContent='mirando al '+facing;
  $('st2').textContent='viento '+(wind<0.5?'calmo':wind<0.95?'suave':'racheado');
  const dt=performance.now()-t0;
  lastMs=lastMs*0.7+dt*0.3;
  if(lastMs>34&&calidad>0.42) calidad=Math.max(0.42,calidad-0.08);
  else if(lastMs<15&&calidad<1) calidad=Math.min(1,calidad+0.04);
  if(dt>46&&animMs<520){ animMs=Math.min(520,Math.round(animMs*1.4)); restartAnim(); }
}

/* Niebla: una pasada final que lava el color y come el detalle.
   Se calcula una vez por metro y se aplica a todo su bloque de casillas. */
function dibujarNiebla(t){
  if(!NV.nieblaEn) return;
  const L=NV.luz;
  const fr=168*L.r+24, fg=178*L.g+26, fb=190*L.b+30;
  const colsM=Math.ceil(cols/CPM), rowsM=Math.ceil(rowsN/RPM);
  let densa=0;
  for(let my=camY;my<camY+rowsM;my++){
    for(let mx=camX;mx<camX+colsM+1;mx++){
      const d=NV.nieblaEn(mx,my,t);
      if(d<0.04) continue;
      if(Math.abs(mx-me.x)<3&&Math.abs(my-me.y)<3) densa=Math.max(densa,d);
      /* La niebla es una nube a ras del suelo: lava el color de lo que hay
         abajo pero NO borra ningún glifo, y las copas quedan por encima. */
      const k=Math.min(0.72,d*0.80);
      const c0=(mx-camX)*CPM, r0=(my-camY)*RPM;
      for(let r=0;r<RPM;r++){
        const fila=r0+r; if(fila<0||fila>=rowsN) continue;
        for(let c=0;c<CPM;c++){
          const col=c0+c; if(col<0||col>=cols) continue;
          const i=fila*cols+col;
          if(fbL[i]>1) continue;                     // las copas quedan por encima
          if(fbG[i]){
            const v=fbC[i];
            fbC[i]=packc(((v>>16)&255)+(fr-((v>>16)&255))*k,
                         ((v>>8)&255)+(fg-((v>>8)&255))*k,
                         (v&255)+(fb-(v&255))*k);
          }
          if(fbB[i]){
            const w=fbB[i]-1;
            fbB[i]=1+packc(((w>>16)&255)+(fr-((w>>16)&255))*k,
                           ((w>>8)&255)+(fg-((w>>8)&255))*k,
                           (w&255)+(fb-(w&255))*k);
          }
        }
      }
    }
  }
  if(NV.cielo) NV.cielo.nieblaAqui=densa;
}

/* El fuego no es constante: late. */
function titilar(t){
  return 0.80 + 0.20*Math.sin(t*9.3) + 0.14*Math.sin(t*23.7+1.4) + 0.08*Math.sin(t*41.1);
}

/* Lluvia: cada gota tiene su columna, su velocidad y su desvío. Cae de verdad,
   se tuerce con la ráfaga y revienta contra el suelo. Tres intensidades. */
function dibujarLluvia(t){
  const cl=NV.cielo&&NV.cielo.clima;
  if(!cl||!cl.intensidad) return;
  layer=3;
  const I=cl.intensidad;
  const dens=[0,0.006,0.020,0.034][I]*calidad;
  const n=Math.round(cols*rowsN*dens);
  const largo=[0,2,3,5][I];
  const vel=[0,26,46,72][I];
  const sesgo=[0,0.5,1,2][I]*(0.6+(NV.vientoFactor||1)*0.5);
  const L=NV.luz;
  const claro=packc(120*L.r+70, 150*L.g+70, 175*L.b+75);
  const medio=packc(70*L.r+34, 92*L.g+40, 112*L.b+48);
  const salpica=packc(150*L.r+60, 170*L.g+66, 180*L.b+70);
  for(let i=0;i<n;i++){
    const h=hash3(i,3,11);
    const c0=h%cols;
    const prop=0.75+((h>>5)%50)/100;                 // cada gota cae a su ritmo
    const alto=rowsN+largo+6;
    const r0=Math.round((((h>>9)%alto)+t*vel*prop)%alto)-largo;
    const dx=Math.round(sesgo*prop);
    for(let k=0;k<largo;k++)
      put(c0-k*dx, r0-k, dx>1?92:124, k?medio:claro);
    if(r0>=0&&r0<rowsN&&((h>>3)%100)<34)             // el golpe contra el suelo
      put(c0+1, r0, 45, salpica);
  }
  layer=0;
}

function drawGroundRow(my,rBase,haze,t){
  const colsM=Math.ceil(cols/CPM);
  let wsum=0,wn=0;
  const top=rBase-(RPM-1);                 // un metro de fondo ocupa RPM filas
  for(let mx=camX;mx<=camX+colsM;mx++){
    const type=NV.sueloEn(mx,my);
    if(!type) continue;                         // más allá del mundo conocido
    const mt=MAT[type]||MAT.g;
    const sh=NV.sombraEn(mx,my);
    let lp=0.84+patch(mx,my,3,0.08)*0.40;
    let fam=mt.fam, grieta=0;
    if(mt.textura==='roca'){
      /* estratos: bandas horizontales de distinta dureza, como la roca de
         verdad, y dos tonos de piedra que se alternan en manchas grandes */
      lp *= 0.58 + patch(mx*0.7, my*2.6, 3, 0.30)*0.95;
      fam = patch(mx*0.25, my*0.25, 2, 0.09)>0.5 ? 'roca2' : 'piedra';
      grieta = patch(mx*1.4+50, my*1.4, 2, 0.5);
    } else if(mt.textura==='tierra'){
      lp *= 0.76 + patch(mx*0.9, my*1.3, 3, 0.22)*0.62;
    } else if(mt.textura==='caida'){
      lp *= 0.30;
    }
    /* la sombra no es sólo oscuridad: la llena la luz azul del cielo */
    const frio = NV.cielo.deNoche ? 0 : clamp((1-sh)*0.85,0,0.8);
    let light=clamp(sh*lp*haze,0,1.3);
    /* resplandor de la hoguera: más fuerte cuanto más oscuro esté todo */
    const fg0=NV.fuegoEn(mx,my);
    const calor = fg0 ? fg0*(1.55-Math.min(1,NV.luz.amb)*0.95)*titilar(t) : 0;
    if(calor) light=clamp(light+calor*0.85,0,2.0);
    const w=windAt(mx,my,t); wsum+=w; wn++;
    const bend = w>1.02?2 : w>0.66?1 : 0;
    const colG=packs(fam,light*(mt.agua||1),calor*0.75,frio);
    /* el fondo del metro: la misma materia, apagada. Esto es lo que llena los
       huecos de negro entre glifo y glifo y convierte el suelo en un manto. */
    const colF=packs(fam, light*(mt.agua||1)*0.40, calor*0.45, frio*0.8);
    const base=(mx-camX)*CPM;
    fondoBloque(base, top, CPM, RPM, colF);
    const grass=(type==='G'||type==='g'||type==='f');

    /* las RPM franjas se recorren de norte a sur: lo de más al sur tapa */
    for(let sy=0;sy<RPM;sy++){
      const rb=top+sy;
      if(!grass){
        for(let k=0;k<CPM;k++){
          const hc=hash3(mx*CPM+k,my*RPM+sy,5);
          const jit=0.80+((hc>>3)%100)/100*0.42;
          let dens=clamp(0.34+light*jit*0.78,0,1);
          if(type==='E'){
            /* la rompiente: olas que llegan al acantilado con el ritmo de la
               marea, más altas y más seguidas cuando el agua está crecida */
            const m=NV.cielo.clima?NV.cielo.clima.marea:{amplitud:0.5};
            const ritmo=1.1+m.amplitud*2.4;
            const rip=0.5+0.5*Math.sin(t*ritmo-(mx*CPM+k)*0.20+sy*0.45);
            dens=clamp(0.14+Math.pow(rip,2.4)*(0.7+m.amplitud*0.9),0,1);
          } else if(mt.agua){
            const este=NV.flujoEn(mx,my)===1;
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
      const colT=packs(mt.fam2||mt.fam,light*1.1,0,frio);
      const colM=packs(mt.fam,light*0.95,0,frio);
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
        const frioR=NV.cielo.deNoche?0:(iluminado?0.06:0.5);
        put(bc+cen+c,br-r,g.charCodeAt(0),packs('piedra',lit,0,frioR));
        const litF=(iluminado?1.0:0.42)*haze;        // dos caras, dos fondos
        fondo(bc+cen+c,br-r,packs('piedra',litF*0.36,0,frioR));
      }
      prevCi=ci;
    }
    return;
  }
  if(tr.k==='hoguera'){
    const tit=titilar(t);
    const brasa=packc(255,138,46), llama=packc(255,196,92), punta=packc(255,232,170);
    const lena=packs('corteza',0.85);
    /* los leños, cruzados */
    for(let c=-4;c<=4;c++){
      fondo(bc+c, br, packs('corteza',0.3));
      put(bc+c, br, (c%3===0)?72:104, lena);
      if(Math.abs(c)<3) put(bc+c, br-1, 104, lena);
    }
    /* las llamas, más angostas y más claras hacia arriba */
    const alto=Math.max(3,Math.round((2.1+tit*1.3)*HPM*0.42));
    for(let r=2;r<alto;r++){
      const u=(r-2)/(alto-2);
      const an=Math.max(0,Math.round((3.2-u*3.0)*(0.75+tit*0.4)));
      for(let c=-an;c<=an;c++){
        const h=hash3(tr.s+c, r, Math.floor(t*14));
        if((h%100) < 22+u*46) continue;
        const g = u>0.72?'\'':u>0.44?'^':(h%2?'%':'&');
        put(bc+c+Math.round(Math.sin(t*5+r*0.7)*u*2.2), br-r,
            g.charCodeAt(0), u>0.66?punta:u>0.3?llama:brasa);
      }
    }
    /* chispas que suben */
    for(let i=0;i<3;i++){
      const h=hash3(tr.s+i,9,0);
      const sube=((t*7+(h%100)/100)%1);
      put(bc+Math.round(Math.sin(t*3+i)*3), br-Math.round(2+sube*alto*1.8),
          46, punta);
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
      const famHoja = east<-0.15?(famC==='verde'?'verdeO':famC):famC;
      const frioHoja = NV.cielo.deNoche?0:(east<-0.15?0.42:0.10);
      put(bc+c-topSway,sr,g.charCodeAt(0),packs(famHoja,lit,0,frioHoja));
      if(u<0.88){
        /* el fondo de la copa se calcula por bandas de luz, no carácter por
           carácter: así las celdas vecinas comparten color y el volcado las
           pinta de una sola pasada */
        const banda=Math.round(east*2.5)/2.5;
        const litF=(0.50+0.60*((banda+1)/2)+0.18*Math.round(tN*3)/3)*haze;
        fondo(bc+c-topSway,sr,packs(famHoja,litF*0.34,0,frioHoja*1.1));
      }
    }
  }
  if(trunkR>0){
    const tw=tr.h>4.5?3:2, fam=sp.corteza;
    for(let r=0;r<trunkR;r++){
      const sr=br-r;
      const g=r<trunkR*0.35?WOOD.tronco[2]:r<trunkR*0.75?WOOD.tronco[1]:WOOD.tronco[0];
      for(let c=0;c<tw;c++){
        const lit=(0.60+0.42*(c/(tw-1||1)))*(0.82+0.3*(r/trunkR))*haze;
        put(bc+c-1,sr,g.charCodeAt(0),packs(fam,lit,0,0.12));
        fondo(bc+c-1,sr,packs(fam,0.30*haze,0,0.2));
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

NV.titilar=titilar; NV.dibujarNiebla=dibujarNiebla;
NV.draw=draw; NV.draw_=draw_;
