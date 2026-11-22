// Mareas, clima y su relación. Comprueba que nada sea fijo ni azaroso.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== mareas sobre un año ===');
const rep={}; let min=9,max=-9;
for(let i=0;i<21500;i++){const m=NV.marea(i*0.02);rep[m.clase]=(rep[m.clase]||0)+1;
  min=Math.min(min,m.amplitud);max=Math.max(max,m.amplitud);}
const tot=Object.values(rep).reduce((a,b)=>a+b,0);
for(const k of ['muerta','ordinaria','viva','reforzada','excepcional'])
  console.log(' ',k.padEnd(12),((rep[k]||0)/tot*100).toFixed(1)+'%');
probar('aparecen las cinco clases de marea', ['muerta','ordinaria','viva','reforzada','excepcional'].every(k=>rep[k]>0));
probar('la amplitud recorre todo el rango', min<0.05 && max>0.95);

// dos cuerpos alineados refuerzan; en ángulo recto se anulan
let alineada=0, cruzada=0;
for(let i=0;i<4000;i++){
  const t=i*0.01, A=NV.ASTRO;
  const dif=Math.abs(((t/A.lunas.calavera.sideral - t/A.anoAstro)%0.5+0.5)%0.5);
  const m=NV.marea(t).amplitud;
  if(dif<0.02) alineada=Math.max(alineada,m);
  if(Math.abs(dif-0.25)<0.02) cruzada=Math.min(cruzada||9,m);
}
console.log('  Calavera alineada con la estrella → amplitud', alineada.toFixed(2),
            '· en ángulo recto →', cruzada.toFixed(2));
probar('alineadas dan más marea que cruzadas', alineada>cruzada);

console.log('\n=== clima sobre un año ===');
const est={}; let llu=0,tor=0,n=0;
for(let i=0;i<21500;i++){
  const c=NV.clima(i*0.02); n++;
  est[c.estacion]=est[c.estacion]||{n:0,l:0,h:0};
  est[c.estacion].n++; est[c.estacion].h+=c.humedad;
  if(c.lluvia>0.12){llu++; est[c.estacion].l++;}
  if(c.tormenta) tor++;
}
for(const e in est) console.log(' ',e.padEnd(10),
  'lluvia el '+(est[e].l/est[e].n*100).toFixed(1)+'% del tiempo · humedad media '+(est[e].h/est[e].n).toFixed(2));
console.log('  tormentas:',(tor/n*100).toFixed(2)+'% del tiempo');
probar('llueve, pero no siempre', llu/n>0.02 && llu/n<0.4);
probar('las tormentas son raras', tor/n<0.03);
probar('las estaciones se diferencian', Math.max(...Object.values(est).map(e=>e.l/e.n))
                                      > Math.min(...Object.values(est).map(e=>e.l/e.n))+0.03);

console.log('\n=== la marea empuja la humedad, pero no la manda ===');
let altas=0,bajas=0,na=0,nb=0;
for(let i=0;i<21500;i++){
  const t=i*0.02, c=NV.clima(t);
  if(c.marea.amplitud>0.8){altas+=c.humedad;na++;} else if(c.marea.amplitud<0.2){bajas+=c.humedad;nb++;}
}
console.log('  humedad media con marea alta',(altas/na).toFixed(3),'· con marea baja',(bajas/nb).toFixed(3));
probar('la marea alta deja más humedad', altas/na > bajas/nb);
probar('pero no la decide sola', Math.abs(altas/na-bajas/nb)<0.25);

console.log('\n=== el mismo momento da siempre el mismo clima ===');
const a=NV.clima(77.25), b=NV.clima(77.25);
probar('el clima es reproducible', a.humedad===b.humedad && a.lluvia===b.lluvia);

console.log('\n=== predicción ===');
console.log('  próxima marea excepcional:', NV.proximaMarea('excepcional',0,60), 'días astronómicos');
console.log('  próxima lluvia:', NV.proximaLluvia(0,60), 'días astronómicos');
const pe=NV.proximoEclipse(0,30);
console.log('  próximo eclipse:', pe? pe.tipo+' de '+pe.luna+' en '+pe.enDias.toFixed(2)+' días':'ninguno');
probar('el sistema predice un eclipse', !!pe);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(m=>console.log('  ✗',m));
process.exit(mal.length?1:0);
