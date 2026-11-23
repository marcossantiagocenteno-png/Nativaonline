global.__viejo=true;
// HUELLA CON SECTORES DE TERRENO: lo mismo que dorado.js pero con sectores de varios tipos puestos en el mundo,
// incluyendo un cambio de sector a mitad del guion (la caché por metro tiene que invalidarse sola).
//   node pruebas/dorado-sectores.js           compara contra pruebas/dorado-sectores.json
//   node pruebas/dorado-sectores.js --grabar  graba la huella (sólo si el cambio visual es a propósito)
const fs=require('fs'); const ARCH=__dirname+'/dorado-sectores.json'; const grabar=process.argv.includes('--grabar');
const cargar=require('./cargar.js');
const m=cargar(`module.exports={ NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  estado:()=>({fbG,fbC,cols,rowsN}) };`);
const NV=m.NV, T=NV.terreno;
performance.now=()=>0; let AHORA=1000000; Date.now=()=>AHORA; m.tictac(); NV.particulas=false;
const fnv=(arr,n)=>{ let h=2166136261; for(let i=0;i<n;i++){ h^=arr[i]&0xffff; h=Math.imul(h,16777619)>>>0; h^=(arr[i]>>>16)&0xffff; h=Math.imul(h,16777619)>>>0; } return h.toString(16); };
T.nuevoMundo();
const A=T.agregar({nombre:'A',terreno:'pradera',x:40,y:40,w:30,h:24,pasto:{densidad:0.8,alto:0.7},flores:{cantidad:1.5,roja:true,amarilla:true,blanca:true,distribucion:'natural'}});
T.agregar({nombre:'B',terreno:'pantano',x:60,y:48,w:24,h:18,trans:{tipo:'organica',ancho:6}});
T.agregar({nombre:'C',terreno:'pradera',x:44,y:56,w:22,h:20,relieve:{tipo:'colinas',intensidad:0.7},trans:{tipo:'gradual',ancho:5},pasto:{estado:'seco'}});
T.agregar({nombre:'D',terreno:'pastonieve',x:30,y:44,w:14,h:14,pasto:{estado:'nieve-parcial',nieve:0.65},trans:{tipo:'irregular',ancho:4}});
const huella={};
const tomar=(nombre)=>{ for(const t of [8,17]){ NV.tViento=t; m.ponerYo(52,52); for(let i=0;i<3;i++) m.draw_(); const E=m.estado(), N=E.cols*E.rowsN; huella[nombre+'@'+t]=fnv(E.fbG,N)+'-'+fnv(E.fbC,N); } };
tomar('centro'); 
for(const [x,y] of [[40,40],[66,56],[36,50],[70,70]]){ NV.tViento=8; m.ponerYo(x,y); for(let i=0;i<3;i++) m.draw_(); const E=m.estado(), N=E.cols*E.rowsN; huella['sitio'+x+','+y]=fnv(E.fbG,N)+'-'+fnv(E.fbC,N); }
T.actualizar(A,{pasto:{estado:'quemado',densidad:0.4},flores:{cantidad:0.5}}); tomar('tras-cambio');
T.mover(A,44,42); tomar('tras-mover');
T.quitar(A); tomar('tras-quitar');
if(grabar){ fs.writeFileSync(ARCH,JSON.stringify(huella,null,1)+'\n'); console.log('huella grabada: '+Object.keys(huella).length+' cuadros'); process.exit(0); }
const ref=JSON.parse(fs.readFileSync(ARCH,'utf8')), malos=Object.keys(ref).filter(k=>ref[k]!==huella[k]);
console.log(Object.keys(ref).length+' cuadros con sectores comparados contra la huella');
if(malos.length){ console.log('  ✗ cambiaron: '+malos.join(', ')); process.exit(1); }
console.log('Todo igual con sectores: ni un glifo ni un color se movieron.');
