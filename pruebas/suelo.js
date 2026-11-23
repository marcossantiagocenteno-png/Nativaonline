// Suelo: que los materiales nuevos estén en el mundo, que la textura no salga
// como estática, que la arena tenga onda y que el pasto crezca a parches.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac, drawGroundRow,
  traerFilas, vecinoDe, f0:()=>_f0, MEZCLA,
  estado:()=>({fbG,fbC,cols,rowsN,CPM,RPM}),
  poner:(x,y)=>{camX=x;camY=y;}, capa:v=>{layer=v;},
  limpiar:()=>{fbG.fill(0);fbL.fill(0);}
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
NV.alturaEn=()=>0;     // miden otra cosa sobre suelo plano: la altura tiene su propia prueba (altura.js)

console.log('=== los materiales nuevos están en el mundo ===');
const DONDE={h:'pasto seco', n:'pasto nevado', b:'barro', y:'arena de mar', K:'canto de mar',
             L:'lago', l:'orilla del lago', O:'mar abierto'};
const hallados={};
for(const [pi,pj] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]){
  const p=NV.panel(pi,pj);
  for(const f of p.ground) for(const ch of f)
    if(DONDE[ch]) hallados[ch]=(hallados[ch]||0)+1;
}
for(const k in DONDE)
  console.log('  '+k+' '+DONDE[k].padEnd(16)+(hallados[k]?hallados[k]+' metros':'NO APARECE'));
probar('todos los materiales nuevos aparecen en el mundo',
  Object.keys(DONDE).every(k=>hallados[k]>0));

/* dibuja un parche de un material y devuelve las celdas */
function parche(mat,W,H){
  const e=m.estado();
  m.poner(0,0); m.limpiar(); m.capa(0);
  /* se pisa el suelo del panel para poder mirar un material cualquiera */
  const p=NV.panel(0,0), L=NV.LADO;
  const guardo=p.ground.slice();
  for(let y=0;y<H+2;y++) p.ground[y]=mat.repeat(L);
  for(let my=0;my<H;my++) m.drawGroundRow(my,(my+1)*e.RPM-1,1,0);
  p.ground=guardo;
  const st=m.estado(), fil=[];
  for(let r=0;r<H*st.RPM;r++){
    let s='';
    for(let c=0;c<W*st.CPM;c++){ const g=st.fbG[r*st.cols+c]; s+=g?String.fromCharCode(g):' '; }
    fil.push(s);
  }
  return fil;
}
/* largo medio de las tiradas de glifos iguales a lo largo de una fila: cerca de
   uno es estática, más de uno es textura con forma */
function tirada(fil){
  let tiradas=0, celdas=0;
  for(const f of fil){
    let prev=null;
    for(const ch of f){ if(ch===' ') { prev=null; continue; }
      if(ch!==prev) tiradas++; prev=ch; celdas++; }
  }
  return celdas/Math.max(1,tiradas);
}
console.log('\n=== la textura no es estática ===');
for(const [mat,nom] of [['s','arena de río'],['D','duna'],['d','tierra'],['b','barro'],['k','guijarral']]){
  const t=tirada(parche(mat,8,5));
  console.log('  '+nom.padEnd(14)+'largo medio de tirada: '+t.toFixed(2)+' celdas');
  probar('la textura de '+nom+' tiene forma, no estática', t>1.25);
  /* una tirada de catorce celdas es un metro entero del mismo glifo: eso ya es
     una raya. Por debajo de eso, una tirada larga es la onda o el terrón. */
  probar('la textura de '+nom+' no es una raya de un metro', t<14);
}

console.log('\n=== la arena tiene onda ===');
/* se cuenta cuántas veces cambia el glifo a lo largo de una fila: con onda son
   pocas tiradas largas, sin onda son muchas y cortas */
{
  const conOnda=tirada(parche('D',10,4)), sinOnda=tirada(parche('N',10,4));
  console.log('  duna '+conOnda.toFixed(2)+' celdas por tirada · nieve (sin onda) '+sinOnda.toFixed(2));
  probar('la onda de la duna alarga las tiradas', conOnda>sinOnda*1.15);
}

