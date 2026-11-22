// Personajes: la mecánica compartida. Lo que se afinó con Myrella tiene que
// servirle igual a una nativa, a un lobo o a lo que venga.
const cargar=require('./cargar.js');
/* el mismo lienzo de mentira que usa la prueba de sprites */
function lienzoFalso(){
  let W=0,H=0,capas=[],alfa=1;
  const ctx={
    clearRect(){capas=[];}, set imageSmoothingEnabled(v){}, set imageSmoothingQuality(v){},
    set globalAlpha(v){alfa=v;}, get globalAlpha(){return alfa;},
    drawImage(img,sx){ capas.push({f:Math.round(sx/71)%8,a:alfa}); },
    getImageData(x,y,w,h){
      const d=new Uint8ClampedArray(w*h*4);
      for(let r=0;r<h;r++) for(let c=0;c<w;c++){
        const i=(r*w+c)*4, aF=255*(c+1)/w;
        let pr=0,pg=0,pb=0,pa=0;
        for(const cp of capas){
          const l=230*(r+1)/h*(0.60+0.40*(cp.f/7)), a=aF/255*cp.a;
          pr=l*a+pr*(1-a); pg=l*0.8*a+pg*(1-a); pb=l*0.5*a+pb*(1-a); pa=a+pa*(1-a);
        }
        d[i+3]=Math.round(pa*255);
        if(pa>0){ d[i]=Math.round(pr/pa); d[i+1]=Math.round(pg/pa); d[i+2]=Math.round(pb/pa); }
      }
      return {data:d};
    }
  };
  return {get width(){return W}, set width(v){W=v;}, get height(){return H}, set height(v){H=v;},
          getContext:()=>ctx};
}
global.document.createElement=t=>t==='canvas'?lienzoFalso():({style:{},textContent:'',appendChild(){}});
global.Image=function(){ Object.defineProperty(this,'src',{set(v){ if(this.onload) this.onload(); }}); };

