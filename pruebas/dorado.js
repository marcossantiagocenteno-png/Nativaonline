// PRUEBA DORADA: la huella de varios cuadros del juego. Es la red de seguridad de cualquier
// refactor: si un cambio "que no debía tocar nada" mueve UN solo glifo o color, esto falla.
//   node pruebas/dorado.js            compara contra pruebas/dorado.json
//   node pruebas/dorado.js --grabar   vuelve a grabar la huella (SOLO cuando el cambio visual es a propósito)
// Reloj congelado y azar propio: los cuadros salen idénticos en cualquier máquina.
const fs=require('fs'), {spawnSync}=require('child_process');
const ARCH=__dirname+'/dorado.json';
const grabar=process.argv.includes('--grabar');
const hijo=process.argv.includes('--hijo');           // el mismo guion, con árboles
if(hijo) global.__arboles=true;
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  estado:()=>({fbG,fbC,cols,rowsN})
};`);
const NV=m.NV;
performance.now=()=>0; let AHORA=1000000; Date.now=()=>AHORA;
m.tictac(); NV.particulas=false;

const fnv=(arr,n)=>{ let h=2166136261; for(let i=0;i<n;i++){ h^=arr[i]&0xffff; h=Math.imul(h,16777619)>>>0; h^=(arr[i]>>>16)&0xffff; h=Math.imul(h,16777619)>>>0; } return h.toString(16); };
/* sitios: el centro de cada panel, la hoguera del claro, una orilla y un borde de panel */
const SITIOS={claro:[50,50],hoguera:[54,56],arroyo:[34,40],oeste:[-50,50],este:[150,50],norte:[50,-50],sur:[50,150],
              esquinaNO:[-50,-50],esquinaSE:[150,150],costura:[0,50]};
const huella={};
for(const [n,[x,y]] of Object.entries(SITIOS)) for(const t of [8,17]){
  NV.tViento=t; m.ponerYo(x,y); for(let i=0;i<3;i++) m.draw_();
  const E=m.estado(), N=E.cols*E.rowsN;
  huella[n+'@'+t]=fnv(E.fbG,N)+'-'+fnv(E.fbC,N);
}
if(!hijo){
  /* la segunda mitad: el mismo guion con árboles */
  const r=spawnSync(process.execPath,[__filename,'--hijo'],{encoding:'utf8',maxBuffer:1<<26});
  const o=JSON.parse(r.stdout.trim().split('\n').pop());
  for(const k in o) huella['arboles:'+k]=o[k];
  if(grabar){ fs.writeFileSync(ARCH,JSON.stringify(huella,null,1)+'\n'); console.log('huella grabada: '+Object.keys(huella).length+' cuadros'); process.exit(0); }
  const ref=JSON.parse(fs.readFileSync(ARCH,'utf8'));
  const malos=Object.keys(ref).filter(k=>ref[k]!==huella[k]), extra=Object.keys(huella).filter(k=>!(k in ref));
  console.log(Object.keys(ref).length+' cuadros comparados contra la huella dorada');
  if(malos.length||extra.length){ console.log('  ✗ cambiaron: '+malos.concat(extra).join(', ')); process.exit(1); }
  console.log('Todo igual: ni un glifo ni un color se movieron.');
} else console.log(JSON.stringify(huella));
