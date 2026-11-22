const cargar=require('./cargar.js');
let NV;
try{ NV=cargar(); console.log('módulos cargados OK'); }
catch(e){ console.log('FALLÓ la carga:',e.message); console.log(e.stack.split('\n').slice(0,3).join('\n')); process.exit(1); }
const w=NV.build(NV.CONFIG);
const c={}; for(let y=0;y<w.h;y++) for(let x=0;x<w.w;x++){const g=w.ground[y][x]; c[g]=(c[g]||0)+1;}
console.log('materiales:',c);
console.log('objetos:',w.trees.length,'· spawn:',NV.findSpawn(w));
const extra='module.exports={NV:window.NV, draw_, cols:()=>cols, rowsN:()=>rowsN, move};';
const m=cargar(extra);
try{ m.draw_(); console.log('dibujo OK — grilla',m.cols()+'x'+m.rowsN()); }
catch(e){ console.log('FALLÓ el dibujo:',e.message,'\n',e.stack.split('\n')[1]); process.exit(1); }
for(let i=0;i<30;i++) m.move(0,-1);
for(let i=0;i<30;i++) m.move(1,0);
console.log('60 pasos sin error');
