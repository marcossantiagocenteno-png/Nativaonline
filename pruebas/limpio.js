// El mundo de partida: UN panel de pasto. Nada más: ni un árbol, una piedra, un charco, un camino, una hoguera.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me, move,
  fbG:()=>fbG, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;

const p=NV.panel(0,0);
probar('existe el panel 0:0, "El claro"', !!p&&p.nombre==='El claro');
probar('no existe ningún otro panel', [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].every(([i,j])=>NV.panel(i,j)===null));
probar('el mundo mide un panel: 100 × 100', (()=>{ const l=NV.limites(); return l.x0===0&&l.x1===100&&l.y0===0&&l.y1===100; })());
let g=0,otro=0; for(const f of p.ground) for(const c of f){ if(c==='g') g++; else otro++; }
probar('todo el suelo es pasto ("g"): '+g+' casillas, '+otro+' de otra cosa', g===10000&&otro===0);
probar('sin árboles, piedras, troncos ni hoguera', p.trees.length===0&&!p.hoguera);
probar('nada ocupa el suelo', p.occ.every(v=>v===0));
probar('el punto de inicio es el centro', p.inicio.x===50&&p.inicio.y===50);
probar('sin ediciones guardadas: el archivo del mundo está vacío', NV.mundo.estadisticas().agregar===0&&NV.mundo.estadisticas().paneles===0);
probar('más allá del panel el mundo es sólido', NV.solidoEn(-1,50)&&NV.solidoEn(100,50)&&NV.solidoEn(50,-1)&&NV.solidoEn(50,100));
probar('y en el centro se camina', !NV.solidoEn(50,50)&&!NV.solidoEn(10,10)&&!NV.solidoEn(99,99));

/* ---- se dibuja y se camina ---- */
m.ponerYo(50,50); for(let k=0;k<4;k++) m.draw_();
let n=0; { const G=m.fbG(); for(let i=0;i<G.length;i++) if(G[i]) n++; }
probar('dibuja un cuadro lleno', n>m.cols()*m.rowsN()*0.5);
const ini={...m.me()}; for(let k=0;k<60;k++) m.move(k%2?1:0,k%2?0:1);
probar('camina 60 pasos por el claro', Math.abs(m.me().x-ini.x)+Math.abs(m.me().y-ini.y)>=30);
m.ponerYo(99,50); for(let k=0;k<5;k++) m.move(1,0);
probar('al llegar al borde del mundo no sale', m.me().x===99);

/* ---- una partida vieja de otro mundo no se arrastra ---- */
const sin=NV.CONFIG.seed; probar('la semilla cambió, y con ella se descartan borradores y partidas de antes', sin==='claro-01');
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
guardado['nativa.mundo.v1']=JSON.stringify({semilla:'bosque-02',ts:1,mundo:{formato:2,semilla:'bosque-02',paneles:{},rasgos:[],caminos:[]}});
probar('un borrador del mundo anterior (semilla bosque-02) no se carga', NV.mundo.cargarBorrador()===false);

console.log(ok.length+' bien, '+mal.length+' mal'); for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);
