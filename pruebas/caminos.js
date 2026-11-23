// El motor de caminos: trazado, campo, las cuatro familias, parámetros, edición local y determinismo.
// El motor está en estado de laboratorio: esta prueba también vigila que NO se haya metido al juego.
const fs=require('fs');
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV};');
const NV=m.NV, C=NV.caminos; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

/* ---- registro y estado ---- */
const mot=NV.motores.obtener('caminos');
probar('el motor está dado de alta y en estado de laboratorio (pendiente)', !!mot&&mot.estado==='pendiente');
probar('declara preview y prueba que existen', fs.existsSync(mot.preview)&&fs.existsSync(mot.prueba));
probar('tiene caras de generar, dibujar y editor', !!mot.caras.generar&&!!mot.caras.dibujar&&!!mot.caras.editor);
probar('las cuatro familias están', Object.keys(C.FAMILIAS).join()==='tierra,tierra-antigua,empedrado,empedrado-antiguo');
const dibujarSrc=fs.readFileSync('src/juego/dibujar.js','utf8')+fs.readFileSync('src/juego/jugar.js','utf8')+fs.readFileSync('src/mundo/paneles.js','utf8');
probar('ni dibujar.js, ni jugar.js ni los paneles lo usan todavía (no se integra sin aprobación)', !/caminos|NV\.caminos/.test(dibujarSrc.replace(/sendero|caminos? de|camino viejo|camino que busca|el camino/gi,'')));

/* ---- ayudas ---- */
const CPM=13, RPM=4, LF=0.9;
function rend(lista,x0,y0,mw,mh,lf){
  const cols=mw*CPM, rows=mh*RPM, G=new Int32Array(cols*rows).fill(-1), K=new Int32Array(cols*rows).fill(-1);
  for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){
    const cx=x0*CPM+i, cy=y0*RPM+j, wx=(cx+0.5)/CPM, wy=(cy+0.5)/RPM;
    if(C.celdaRed(wx,wy,lf||LF,cx,cy,lista)){ G[j*cols+i]=C.sal.g; K[j*cols+i]=C.sal.c; }
  }
  return {G,K,cols,rows};
}
const igual=(a,b)=>{ if(a.G.length!==b.G.length) return false; for(let i=0;i<a.G.length;i++) if(a.G[i]!==b.G[i]||a.K[i]!==b.K[i]) return false; return true; };
const difer=(a,b)=>{ let n=0; for(let i=0;i<a.G.length;i++) if(a.G[i]!==b.G[i]||a.K[i]!==b.K[i]) n++; return n; };
const cubiertas=r=>{ let n=0; for(let i=0;i<r.G.length;i++) if(r.G[i]>=0) n++; return n; };
const nuevoC=(fam,o)=>C.nuevo(Object.assign({familia:fam,puntos:C.curvo([100,110],[128,106],0.12),semilla:5},o||{}));
const FAMS=Object.keys(C.FAMILIAS);

/* ---- determinismo y estabilidad ---- */
for(const f of FAMS){
  const a=rend([nuevoC(f)],100,100,30,16), b=rend([nuevoC(f)],100,100,30,16);
  probar(f+': mismas semillas, mismo resultado casilla por casilla', igual(a,b)&&cubiertas(a)>200);
  const c=rend([nuevoC(f,{semTextura:99})],100,100,30,16);
  probar(f+': otra semilla de textura, otra piel', difer(a,c)>cubiertas(a)*0.2);
}
{ // la caché de piedras no cambia lo que se ve: antes y después de preparar otro camino
  const c1=nuevoC('empedrado-antiguo'); const a=rend([c1],100,100,30,16);
  nuevoC('tierra',{puntos:[[0,0],[5,5]]}); const b=rend([c1],100,100,30,16);
  probar('el empedrado sale igual con la memoria de piedras vacía o llena', igual(a,b));
  // y el orden en que se pide no importa: mitad derecha primero
  const half=(cx0)=>{ const r=[]; for(let j=0;j<64;j++) for(let i=cx0;i<cx0+60;i++){ const cx=100*CPM+i, cy=100*RPM+j; r.push(C.celdaRed((cx+0.5)/CPM,(cy+0.5)/RPM,LF,cx,cy,[c1])?C.sal.g:-1); } return r.join(); };
  const x1=half(200), x2=half(0), x3=half(200);
  probar('pedir las casillas en otro orden da lo mismo (sin parpadeo al caminar)', x1===x3&&x2.length>0);
}

