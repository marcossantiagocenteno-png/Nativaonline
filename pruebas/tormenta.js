// Lluvia, relámpagos y viento de tormenta.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== reparto de intensidades sobre un año ===');
const r={0:0,1:0,2:0,3:0}; let n=0;
for(let i=0;i<21500;i++){ const c=NV.clima(i*0.02); r[c.intensidad]++; n++; }
const nom=['seco','llovizna','lluvia cerrada','tormenta'];
for(const k in r) console.log('  '+nom[k].padEnd(16), (r[k]/n*100).toFixed(2)+'%');
probar('existen las tres intensidades', r[1]>0&&r[2]>0&&r[3]>0);
probar('la tormenta es poco frecuente', r[3]/n<0.03);

console.log('\n=== la tormenta exige que coincidan tres cosas ===');
let conMarea=0, total=0;
for(let i=0;i<21500;i++){
  const c=NV.clima(i*0.02);
  if(!c.tormenta) continue;
  total++; if(c.marea.amplitud>0.62) conMarea++;
}
console.log('  tormentas con marea viva o más:', conMarea, 'de', total);
probar('ninguna tormenta sin marea crecida', total>0 && conMarea===total);

console.log('\n=== la luna no dispara la tormenta por sí sola ===');
let llenas=0, llenasConTormenta=0;
for(let i=0;i<21500;i++){
  const t=i*0.02, a=NV.astroEn(t*NV.msPorDiaAstro);
  if(a.lunas.calavera.ilum>0.97){ llenas++; if(NV.clima(t).tormenta) llenasConTormenta++; }
}
console.log('  con Calavera llena hay tormenta el', (llenasConTormenta/llenas*100).toFixed(1)+'% de las veces');
probar('la luna llena no implica tormenta', llenasConTormenta/llenas<0.1);

console.log('\n=== el viento responde al clima ===');
let vSeco=0,vTor=0,ns=0,nt=0;
for(let i=0;i<21500;i++){
  const c=NV.clima(i*0.02);
  if(c.intensidad===0){vSeco+=c.viento;ns++;} else if(c.tormenta){vTor+=c.viento;nt++;}
}
console.log('  factor de viento: seco', (vSeco/ns).toFixed(2), '· tormenta', (vTor/nt).toFixed(2));
probar('en tormenta el viento al menos se duplica', (vTor/nt)/(vSeco/ns)>2);

console.log('\n=== relámpagos ===');
// buscar un momento de tormenta y mirar un minuto real de relámpagos
let tTor=null;
for(let i=0;i<21500&&!tTor;i++){ if(NV.clima(i*0.02).tormenta) tTor=i*0.02; }
/* El relámpago es una función del reloj real, y con una tasa de ~5 golpes por minuto
   un minuto cualquiera tiene a veces cero. Con Date.now() la prueba fallaba una de
   cada sesenta corridas. Se miran diez minutos FIJOS: lo que se exige es que
   haya relámpagos en una tormenta y que nunca sean continuos, no que cada minuto
   tenga uno. */
if(!NV.probarRelampago){ console.log('  (sin acceso directo a la función; se comprueba en el navegador)'); }
else {
  const porMinuto=[]; let continuos=0, maxFl=0;
  for(let k=0;k<10;k++){
    const base=1.7e12+k*3600000+k*1234;
    let golpes=0, muestras=0;
    for(let ms=0; ms<60000; ms+=130){                  // un minuto, al ritmo del motor
      const fl=NV.probarRelampago(base+ms,true); muestras++;
      if(fl>0.05){ golpes++; maxFl=Math.max(maxFl,fl); }
    }
    porMinuto.push(golpes); if(golpes/muestras>=0.25) continuos++;
  }
  const total=porMinuto.reduce((a,b)=>a+b,0);
  console.log('  golpes en cada uno de diez minutos de tormenta:', porMinuto.join(' '), '· el más fuerte', maxFl.toFixed(2));
  probar('en diez minutos de tormenta hay relámpagos', total>0);
  probar('ningún minuto de relámpagos es continuo', continuos===0);
  probar('el ritmo es de unos pocos golpes por minuto (entre 1 y 15 de media)', total/10>=1 && total/10<=15);
  const sin=NV.probarRelampago(1.7e12,false)||0;
  probar('sin tormenta no hay relámpagos', sin===0 && [0,1,2,3,4,5].every(k=>!NV.probarRelampago(1.7e12+k*85,false)));
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(m=>console.log('  ✗',m));
process.exit(mal.length?1:0);
