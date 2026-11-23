// SECTORES EN CHROME REAL: tres sectores de terreno en pantalla y 4 s caminando; informa FPS y tiempos.
//   node pruebas/chrome-sectores.js [?query] [etiqueta]      (necesita puppeteer-core y Chrome; si no, se salta)
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const q=process.argv[2]||'', tag=process.argv[3]||'';
(async()=>{ const b=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--window-size=1200,700']});
 const p=await b.newPage(); await p.setViewport({width:1200,height:700}); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'..','index.html')+q,{waitUntil:'load'}); await new Promise(r=>setTimeout(r,2500));
 const info=await p.evaluate(()=>{ const T=NV.terreno; const px=NV.camXf||36, py=NV.camYf||31;
   T.agregar({nombre:'A',terreno:'pradera',x:Math.floor(px)-6,y:Math.floor(py)-4,w:60,h:40,pasto:{densidad:0.8,alto:0.7,tono:'natural'},flores:{cantidad:1.5,roja:true,amarilla:true,blanca:true,distribucion:'natural'},relieve:{tipo:'plano'}});
   T.agregar({nombre:'B',terreno:'pantano',x:Math.floor(px)+10,y:Math.floor(py)+2,w:30,h:20,trans:{tipo:'organica',ancho:6}});
   T.agregar({nombre:'C',terreno:'pradera',x:Math.floor(px)-2,y:Math.floor(py)+8,w:25,h:25,relieve:{tipo:'colinas',intensidad:0.7},trans:{tipo:'gradual',ancho:5},pasto:{estado:'seco'}});
   return {cpm:NV.CPM(),rpm:NV.medidas().CPM, hay:T.hay()}; });
 console.log('cfg',JSON.stringify(info));
 await new Promise(r=>setTimeout(r,500)); await p.evaluate(()=>NV.fluidez.reiniciar());
 await p.keyboard.down('ArrowRight'); await new Promise(r=>setTimeout(r,4000)); await p.keyboard.up('ArrowRight');
 const r=await p.evaluate(()=>NV.fluidez.resumen());
 console.log(tag,'FPS',r.fps.toFixed(1),'· cuadro',r.cuadroMs.toFixed(0),'ms · mundo',r.mundoMs.toFixed(0),'· pintado',r.pintadoMs.toFixed(1),'· motores',JSON.stringify(r.motores.map(([k,v])=>[k,Math.round(v)])));
 await b.close(); })();
