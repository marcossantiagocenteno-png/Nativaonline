// Zoom: que la escala del mundo se mueva sin saltos y que el acercamiento planee.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== la escala del mundo a lo largo de todo el zoom ===');
let peorX=0,peorY=0,mX=0,mY=0, prev=null;
const paso=[];
for(let m=NV.ZOOM.cerca;m<=NV.ZOOM.lejos*1.0001;m*=1.01){
  NV.zoomAbsoluto(m); while(NV.acercarZoom()){}
  const d=NV.medidas();
  if(prev){
    const sx=Math.abs(d.pxmX/prev.pxmX-1), sy=Math.abs(d.pxmY/prev.pxmY-1);
    if(sx>peorX){peorX=sx;mX=m;} if(sy>peorY){peorY=sy;mY=m;}
    paso.push([m,sy]);
  }
  prev=d;
}
console.log('  salto mayor a lo ancho:', (peorX*100).toFixed(1)+'% (a los '+mX.toFixed(0)+' m)');
console.log('  salto mayor a lo alto: ', (peorY*100).toFixed(1)+'% (a los '+mY.toFixed(0)+' m)');
/* Cada muestra avanza un 1% de zoom, así que un salto sano ronda el 1%. */
probar('a lo ancho no hay escalones', peorX<0.03);
probar('a lo alto no hay escalones', peorY<0.03);

console.log('\n=== la letra se queda del mismo tamaño ===');
let lmin=1e9,lmax=0;
for(let m=NV.ZOOM.cerca;m<=NV.ZOOM.lejos*1.0001;m*=1.03){ NV.zoomAbsoluto(m); while(NV.acercarZoom()){}
  const l=NV.medidas().letra; if(l<lmin)lmin=l; if(l>lmax)lmax=l; }
console.log('  entre', lmin.toFixed(1), 'y', lmax.toFixed(1), 'px');
probar('la letra no cambia de tamaño con el zoom', lmax/lmin<1.35);

console.log('\n=== un giro largo de ruedita planea, no salta ===');
NV.zoomAbsoluto(NV.ZOOM.lejos); while(NV.acercarZoom()){}
for(let i=0;i<14;i++) NV.zoomRelativo(0.94);     // catorce clics de golpe: llega al tope cercano
let cuadros=0, mayor=0, antes=NV.medidas().metros;
while(NV.acercarZoom() && cuadros<400){
  const ahora=NV.medidas().metros;
  mayor=Math.max(mayor,Math.abs(Math.log(ahora/antes)));
  antes=ahora; cuadros++;
}
console.log('  destino', NV.medidas().metros.toFixed(1), 'm · recorrido en', cuadros,
            'cuadros · paso mayor', (mayor*100).toFixed(1)+'% por cuadro');
probar('el giro no se resuelve de un salto', cuadros>14);
probar('ningún cuadro avanza más del 5%', mayor<=0.0501);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
