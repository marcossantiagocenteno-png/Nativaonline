// Piedra: que los quince modelos dibujen, que el grano no salga a cuadros, que
// la cara que da al sol se distinga de la otra y que el voladizo exista.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, drawRoca, drawMuro, draw_, tictac,
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM}),
  poner:(x,y)=>{camX=x;camY=y;}, capa:v=>{layer=v;},
  limpiar:()=>{fbG.fill(0);fbL.fill(0);}
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
NV.actualizarCielo(Date.UTC(2026,4,1,12,0,0));
m.tictac();
const G=s=>String.fromCharCode(s);
const ALTO={pequena:0.55,media:1.20,grande:2.50,gigante:6.00};

function una(cat,v,alto){
  const e=m.estado();
  m.poner(0,0); m.limpiar(); m.capa(2);
  const tr={x:Math.floor(e.cols/e.CPM/2), y:Math.floor(e.rowsN/e.RPM)-6,
            h:alto||ALTO[cat], k:'roca', s:v};
  m.drawRoca(tr,1,0);
  const st=m.estado(), cel=[];
  for(let r=0;r<st.rowsN;r++) for(let c=0;c<st.cols;c++){
    const g=st.fbG[r*st.cols+c];
    if(g) cel.push({c,r,g:G(g),col:st.fbC[r*st.cols+c]});
  }
  return cel;
}

console.log('=== los doce modelos con silueta dibujan algo ===');
let minimo=1e9;
for(const cat of ['pequena','media','grande','gigante']) for(let v=0;v<3;v++){
  const cel=una(cat,v);
  console.log('  '+NV.ROCAS[cat][v].id.padEnd(8)+' '+String(cel.length).padStart(5)+' glifos');
  minimo=Math.min(minimo,cel.length);
}
/* una piedra de medio metro a este zoom son tres filas: no se le puede pedir
   mucho más que treinta glifos */
probar('ningún modelo de piedra sale vacío', minimo>12);

console.log('\n=== el grano no sale a cuadros ===');
/* Con una sola octava en bloques, el grano daba tiradas de tres glifos iguales
   seguidos. Se mide el largo medio de esas tiradas: cerca de uno es grano,
   cerca de tres es cuadrícula. */
for(const cat of ['media','grande','gigante']){
  const cel=una(cat,0);
  const fila=new Map();
  for(const x of cel){ if(!fila.has(x.r)) fila.set(x.r,[]); fila.get(x.r).push(x); }
  let tiradas=0, celdas=0;
  fila.forEach(lista=>{
    lista.sort((a,b)=>a.c-b.c);
    let prevG=null, prevC=-9;
    for(const x of lista){
      if(x.g!==prevG||x.c!==prevC+1) tiradas++;
      prevG=x.g; prevC=x.c; celdas++;
    }
  });
  const largo=celdas/tiradas;
  console.log('  '+cat.padEnd(8)+' largo medio de tirada: '+largo.toFixed(2)+' celdas');
  probar('el grano de la '+cat+' no es una cuadrícula', largo<2.0);
}

console.log('\n=== la cara que da al sol se distingue de la otra ===');
for(const cat of ['media','grande','gigante']){
  const cel=una(cat,1);
  const cs=cel.map(x=>x.c), c0=Math.min(...cs), c1=Math.max(...cs);
  const brillo=x=>{const v=x.col;return ((v>>16&255)+(v>>8&255)+(v&255))/3;};
  const oeste=cel.filter(x=>x.c<c0+(c1-c0)*0.3), este=cel.filter(x=>x.c>c1-(c1-c0)*0.3);
  const bo=oeste.reduce((a,x)=>a+brillo(x),0)/Math.max(1,oeste.length);
  const be=este.reduce((a,x)=>a+brillo(x),0)/Math.max(1,este.length);
  console.log('  '+cat.padEnd(8)+' oeste '+bo.toFixed(0)+' · este '+be.toFixed(0));
  probar('en la '+cat+' el este está más iluminado que el oeste', be>bo*1.25);
}

