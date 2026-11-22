// Prueba de humo: cargar todo, generar los cinco paneles, dibujar y caminar.
const cargar=require('./cargar.js');
let NV;
try{ NV=cargar(); console.log('módulos cargados OK'); }
catch(e){ console.log('FALLÓ la carga:',e.message,'\n',e.stack.split('\n')[1]); process.exit(1); }

for(const k in NV.BIOMAS){
  const [i,j]=k.split(',').map(Number);
  const p=NV.panel(i,j);
  const c={}; for(let y=0;y<NV.LADO;y++) for(let x=0;x<NV.LADO;x++){ const g=p.ground[y][x]; c[g]=(c[g]||0)+1; }
  const mat=Object.entries(c).sort((a,b)=>b[1]-a[1])
    .map(([g,n])=>g+':'+Math.round(n/100)+'%').join(' ');
  console.log(('  '+p.coord+' '+p.nombre).padEnd(34), p.trees.length+' obj ·', mat);
}
const claro=NV.panel(0,0);
console.log('inicio:', JSON.stringify(claro.inicio), '· hoguera:', JSON.stringify(claro.hoguera));

const extra='module.exports={NV:window.NV, draw_, cols:()=>cols, rowsN:()=>rowsN, move, me:()=>me, tictac};';
const m=cargar(extra);
m.tictac();
try{ m.draw_(); console.log('dibujo OK — grilla', m.cols()+'x'+m.rowsN()); }
catch(e){ console.log('FALLÓ el dibujo:',e.message,'\n',e.stack.split('\n')[1]); process.exit(1); }

// caminar hacia cada panel vecino, esquivando lo que se cruce
const viajes=[['oeste',-1,0],['este',1,0],['norte',0,-1],['sur',0,1]];
let fallos=0;
for(const [nom,dx,dy] of viajes){
  const c=NV.panel(0,0); m.me().x=c.inicio.x; m.me().y=c.inicio.y;
  let pasos=0, llegó=null;
  for(let i=0;i<900;i++){
    const antes=m.me().x+','+m.me().y;
    m.move(dx,dy);
    if(m.me().x+','+m.me().y===antes){            // bloqueado: probar de costado
      const lado = (i%7<4)?1:-1;
      m.move(dy?lado:0, dy?0:lado);
    }
    pasos++;
    const p=NV.panelDe(m.me().x,m.me().y);
    if(p&&p.coord!=='0:0'){ llegó=p; break; }
  }
  if(llegó) console.log('  al '+nom+': se entra en', llegó.coord, llegó.nombre, 'tras', pasos, 'pasos');
  else { console.log('  al '+nom+': NO se llegó (quedó en', JSON.stringify(m.me())+')'); fallos++; }
}
if(fallos) { console.log(fallos+' viajes fallaron'); }
try{ m.draw_(); console.log('dibujo tras viajar OK'); }
catch(e){ console.log('FALLÓ el dibujo tras viajar:',e.message); process.exit(1); }
