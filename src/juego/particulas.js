/* Nativa Online — partículas: hojas, polvo, chispas y luciérnagas.
   Reglas en docs/DISENO.md ("Partículas"). Sin dependencias ni compilación.

   No guardan estado. Cada partícula es una función del reloj: dado el instante y la
   semilla de su "ranura" (un árbol, una celda del mundo, una hoguera) se sabe dónde
   está y cuánto le queda de vida, igual que la lluvia. Por eso no hay nada que
   crezca ni que limpiar, y una prueba puede pedir el mismo instante dos veces.

   Viven en METROS del mundo (x, y y una altura z), no en filas: al cambiar el zoom
   cambian las letras que las dibujan, no dónde están. Se escriben con el orden de
   pintado de la fila donde están, así que una loma o un árbol más al sur las tapa. */

/* una partícula en el mundo: (x,y) en metros, z metros sobre el suelo de ahí */
function punto(x,y,z,code,col){
  const c=Math.floor((x-camX)*CPM);
  const r=Math.floor((y-camY)*RPM+RPM-1-z*HPM);
  alzaR=Math.round(NV.alturaEn(x,y)*HPM);
  ordR=Math.max(1,Math.floor(y)-camY+extNorte()+1);
  put(c,r,code,col);
  alzaR=0;
}
const _u=(h,s,m)=>((h>>s)%1000)/1000*m;       // un número de 0 a m sacado de unos bits del hash
const _fade=u=>Math.sin(Math.PI*u);            // 0 al nacer, 1 en la mitad, 0 al morir

/* Qué tanto se desprende de lo que hay según la estación. Los caducos sueltan hoja en otoño. */
const HOJA_ESTACION={primavera:0.18, verano:0.10, 'otoño':1.0, invierno:0.12};

function hojas(ts,objetos,L){
  const est='primavera';                                         // ya no hay estaciones
  const f=(HOJA_ESTACION[est]||0.15)*calidad;
  if(f<=0.02) return;
  const fam=est==='otoño'||est==='invierno'?'hoja':'verde';
  const deriva=0.45+wind*1.3;                                   // m/s hacia el oeste
  let n=0;
  for(const tr of objetos){
    if(tr.k!=='arbol'||(tr.sp!=='encino'&&tr.sp!=='alamo')) continue;
    for(let j=0;j<2;j++){
      const h=hash3(tr.s,j,77);
      if(((h>>3)%1000)/1000>f) continue;
      const T=5+_u(h,7,5), u=((ts/T)+_u(h,13,1))%1;
      if(u>0.97) continue;
      const alto=tr.h*(0.55+_u(h,17,0.35));
      const vuelo=u*T;
      const x=tr.x+0.5+(_u(h,21,1)-0.5)*tr.h*0.5-deriva*vuelo+Math.sin(vuelo*2.1+_u(h,5,6))*0.35;
      const y=tr.y+0.5+(_u(h,25,1)-0.5)*tr.h*0.4;
      const z=alto*(1-u);
      const g=((Math.floor(vuelo*3)+j)%3)===0?96:44;          // ` o , según cómo vaya girando
      punto(x,y,z,g,packs(fam,0.7+0.3*((h>>9)%3)/2));
      if(++n>160) return;
    }
  }
}

