// Laboratorio de terreno y vegetación: el pasto real, ajustado por sectores. Nada del juego cambia.
const fs=require('fs'), cargar=require('./cargar.js');
const m=cargar(`
const cap=(f)=>{ const o=[]; const p0=put; put=(c,r,ch,col)=>o.push(c+','+r+','+ch+','+col); try{ f(); } finally{ put=p0; } return o; };
NV.terreno.puente.get=()=>put; NV.terreno.puente.set=f=>{ put=f; };
module.exports={NV,T:NV.terreno,
 real:(mx,my)=>cap(()=>{ pastoPreparar(mx,my,true); for(let sy=0;sy<RPM;sy++) pastoFranja(mx,my,sy,10+sy,0,false,1,0,0.3,1); }),
 capa:(mx,my,cfg)=>cap(()=>NV.terreno.dibujarMetro(mx,my,{base:0,rb0:10,luz:1,calor:0,dPasto:0.3,t:0})),
 cfg:()=>({c:NV.pasto.cfg.cobertura,t:NV.pasto.cfg.trazo,z:NV.pasto.cfg.zona})};`);
const T=m.T; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const cfg0=JSON.stringify(m.cfg());

// 1. sin sectores: idéntico al pasto real
let igual=true; for(let x=0;x<12;x++) for(let y=0;y<6;y++){ T.nuevoMundo(); if(m.real(40+x,40+y).join('|')!==m.capa(40+x,40+y).join('|')) igual=false; }
probar('sin sectores: glifo por glifo igual que el pasto real', igual);
// 2. un sector con valores por defecto: también idéntico
T.nuevoMundo(); T.agregar({x:36,y:36,w:30,h:20});
igual=true; for(let x=0;x<12;x++) for(let y=0;y<6;y++) if(m.real(40+x,40+y).join('|')!==m.capa(40+x,40+y).join('|')) igual=false;
probar('sector neutro (valores por defecto): igual que el pasto real', igual);
probar('las perillas del pasto real vuelven a su valor tras dibujar', JSON.stringify(m.cfg())===cfg0);
// 3. determinista
T.nuevoMundo(); T.agregar({x:40,y:40,w:10,h:10,pasto:{densidad:0.9,alto:0.9,estado:'seco',tono:'seco'},flores:{cantidad:3.2,roja:true,distribucion:'grupos'}});
const a=m.capa(44,44).join('|'), b=m.capa(44,44).join('|');
probar('determinista: el mismo metro sale igual', a===b&&a.length>50);
probar('un sector configurado SÍ cambia el pasto', a!==m.real(44,44).join('|'));
// 4. densidad
const cuenta=(d,al)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:200,h:200,pasto:{densidad:d,alto:al===undefined?0.5:al}}); let n=0; for(let x=0;x<8;x++) n+=m.capa(100+x,100).length; return n; };
probar('más densidad, más marcas (0,1 < 0,5 < 0,95)', cuenta(0.1)<cuenta(0.5)&&cuenta(0.5)<cuenta(0.95));
// 5. altura: más larga, más filas arriba
const altura=(al)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:200,h:200,pasto:{alto:al}}); let mn=99; for(let x=0;x<12;x++) for(const s of m.capa(100+x,100)) mn=Math.min(mn,+s.split(',')[1]); return mn; };
probar('pasto largo sube más filas que el corto', altura(1)<altura(0.5)&&altura(0.5)<=altura(0));
// 6. aislamiento: el vecino de un sector no cambia
T.nuevoMundo(); const antes=[m.capa(10,10).join('|'),m.capa(60,60).join('|')];
T.agregar({x:30,y:30,w:10,h:10,terreno:'arena',trans:{tipo:'gradual',ancho:3}});
probar('metros lejos del sector no cambian al crearlo', antes[0]===m.capa(10,10).join('|')&&antes[1]===m.capa(60,60).join('|'));
const dentro=m.capa(34,34).join('|'); T.agregar({x:100,y:100,w:5,h:5,terreno:'barro'});
probar('crear otro sector no altera el primero', dentro===m.capa(34,34).join('|'));
const vecino=m.capa(45,34).join('|'); const id=T.mundo.sectores[0].id;
T.actualizar(id,{terreno:'pantano',pasto:{densidad:0.3}});
probar('editar un sector no altera uno que no lo toca', vecino===m.capa(45,34).join('|')&&dentro!==m.capa(34,34).join('|'));
// 7. regenerar sólo ese
T.nuevoMundo(); T.agregar({x:0,y:0,w:10,h:10,flores:{cantidad:3.2,roja:true,distribucion:'grupos'}}); T.agregar({x:20,y:0,w:10,h:10,flores:{cantidad:3.2,roja:true,distribucion:'grupos'}});
const f1=[T.floresDelMetro(3,3).length,T.floresDelMetro(24,3).length]; let h1=m.capa(24,3).join('|'), h0=m.capa(3,3).join('|');
T.regenerar(T.mundo.sectores[0].id,7);
probar('regenerar un sector no mueve el otro', h1===m.capa(24,3).join('|')&&h0!==m.capa(3,3).join('|'));
// 8. transición: peso 0 afuera, 1 adentro, monótono-ish en gradual
const ss={x:0,y:0,w:20,h:20,trans:{tipo:'gradual',ancho:4}}; T.nuevoMundo(); const sid=T.agregar(ss); const S=T.porId(sid);
probar('transición gradual: 0 muy afuera, 1 adentro, intermedio en el borde', T.peso(S,-5,10)===0&&T.peso(S,10,10)===1&&T.peso(S,0,10)>0.4&&T.peso(S,0,10)<0.6&&T.peso(S,-1,10)<T.peso(S,1,10));
probar('transición definida: sólo 0 o 1', [-3,-1,0.2,2,8].every(x=>{ const s2=T.normalizar({x:0,y:0,w:20,h:20,trans:{tipo:'definida',ancho:4}}); const p=T.peso(s2,x,10); return p===0||p===1; }));
// 9. terrenos: todos dibujan, ninguno usa números ni rompe, y el pasto no hereda donde no cabe
let todos=true; for(const k of Object.keys(T.TERRENOS)){ T.nuevoMundo(); T.agregar({x:0,y:0,w:300,h:300,terreno:k}); const o=m.capa(100,100); if(o.length<20) todos=false; }
probar('los 20 terrenos dibujan un metro con contenido', todos&&Object.keys(T.TERRENOS).length===20);
const marcasPasto=(k)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:300,h:300,terreno:k}); return m.capa(100,100).filter(s=>/,(124|47|92),/.test(s)).length; };
probar('en arena casi no hay trazos de pasto; en pradera sí', marcasPasto('arena')<marcasPasto('pradera')*0.25);
const texturas=new Set(); for(const k of ['arena','barro','pantano','agrietada','rocoso','nevado','congelado']){ T.nuevoMundo(); T.agregar({x:0,y:0,w:300,h:300,terreno:k}); texturas.add(m.capa(100,100).map(s=>s.split(',')[2]).join('')); }
probar('los terrenos tienen glifos propios (no es el pasto recoloreado)', texturas.size===7);
// 10. flores
const flores=(F)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:400,h:400,flores:F}); let n=0; for(let x=0;x<40;x++) for(let y=0;y<40;y++) n+=T.floresDelMetro(100+x,100+y).length; return n; };
probar('sin flores: cero', flores({cantidad:0})===0);
probar('más cantidad, más flores', flores({cantidad:0.5})<flores({cantidad:1})&&flores({cantidad:1})<flores({cantidad:3.2}));
const colores=(F)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:400,h:400,flores:Object.assign({cantidad:3.2,blanca:false},F)}); const s=new Set(); for(let x=0;x<40;x++) for(let y=0;y<40;y++) for(const f of T.floresDelMetro(100+x,100+y)) s.add(f.col.join()); return [...s]; };
probar('flores rojas: sólo rojo', colores({roja:true}).join('|')==='196,84,80');
probar('flores amarillas: sólo amarillo', colores({amarilla:true}).join('|')==='214,190,100');
probar('mezcla: más de un color', colores({roja:true,amarilla:true}).length===2);
T.nuevoMundo(); T.agregar({x:0,y:0,w:400,h:400,terreno:'arena',flores:{cantidad:3.2,roja:true}}); let fa=0; for(let x=0;x<40;x++) fa+=T.floresDelMetro(100+x,100).length;
probar('en arena las flores no aparecen (incompatibles)', fa===0);
// flores: zona elegida y abundancia dentro de ella
{ T.nuevoMundo(); T.agregar({x:100,y:100,w:40,h:40,flores:{cantidad:4,roja:true,distribucion:'grupos',zona:{x:10,y:10,w:8,h:8}}});
  let dentro=0,fuera=0; for(let x=0;x<40;x++) for(let y=0;y<40;y++){ const n=T.floresDelMetro(100+x,100+y).length; if(x>=10&&x<18&&y>=10&&y<18) dentro+=n; else fuera+=n; }
  probar('con zona, las flores sólo caen dentro de ella (y hay)', dentro>0&&fuera===0);
  T.nuevoMundo(); T.agregar({x:100,y:100,w:40,h:40,flores:{cantidad:0.5,roja:true,distribucion:'grupos',zona:{x:10,y:10,w:8,h:8}}}); let poca=0; for(let x=10;x<18;x++) for(let y=10;y<18;y++) poca+=T.floresDelMetro(100+x,100+y).length;
  probar('más abundancia en la zona, más flores', poca<dentro); }
