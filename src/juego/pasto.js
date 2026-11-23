/* Nativa Online — MOTOR DEL PASTO.
   Extraído de dibujar.js sin cambiar un glifo ni un color (lo vigila pruebas/dorado.js).
   Dibuja UNA franja de un metro de pasto: lo único que necesita del resto es el lienzo
   (put, packc, CPM, RPM), el ruido del mundo (hash3, tex2) y el empuje del viento.
   Contrato en docs/DISENO.md, "Arquitectura del mundo editable". */

/* ---------- PASTO COMPACTO (variante C de preview/pasto.js, aprobada por Marcos) ----------
   Superficie continua de marcas chicas: casi cada celda lleva un caracter (: ; ' ` - ~ " ! i , .)
   y encima trazos | / \ de 1 a 3 caracteres, nunca briznas largas. Seis tonos: bosque azulado
   muy oscuro, musgo triste, verde grisáceo frío, oliva apagado, reflejo claro y gris discreto.
   Las manchas de tono y de luminosidad vienen de ruido del mundo, medido una vez por franja
   de metro y no por celda. Las flores son pocas y van en grupitos, no sueltas. */
const PC_PAL=[[14,32,34, 22,46,48],[38,66,58, 54,88,76],[66,86,86, 84,106,106],
              [72,80,62, 90,98,76],[96,150,138, 134,184,170],[98,108,112, 120,130,134]];
const PC_CUM=[0.28,0.48,0.63,0.80,0.94,1.0];
const PC_MICRO=':;\'`-~"!i,.:;'.split('').map(ch=>ch.charCodeAt(0));
/* lo que el Modo Dios podrá ajustar: se lee de NV.pasto.cfg en cada franja, no de constantes */
const PC_CFG={cobertura:0.965, trazo:0.30, zona:0.55};
function pcColor(tono,u,lum,lf,calor){
  const p=PC_PAL[tono], m=lum*lf;
  let r=(p[0]+(p[3]-p[0])*u)*m, g=(p[1]+(p[4]-p[1])*u)*m, b=(p[2]+(p[5]-p[2])*u)*m;
  if(calor){ const k=Math.min(1.2,calor)*0.6; r+=168*k; g+=84*k; b+=22*k; }
  return packc(r,g,b);
}
/* los grupitos de flores de UN metro: baldosas de 6 m, un grupo en 1 de cada 9, de 3 a 6 flores */
const _flC=[0,0,0,0,0,0,0,0], _flS=[0,0,0,0,0,0,0,0], _flG=[0,0,0,0,0,0,0,0]; let _flN=0;
function pastoFlores(mx,my){
  _flN=0;
  const TS=6, tx=Math.floor(mx/TS), ty=Math.floor(my/TS), hh=hash3(tx+500,ty+500,9);
  if(hh%100>=11) return;
  const cx=tx*TS+1.2+((hh>>8)%100)/100*3.6, cy=ty*TS+1.2+((hh>>16)%100)/100*3.6, n=3+((hh>>3)%4);
  for(let i=0;i<n;i++){
    const hi=hash3(tx+500,ty+500,40+i);
    const fx=cx+(((hi%100)/100)-0.5)*2.2, fy=cy+((((hi>>8)%100)/100)-0.5)*1.1;
    if(Math.floor(fx)!==mx||Math.floor(fy)!==my) continue;
    _flC[_flN]=Math.min(CPM-1,Math.floor((fx-mx)*CPM));
    _flS[_flN]=Math.min(RPM-1,Math.floor((fy-my)*RPM));
    _flG[_flN]='@eo'.charCodeAt((hi>>16)%3); _flN++;
  }
}

/* antes de recorrer las franjas de un metro: calcula sus flores (sólo si es pasto) */
function pastoPreparar(mx,my,esPasto){ if(esPasto) pastoFlores(mx,my); else _flN=0; }

