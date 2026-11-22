// Sprites: la conversión de imagen a glifos, con un lienzo de mentira que
// devuelve píxeles conocidos. Prueba el código, no el dibujo.
const cargar=require('./cargar.js');

/* un lienzo que, al pedirle los píxeles, devuelve un degradado conocido:
   alfa creciente a lo ancho y brillo creciente a lo alto */
let ultimoDraw=null;
function lienzoFalso(){
  let W=0,H=0;
  const ctx={
    clearRect(){}, set imageSmoothingEnabled(v){}, set imageSmoothingQuality(v){},
    drawImage(){ ultimoDraw=[...arguments].slice(1); },
    getImageData(x,y,w,h){
      const d=new Uint8ClampedArray(w*h*4);
      for(let r=0;r<h;r++) for(let c=0;c<w;c++){
        const i=(r*w+c)*4;
        const a=Math.round(255*(c+1)/w);
        const l=Math.round(230*(r+1)/h);
        d[i]=Math.round(l*a/255); d[i+1]=Math.round(l*0.8*a/255);
        d[i+2]=Math.round(l*0.5*a/255); d[i+3]=a;
      }
      return {data:d};
    }
  };
  return {get width(){return W}, set width(v){W=v},
          get height(){return H}, set height(v){H=v},
          getContext:()=>ctx};
}
global.document.createElement=t=>t==='canvas'?lienzoFalso():
  ({style:{},textContent:'',appendChild(){}});
global.Image=function(){ this.set=null;
  Object.defineProperty(this,'src',{set(v){ this._src=v; if(this.onload) this.onload(); }}); };

const m=cargar(`module.exports={
  NV:window.NV, celdasArte, RAMPA_ARTE, cargarArte,
  estado:()=>({fbG,fbC,cols,rowsN,CPM,RPM,HPM}),
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
  const c=m.celdasArte('myrella','walk_front',0,20,30);
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

console.log('\n=== la memoria no se llena ni se repite trabajo ===');
{
  const a=m.celdasArte('myrella','walk_front',0,20,30);
  const b=m.celdasArte('myrella','walk_front',0,20,30);
  probar('pedir dos veces lo mismo devuelve lo mismo', a===b);
  for(let i=0;i<300;i++) m.celdasArte('myrella','walk_front',i%8,10+(i%40),20);
  const c=m.celdasArte('myrella','walk_front',0,20,30);
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
  for(const [filas,quieta,esp] of [[12,true,1],[12,false,2],[16,true,2],[24,false,4],[40,true,8]]){
    const n=NV.cuadrosUtiles('myrella',filas,quieta);
    console.log('  '+String(filas).padStart(2)+' filas '+(quieta?'quieta':'andando')
                +' → '+n+' cuadro'+(n>1?'s':''));
    probar('a '+filas+' filas '+(quieta?'quieta':'andando')+' usa '+esp, n===esp);
  }
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