/* polvo: sólo cuando el viento está racheado, y sólo sobre arena y tierra seca */
function polvo(ts,colsM,rowsM,L){
  const k=wind-0.78; if(k<=0) return;
  const CELDA=4, x0=Math.floor(camX/CELDA)-2, x1=Math.ceil((camX+colsM)/CELDA)+1;
  const y0=Math.floor(camY/CELDA)-1, y1=Math.ceil((camY+rowsM)/CELDA)+1;
  const vel=1.6+wind*2.2;
  for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){
    const h=hash3(cx,cy,91);
    const suelo=NV.sueloEn(cx*CELDA+2,cy*CELDA+2); if(!suelo) continue;
    const m=MAT[suelo]; if(!m||(m.fam!=='arena'&&m.fam!=='tierra')||m.ola) continue;
    const cuantos=Math.min(3,Math.round(k*4*calidad+((h>>4)%100)/100));
    for(let j=0;j<cuantos;j++){
      const hj=hash3(cx*5+j,cy,93), T=2+_u(hj,5,2.5), u=((ts/T)+_u(hj,11,1))%1;
      const v=_fade(u); if(v<0.15) continue;
      const x=cx*CELDA+_u(hj,15,CELDA)-vel*u*T, y=cy*CELDA+_u(hj,21,CELDA)+Math.sin(u*T*1.7+j)*0.4;
      const z=0.15+_u(hj,25,0.5)+0.25*Math.sin(u*T*2.3);
      punto(x,y,z,v>0.7?45:46,packs(m.fam,0.55+0.5*v));
    }
  }
}

/* chispas: suben de cada hoguera, se van de lado con el viento y se apagan */
function chispas(ts,objetos){
  for(const tr of objetos){
    if(tr.k!=='hoguera') continue;
    for(let j=0;j<8;j++){
      const h=hash3(tr.s,j,31), T=0.9+_u(h,5,1.3), u=((ts/T)+_u(h,11,1))%1;
      const x=tr.x+0.5+Math.sin(u*T*5+_u(h,15,6))*0.22*u-wind*0.5*u*u+(_u(h,19,1)-0.5)*0.3;
      const y=tr.y+0.5+(_u(h,23,1)-0.5)*0.3;
      const z=0.35+u*(2.0+_u(h,3,1.6));
      const v=1-u;                                              // brillo: nace blanca-naranja y se va a rojo
      const code=u<0.35?42:u<0.7?43:46;
      punto(x,y,z,code,packc(255*(0.5+0.5*v),(210-150*u)*(0.4+0.6*v),(90-80*u)*v));
    }
  }
}

/* luciérnagas: sólo de noche y sin lluvia; vagan en lo suyo y se encienden a ratos */
function luciernagas(ts,colsM,rowsM,L){
  /* el mundo vive siempre de noche (luz de lunas): las luciérnagas salen siempre */
  if(!NV.LUZ_LUNAS||!NV.LUZ_LUNAS.luciernagas) return;
  const oscuro=1;
  const CELDA=5, x0=Math.floor(camX/CELDA)-1, x1=Math.ceil((camX+colsM)/CELDA)+1;
  const y0=Math.floor(camY/CELDA)-1, y1=Math.ceil((camY+rowsM)/CELDA)+1;
  for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++){
    const h=hash3(cx,cy,57); if((h>>3)%100>=45) continue;
    const suelo=NV.sueloEn(cx*CELDA+2,cy*CELDA+2); if(!suelo) continue;
    const m=MAT[suelo]; if(!m||!(m.mata||m.fam==='agua')||m.ola==='mar'||m.solido) continue;
    const fa=_u(h,9,6.28);
    if(Math.sin(ts*1.3+fa*9)<0.15) continue;                   // apagada
    const x=cx*CELDA+2.5+2.2*Math.sin(ts*0.31+fa), y=cy*CELDA+2.5+1.6*Math.sin(ts*0.23+fa*2);
    const z=0.5+0.45*Math.sin(ts*0.7+fa*3);
    const g=oscuro*(0.7+0.3*Math.sin(ts*5+fa));
    punto(x,y,z,42,packc(190*g,235*g,90*g));
  }
}

function dibujarParticulas(ts,objetos,colsM,rowsM){
  if(NV.particulas===false) return;               // interruptor de las pruebas
  const prev=layer; layer=3;
  const L=NV.luz;
  hojas(ts,objetos,L); polvo(ts,colsM,rowsM,L); chispas(ts,objetos); luciernagas(ts,colsM,rowsM,L);
  layer=prev; alzaR=0;
}
