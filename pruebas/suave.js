// Que el zoom y la cámara lleguen sin saltos, y que el lazo se apague solo.
const cargar=require('./cargar.js');
const cola=[]; global.requestAnimationFrame=f=>{ cola.push(f); return cola.length; };
const m=cargar('module.exports={NV:window.NV, animarSuave, draw_, tictac, me:()=>me, cols:()=>cols, rowsN:()=>rowsN, CPM:()=>CPM, RPM:()=>RPM, fontSize:()=>fontSize};');
const NV=m.NV, ok=[], mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac(); m.draw_();
let t=0;
const correr=n=>{ let c=0; for(let i=0;i<n;i++){ const f=cola.shift(); if(!f) break; t+=30; f(t); c++; } return c; };

console.log('=== la escala es continua, sin escalones ===');
console.log('  metros   CPM  RPM   letra   celdas   fondo');
let saltoMax=0, antes=null;
for(let met=NV.ZOOM.cerca;met<=NV.ZOOM.lejos+0.01;met+=(NV.ZOOM.lejos-NV.ZOOM.cerca)/8){
  NV.zoomAbsoluto(met); for(let i=0;i<80;i++) NV.acercarZoom(); m.draw_();
  const fila={met, cpm:m.CPM(), rpm:m.RPM(), fs:m.fontSize(), celdas:m.cols()*m.rowsN(), fondo:m.rowsN()/m.RPM()};
  if(true)
    console.log('   '+met.toFixed(1).padStart(5)+' m   '+String(fila.cpm).padStart(3)+'  '+String(fila.rpm).padStart(3)+
                '   '+fila.fs.toFixed(1)+'px   '+Math.round(fila.celdas/1000)+'k    '+Math.round(fila.fondo)+' m');
  if(antes) saltoMax=Math.max(saltoMax, Math.abs(fila.fs-antes.fs)/antes.fs);
  antes=fila;
}
console.log('  mayor salto en el tamaño de letra entre pasos:', (saltoMax*100).toFixed(0)+'%');
probar('la letra se mantiene casi igual en todo el rango', saltoMax<0.22);
probar('se puede parar en cualquier punto', (NV.zoomAbsoluto((NV.ZOOM.cerca+NV.ZOOM.lejos)/2.3), NV.metrosVista()!==undefined));

console.log('\n=== topes ===');
NV.zoomAbsoluto(1); for(let i=0;i<90;i++) NV.acercarZoom();
const min=NV.metrosVista();
NV.zoomAbsoluto(500); for(let i=0;i<90;i++) NV.acercarZoom();
const max=NV.metrosVista();
console.log('  se queda entre', min.toFixed(1), 'y', max.toFixed(1), 'metros de ancho ('
            +(NV.zoomPorcentaje(min)*100).toFixed(0)+'% y '+(NV.zoomPorcentaje(max)*100).toFixed(0)+'% de la escala de 9 a 72)');
probar('respeta el mínimo y el máximo', Math.abs(min-NV.ZOOM.cerca)<0.05 && Math.abs(max-NV.ZOOM.lejos)<0.05);
probar('el jugador sólo recorre del 20 al 40% de la escala completa',
       Math.abs(NV.zoomPorcentaje(min)-0.20)<0.005 && Math.abs(NV.zoomPorcentaje(max)-0.40)<0.005);
NV.zoomAbsoluto(NV.ZOOM.ini); for(let i=0;i<90;i++) NV.acercarZoom();
probar('arranca dentro del rango, en el medio', NV.metrosVista()>NV.ZOOM.cerca && NV.metrosVista()<NV.ZOOM.lejos
       && Math.abs(NV.zoomPorcentaje(NV.metrosVista())-0.30)<0.005);

console.log('\n=== el zoom llega de a poco ===');
NV.zoomAbsoluto(NV.ZOOM.lejos); for(let i=0;i<90;i++) NV.acercarZoom();
cola.length=0;
const DEST=NV.ZOOM.cerca*1.08; NV.zoomAbsoluto(DEST); m.animarSuave();
const cz=correr(120);
console.log('  del tope lejano a cerca del cercano:', cz, 'cuadros · quedó en', NV.metrosVista().toFixed(1), 'm');
probar('el zoom no salta de golpe', cz>8);
probar('el zoom llega a destino', Math.abs(NV.metrosVista()-DEST)<0.1);

console.log('\n=== la cámara persigue y se calma ===');
cola.length=0;
m.me().x+=3; m.animarSuave();
const cc=correr(120);
console.log('  tras tres pasos:', cc, 'cuadros hasta quedar quieta ·', NV.camQuieta?'quieta':'todavía se mueve');
probar('la cámara tarda en acomodarse, no salta', cc>5);
probar('la cámara termina quieta', NV.camQuieta===true);
probar('el lazo se apaga solo', cola.length===0);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);
