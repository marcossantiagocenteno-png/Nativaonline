// Los cinco paneles: nombres, continuidad y que se pueda entrar y salir.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const L=NV.LADO;

console.log('=== nombres y ubicación ===');
for(const k in NV.BIOMAS){
  const [i,j]=k.split(',').map(Number);
  const p=NV.panel(i,j);
  const donde = j<0?'norte' : j>0?'sur' : i<0?'oeste' : i>0?'este' : 'centro';
  console.log('  '+p.coord.padEnd(6), p.nombre.padEnd(24), donde);
}
probar('el claro es el 0:0', NV.panel(0,0).coord==='0:0');
probar('el norte es 0:1 y está arriba', NV.panel(0,-1).coord==='0:1');
probar('el sur es 0:-1 y está abajo',   NV.panel(0,1).coord==='0:-1');

console.log('\n=== el terreno continúa de un panel al otro ===');
// el ruido se muestrea en coordenadas del mundo: la costura no debe notarse
let saltos=0, pares=0;
for(let y=10;y<90;y+=3){
  const a=NV.sueloEn(-1,y), b=NV.sueloEn(0,y);     // borde oeste del claro
  if(!a||!b) continue;
  pares++;
  const verde=c=>c==='g'||c==='G';
  if(verde(a)!==verde(b)) saltos++;
}
console.log('  en la costura oeste:', saltos, 'cambios de tipo en', pares, 'pares');
probar('la costura no es una línea recta de cambio', saltos<pares*0.5);

console.log('\n=== cada bioma tiene lo suyo ===');
const tiene=(p,m)=>{ for(let y=0;y<L;y++) if(p.ground[y].includes(m)) return true; return false; };
const O=NV.panel(-1,0), E=NV.panel(1,0), N=NV.panel(0,-1), S=NV.panel(0,1);
/* el lago usa L y l —agua quieta— desde que el agua tiene estados de ola; antes
   usaba la honda del río y se movía como un río */
console.log('  oeste: pared de roca', tiene(O,'M'), '· lago', tiene(O,'L')&&tiene(O,'l'),
            '· ruinas', tiene(O,'R'), '· árbol místico', O.trees.some(t=>t.sp==='mistico'));
console.log('  este: mar abierto', tiene(E,'O'), '· cauce del río', tiene(E,'P'),
            '· rompiente', tiene(E,'E'), '· acantilado', tiene(E,'M'));
console.log('  norte: duna', tiene(N,'D'), '· bosque', tiene(N,'G'));
console.log('  sur: nieve', tiene(S,'N'), '· solo pinos', S.trees.filter(t=>t.k==='arbol').every(t=>t.sp==='pino'));
probar('el oeste tiene pared, lago de agua quieta, ruinas y el árbol místico',
  tiene(O,'M')&&tiene(O,'L')&&tiene(O,'l')&&tiene(O,'R')&&O.trees.some(t=>t.sp==='mistico'));
probar('el este tiene mar abierto, cauce, rompiente y acantilado',
  tiene(E,'O')&&tiene(E,'P')&&tiene(E,'E')&&tiene(E,'M'));
probar('el norte corta a desierto', tiene(N,'D')&&tiene(N,'G'));
probar('el sur tiene nieve y solo pinos',
  tiene(S,'N')&&S.trees.filter(t=>t.k==='arbol').every(t=>t.sp==='pino'));

console.log('\n=== ningún árbol con los pies en el agua ===');
const AG='aAPEsk';
let dentro=0, orilla=0, totalArb=0, excep=[];
for(const k in NV.BIOMAS){
  const [i,j]=k.split(',').map(Number), p=NV.panel(i,j);
  for(const t of p.trees.filter(t=>t.k==='arbol')){
    totalArb++;
    if('aAPE'.indexOf(p.ground[t.y][t.x])>=0){ dentro++; excep.push(p.coord+' '+t.sp+' en el agua'); continue; }
    let cerca=false;
    for(let dy=-2;dy<=2&&!cerca;dy++) for(let dx=-2;dx<=2;dx++){
      const x=t.x+dx, y=t.y+dy;
      if(x<0||y<0||x>=L||y>=L) continue;
      if(AG.indexOf(p.ground[y][x])>=0){ cerca=true; break; }
    }
    if(cerca){ orilla++; excep.push(p.coord+' '+t.sp+' en la orilla'); }
  }
}
console.log('  de', totalArb, 'árboles:', dentro, 'en el agua ·', orilla, 'en la orilla');
excep.forEach(e=>console.log('    ·', e));
probar('ningún árbol dentro del agua', dentro===0);
probar('en la orilla solo puede quedar el árbol místico',
  excep.every(e=>e.includes('mistico')));

console.log('\n=== la pared oeste no se pasa ===');
let pared=0, total=0;
for(let y=5;y<95;y+=2){ total++; if(NV.solidoEn(-100,y)) pared++; }
console.log('  borde oeste del mundo sólido en', pared, 'de', total, 'puntos');
probar('el borde oeste está cerrado', pared/total>0.9);

console.log('\n=== los árboles del bosque viejo son más grandes ===');
const alt=p=>{const a=p.trees.filter(t=>t.k==='arbol'); return a.reduce((s,t)=>s+t.h,0)/a.length;};
console.log('  altura media — claro', alt(NV.panel(0,0)).toFixed(1)+' m · bosque viejo', alt(O).toFixed(1)+' m');
probar('el bosque viejo es más alto', alt(O)>alt(NV.panel(0,0))*1.3);

console.log('\n=== el sur ralea hacia abajo ===');
const norteS=S.trees.filter(t=>t.k==='arbol'&&t.y<35).length;
const surS  =S.trees.filter(t=>t.k==='arbol'&&t.y>65).length;
console.log('  pinos en la mitad norte:', norteS, '· en la mitad sur:', surS);
probar('hacia el sur quedan menos pinos', surS<norteS);

console.log('\n=== los senderos cruzan las costuras ===');
let filas=0, desajustes=0;
for(let y=5;y<95;y++){
  const a=NV.sueloEn(-1,y)==='d', b=NV.sueloEn(0,y)==='d';
  if(a||b){ filas++; if(a!==b) desajustes++; }
}
console.log('  costura oeste: filas con sendero', filas, '· desajustes', desajustes);
probar('el sendero no se corta en la costura', filas>0 && desajustes===0);
/* En el claro el sendero cruza el arroyo por un vado. En el acantilado no:
   allá el río ya es ancho y hondo, y cortar el paso es lo que corresponde. */
let hondoEnCamino=0;
{ const p=NV.panel(0,0);
  for(let y=0;y<L;y++) for(let x=0;x<L;x++)
    if(p.ground[y][x]==='A' && NV.sendero(x,y)) hondoEnCamino++; }
console.log('  agua honda sobre el sendero del claro:', hondoEnCamino);
probar('en el claro el sendero cruza por vado', hondoEnCamino===0);

console.log('\n=== el acantilado tiene filo, vacío y mar ===');
const E2=NV.panel(1,0);
const perfil=E2.ground[50].slice(58,95).replace(/(.)\1+/g,'$1');
console.log('  perfil de la fila 50:', perfil);
const tieneV=(()=>{ for(let y=0;y<L;y++) if(E2.ground[y].includes('V')) return true; return false; })();
probar('hay un vacío entre la roca y el mar', tieneV);
probar('el vacío no se puede pisar', NV.MAT.V.solido===true);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(m=>console.log('  ✗',m));
process.exit(mal.length?1:0);