/* ---- trazado: ancho variable, bordes, meandro ---- */
{
  const fijo=nuevoC('tierra',{params:{variacionAncho:0}}), vari=nuevoC('tierra',{params:{variacionAncho:1}});
  const rango=c=>{ const W=c._p.W.slice(3,-3); return Math.max(...W)-Math.min(...W); };
  probar('con variación 0 el ancho es constante', rango(fijo)<1e-9);
  probar('con variación 1 el ancho cambia a lo largo del camino', rango(vari)>0.7);
  const rec=params=>C.nuevo({familia:'tierra',puntos:C.recto([100,108],[140,108]),semilla:3,params});
  const borde=(c)=>{ const ys=[]; for(let x=104;x<136;x+=0.25){ let top=null; for(let y=100;y<108;y+=1/RPM){ const cx=Math.floor(x*CPM), cy=Math.floor(y*RPM); if(C.celdaRed(x,y,LF,cx,cy,[c])){ top=y; break; } } if(top!==null) ys.push(top); }
    const mu=ys.reduce((a,b)=>a+b,0)/ys.length; return Math.sqrt(ys.reduce((a,b)=>a+(b-mu)*(b-mu),0)/ys.length); };
  const liso=borde(rec({bordes:0,irregularidad:0,variacionAncho:0,transicion:0.2})), roto=borde(rec({bordes:1,irregularidad:0,variacionAncho:0,transicion:0.2}));
  probar('la irregularidad de los bordes mueve el borde ('+liso.toFixed(2)+' → '+roto.toFixed(2)+' m)', roto>liso*1.8&&roto>0.12);
  const recto=C.nuevo({familia:'tierra',puntos:C.recto([100,108],[140,108]),semilla:3,params:{irregularidad:0}});
  const ond=C.nuevo({familia:'tierra',puntos:C.recto([100,108],[140,108]),semilla:3,params:{irregularidad:1}});
  const desv=c=>Math.max(...c._p.Y)-Math.min(...c._p.Y);
  probar('el nivel de irregularidad hace serpentear el eje ('+desv(recto).toFixed(2)+' → '+desv(ond).toFixed(2)+' m)', desv(ond)>0.6&&desv(ond)>desv(recto)*3&&desv(recto)<0.3);
  // regenerar la textura no mueve el trazado (el eje y el ancho)
  const c0=nuevoC('empedrado'), eje0=c0._p.X.join()+c0._p.Y.join()+c0._p.W.join();
  C.editar.regenerarTextura(c0,777);
  probar('regenerar la textura deja el eje y el ancho idénticos', c0._p.X.join()+c0._p.Y.join()+c0._p.W.join()===eje0&&c0.semTextura===777);
  const fin=C.nuevo({familia:'tierra',puntos:C.recto([100,108],[130,108]),semilla:1,fin:'afila'}), pl=C.nuevo({familia:'tierra',puntos:C.recto([100,108],[130,108]),semilla:1,fin:'plaza'});
  probar('"afila" cierra el camino y "plaza" lo ensancha al final', fin._p.W[fin._p.N-1]<fin._p.W[10]*0.4&&pl._p.W[pl._p.N-2]>pl._p.W[10]*1.4);
}