console.log('\n=== el pasto crece a parches ===');
/* se cuenta cuántas briznas hay por metro: si el pasto fuera parejo la
   diferencia entre metros sería mínima */
{
  const fil=parche('G',14,5), st=m.estado();
  const porMetro=[];
  for(let mx=0;mx<14;mx++){
    let n=0;
    for(const f of fil) for(let k=0;k<st.CPM;k++){
      const ch=f[mx*st.CPM+k];
      if(ch==='|'||ch==='/'||ch==='\\') n++;
    }
    porMetro.push(n);
  }
  const med=porMetro.reduce((a,b)=>a+b,0)/porMetro.length;
  const desv=Math.sqrt(porMetro.reduce((a,b)=>a+(b-med)*(b-med),0)/porMetro.length);
  /* Se compara el metro más tupido con el más ralo, y no el desvío contra la
     media: cuantas más briznas hay por metro —y hay más cuanto más cerca está
     la cámara— más chico sale el desvío relativo aunque el pasto varíe igual.
     El cociente entre extremos no depende del zoom. */
  const razon=Math.max(...porMetro)/Math.max(1,Math.min(...porMetro));
  console.log('  briznas por metro: '+med.toFixed(0)+' de media, desvío '+desv.toFixed(0)
              +' ('+Math.round(100*desv/med)+'%) · el metro más tupido tiene '
              +razon.toFixed(2)+' veces las del más ralo');
  probar('el pasto no sale parejo como una cancha', razon>1.30);
}

console.log('\n=== el borde no es una escalera de un metro ===');
/* El síntoma del escalón es que el borde está CLAVADO EN LA LÍNEA DEL METRO.
   Decidiendo por metro, el límite entre agua y tierra cae siempre justo donde
   empieza un metro, porque es ahí donde cambia la letra: el 100% de las veces.
   Decidiendo por celda, cae en cualquier parte, y por puro azar daría una de
   cada CPM. Se mide eso, que no se rompe con los meandros, en vez de comparar
   filas vecinas: con el arroyo doblando, "la primera celda de tierra" salta de
   una orilla a la otra y la medición no dice nada. */
{
  const st=m.estado(), CPM=st.CPM, RPM=st.RPM;
  const esAgua=k=>!!(NV.MAT[k]&&NV.MAT[k].agua);
  function medir(conMezcla){
    let enLinea=0, total=0;
    for(let my=20;my<80;my++){
      m.traerFilas(my,18,56);
      for(let sy=0;sy<RPM;sy++){
        const v=(sy+0.5)/RPM;
        let hubo=false;
        for(let mx=20;mx<54;mx++){
          const i=mx-m.f0(), type=NV.sueloEn(mx,my);
          if(!type) continue;
          for(let k=0;k<CPM;k++){
            const u=(k+0.5)/CPM, cx=mx*CPM+k, cy=my*RPM+sy;
            const tc=conMezcla?m.vecinoDe(i,type,u,v,cx,cy):type;
            if(esAgua(tc)){ hubo=true; continue; }
            if(hubo){ total++; if(k===0) enLinea++; hubo=false; }
          }
        }
      }
    }
    return {total:total, enLinea:enLinea, pct:100*enLinea/Math.max(1,total)};
  }
  const pm=medir(false), pc=medir(true);
  console.log('  por metro:  '+pm.total+' bordes · clavados en la línea del metro: '
              +pm.pct.toFixed(0)+'%');
  console.log('  por celda:  '+pc.total+' bordes · clavados en la línea del metro: '
              +pc.pct.toFixed(0)+'%  (el azar daría '+(100/CPM).toFixed(0)+'%)');
  probar('por metro el borde está clavado en la grilla', pm.pct>90);
  probar('por celda el borde se suelta de la grilla', pc.pct<40);
}

console.log('\n=== coste del cuadro ===');
m.tictac();
const t0=Date.now(); for(let i=0;i<12;i++) m.draw_();
const ms=(Date.now()-t0)/12;
console.log('  armar un cuadro: '+ms.toFixed(1)+' ms');
probar('un cuadro se arma en menos de 90 ms', ms<90);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
