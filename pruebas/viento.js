// El viento global: ciclo de 20 s, siempre de este a oeste, y lo que hace en el pasto y en los árboles.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  estado:()=>({fbG,fbC,cols,rowsN})
};`);
const NV=m.NV, V=NV.viento; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0;                       // calidad congelada: dos cuadros iguales salen iguales
m.tictac(); NV.particulas=false;
V.cfg.x0=0;

console.log('=== el ciclo de 20 s ===');
const I=t=>V.local(0,0,t);
let calma=0; for(let t=0;t<=11.5;t+=0.5) calma=Math.max(calma,V.envolvente(t));
console.log('  envolvente máxima en 0-12 s: '+calma.toFixed(2)+' · en 14,9 s: '+V.envolvente(14.9).toFixed(2)+' · en 17 s: '+V.envolvente(17).toFixed(2));
probar('0 a 12 s es calma (nada de viento general)', calma===0);
probar('12 a 15 s la brisa sube sin pasar de 0,30', V.envolvente(13.5)>0.02&&V.envolvente(14.99)<=0.3001);
probar('15 a 18 s la ráfaga llega al máximo', V.envolvente(17)>0.99);
probar('18 a 20 s baja y en el 20 desaparece', V.envolvente(19)<0.6&&V.envolvente(19)>0&&Math.abs(V.envolvente(19.999))<0.001);
let salto=0; for(let t=0;t<40;t+=0.01) salto=Math.max(salto,Math.abs(V.envolvente(t%20+0.01)-V.envolvente(t%20)));
probar('el ciclo no da saltos (ni al repetirse)', salto<0.02&&Math.abs(V.envolvente(0)-V.envolvente(20))<1e-9);
probar('el estado dice la fase correcta', V.estado(5).fase==='calma'&&V.estado(13).fase==='brisa'&&V.estado(16).fase==='ráfaga'&&V.estado(19).fase==='reposo');

console.log('\n=== de este a oeste ===');
/* la ráfaga entra por el este: en el mismo instante, lo que está más al este va más adelantado */
let masEste=0, masOeste=0; for(let y=0;y<30;y+=2){ masEste+=V.local(14,y,13); masOeste+=V.local(-14,y,13); }
console.log('  intensidad a 14 m al este '+masEste.toFixed(2)+' · a 14 m al oeste '+masOeste.toFixed(2)+' (t=13 s)');
probar('el este recibe la brisa antes que el oeste', masEste>masOeste*1.5);
probar('la dirección es hacia el oeste', V.DIR.x===-1&&V.DIR.y===0);
/* pasto: nunca empuja al este */
let neg=0; for(let t=0;t<40;t+=0.7) for(let x=-20;x<20;x+=3) if(NV.vientoPasto(x,x*0.5,t)<0) neg++;
probar('el empuje del pasto nunca es hacia el este', neg===0);

console.log('\n=== calma casi quieta, con movimientos pequeños y dispersos ===');
let activos=0,total=0; for(let x=0;x<60;x+=1.7) for(let y=0;y<60;y+=1.7){ total++; if(V.local(x,y,5)>0.05) activos++; }
console.log('  sectores que se mueven en la calma (t=5 s): '+(100*activos/total).toFixed(0)+' %');
probar('en la calma se mueve una minoría de sectores (menos del 35 %)', activos<total*0.35);
probar('y alguno sí se mueve', activos>0);
/* cerca de la referencia (±5 m); más al este la brisa ya empezó, porque la corriente viaja */
let max=0; for(let t=0;t<11;t+=0.2) for(let x=-5;x<=5;x+=1.7) max=Math.max(max,V.local(x,3,t));
console.log('  el movimiento más fuerte de la calma: '+max.toFixed(2)+' (la ráfaga llega a ~0,6 con el perfil A)');
probar('los movimientos de la calma son leves (menos de la mitad de una ráfaga)', max<0.3);

console.log('\n=== cada tipo responde distinto al mismo viento ===');
const R=n=>{ let s=0,c=0; for(let t=14;t<19;t+=0.1){ s=Math.max(s,V.respuesta(n,0,0,t).mov); } return s; };
const pasto=R('pasto'), flor=R('flor'), rama=R('arbol.rama'), tronco=R('arbol.tronco');
console.log('  máximo: pasto '+pasto.toFixed(2)+' · flor '+flor.toFixed(2)+' · rama '+rama.toFixed(2)+' · tronco '+tronco.toFixed(2));
probar('la flor se mueve más que el pasto', flor>pasto*1.8);
probar('la rama más que el tronco', rama>tronco*1.5);
/* inercia: lo pesado llega tarde */
const llega=n=>{ for(let t=12;t<19;t+=0.05) if(V.respuesta(n,0,0,t).I>0.12) return t; return 99; };
probar('el tronco reacciona más tarde que el pasto', llega('arbol.tronco')>llega('pasto'));
probar('las hojas reaccionan con retraso respecto a las ramas', llega('arbol.hoja')>llega('arbol.rama'));
V.registrar('cultivo-de-prueba',{amp:2});
probar('se pueden registrar tipos nuevos sin tocar el motor', V.respuesta('cultivo-de-prueba',0,0,16.5).mov>0);

console.log('\n=== en el juego ===');
const cuadro=t=>{ NV.tViento=t; m.ponerYo(20,20); m.draw_(); const E=m.estado(); return {G:E.fbG.slice(),C:E.fbC.slice(),n:E.cols*E.rowsN}; };
const dif=(a,b)=>{ let d=0,n=0; for(let i=0;i<a.n;i++) if(a.G[i]||b.G[i]){ n++; if(a.G[i]!==b.G[i]||a.C[i]!==b.C[i]) d++; } return 100*d/n; };
const c8=cuadro(8), c8b=cuadro(8.5), c17=cuadro(17);
console.log('  cuadro del juego: cambia '+dif(c8,c8b).toFixed(2)+' % en la calma y '+dif(c8,c17).toFixed(1)+' % en la ráfaga');
probar('en la calma el cuadro casi no cambia (menos del 3 %)', dif(c8,c8b)<3);
probar('en la ráfaga el pasto sí se inclina', dif(c8,c17)>2);
probar('el mismo instante da el mismo cuadro (no hay azar propio)', dif(cuadro(17),cuadro(17))===0);
const cuenta=c=>{ let e=0,o=0; for(let i=0;i<c.n;i++){ if(c.G[i]===47) e++; else if(c.G[i]===92) o++; } return [e,o]; };
const [e8,o8]=cuenta(c8), [e17,o17]=cuenta(c17);
console.log('  trazos "/" (este) y "\\" (oeste): calma '+e8+'/'+o8+' · ráfaga '+e17+'/'+o17);
probar('la ráfaga cambia trazos hacia el oeste y quita hacia el este', o17>o8&&e17<e8);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:\n  ✗ '+mal.join('\n  ✗ '):''));
process.exit(mal.length?1:0);