/* ---- cada parámetro que se ofrece hace algo ---- */
for(const f of FAMS){
  const ps=C.parametrosDe(f);
  for(const k of Object.keys(ps)){
    const a=rend([nuevoC(f,{params:{[k]:ps[k].min}})],100,98,30,20), b=rend([nuevoC(f,{params:{[k]:ps[k].max}})],100,98,30,20);
    probar(f+': el parámetro "'+k+'" cambia lo que se dibuja ('+difer(a,b)+' casillas)', difer(a,b)>12);
  }
}
probar('"separacion" sólo se ofrece al empedrado y las piedras sueltas de la tierra no la tienen', !C.parametrosDe('tierra').separacion&&!!C.parametrosDe('empedrado').separacion);
probar('cada familia tiene sus propios valores por defecto', new Set(FAMS.map(f=>JSON.stringify(C.FAMILIAS[f].def))).size===4);
probar('las tres variantes cambian el nivel de detalle', C.variante('tierra','natural').detalle===0&&C.variante('tierra','intermedia').detalle===1&&C.variante('tierra','detallada').detalle===2);
for(const f of FAMS){ const n=rend([nuevoC(f,{params:C.variante(f,'natural')})],100,98,30,20), d=rend([nuevoC(f,{params:C.variante(f,'detallada')})],100,98,30,20);
  probar(f+': natural y detallada son visiblemente distintas', difer(n,d)>cubiertas(n)*0.25); }

/* ---- el diccionario de glifos ---- */
{
  const PERMITIDOS=new Set(' .,:;-_=o°`\'"/\\08'.split('').map(c=>c.charCodeAt(0)));
  const usados={}; for(const f of FAMS){ const s=new Set(); for(const v of ['natural','detallada']){ const r=rend([nuevoC(f,{params:C.variante(f,v)})],100,98,30,20); for(const g of r.G) if(g>=0) s.add(g); } usados[f]=s; }
  let fuera=[]; for(const f of FAMS) for(const g of usados[f]) if(!PERMITIDOS.has(g)) fuera.push(f+':'+String.fromCharCode(g));
  probar('sólo salen glifos del diccionario ampliado ('+(fuera.join(',')||'ninguno ajeno')+')', !fuera.length);
  probar('regla 3: "0" y "8", el extremo denso de la piedra, son exclusivos del empedrado', !usados['tierra'].has(48)&&!usados['tierra-antigua'].has(56)&&!usados['tierra'].has(56)&&!usados['tierra-antigua'].has(48)&&usados['empedrado'].has(48)&&usados['empedrado-antiguo'].has(56));
  const colores=rend([nuevoC('empedrado-antiguo')],100,98,30,20).K.filter(x=>x>=0);
  probar('los colores son enteros RGB válidos', colores.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffff));
  const lum=lf=>{ const r=rend([nuevoC('tierra')],100,98,30,20,lf); let s=0,n=0; for(const x of r.K) if(x>=0){ s+=((x>>16)&255)+((x>>8)&255)+(x&255); n++; } return s/n; };
  probar('la luz oscurece y aclara el camino', lum(0.5)<lum(0.9)&&lum(0.9)<lum(1.25));
}

/* ---- la transición con el pasto: el camino deja casillas libres en el borde ---- */
{
  const mk=t=>nuevoC('tierra',{params:{transicion:t}});
  /* qué fracción de las casillas a cierta distancia del borde nominal lleva camino */
  const cobertura=(c,e0,e1)=>{ let cub=0,tot=0;
    for(let x=104;x<124;x+=1/CPM) for(let y=100;y<116;y+=1/RPM){ const d=C.campo(c,x,y); if(!d) continue; const e=d.d-d.w/2; if(e>e0&&e<e1){ tot++; if(C.celdaRed(x,y,LF,Math.floor(x*CPM),Math.floor(y*RPM),[c])) cub++; } }
    return cub/Math.max(1,tot); };
  const ca=mk(0.05), cb=mk(1);
  const afA=cobertura(ca,0.15,0.45), afB=cobertura(cb,0.15,0.45), adA=cobertura(ca,-0.5,-0.2), adB=cobertura(cb,-0.5,-0.2);
  probar('con más transición el camino se deshilacha hacia afuera ('+afA.toFixed(2)+' → '+afB.toFixed(2)+' del borde afuera con camino)', afB>afA+0.15);
  probar('...y el pasto se mete hacia adentro ('+adA.toFixed(2)+' → '+adB.toFixed(2)+' del borde adentro con camino)', adB<adA-0.05);
}
{
  const c=nuevoC('empedrado'); const r=rend([c],100,98,30,20);
  let fuera=0; for(let j=0;j<r.rows;j++) for(let i=0;i<r.cols;i++){ const wx=100+(i+0.5)/CPM, wy=98+(j+0.5)/RPM, d=C.campo(c,wx,wy); if(r.G[j*r.cols+i]>=0&&(!d||d.d>d.w/2+2.6)) fuera++; }
  probar('el empedrado no pinta lejos de su camino', fuera===0);
}

