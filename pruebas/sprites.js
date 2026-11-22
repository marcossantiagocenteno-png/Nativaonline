// Sprites: la conversión de imagen a glifos, con un lienzo de mentira que
// devuelve píxeles conocidos. Prueba el código, no el dibujo.
const cargar=require('./cargar.js');

/* Un lienzo de mentira que se comporta como uno de verdad en lo que importa:
   apila lo que se dibuja encima con su transparencia y devuelve el color SIN
   premultiplicar, que es lo que hace getImageData. Sin apilar, la mezcla entre
   cuadros no se puede observar y la prueba no sirve; sin lo de premultiplicar,
   no se puede atrapar una división de más, que es lo que dejó al personaje
   gris. */
function lienzoFalso(){
  let W=0,H=0,capas=[],alfa=1;
  const ctx={
    clearRect(){ capas=[]; },
    set imageSmoothingEnabled(v){}, set imageSmoothingQuality(v){},
    set globalAlpha(v){ alfa=v; }, get globalAlpha(){ return alfa; },
    drawImage(img,sx){ capas.push({f:Math.round(sx/71)%8, a:alfa}); },
    getImageData(x,y,w,h){
      const d=new Uint8ClampedArray(w*h*4);
      for(let r=0;r<h;r++) for(let c=0;c<w;c++){
        const i=(r*w+c)*4;
        const aFuente=255*(c+1)/w;
        /* se compone "encima", en premultiplicado, como el lienzo de verdad */
        let pr=0,pg=0,pb=0,pa=0;
        for(const cp of capas){
          const l=230*(r+1)/h*(0.60+0.40*(cp.f/7));
          const a=aFuente/255*cp.a;
          pr=l*a+pr*(1-a); pg=l*0.8*a+pg*(1-a); pb=l*0.5*a+pb*(1-a);
          pa=a+pa*(1-a);
        }
        d[i+3]=Math.round(pa*255);
        if(pa>0){                       /* devolver el color recto, no premultiplicado */
          d[i]=Math.round(pr/pa); d[i+1]=Math.round(pg/pa); d[i+2]=Math.round(pb/pa);
        }
      }
      return {data:d};
    }
  };
  return {get width(){return W}, set width(v){W=v;},
          get height(){return H}, set height(v){H=v;},
          getContext:()=>ctx};
}
global.document.createElement=t=>t==='canvas'?lienzoFalso():
  ({style:{},textContent:'',appendChild(){}});
global.Image=function(){ this.set=null;
  Object.defineProperty(this,'src',{set(v){ this._src=v; if(this.onload) this.onload(); }}); };

