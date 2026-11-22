// Cuenta y clasifica los eclipses de un año, y comprueba los colores.
const cargar=require('./cargar.js');
const NV=cargar();
const A=NV.ASTRO, D=NV.msPorDiaAstro;
console.log('tamaños en el cielo: estrella', A.solAparente.toFixed(3)+'°',
  '· Calavera', (NV.radioAparente(A.lunas.calavera)*2).toFixed(2)+'°',
  '· Madre', (NV.radioAparente(A.lunas.madre)*2).toFixed(2)+'°');
console.log('sombra del planeta: a la altura de Calavera',
  NV.radioUmbra(A.lunas.calavera).toFixed(2)+'°, de Madre', NV.radioUmbra(A.lunas.madre).toFixed(2)+'°\n');

// recorrer un año entero muestreando fino y agrupar en episodios
const paso=0.004;                       // ~6 min de juego
const cuenta={};
for(const k in A.lunas){
  const eventos=[]; let act=null;
  for(let t=0;t<A.anoAstro;t+=paso){
    const e=NV.eclipse(A.lunas[k],t,(((t-A.lunas[k].epocaNueva)/A.lunas[k].sinodico)%1+1)%1);
    if(e){ if(!act||act.tipo!==e.tipo||t-act.fin>0.05){ act={tipo:e.tipo,clase:e.clase,ini:t,fin:t,max:e.magnitud}; eventos.push(act); }
           else { act.fin=t; if(e.magnitud>act.max){act.max=e.magnitud; act.clase=e.clase;} } }
  }
  cuenta[k]=eventos;
  const sol=eventos.filter(e=>e.tipo==='solar'), lun=eventos.filter(e=>e.tipo==='lunar');
  const dur=e=>((e.fin-e.ini)*D/3600000);
  console.log(A.lunas[k].nombre+':', sol.length, 'eclipses de sol y', lun.length, 'de luna por año');
  if(sol.length) console.log('   solares por clase:',
    ['total','anular','parcial'].map(c=>c+' '+sol.filter(e=>e.clase===c).length).join(', '),
    '· duración media', (sol.reduce((a,e)=>a+dur(e),0)/sol.length*60).toFixed(0)+' min reales');
  if(lun.length) console.log('   lunares por clase:',
    ['total','parcial'].map(c=>c+' '+lun.filter(e=>e.clase===c).length).join(', '));
  const porReal = eventos.length/30;
  console.log('   →', porReal.toFixed(1), 'episodios por día real de juego\n');
}
// colores: buscar un eclipse de cada luna EN SOLITARIO y de día
const probar=[];
for(const [k,col] of [['calavera','rojo'],['madre','blanco']]){
  let mejor=0, luz=null, clase='';
  for(const ev of cuenta[k].filter(x=>x.tipo==='solar'))
    for(let t=ev.ini;t<=ev.fin;t+=paso/2){
      const c=NV.actualizarCielo(t*D);
      const propio = k==='calavera'?c.rojo:c.blanco;
      const ajeno  = k==='calavera'?c.blanco:c.rojo;
      if(ajeno>0.01) continue;                 // descartar eclipses dobles
      if(propio>mejor){ mejor=propio; luz={...c.luz}; clase=ev.clase; }
    }
  if(!luz){ console.log(k+': ningún eclipse solar en solitario y de día'); continue; }
  const dom = luz.r>luz.b ? 'rojo' : 'blanco';
  console.log(k, '· eclipse', clase, 'de magnitud', mejor.toFixed(2),
    '→ luz r'+luz.r.toFixed(2)+' g'+luz.g.toFixed(2)+' b'+luz.b.toFixed(2), '· domina el', dom);
  probar.push([k+' tiñe de '+col, dom===col]);
}
// un eclipse doble no puede quedar en un color al azar
let doble=null;
for(let t=0;t<A.anoAstro && !doble;t+=paso){
  const c=NV.actualizarCielo(t*D);
  if(c.rojo>0.3 && c.blanco>0.3) doble={t, luz:{...c.luz}, rojo:c.rojo, blanco:c.blanco};
}
console.log(doble
  ? '\neclipse doble en el día '+doble.t.toFixed(1)+': rojo '+doble.rojo.toFixed(2)+
    ' contra blanco '+doble.blanco.toFixed(2)+' → gana el '+(doble.rojo>=doble.blanco?'rojo':'blanco')+', por regla fija'
  : '\nno hay eclipses dobles fuertes en el año');

const mal=probar.filter(p=>!p[1]);
console.log('\n'+(probar.length-mal.length)+' de '+probar.length+' colores correctos');
mal.forEach(m=>console.log('  ✗',m[0]));
process.exit(mal.length?1:0);
