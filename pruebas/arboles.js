// Árboles: que los nueve modelos se dibujen, con corteza en crestas, nudos,
// huecos de cielo en la copa y una textura distinta por especie.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, drawArbol, tictac, draw_,
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY}),
  poner:(x,y)=>{camX=x;camY=y;},
  capa:v=>{layer=v;},
  limpiar:()=>{fbG.fill(0);fbL.fill(0);}
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
NV.actualizarCielo(Date.UTC(2026,4,1,12,0,0));     // mediodía fijo: sin azar de hora
m.tictac();

const ALTO={pino:5.6,encino:4.0,alamo:5.2};
const G=s=>String.fromCharCode(s);

function dibujarUno(sp,v){
  const e=m.estado();
  m.poner(0,0); m.limpiar(); m.capa(2);
  /* s elige la variante: s%3 */
  const tr={x:Math.floor(e.cols/e.CPM/2), y:Math.floor(e.rowsN/e.RPM)-4,
            h:ALTO[sp], k:'arbol', sp:sp, s:v};
  m.drawArbol(tr,1,0);
  const st=m.estado(), celdas=[];
  for(let r=0;r<st.rowsN;r++) for(let c=0;c<st.cols;c++){
    const g=st.fbG[r*st.cols+c];
    if(g) celdas.push({c,r,g:G(g)});
  }
  return {tr:tr,celdas:celdas,st:st};
}

console.log('=== los nueve modelos dibujan algo ===');
let minimo=1e9;
for(const sp of ['pino','encino','alamo']) for(let v=0;v<3;v++){
  const d=dibujarUno(sp,v);
  const id=NV.MODELOS[sp][v].id;
  console.log('  '+id.padEnd(10)+' '+String(d.celdas.length).padStart(5)+' glifos');
  minimo=Math.min(minimo,d.celdas.length);
}
probar('ningún modelo sale vacío', minimo>200);

console.log('\n=== la corteza son crestas verticales, no ruido ===');
/* Por cada columna del tronco se mira cuántas filas repiten el glifo más
   frecuente de esa columna. Con ruido celda por celda eso ronda 1/3; con
   crestas que se mantienen, pasa la mitad. */
for(const sp of ['pino','encino','alamo']){
  const d=dibujarUno(sp,2);
  const placa=new Set(NV.SPECIES[sp].placa.concat([NV.SPECIES[sp].veta]));
  const porCol=new Map();
  for(const x of d.celdas) if(placa.has(x.g)){
    if(!porCol.has(x.c)) porCol.set(x.c,[]);
    porCol.get(x.c).push(x.g);
  }
  let suma=0,n=0;
  porCol.forEach(lista=>{
    if(lista.length<4) return;
    const cuenta={}; let mejor=0;
    for(const g of lista){ cuenta[g]=(cuenta[g]||0)+1; if(cuenta[g]>mejor) mejor=cuenta[g]; }
    suma+=mejor/lista.length; n++;
  });
  const coh=n?suma/n:0;
  console.log('  '+sp.padEnd(7)+' coherencia vertical de la corteza: '+(coh*100).toFixed(0)+'%'
              +' ('+n+' columnas)');
  probar('la corteza del '+sp+' se mantiene a lo alto', coh>0.50);
}

console.log('\n=== los nudos se dibujan ===');
for(const sp of ['pino','encino','alamo']){
  const mod=NV.MODELOS[sp], conNudo=mod.findIndex(x=>x.nudos.length>0);
  const d=dibujarUno(sp,conNudo);
  /* el nudo lleva su reborde claro arriba: una tilde donde no hay follaje */
  const tildes=d.celdas.filter(x=>x.g==='~').length;
  console.log('  '+mod[conNudo].id.padEnd(10)+' nudos en el modelo: '+mod[conNudo].nudos.length
              +' · rebordes dibujados: '+tildes);
  probar('se ven los nudos del '+sp, tildes>0);
}

console.log('\n=== la copa deja pasar cielo ===');
for(const sp of ['pino','encino','alamo']){
  const d=dibujarUno(sp,0);
  const hojas=d.celdas.filter(x=>NV.SPECIES[sp].copa.indexOf(x.g)>=0
                               || NV.SPECIES[sp].borde.indexOf(x.g)>=0);
  if(!hojas.length){ probar('la copa del '+sp+' deja pasar cielo', false); continue; }
  const c0=Math.min(...hojas.map(x=>x.c)), c1=Math.max(...hojas.map(x=>x.c));
  const r0=Math.min(...hojas.map(x=>x.r)), r1=Math.max(...hojas.map(x=>x.r));
  const caja=(c1-c0+1)*(r1-r0+1);
  const lleno=hojas.length/caja;
  console.log('  '+sp.padEnd(7)+' copa de '+(c1-c0+1)+'×'+(r1-r0+1)
              +' · llena al '+(lleno*100).toFixed(0)+'%');
  probar('la copa del '+sp+' no es un borrón ni un fantasma', lleno>0.12&&lleno<0.82);
}

console.log('\n=== cada especie tiene su textura ===');
const firma={};
for(const sp of ['pino','encino','alamo']){
  const d=dibujarUno(sp,0);
  const cuenta={};
  for(const x of d.celdas) cuenta[x.g]=(cuenta[x.g]||0)+1;
  firma[sp]=Object.entries(cuenta).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);
  console.log('  '+sp.padEnd(7)+' glifos más usados: '+firma[sp].join(' '));
}
/* La regla 3 del diccionario: el extremo ralo ". ," se comparte y la identidad
   vive en el extremo denso. Así que no se mide cuántos glifos comparten en
   total —el ralo lo comparten a propósito— sino que el glifo más usado de cada
   especie sea distinto, y se informa qué comparten en el extremo denso. */
probar('el glifo más usado del pino no es el del encino', firma.pino[0]!==firma.encino[0]);
probar('el glifo más usado del álamo no es el del encino', firma.alamo[0]!==firma.encino[0]);
probar('el glifo más usado del pino no es el del álamo', firma.pino[0]!==firma.alamo[0]);
const denso=sp=>NV.SPECIES[sp].copa.slice(-2);
for(const [a,b] of [['pino','encino'],['alamo','encino'],['pino','alamo']]){
  const comp=denso(a).filter(g=>denso(b).indexOf(g)>=0);
  if(comp.length) console.log('  ojo — '+a+' y '+b+' comparten el extremo denso: '+comp.join(' '));
}

console.log('\n=== coste de un cuadro con el bosque entero ===');
m.tictac();
const t0=Date.now(); for(let i=0;i<12;i++) m.draw_();
const ms=(Date.now()-t0)/12;
console.log('  armar un cuadro: '+ms.toFixed(1)+' ms');
probar('un cuadro se arma en menos de 90 ms', ms<90);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