// la flor es de una celda y de un metro: nunca hay más de 8 en un metro (como el pasto real)
{ T.nuevoMundo(); T.agregar({x:0,y:0,w:300,h:300,flores:{cantidad:4,roja:true,amarilla:true,blanca:true,distribucion:'concentradas'}}); let mx=0; for(let x=0;x<60;x++) for(let y=0;y<60;y++) mx=Math.max(mx,T.floresDelMetro(100+x,100+y).length);
  probar('ningún metro lleva más de 8 flores (igual que el pasto real)', mx>0&&mx<=8); }
// 11. guardado
T.nuevoMundo(); T.agregar({x:3,y:4,w:12,h:7,terreno:'pantano',pasto:{densidad:0.3,tono:'oscuro'},trans:{tipo:'organica',ancho:6}}); T.agregar({x:20,y:4,w:5,h:5,flores:{roja:true,cantidad:1.8}});
const j=T.exportar(); const muestra=[m.capa(5,5).join('|'),m.capa(22,6).join('|'),m.capa(16,5).join('|')];
T.nuevoMundo(); T.importar(j);
probar('exportar → importar devuelve exactamente el mismo mundo', T.exportar()===j&&muestra.every((s,i)=>s===[m.capa(5,5).join('|'),m.capa(22,6).join('|'),m.capa(16,5).join('|')][i]));
// 12. historial
const i3=T.mundo.sectores[0].id; const before=T.mundo.sectores[0].terreno; T.actualizar(i3,{terreno:'arena'}); T.revertir(i3);
probar('revertir devuelve la configuración anterior', T.porId(i3).terreno===before);
T.actualizar(i3,{terreno:'barro'}); T.deshacer(); probar('deshacer revierte el último cambio', T.porId(i3).terreno===before);
T.copiarConfig; const cc=T.copiarConfig(i3); T.pegarConfig(T.mundo.sectores[1].id,cc);
probar('copiar/pegar configuración conserva posición y tamaño del destino', T.mundo.sectores[1].terreno==='pantano'&&T.mundo.sectores[1].x===20&&T.mundo.sectores[1].w===5);
// 13. estados
const est=(e)=>{ T.nuevoMundo(); T.agregar({x:0,y:0,w:300,h:300,pasto:{estado:e}}); return m.capa(100,100).join('|'); };
const dist=new Set(Object.keys(T.ESTADOS).map(est));
probar('los 7 estados del pasto se ven distintos', dist.size===7);
// 14. integrado: está en la lista de módulos y el juego dibuja con él
const mods=fs.readFileSync('/home/claude/nativaonline/src/modulos.js','utf8');
probar('terreno y su editor están en src/modulos.js', /juego\/terreno'/.test(mods)&&/juego\/editor-terreno'/.test(mods));
probar('el dibujo del juego usa el motor sólo en metros con sector', /NV\.terreno\.toca\(mx,my\)/.test(fs.readFileSync('/home/claude/nativaonline/src/juego/dibujar.js','utf8')));

console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);
