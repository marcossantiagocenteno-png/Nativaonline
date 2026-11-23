/* Nativa Online — REGISTRO DE MOTORES.
   Cada motor del juego (luz, viento, y los que vienen: pasto, caminos, empedrados, agua y
   ríos, árboles, vegetación, rocas y decorado) se da de alta acá con el mismo contrato, para
   que el juego —y más adelante el Modo Dios— los encuentre sin conocerlos de antemano.

   Un motor tiene hasta cuatro CARAS, todas opcionales:
     generar(ctx)        datos: produce o modifica datos del mundo, de forma determinista
     dibujar(ctx, fila)  imagen: pinta en el búfer de glifos
     ambiente(x,y,t)     consulta: responde en un punto y un instante (el viento, la luz)
     editor              qué ofrece al Modo Dios: {parametros:{nombre:{tipo,min,max,def}}, herramientas:[...]}
   y datos de ubicación:
     id, nombre, version, estado ('integrado' | 'en-dibujar' | 'pendiente'),
     preview ('preview/x.html'), prueba ('pruebas/x.js'), archivo ('src/...').

   El registro no ejecuta nada por sí solo: sólo ordena y valida. Un motor que no se registra
   sigue funcionando; registrarlo es lo que lo hace visible al editor. */

const NVr = window.NV;

const CARAS=['generar','dibujar','ambiente','editor'];
const ESTADOS=['integrado','en-dibujar','pendiente'];
const motores=new Map();

function registrar(def){
  if(!def||typeof def.id!=='string'||!def.id) throw new Error('motor sin id');
  if(motores.has(def.id)) throw new Error('motor repetido: '+def.id);
  const caras=def.caras||{};
  for(const c of Object.keys(caras)){
    if(CARAS.indexOf(c)<0) throw new Error(def.id+': cara desconocida "'+c+'"');
    if(c==='editor'){ if(caras[c]&&typeof caras[c]!=='object') throw new Error(def.id+': editor debe ser un objeto'); }
    else if(caras[c]&&typeof caras[c]!=='function') throw new Error(def.id+': la cara "'+c+'" debe ser una función');
  }
  const estado=def.estado||'integrado';
  if(ESTADOS.indexOf(estado)<0) throw new Error(def.id+': estado desconocido "'+estado+'"');
  const m=Object.freeze(Object.assign({nombre:def.id,version:1,estado,caras:{}},def,{caras:Object.freeze(Object.assign({},caras)),estado}));
  motores.set(m.id,m);
  return m;
}
const obtener=id=>motores.get(id)||null;
const ids=()=>Array.from(motores.keys());
/* los motores que tienen una cara dada (p. ej. todos los que tienen 'editor') */
const conCara=c=>Array.from(motores.values()).filter(m=>m.caras[c]);
/* para el informe de arquitectura: qué hay, dónde vive y en qué estado está */
const catalogo=()=>Array.from(motores.values()).map(m=>({id:m.id,nombre:m.nombre,estado:m.estado,
  caras:Object.keys(m.caras).filter(c=>m.caras[c]),archivo:m.archivo||null,preview:m.preview||null,prueba:m.prueba||null}));

NVr.motores={registrar,obtener,ids,conCara,catalogo,CARAS,ESTADOS};
