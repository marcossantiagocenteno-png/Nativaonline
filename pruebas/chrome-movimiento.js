// MOVIMIENTO EN CHROME REAL: mide la cadencia con que el juego dibuja de verdad (intervalo entre cuadros dibujados).
//   node pruebas/chrome-movimiento.js [?query] [etiqueta] [vacio|lleno] [lentitud CPU]
// Necesita puppeteer-core y Chrome (CHROME=/ruta); si no están, se salta. 'vacio' anula pasto, detalle, árboles y rocas.
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const q=process.argv[2]||'', tag=process.argv[3]||'', vacio=process.argv[4]!=='lleno';
(async()=>{ const b=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--window-size=1200,700']});
 const p=await b.newPage(); await p.setViewport({width:1200,height:700}); p.on('pageerror',e=>console.log('ERR',e.message));
 const thr=+(process.argv[5]||1); if(thr>1){ const c=await p.target().createCDPSession(); await c.send('Emulation.setCPUThrottlingRate',{rate:thr}); }
 await p.goto('file://'+require('path').resolve(__dirname,'..','index.html')+q,{waitUntil:'load'}); await new Promise(r=>setTimeout(r,2500));
 if(vacio) await p.evaluate(()=>{ window.pastoFranja=function(){}; window.detallar=function(){}; if(NV.arbolado) NV.arbolado.dibujar=function(){}; if(NV.rocoso) NV.rocoso.dibujar=function(){}; });
 const medir=async(nombre,fn)=>{
   await p.evaluate(()=>NV.fluidez.reiniciar()); await fn();
   let f=await p.evaluate(()=>Array.from(NV.fluidez.serie())); f=f.slice(0,-1);   // el último intervalo es el hueco de después del gesto, no un cuadro const r=await p.evaluate(()=>NV.ritmo&&NV.ritmo().divisor);
   if(f.length<5){ console.log(tag.padEnd(6),nombre.padEnd(20),'sin cuadros'); return; }
   const c=[...f].sort((a,b)=>a-b); const m=f.reduce((a,x)=>a+x,0)/f.length; const sd=Math.sqrt(f.reduce((a,x)=>a+(x-m)*(x-m),0)/f.length);
   const largos=f.filter(x=>x>m*1.5).length;
   console.log(tag.padEnd(6),nombre.padEnd(20),'cuadros',String(f.length).padStart(3),'· FPS',(1000/m).toFixed(1).padStart(5),'· prom',m.toFixed(1).padStart(6),'· p95',c[Math.floor(c.length*.95)].toFixed(0).padStart(3),'· máx',c[c.length-1].toFixed(0).padStart(3),'· desv',sd.toFixed(1).padStart(5),'· irregulares',largos); };
 const esp=ms=>new Promise(r=>setTimeout(r,ms));
 const mover=async(teclas,ms)=>{ for(const k of teclas) await p.keyboard.down(k); await esp(ms); for(const k of teclas) await p.keyboard.up(k); };
 await medir('quieto',()=>esp(1500));
 await medir('horizontal',()=>mover(['ArrowRight'],3000));
 await medir('vertical',()=>mover(['ArrowDown'],3000));
 await medir('diagonal',()=>mover(['ArrowRight','ArrowDown'],3000));
 const rueda=(dir,cuadros)=>p.evaluate((dir,n)=>new Promise(res=>{ const cv=document.querySelector('canvas'); let i=0; const f=()=>{ cv.dispatchEvent(new WheelEvent('wheel',{deltaY:dir*100,cancelable:true,bubbles:true})); if(++i<n) requestAnimationFrame(f); else setTimeout(res,400); }; requestAnimationFrame(f); }),dir,cuadros);
 await medir('zoom acercando',()=>rueda(-1,90));
 await medir('zoom alejando',()=>rueda(1,90));
 await medir('zoom + movimiento',async()=>{ await p.keyboard.down('ArrowRight'); await rueda(-1,45); await rueda(1,45); await p.keyboard.up('ArrowRight'); });
 await b.close(); })();
