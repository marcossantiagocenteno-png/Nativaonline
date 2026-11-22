// Verifica el reloj astronómico y las fases de las dos lunas.
const cargar=require('./cargar.js');
const NV=cargar();
const A=NV.ASTRO, D=NV.msPorDiaAstro;
const ok=[], mal=[];
const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== escala ===');
const diaCal=D;
console.log('1 día del planeta = 1 día del calendario =', (D/60000).toFixed(1),'min reales');
console.log('1 día astronómico   =', (D/60000).toFixed(1),'min reales');
console.log('año completo        =', (A.anoAstro*D/86400000).toFixed(1),'días reales');
console.log('estación            =', (A.anoAstro/4*D/86400000).toFixed(2),'días reales');
probar('el año dura 30 días reales', Math.abs(A.anoAstro*D/86400000-30)<0.01);
probar('la fecha avanza con el día del planeta', NV.calendario(5.4).dia===6 && NV.calendario(6.1).dia===7);

console.log('\n=== sinódicos (deben dar 1.37035 y 5.725) ===');
for(const k in A.lunas){
  const l=A.lunas[k];
  console.log(' ', l.nombre.padEnd(9), 'sideral', l.sideral, '→ sinódico', l.sinodico.toFixed(5),
              '·', (l.sinodico*D/3600000).toFixed(2)+' h reales',
              '· tamaño en el cielo', (2*Math.atan(l.diametro/2/l.distancia)*180/Math.PI).toFixed(2)+'°');
}
probar('sinódico de Calavera ≈ 1.37035', Math.abs(A.lunas.calavera.sinodico-1.37035)<0.001);
probar('sinódico de Madre ≈ 5.725',      Math.abs(A.lunas.madre.sinodico-5.725)<0.002);

console.log('\n=== fases a lo largo de un ciclo de Calavera ===');
const paso=A.lunas.calavera.sinodico/8;
for(let i=0;i<8;i++){
  const a=NV.astroEn(i*paso*D), L=a.lunas.calavera;
  console.log('  +'+(i*paso).toFixed(3)+'d', L.nombreFase.padEnd(18), 'iluminada', (L.ilum*100).toFixed(0)+'%');
}
let a0=NV.astroEn(0).lunas.calavera;
probar('Calavera empieza nueva', a0.ilum<0.01 && a0.nombreFase==='nueva');
let aL=NV.astroEn(A.lunas.calavera.sinodico/2*D).lunas.calavera;
probar('medio ciclo después está llena', aL.ilum>0.99 && aL.nombreFase==='llena');

console.log('\n=== la fase vuelve tras un ciclo completo ===');
for(const k in A.lunas){
  const l=A.lunas[k];
  const x=NV.astroEn(123.456*D).lunas[k].fase;
  const y=NV.astroEn((123.456+l.sinodico)*D).lunas[k].fase;
  probar('la fase de '+l.nombre+' se repite tras su ciclo', Math.abs(x-y)<1e-6);
}

console.log('\n=== Madre nueva el día 387 del año ===');
const t27=387;
const m27=NV.astroEn(t27*D).lunas.madre;
console.log('  día 387 → Madre', m27.nombreFase, '('+(m27.ilum*100).toFixed(0)+'% iluminada)');
probar('Madre está nueva el día 387', m27.ilum<0.01);

console.log('\n=== el calendario cruza del 430 al 1 sin romperse ===');
for(const t of [429.9, 429.99, 430, 430.01, 430.5, 860]){
  const c=NV.calendario(t);
  console.log('  día astronómico', String(t).padEnd(7), '→ año', c.ano, 'día', String(c.dia).padStart(2), c.estacion);
}
const antes=NV.calendario(429.999), despues=NV.calendario(430.001);
probar('al cruzar el año vuelve al día 1', antes.dia===430 && despues.dia===1 && despues.ano===antes.ano+1);

console.log('\n=== la luz nocturna sigue a las lunas, no es fija ===');
let min=9, max=-9, sinLuna=0, conLuna=0;
for(let i=0;i<400;i++){
  const t=i*0.37;                      // muestreo a lo largo de ~148 días
  const c=NV.actualizarCielo(t*D);
  if(!c.deNoche) continue;
  min=Math.min(min,c.luz.amb); max=Math.max(max,c.luz.amb);
  if(c.brilloLunar<0.05) sinLuna++; else conLuna++;
}
console.log('  luz nocturna entre', min.toFixed(3), 'y', max.toFixed(3),
            '·', sinLuna, 'noches sin luna contra', conLuna, 'con luna');
probar('la noche no tiene una luz fija', max-min>0.08);
probar('hay noches sin ninguna luna', sinLuna>0);

console.log('\n=== la sombra sigue al sol ===');
const dir=f=>{const c=NV.actualizarCielo(f*D);
  if(c.sombra.porMetro<0.02) return 'sin sombra';
  return Math.abs(c.sombra.dy)>Math.abs(c.sombra.dx)?(c.sombra.dy<0?'norte':'sur')
                                                    :(c.sombra.dx<0?'oeste':'este');};
console.log('  amanecer', dir(0.30), '· mediodía', dir(0.50), '· tarde', dir(0.70), '· noche', dir(0.95));
probar('a la mañana la sombra va al oeste', dir(0.30)==='oeste');
probar('a la tarde la sombra va al este',  dir(0.70)==='este');
probar('de noche no hay sombra proyectada', dir(0.95)==='sin sombra');

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(m=>console.log('  ✗',m));
process.exit(mal.length?1:0);
