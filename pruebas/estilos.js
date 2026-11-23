// La hoja de estilos: que exista una sola, que la cargue el juego, y que
// tenga una regla para cada pieza de la interfaz.
const fs=require('fs');
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

const enRaiz=fs.existsSync('style.css');
console.log('hoja huérfana en la raíz:', enRaiz?'SÍ — nadie la carga':'no');
probar('hay una sola hoja de estilos', !enRaiz);

const html=fs.readFileSync('index.html','utf8');
const ruta=(html.match(/href="(src\/[^"?]+\.css)/)||[])[1];
console.log('el juego carga:', ruta);
probar('el cargador apunta a src/style.css', ruta==='src/style.css');

const css=fs.readFileSync('src/'+'style.css','utf8');
const marcado=fs.readFileSync('src/juego/interfaz.js','utf8');
/* Las piezas que se colocan solas en la pantalla necesitan regla propia; el
   resto hereda del encabezado, del pie o del cuadro. */
const PROPIOS=['stage','cv','compass','bubble','map','mapTx',
               'bInfo','info','cuadro','fallo','toast','sello',
               /* los paneles de las esquinas, desde que el lienzo va a los bordes */
               'hudTL','hudBL','wname','ayuda','dios','diosPaleta','diosEstado'];
const sinRegla=PROPIOS.filter(i=>!css.includes('#'+i));
console.log('piezas que se colocan solas:', PROPIOS.length, '· sin regla:', sinRegla.join(', ')||'ninguna');
probar('cada pieza que se coloca sola tiene estilo', sinRegla.length===0);

const clases=[...new Set([...marcado.matchAll(/class="([^"]+)"/g)]
  .flatMap(m=>m[1].split(/\s+/)))].filter(Boolean);
const faltan=clases.filter(c=>!css.includes('.'+c));
console.log('clases usadas:', clases.join(' '), '· sin estilo:', faltan.join(', ')||'ninguna');
probar('las clases del marcado tienen estilo', faltan.length===0);

/* el encabezado y el pie se fueron cuando el mundo pasó a llegar a los bordes */
const muertas=['#pad','.modal','#astros','#legend','header','footer','main{','.sp','.zg']
  .filter(r=>css.includes(r));
console.log('reglas de cosas que ya no existen:', muertas.join(', ')||'ninguna');
probar('no quedan estilos de piezas borradas', muertas.length===0);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);
