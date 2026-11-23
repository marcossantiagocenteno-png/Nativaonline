// El relieve del suelo.
//
// El mundo es plano: no hay altura en ningún panel, y un suelo plano se ve igual
// de iluminado en todas partes. El relieve es un campo de altura en metros del
// mundo que NO cambia dónde se camina: sólo decide cuánta luz recibe cada metro
// según hacia dónde mira su pendiente (el sol está al este y bajo).
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; },
  espiarSuelo:f=>{ const o=celdaSuelo; celdaSuelo=function(mt,wx,wy,cx,cyb,l,c,t){
      const r=o(mt,wx,wy,cx,cyb,l,c,t); f(wx,wy,!!mt.ola,l); return r; }; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,camX,camY})
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac(); NV.actualizarCielo(Date.UTC(2026,4,1,0,0,0));
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; NV.nieblaEn=()=>0;
NV.objetosEn=()=>[];
NV.alturaEn=()=>0;     // estas pruebas miden otra cosa sobre un suelo plano: la altura tiene su propia prueba (altura.js)

console.log('=== el campo ===');
const tiene = typeof NV.luzRelieve==='function' && typeof NV.relieveEn==='function';
probar('existen relieveEn y luzRelieve', tiene);
if(!tiene){ console.log('  (no existen)'); finalizar(); }

let suma=0,n=0,mn=9,mx=0,signo=0,signoN=0,salto=0;
for(let x=-300;x<600;x+=3.7) for(let y=-300;y<600;y+=4.1){
  const f=NV.luzRelieve(x,y); suma+=f; n++; mn=Math.min(mn,f); mx=Math.max(mx,f);
  const dx=NV.relieveEn(x+0.5,y)-NV.relieveEn(x-0.5,y);
  if(Math.abs(dx)>0.004){ signoN++; if((dx<0)===(f>1)) signo++; }
  salto=Math.max(salto,Math.abs(NV.luzRelieve(x+1,y)-f));
}
const media=suma/n;
console.log(`  luz del relieve: media ${media.toFixed(3)} · mínimo ${mn.toFixed(2)} · máximo ${mx.toFixed(2)} · salto mayor entre metros vecinos ${salto.toFixed(3)}`);
probar('no oscurece ni aclara el mundo en promedio (0.97 a 1.03)', media>0.97&&media<1.03);
probar('hay laderas que se notan: de menos de 0.88 a más de 1.12', mn<0.88&&mx>1.12);
probar('queda dentro de los topes 0.72 a 1.28', mn>=0.72-1e-9&&mx<=1.28+1e-9);
probar('la ladera que mira al este se ilumina y la del oeste se apaga, sin excepción', signoN>200&&signo===signoN);
probar('entre metros vecinos no hay escalones (salto < 0.10)', salto<0.10);

console.log('\n=== en el cuadro ===');
/* Todo pasto parejo: lo único que puede variar entre metros es el relieve. Se
   dibuja el mismo cuadro con y sin relieve y se mide la luminosidad por metro. */