const m=cargar(`module.exports={
  NV:window.NV, celdasArte, RAMPA_ARTE, cargarArte,
  estado:()=>({fbG,fbC,cols,rowsN,CPM,RPM,HPM}),
  ponerMe:(x,y)=>{ me.x=x; me.y=y; },
  limpiar:()=>{fbG.fill(0);fbL.fill(0);}, capa:v=>{layer=v;},
  fondos:()=>nArteLeido
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== el arte está declarado y se carga ===');
const man=NV.ARTE&&NV.ARTE.myrella;
console.log('  myrella:', man? man.ancho+'×'+man.alto+' celdas · '
  +Object.keys(man.anims).length+' animaciones × '+man.cuadros+' cuadros'
  +' · pies en '+man.pieX+','+man.pieY : 'NO ESTÁ');
probar('el arte de myrella está en NV.ARTE', !!man);
probar('tiene las ocho animaciones', man && Object.keys(man.anims).length===8);
probar('todas las animaciones tienen ocho cuadros',
  man && Object.values(man.anims).every(a=>a.n===8));
probar('la imagen viene embebida como data URI',
  man && typeof man.png==='string' && man.png.startsWith('data:image/png;base64,'));
m.cargarArte();
console.log('  arte listo:', NV.hayArte('myrella'));
probar('el arte queda listo con un lienzo disponible', NV.hayArte('myrella'));

console.log('\n=== la rampa va de menos a más tinta ===');
console.log('  '+JSON.stringify(m.RAMPA_ARTE));
probar('la rampa empieza en vacío y termina en arroba',
  m.RAMPA_ARTE[0]===' ' && m.RAMPA_ARTE[m.RAMPA_ARTE.length-1]==='@');

console.log('\n=== la conversión respeta brillo y cobertura ===');
{
  const c=m.celdasArte('myrella','walk_front',0,1,0,20,30);
  if(!c){ probar('la conversión devuelve celdas', false); }
  else{
    probar('la conversión devuelve celdas', true);
    /* el degradado del lienzo falso: alfa crece a lo ancho, brillo a lo alto */
    const vacias=[...c.g].filter(g=>!g).length;
    const G=String.fromCharCode;
    const pri=G(c.g[(c.filas-1)*c.cols+1]||32), ult=G(c.g[(c.filas-1)*c.cols+c.cols-1]||32);
    console.log('  celdas vacías por poca cobertura: '+vacias+' de '+(20*30));
    console.log('  en la fila más clara: columna izquierda "'+pri+'" · derecha "'+ult+'"');
    probar('lo de poca cobertura queda vacío', vacias>0);
    probar('a más cobertura, glifo más tupido',
      m.RAMPA_ARTE.indexOf(ult)>m.RAMPA_ARTE.indexOf(pri));
    const arriba=G(c.g[1*c.cols+c.cols-1]||32), abajo=G(c.g[(c.filas-1)*c.cols+c.cols-1]||32);
    console.log('  en la columna más cubierta: fila oscura "'+arriba+'" · clara "'+abajo+'"');
    probar('a más brillo, glifo más tupido',
      m.RAMPA_ARTE.indexOf(abajo)>m.RAMPA_ARTE.indexOf(arriba));
  }
}

console.log('\n=== el color no se divide por la cobertura ===');
/* Éste es el error que dejó a Myrella gris: getImageData ya devuelve el color
   sin premultiplicar, y el conversor lo volvía a dividir por el alfa. Con
   cobertura baja eso multiplica por dos y medio y manda todo al gris claro.
   El lienzo falso devuelve un color conocido; acá se exige que salga ése. */
{
  const c=m.celdasArte('myrella','idle_front',1,2,0,24,30);
  let peor=0, mirados=0, grises=0;
  for(let r=0;r<c.filas;r++) for(let cc=0;cc<c.cols;cc++){
    const i=r*c.cols+cc;
    if(!c.g[i]) continue;
    const a=Math.round(255*(cc+1)/c.cols);
    /* una sola capa (mezcla 0), el cuadro 1: el falso tiñe según el cuadro */
    const l=230*(r+1)/c.filas*(0.60+0.40*(1/7));
    const fa=0.80+0.20*(a/255);
    const esp=l*fa, dio=(c.col[i]>>16)&255;
    peor=Math.max(peor,Math.abs(dio-esp)); mirados++;
    /* gris = los tres canales casi iguales; el falso da R:G:B de 1 : 0,8 : 0,5 */
    const g2=(c.col[i]>>8)&255, b2=c.col[i]&255;
    if(dio>20 && Math.abs(dio-b2)<dio*0.18) grises++;
  }
  console.log('  celdas miradas: '+mirados+' · peor diferencia con el color esperado: '+peor);
  console.log('  celdas que salieron grises: '+grises);
  probar('el color sale como entró, sin dividir por la cobertura', mirados>0 && peor<=3);
  probar('no se agrisa', grises===0);
}

console.log('\n=== un cuadro se funde con el siguiente ===');
/* Sin fundir, el personaje salta de pose en pose y a esta resolución se lee
   como si desapareciera y apareciera en otro lado. Con la mezcla en cuartos,
   entre dos poses hay tres pasos intermedios distintos. */
{
  const vistos=new Set();
  for(let mz=0;mz<4;mz++){
    const c=m.celdasArte('myrella','walk_right',2,3,mz,22,28);
    vistos.add([...c.g].join(','));
  }
  console.log('  entre la pose 2 y la 3 hay '+vistos.size+' dibujos distintos');
  probar('la mezcla da pasos intermedios', vistos.size>=3);
  const a=m.celdasArte('myrella','walk_right',2,3,0,22,28);
  const b=m.celdasArte('myrella','walk_right',2,3,3,22,28);
  let dif=0;
  for(let i=0;i<a.g.length;i++) if(a.g[i]!==b.g[i]) dif++;
  console.log('  del principio al final de la mezcla cambian '+dif+' celdas');
  probar('la mezcla llega a parecerse al cuadro siguiente', dif>0);
}

console.log('\n=== la figura lleva contorno ===');
{
  const c=m.celdasArte('myrella','idle_front',0,1,0,24,30);
  let borde=0;
  for(let i=0;i<c.cols*c.filas;i++) if(c.borde[i]) borde++;
  console.log('  celdas de contorno alrededor de la figura: '+borde);
  probar('hay contorno', borde>10);
  let mal2=0;
  for(let i=0;i<c.cols*c.filas;i++) if(c.borde[i]&&c.g[i]) mal2++;
  probar('el contorno no pisa la figura', mal2===0);
}

console.log('\n=== quieta se queda quieta un rato largo ===');
{
  /* el ciclo de reposo dura veinte segundos y tres cuartas partes son el
     primer cuadro: una persona parada no se balancea sin parar */
  const CICLO=20000, QUIETA=0.74;
  let enCero=0;
  for(let ms=0;ms<CICLO;ms+=100){
    const u=ms/CICLO;
    const fase = u<QUIETA ? 0 : 1+(u-QUIETA)/(1-QUIETA)*7;
    if(fase===0) enCero++;
  }
  const pct=Math.round(100*enCero/(CICLO/100));
  console.log('  del ciclo de '+(CICLO/1000)+' s, pasa el '+pct+'% sin moverse');
  probar('pasa más de dos tercios del tiempo inmóvil', pct>=70);
}

console.log('\n=== la memoria no se llena ni se repite trabajo ===');
{
  const a=m.celdasArte('myrella','walk_front',0,1,0,20,30);
  const b=m.celdasArte('myrella','walk_front',0,1,0,20,30);
  probar('pedir dos veces lo mismo devuelve lo mismo', a===b);
  for(let i=0;i<300;i++) m.celdasArte('myrella','walk_front',i%8,(i+1)%8,i%4,10+(i%40),20);
  const c=m.celdasArte('myrella','walk_front',0,1,0,20,30);
  console.log('  tras 300 tamaños distintos, la memoria se vació y rehízo:', c!==a);
  probar('la memoria se limpia sola', !!c);
}

console.log('\n=== los pies caen donde tienen que caer ===');
{
  const st=m.estado();
  for(const altoM of [1.75]) for(const [nom,filasEsp] of [['normal',null]]){
    m.limpiar(); m.capa(3);
    const bc=Math.floor(st.cols/2), br=Math.floor(st.rowsN*0.7);
    NV.luz={r:1,g:1,b:1,amb:1};
    const hecho=NV.dibujarArte('myrella','idle_front',0,bc,br,altoM,1);
    probar('dibujarArte dibuja', hecho);
    const s2=m.estado();
    let rMin=1e9,rMax=-1,cMin=1e9,cMax=-1;
    for(let r=0;r<s2.rowsN;r++) for(let c=0;c<s2.cols;c++)
      if(s2.fbG[r*s2.cols+c]){ rMin=Math.min(rMin,r); rMax=Math.max(rMax,r);
                               cMin=Math.min(cMin,c); cMax=Math.max(cMax,c); }
    const alto=rMax-rMin+1;
    console.log('  caja dibujada: '+(cMax-cMin+1)+'×'+alto+' celdas · fila de los pies '
                +rMax+', esperada '+br);
    probar('los pies quedan en la fila del personaje', Math.abs(rMax-br)<=1);
    probar('el alto sale de los metros y no del pack',
      Math.abs(alto-Math.round(1.75*st.HPM))<=2);
    probar('queda centrado a lo ancho', Math.abs((cMin+cMax)/2-bc)<=2);
  }
}

console.log('\n=== quieta y chica, no tiembla ===');
/* A doce filas los movimientos chicos del reposo se redondean a celdas
   enteras: en vez de un balanceo suave salen celdas que prenden y apagan. A
   ese tamaño se muestra un solo cuadro. */
{
  for(const [filas,quieta,esp] of [[6,true,2],[9,false,4],[12,true,8],[19,false,8],[40,true,8]]){
    const n=NV.cuadrosUtiles('myrella',filas,quieta);
    console.log('  '+String(filas).padStart(2)+' filas '+(quieta?'quieta':'andando')
                +' → '+n+' cuadro'+(n>1?'s':''));
    probar('a '+filas+' filas '+(quieta?'quieta':'andando')+' usa '+esp, n===esp);
  }
}

console.log('\n=== el personaje no salta de casilla en casilla ===');
/* Camina de a un metro, que a este zoom son dieciocho columnas. Dibujado en la
   casilla, desaparecía y reaparecía más allá. Se mira dónde se dibuja a lo
   largo de un paso: tiene que recorrerlo, no saltarlo. */
{
  const st=m.estado();
  NV.ultimoPaso=1000; NV.pasoMs=186; NV.desdeX=50; NV.desdeY=50;
  m.ponerMe(51,50);
  const cols=[];
  for(let ms=1000;ms<=1186;ms+=18) cols.push(NV.posDibujo(ms).x);
  const salto=Math.max(...cols.map((v,i)=>i?Math.abs(v-cols[i-1]):0));
  const distintos=new Set(cols.map(v=>Math.round(v*st.CPM))).size;
  console.log('  a lo largo del paso se dibuja en '+distintos+' columnas distintas'
              +' · salto mayor '+(salto*st.CPM).toFixed(1)+' columnas');
  probar('recorre el paso en vez de saltarlo', distintos>=6);
  probar('ningún salto llega a media casilla', salto<0.5);
  NV.desdeX=undefined; NV.desdeY=undefined;
}

console.log('\n=== el personaje no se satura a blanco ===');
{
  const st=m.estado();
  m.limpiar(); m.capa(3);
  NV.luz={r:1,g:1,b:1,amb:1};
  NV.dibujarArte('myrella','idle_front',0,Math.floor(st.cols/2),Math.floor(st.rowsN*0.7),1.75,1);
  const s2=m.estado();
  let blancas=0,total=0;
  for(let i=0;i<s2.cols*s2.rowsN;i++){
    if(!s2.fbG[i]) continue;
    total++;
    const v=s2.fbC[i];
    if(((v>>16)&255)>240 && ((v>>8)&255)>240 && (v&255)>240) blancas++;
  }
  console.log('  celdas del personaje: '+total+' · a blanco puro: '+blancas);
  probar('el personaje conserva su color', total>0 && blancas/total<0.06);
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