/* ---- sin patrón repetido (mosaico) ---- */
for(const f of FAMS){
  const c=C.nuevo({familia:f,puntos:C.recto([100,110],[190,110]),semilla:9,params:{irregularidad:0,variacionAncho:0}});
  const r=rend([c],100,104,90,12), cols=r.cols;
  const sim=lag=>{ let eq=0,n=0; for(let j=0;j<r.rows;j++) for(let i=0;i<cols-lag;i++){ const a=r.G[j*cols+i], b=r.G[j*cols+i+lag]; if(a>=0&&b>=0){ n++; if(a===b) eq++; } } return n?eq/n:0; };
  const lags=[]; for(let l=3*CPM;l<=40*CPM;l+=7) lags.push(sim(l));
  const mu=lags.reduce((a,b)=>a+b,0)/lags.length, mx=Math.max(...lags);
  probar(f+': ningún desplazamiento repite la textura (máx '+mx.toFixed(2)+' vs media '+mu.toFixed(2)+')', mx-mu<0.07);
}

/* ---- ediciones locales: sólo cambia lo que se tocó ---- */
for(const f of ['tierra','empedrado']){
  const lar=C.nuevo({familia:f,puntos:C.curvo([100,110],[170,106],0.08),semilla:4});
  const a=rend([lar],98,96,76,26);
  const caja=C.editar.moverPunto(lar,3,lar.puntos[3][0],lar.puntos[3][1]+1.4);   // mover un punto del medio
  const b=rend([lar],98,96,76,26);
  let fueraCaja=0,dentro=0;
  for(let j=0;j<a.rows;j++) for(let i=0;i<a.cols;i++){ const x=98+(i+0.5)/CPM, y=96+(j+0.5)/RPM, k=j*a.cols+i, d=a.G[k]!==b.G[k]||a.K[k]!==b.K[k];
    if(d){ if(x<caja[0]-0.01||x>caja[2]+0.01||y<caja[1]-0.01||y>caja[3]+0.01) fueraCaja++; else dentro++; } }
  probar(f+': mover un punto cambia casillas y todas caen dentro de la caja que devuelve ('+dentro+' dentro, '+fueraCaja+' fuera)', dentro>100&&fueraCaja===0);
  probar(f+': esa caja es chica frente al camino entero', (caja[2]-caja[0])<(lar._caja[2]-lar._caja[0])*0.75);
}
{
  const c=nuevoC('tierra'); const n0=c.puntos.length;
  C.editar.insertarPunto(c,2,113,108); probar('insertar un punto lo agrega', c.puntos.length===n0+1);
  C.editar.quitarPunto(c,2); probar('quitar un punto lo saca', c.puntos.length===n0);
  let err=false; try{ const d=C.nuevo({familia:'tierra',puntos:[[0,0],[5,0]]}); C.editar.quitarPunto(d,0); }catch(e){ err=true; }
  probar('no deja un camino con menos de dos puntos', err);
  const w0=Math.max(...c._p.W); C.editar.fijarAncho(c,2,5); probar('fijar el ancho en un punto ensancha ese tramo', Math.max(...c._p.W)>w0+1);
  C.editar.fijarParametro(c,'ancho',99); probar('los parámetros se acotan a su rango', c.params.ancho===C.PARAMS.ancho.max);
  let err2=false; try{ C.editar.fijarParametro(c,'magia',1); }catch(e){ err2=true; } probar('un parámetro que no existe se rechaza', err2);
}
{
  const c=C.nuevo({familia:'tierra',puntos:C.recto([100,108],[140,108]),semilla:2,params:{bordes:0.1,transicion:0.3}});
  const antes=rend([c],100,102,40,12);
  C.editar.cambiarFamilia(c,'empedrado'); const emp=rend([c],100,102,40,12);
  probar('cambiar la familia de un camino ya creado cambia su superficie y conserva el trazado', difer(antes,emp)>cubiertas(antes)*0.5&&c.puntos.length===2&&emp.G.some(g=>g===48||g===56));
  C.editar.sectorear(c,12,22,'tierra');
  const mix=rend([c],100,102,40,12); const xTierra=[], xEmp=[];
  for(let j=0;j<mix.rows;j++) for(let i=0;i<mix.cols;i++){ const g=mix.G[j*mix.cols+i]; if(g===48||g===56) xEmp.push(100+i/CPM); }
  probar('un sector del camino puede ser de otra familia (el tramo 12–22 m es tierra: sin piedra "0"/"8")', xEmp.length>50&&!xEmp.some(x=>x>113.2&&x<120.8));
  C.editar.quitarSector(c,15); const sin=rend([c],100,102,40,12);
  probar('quitar el sector devuelve el camino a una sola familia', sin.G.some((g,i)=>g>=0&&(g===48||g===56)&&(100+(i%sin.cols)/CPM)>113.2&&(100+(i%sin.cols)/CPM)<120.8));
}