console.log('\n=== el voladizo existe ===');
/* Con el método viejo —mínimo y máximo de todos los cortes— la concavidad se
   rellenaba y la piedra quedaba más ancha abajo que arriba siempre. */
{
  const cel=una('grande',1);          // gra-2, la roca en voladizo
  /* Se miden sólo las filas MACIZAS: las del derrumbe tienen huecos y se
     desparraman más ancho que la piedra, y ensanchaban la medición sin que la
     masa fuera más ancha. Una fila es maciza si tiene un glifo en cada celda
     entre su borde izquierdo y su derecho. */
  const porFila=new Map();
  for(const x of cel){
    let f=porFila.get(x.r);
    if(!f){ f={a:x.c,b:x.c,n:0}; porFila.set(x.r,f); }
    if(x.c<f.a) f.a=x.c; if(x.c>f.b) f.b=x.c; f.n++;
  }
  const macizas=[...porFila.entries()]
    .filter(([r,f])=>f.n===f.b-f.a+1).sort((p,q)=>p[0]-q[0]);
  const anchos=macizas.map(([r,f])=>f.b-f.a+1);
  const arriba=Math.max(...anchos), alPie=anchos[anchos.length-1];
  console.log('  la masa mide '+arriba+' celdas en lo más ancho y '+alPie+' al pie'
              +' ('+macizas.length+' filas macizas)');
  probar('el voladizo es más ancho arriba que al pie', arriba>alPie*1.12);
}

console.log('\n=== el muro del acantilado: las tajadas calzan ===');
/* Cada tajada es un metro de norte a sur. El ruido se muestrea en coordenadas
   del mundo, así que dos vecinas tienen que quedar casi a la misma altura: si
   saltaran, la pared saldría como una sierra. */
for(let mod=0;mod<3;mod++){
  const e=m.estado();
  m.poner(0,0); m.limpiar(); m.capa(2);
  const alturas=[];
  for(let y=4;y<4+14;y++){
    m.limpiar();
    m.drawMuro({x:Math.floor(e.cols/e.CPM/2), y:y, h:NV.ROCAS.acantilado[mod].alto,
                k:'muro', mod:mod, s:1}, 1, 0);
    const st=m.estado();
    let top=1e9;
    for(let r=0;r<st.rowsN;r++) for(let c=0;c<st.cols;c++)
      if(st.fbG[r*st.cols+c]){ top=Math.min(top,r); }
    alturas.push(top);
  }
  let peor=0;
  for(let i=1;i<alturas.length;i++) peor=Math.max(peor,Math.abs(alturas[i]-alturas[i-1]));
  console.log('  '+NV.ROCAS.acantilado[mod].id+' salto mayor entre tajadas vecinas: '+peor+' filas');
  probar('el muro '+NV.ROCAS.acantilado[mod].id+' no sale como una sierra', peor<=6);
}

console.log('\n=== las gigantes ocupan lo que miden ===');
{
  /* p.trees guarda coordenadas LOCALES del panel, no del mundo: se mira el occ
     del propio panel y no solidoEn, que espera coordenadas del mundo. */
  const p=NV.panel(0,1), L=NV.LADO;
  const gig=p.trees.filter(t=>t.k==='roca'&&t.h>=3.5);
  let mal_=0;
  for(const t of gig){
    const an=Math.max(2,Math.round(t.h*0.65));
    for(let dx=-an;dx<=an;dx++) if(!p.occ[t.y*L+t.x+dx]) mal_++;
  }
  console.log('  '+gig.length+' gigantes · celdas de su pie que no son macizas: '+mal_);
  probar('no se puede caminar por adentro de una gigante', gig.length>0&&mal_===0);
}

console.log('\n=== coste de un cuadro ===');
m.tictac();
const t0=Date.now(); for(let i=0;i<12;i++) m.draw_();
const ms=(Date.now()-t0)/12;
console.log('  armar un cuadro: '+ms.toFixed(1)+' ms');
probar('un cuadro se arma en menos de 90 ms', ms<90);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
