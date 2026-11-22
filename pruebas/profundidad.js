// Profundidad de imagen: cuánta información lleva cada celda y cuánto cuesta.
// Lo que el ojo lee como "textura" y no como "dibujo plano" sale de acá.
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV, draw_, tictac, fbG:()=>fbG, fbC:()=>fbC, fbB:()=>fbB, bloques:()=>bloques, nBloques:()=>nBloques, cols:()=>cols, rowsN:()=>rowsN};');
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
/* Se fija un mediodía: de noche no hay sombras que teñir y la medición
   cambiaría según la hora a la que se corra la prueba. */
const MEDIODIA=(1000+0.5)*m.NV.msPorDiaAstro;
m.NV.actualizarCielo(MEDIODIA);
m.NV.recalcularSombras();
m.draw_();
console.log('momento fijado:', m.NV.cielo.nombre, '· luz', m.NV.cielo.luz.amb.toFixed(2), '\n');

const cols=m.cols(), rowsN=m.rowsN(), total=cols*rowsN;
const G=m.fbG(), C=m.fbC(), B=m.fbB();

/* El fondo del suelo se pinta por bloques; para medir hay que reconstruirlo. */
const fondo=new Int32Array(total);
const bl=m.bloques();
for(let i=0;i<m.nBloques();i++){
  const [c0,r0,an,al,col]=bl[i];
  for(let r=r0;r<r0+al;r++) for(let c=c0;c<c0+an;c++){
    if(c<0||r<0||c>=cols||r>=rowsN) continue;
    fondo[r*cols+c]=col+1;
  }
}
for(let i=0;i<total;i++) if(B[i]) fondo[i]=B[i];

let sinNada=0;
const gg=new Map(), cc=new Map(), bb=new Map();
for(let i=0;i<total;i++){
  if(!G[i]&&!fondo[i]) sinNada++;
  gg.set(G[i],(gg.get(G[i])||0)+1);
  cc.set(G[i]?C[i]:0,(cc.get(G[i]?C[i]:0)||0)+1);
  bb.set(fondo[i],(bb.get(fondo[i])||0)+1);
}
const bits=mp=>{ let h=0; for(const v of mp.values()){ const p=v/total; h-=p*Math.log2(p); } return h; };
const bForma=bits(gg), bLetra=bits(cc), bFondo=bits(bb);

console.log('=== información por celda ===');
console.log('  forma de la letra:', bForma.toFixed(2), 'bits ·', gg.size-1, 'glifos distintos');
console.log('  color de la letra:', bLetra.toFixed(2), 'bits ·', cc.size-1, 'colores');
console.log('  color del fondo:  ', bFondo.toFixed(2), 'bits ·', bb.size-1, 'colores');
console.log('  TOTAL:', (bForma+bLetra+bFondo).toFixed(2), 'bits por celda');
probar('la imagen pasa de 17 bits por celda', bForma+bLetra+bFondo>17);

console.log('\n=== huecos negros ===');
console.log('  celdas sin letra ni fondo:', sinNada, '('+(sinNada/total*100).toFixed(1)+'%)');
probar('casi no queda negro puro', sinNada/total<0.02);

console.log('\n=== coste de pintar ===');
let tiradas=0;
for(let r=0;r<rowsN;r++){ let prev=-1; for(let c=0;c<cols;c++){ const v=B[r*cols+c]; if(v&&v!==prev) tiradas++; prev=v; } }
console.log('  bloques de suelo:', m.nBloques(), '· tiradas de objetos:', tiradas,
            '· total', m.nBloques()+tiradas, 'rectángulos para', total, 'celdas');
probar('el fondo se pinta en pocos rectángulos', m.nBloques()+tiradas < total/12);

console.log('\n=== oclusión: al pie de las cosas entra menos luz ===');
{
  const NV=m.NV, L=NV.LADO, p=NV.panel(0,0);
  let alPie=0,nPie=0, abierto=0,nAb=0;
  for(const t of p.trees){
    if(t.k!=='arbol') continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=t.x+dx, y=t.y+dy;
      if(x<0||y<0||x>=L||y>=L) continue;
      alPie+=p.ao[y*L+x]; nPie++;
    }
  }
  for(let y=4;y<L-4;y+=7) for(let x=4;x<L-4;x+=7){
    let cerca=false;
    for(let j=-3;j<=3&&!cerca;j++) for(let i=-3;i<=3;i++) if(p.occ[(y+j)*L+(x+i)]){ cerca=true; break; }
    if(cerca) continue;
    abierto+=p.ao[y*L+x]; nAb++;
  }
  console.log('  luz que llega — al pie de un árbol:', (alPie/nPie).toFixed(2),
              '· en campo abierto:', (abierto/nAb).toFixed(2));
  probar('al pie de los árboles entra menos luz', alPie/nPie < abierto/nAb*0.9);
}

console.log('\n=== la sombra es azul, no sólo oscura ===');
const az=(c)=>{ const r=(c>>16)&255,g=(c>>8)&255,b=c&255; return b-(r+g)/2; };
let sol=0,nsol=0, som=0,nsom=0;
const NV=m.NV;
for(let i=0;i<total;i++){
  if(!G[i]) continue;
  const f=fondo[i]?fondo[i]-1:0;
  const lum=((f>>16&255)+(f>>8&255)+(f&255))/3;
  if(lum>34){ sol+=az(f); nsol++; } else if(lum>6){ som+=az(f); nsom++; }
}
console.log('  tendencia al azul — a pleno sol:', (sol/nsol).toFixed(1), '· en sombra:', (som/nsom).toFixed(1));
probar('lo que está en sombra tira más al azul', som/nsom > sol/nsol);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);