/* ---- la red: bifurcaciones, intersecciones y borrar ---- */
{
  C.vaciar();
  const pa=C.agregar(nuevoC('tierra',{id:'principal',puntos:C.curvo([100,110],[140,104],0.1)}));
  const hijo=C.bifurcar(pa,0.5,[132,122],{semilla:3,id:'hijo'}); C.agregar(hijo);
  const nacio=C.puntoEn(pa,0.5), p0=hijo.puntos[0];
  probar('la bifurcación nace sobre el eje del padre', Math.hypot(nacio.x-p0[0],nacio.y-p0[1])<0.01);
  const cam=C.campo(pa,hijo._p.X[1],hijo._p.Y[1]);
  probar('y el empalme está dentro del ancho del padre (sin escalón)', cam&&cam.d<pa._p.W[10]*0.5+0.6);
  // una casilla del medio del hijo, lejos del padre, la pinta la red
  const mid=hijo._p.N>>1, mx=hijo._p.X[mid], my=hijo._p.Y[mid];
  probar('la red resuelve casillas de cada camino por su índice', C.celdaRed(mx,my,LF,Math.floor(mx*CPM),Math.floor(my*RPM))===true);
  const cruce=C.agregar(nuevoC('tierra',{id:'cruce',puntos:C.recto([120,98],[124,125])}));
  const px=(hijo._p.X[mid]), r1=C.celdaRed(122,110,LF,Math.floor(122*CPM),Math.floor(110*RPM));
  probar('una intersección es dos caminos que se cruzan y la red cubre el cruce', r1===true&&px>0);
  const v=C.red.version; C.quitar('cruce'); probar('borrar un camino lo saca de la red y sube su versión', !C.red.caminos.has('cruce')&&C.red.version>v&&C.celdaRed(122,125.5,LF,0,0)!==true);
  C.vaciar();
}

/* ---- datos: lo que se guarda y se vuelve a leer ---- */
for(const f of FAMS){
  const c=nuevoC(f,{params:{ancho:3.1,desgaste:0.2},anchos:[null,2,null,4,null,null,null],fin:'plaza'});
  C.editar.sectorear(c,5,9,f==='tierra'?'empedrado':'tierra');
  const d=JSON.parse(JSON.stringify(C.aDatos(c))), c2=C.deDatos(d);
  probar(f+': guardar y leer da el mismo camino, casilla por casilla', igual(rend([c],100,98,30,20),rend([c2],100,98,30,20))&&d.tipo==='camino');
}

/* ---- costo ---- */
{
  const lista=[nuevoC('empedrado-antiguo')]; rend(lista,100,98,30,20);
  const t0=Date.now(); const r=rend(lista,100,98,30,20), ms=Date.now()-t0, n=r.cols*r.rows;
  console.log('  costo: '+n+' casillas consultadas en '+ms+' ms ('+(ms*1000/n).toFixed(2)+' µs/casilla, '+cubiertas(r)+' cubiertas)');
  probar('consultar 30×20 m cuesta menos de 150 ms (la ventana del juego son unos 22×30 m)', ms<150);
}
console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);