const lum=c=>(((c>>16)&255)*0.3+((c>>8)&255)*0.59+(c&255)*0.11);
function cuadro(conRelieve,suelo,cx,cy){
  NV.sueloEn=()=>suelo;
  const orig=NV.luzRelieve; let llamadas=0;
  NV.luzRelieve=conRelieve?function(x,y){ llamadas++; return orig(x,y); }:()=>1;
  m.ponerYo(cx,cy); m.draw_(); NV.luzRelieve=orig;
  const E=m.estado(), por=new Map();
  for(let r=0;r<E.rowsN;r++) for(let c=0;c<E.cols;c++){
    const i=r*E.cols+c; if(!E.fbG[i]||E.fbL[i]!==0) continue;
    const k=(E.camX+Math.floor(c/E.CPM))+','+(E.camY+Math.floor(r/E.RPM));
    const a=por.get(k)||[0,0]; a[0]+=lum(E.fbC[i]); a[1]++; por.set(k,a);
  }
  return {por,llamadas,fb:Array.from(E.fbC)};
}
/* un punto de vista donde el cuadro tenga de las dos laderas, para que compare */
let CX=60,CY=60,mejor=-1;
NV.sueloEn=()=>'g'; m.ponerYo(60,60); m.draw_();
const E0=m.estado(), AN=Math.ceil(E0.cols/E0.CPM), AL=Math.ceil(E0.rowsN/E0.RPM);    // lo que ve la cámara, en metros
const DX=60-E0.camX, DY=60-E0.camY;                    // dónde queda el personaje dentro de la vista, en metros
console.log('  la cámara ve '+AN+' × '+AL+' m, con el personaje a '+DX+' m del borde oeste y '+DY+' del norte');
const LIM=NV.limites();      // la cámara no sale del mundo: el punto de vista tiene que dejar entera la ventana adentro
for(let x=LIM.x0+DX+2;x<=LIM.x1-AN+DX-2;x+=20) for(let y=LIM.y0+DY+2;y<=LIM.y1-AL+DY-2;y+=20){
  let o=0,c=0; for(let i=0;i<AN;i++) for(let j=0;j<AL;j+=2){ const f=NV.luzRelieve(x-DX+i+0.5,y-DY+j+0.5); if(f<0.92)o++; else if(f>1.08)c++; }
  if(Math.min(o,c)>mejor){ mejor=Math.min(o,c); CX=x; CY=y; }
}
console.log('  punto de vista elegido: ('+CX+', '+CY+')');
const con=cuadro(true,'g',CX,CY), sin=cuadro(false,'g',CX,CY);
const grupos={oscuro:[0,0,0,0],claro:[0,0,0,0]};       // [suma con, suma sin, n, _]
for(const [k,a] of con.por){
  const b=sin.por.get(k); if(!b||a[1]<20) continue;
  const [x,y]=k.split(',').map(Number), f=NV.luzRelieve(x+0.5,y+0.5);
  const g= f<0.92?grupos.oscuro : f>1.08?grupos.claro : null; if(!g) continue;
  g[0]+=a[0]/a[1]; g[1]+=b[0]/b[1]; g[2]++;
}
const rOsc=grupos.oscuro[0]/grupos.oscuro[1], rCla=grupos.claro[0]/grupos.claro[1];
console.log(`  metros en penumbra: ${grupos.oscuro[2]} · metros iluminados: ${grupos.claro[2]}`);
console.log(`  luminosidad con relieve / sin relieve: en penumbra ${(rOsc*100).toFixed(0)}% · iluminados ${(rCla*100).toFixed(0)}%`);
probar('en un mismo cuadro conviven metros en penumbra y metros iluminados', grupos.oscuro[2]>5&&grupos.claro[2]>5);
probar('lo que mira al oeste se ve más oscuro que sin relieve, y lo que mira al este más claro',
       rOsc<0.97 && rCla>1.02 && rCla-rOsc>0.08);     // umbral 0,08 y no 0,10: el verde frío rinde menos luminosidad por canal
probar('el cuadro consulta el relieve una vez por metro de tierra (no por casilla)', con.llamadas>300&&con.llamadas<3000);

console.log('\n=== el agua no se toca ===');
const aCon=cuadro(true,'a',CX,CY), aSin=cuadro(false,'a',CX,CY);
let dif=0; for(let i=0;i<aCon.fb.length;i++) if(aCon.fb[i]!==aSin.fb[i]) dif++;
console.log(`  casillas distintas en un cuadro de agua: ${dif} · consultas al relieve: ${aCon.llamadas}`);
probar('el agua queda idéntica con y sin relieve, y ni lo consulta', dif===0&&aCon.llamadas===0);

console.log('\n=== el mundo no cambia ===');
NV.sueloEn=(x,y)=>'g';
const antes=[]; for(let i=0;i<50;i++) antes.push(NV.luzRelieve(i*7,i*3));
probar('el relieve es determinista (misma semilla, mismos valores)', antes.every((v,i)=>v===NV.luzRelieve(i*7,i*3)));

finalizar();
function finalizar(){
  console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
  mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);
}