/* una franja (sy) del metro (mx,my): una marca por celda y trazos cortos encima.
   cerca: hay fuego cerca y cada celda recalcula su luz con afinar(). calidad: 0.42..1. */
function pastoFranja(mx,my,sy,rb,base,cerca,light,calor,dPasto,calidad){
  const cfg=PC_CFG;
  /* superficie compacta: una marca por celda casi siempre, trazos cortos encima */
  const y0=my+(sy+0.5)/RPM, cyb=my*RPM+sy;
  const lumZ=tex2(mx+0.5,y0,3.0), tonZ=tex2(mx+9.5,y0+5.3,2.2), corr=tex2(mx+17.5,y0-3.1,4.5);
  const cob=Math.min(0.985,cfg.cobertura*(0.78+0.22*calidad));
  /* lo que no cambia de una celda a otra de la franja, calculado una vez (mismas operaciones, mismo orden: mismo resultado) */
  const umbral=cob*1000, zonaT=(tonZ-0.5)*cfg.zona*1.4, zonaL=(1+(lumZ-0.45)*cfg.zona*1.6), trazo=cfg.trazo;
  const lf0=clamp(0.25+0.75*light,0.2,1.4), cx0=mx*CPM;
  for(let k=0;k<CPM;k++){
    const cx=cx0+k, h=hash3(cx,cyb,23);
    if((h%1000)>=umbral) continue;
    let lf, cal=calor;
    if(cerca){ afinar(k,sy); lf=_lz; cal=_cal; lf=clamp(0.25+0.75*lf,0.2,1.4); } else lf=lf0;
    let ro=clamp(((h>>10)%1000)/1000+zonaT,0,0.999), tono=0;
    while(tono<5&&ro>=PC_CUM[tono]) tono++;
    const u=((h>>20)%100)/100;
    let lum=(0.80+0.55*(((h>>4)%100)/100))*0.86*zonaL;
    lum=clamp(tono>=4?Math.max(lum,0.85):lum,0.35,1.5);
    const col=pcColor(tono,u,lum,lf,cal);
    if(((h>>14)%100)/100<trazo){
      const q=((h>>24)%100)/100, lr=((h>>8)%100)/100;
      /* el reposo es la textura aprobada; el viento sólo la inclina hacia el oeste, nunca al este,
         y cada trazo cambia en su propio momento (su dado) */
      const base0=q<0.22?-1:q>0.78?1:(corr<0.40?-1:corr>0.60?1:0);
      const vv=base0-dPasto*(1+0.45*(((h>>12)%1000)/1000-0.5));
      const lean=vv<-0.5?-1:vv>0.5?1:0;
      const L=lr<0.70?1:lr<0.94?2:3;
      const ch=(lean>0?'/':lean<0?'\\':'|').charCodeAt(0);
      for(let j=0;j<L;j++)
        put(base+k+Math.round(lean*j*0.6),rb-j,ch,(j===L-1&&L>1)?pcColor(Math.max(tono,1),u,Math.min(1.5,lum*1.1),lf,cal):col);
    } else put(base+k,rb,PC_MICRO[(h>>6)%PC_MICRO.length],col);
  }
  for(let f=0;f<_flN;f++) if(_flS[f]===sy) put(base+_flC[f],rb,_flG[f],packc(205,218,208));
}

/* Alta en el registro de motores. */
if(NV.motores) NV.motores.registrar({id:'pasto',nombre:'Pasto compacto',estado:'integrado',
  archivo:'src/juego/pasto.js',preview:'preview/pasto.html',prueba:'pruebas/pasto.js',
  caras:{dibujar:pastoFranja,
         editor:{parametros:{cobertura:{tipo:'cantidad',min:0.5,max:0.985,def:PC_CFG.cobertura},
                             trazo:{tipo:'cantidad',min:0,max:0.6,def:PC_CFG.trazo},
                             zona:{tipo:'cantidad',min:0,max:1,def:PC_CFG.zona}}}}});
NV.pasto={cfg:PC_CFG,color:pcColor,flores:pastoFlores};