const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac, cargarArte,
  estado:()=>({fbG,fbC,cols,rowsN,CPM,RPM,HPM,camX,camY}),
  donde:()=>({x:me.x,y:me.y}),
  limpiar:()=>{fbG.fill(0);fbL.fill(0);}
};`);
const NV=m.NV;
m.cargarArte();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const DIA=30*86400e3/430, base=Date.UTC(2026,4,1,0,0,0);
const hora=i=>{ NV.actualizarCielo(base+DIA*i/8); };

console.log('=== un personaje se crea y camina ===');
{
  const p=NV.nuevoPersonaje({arte:'myrella',nombre:'Nadie',alto:1.6,x:50,y:50});
  console.log('  recién creado: '+p.nombre+', '+p.alto+' m, mirando al '+p.mirando);
  probar('se crea con lo suyo', p.alto===1.6 && p.andado===0);
  NV.avanzarPersonaje(p,1,0,1000);
  console.log('  tras un paso al este: anduvo '+p.andado+' m, mira al '+p.mirando
              +', viene de '+p.desdeX+','+p.desdeY);
  probar('el paso lo gira', p.mirando==='este');
  probar('el paso cuenta la distancia', p.andado===1);
  probar('el paso recuerda de dónde viene', p.desdeX===50 && p.x===51);
  const medio=NV.posPersonaje(p,1000+93), fin=NV.posPersonaje(p,1000+400);
  console.log('  a mitad del paso está en x='+medio.x.toFixed(2)+', al final en x='+fin.x);
  probar('a mitad de paso está entre las dos casillas', medio.x>50.2 && medio.x<50.8);
  probar('al final llega entera', fin.x===51);
}

console.log('\n=== la luz: nunca se apaga del todo ===');
{
  let peor=9;
  for(let i=0;i<8;i++){
    hora(i);
    const l=NV.luzPersonaje({x:20,y:20},20,20,0);
    peor=Math.min(peor,Math.max(l.r,l.g,l.b));
  }
  hora(0);
  const noche=NV.luzPersonaje({x:20,y:20},20,20,0);
  console.log('  en la hora más oscura del día recibe '+peor.toFixed(2)+' de luz');
  console.log('  de noche: r'+noche.r.toFixed(2)+' g'+noche.g.toFixed(2)+' b'+noche.b.toFixed(2)
              +' (azulada, que es la luz de las lunas)');
  probar('de noche se ve, oscurecida pero se ve', peor>0.18);
  probar('la noche la tiñe de azul y no de naranja', noche.b>noche.r);
}

console.log('\n=== las lunas alumbran ===');
{
  let masClara=0, masOscura=9, lunaClara=0, lunaOscura=0;
  for(let i=0;i<40;i++){
    NV.actualizarCielo(base+DIA*(i*7.3));
    if(!NV.cielo.deNoche) continue;
    const a=NV.luz.amb, l=NV.cielo.brilloLunar;
    if(a>masClara){ masClara=a; lunaClara=l; }
    if(a<masOscura){ masOscura=a; lunaOscura=l; }
  }
  console.log('  noche más clara: ambiente '+masClara.toFixed(2)+' con lunas en '+lunaClara.toFixed(2));
  console.log('  noche más oscura: ambiente '+masOscura.toFixed(2)+' con lunas en '+lunaOscura.toFixed(2));
  probar('una noche de lunas altas es más clara que una sin ellas', masClara>masOscura*1.15);
  probar('y es la luna la que la aclara', lunaClara>lunaOscura);
}

console.log('\n=== la hoguera lo alumbra de naranja ===');
{
  hora(0);
  const lejos=NV.luzPersonaje({x:20,y:20},20,20,0);
  const cerca=NV.luzPersonaje({x:54,y:54},54,54,0);
  console.log('  lejos del fuego r'+lejos.r.toFixed(2)+' b'+lejos.b.toFixed(2)
              +' · al lado r'+cerca.r.toFixed(2)+' b'+cerca.b.toFixed(2));
  probar('al lado de la hoguera recibe mucha más luz', cerca.r>lejos.r*2);
  probar('y esa luz es naranja, no blanca', cerca.r>cerca.b*1.8);
  probar('lejos del fuego no le llega nada', lejos.calor===0);
}

console.log('\n=== el resplandor propio se nota de noche y no de día ===');
{
  hora(0); const n=0.04+0.16*(1-Math.min(1,NV.luz.amb));
  hora(4); const d=0.04+0.16*(1-Math.min(1,NV.luz.amb));
  console.log('  de noche '+n.toFixed(3)+' · de día '+d.toFixed(3));
  probar('de noche irradia más que de día', n>d*1.8);
}

console.log('\n=== la mecánica vale para cualquiera, no sólo para el jugador ===');
{
  const st=m.estado();
  hora(4); m.tictac();
  const antes=NV.personajes.length;
  /* al lado del jugador: la cámara lo sigue a él, así que es el único lugar
     donde se garantiza que el NPC entre en pantalla */
  const yo=m.donde();
  const npc=NV.nuevoPersonaje({arte:'myrella',nombre:'Nadie',alto:1.4,
                               x:yo.x+3, y:yo.y+2});
  NV.personajes.push(npc);
  m.limpiar(); m.draw_();
  const s2=m.estado();
  let hay=0;
  for(let r=0;r<s2.rowsN;r++){
    let f='';
    for(let c=0;c<s2.cols;c++){ const g=s2.fbG[r*s2.cols+c]; f+=g?String.fromCharCode(g):' '; }
    if(f.includes('Nadie')) hay++;
  }
  console.log('  personajes en la lista: '+NV.personajes.length
              +' · veces que aparece su nombre en pantalla: '+hay);
  probar('la lista estaba vacía y ahora tiene uno', antes===0 && NV.personajes.length===1);
  probar('un personaje que no es el jugador se dibuja solo', hay>0);
  NV.personajes.length=0;
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);
