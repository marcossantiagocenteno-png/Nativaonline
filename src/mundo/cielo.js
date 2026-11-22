/* Nativa Online — cielo: traduce la astronomía a luz, color y palabras.
   Los cálculos viven en astro.js; acá solo se presenta. */

const NV_ = window.NV;

/* Paradas de color según la hora del día. Se interpola entre ellas. */
const PARADAS = [
  {f:0.00, amb:0.14, r:0.44, g:0.54, b:0.86, n:'noche cerrada'},
  {f:0.18, amb:0.17, r:0.50, g:0.58, b:0.88, n:'antes del alba'},
  {f:0.25, amb:0.52, r:1.18, g:0.80, b:0.60, n:'amanece'},
  {f:0.32, amb:0.86, r:1.12, g:0.96, b:0.82, n:'mañana temprano'},
  {f:0.44, amb:1.00, r:1.00, g:1.00, b:1.00, n:'mañana'},
  {f:0.50, amb:1.04, r:1.00, g:1.00, b:0.98, n:'mediodía'},
  {f:0.62, amb:0.98, r:1.04, g:0.99, b:0.92, n:'tarde'},
  {f:0.72, amb:0.72, r:1.16, g:0.88, b:0.66, n:'cae la tarde'},
  {f:0.78, amb:0.40, r:1.14, g:0.74, b:0.62, n:'anochece'},
  {f:0.86, amb:0.17, r:0.52, g:0.58, b:0.88, n:'noche'},
  {f:1.00, amb:0.14, r:0.44, g:0.54, b:0.86, n:'noche cerrada'}
];
const entre=(a,b,t)=>a+(b-a)*t;

const cielo = {
  t:0, dia:1, ano:0, estacion:'primavera', fase:0.4, deNoche:false,
  elev:40, azimut:140,
  sombra:{dx:-1, dy:0, porMetro:1.7},
  luz:{amb:1, r:1, g:1, b:1},
  lunas:null, brilloLunar:0, nombre:'mañana', eclipse:null, rojo:0, blanco:0
};

function actualizarCielo(ms){
  const a = NV_.astroEn(ms);
  cielo.t=a.t; cielo.dia=a.dia; cielo.ano=a.ano; cielo.estacion=a.estacion;
  cielo.fase=a.fraccionDia; cielo.deNoche=!a.deDia;
  cielo.elev=a.solElev; cielo.azimut=a.solAzimut; cielo.lunas=a.lunas;

  /* la sombra apunta al lado contrario del sol y se acorta al mediodía */
  const s=(a.solAzimut+180)*Math.PI/180;
  cielo.sombra.dx=Math.sin(s);
  cielo.sombra.dy=-Math.cos(s);
  cielo.sombra.porMetro = a.solElev>3 ? Math.min(14,1/Math.tan(a.solElev*Math.PI/180)) : 0;

  /* luz de las lunas: fase por altura sobre el horizonte, cada una con su peso */
  let lunar=0;
  for(const k in a.lunas){
    const L=a.lunas[k];
    if(L.altura>0) lunar += L.ilum * L.altura * L.cfg.peso;
  }
  cielo.brilloLunar=lunar;

  /* color y cantidad de luz */
  const f=a.fraccionDia;
  let i=0; while(i<PARADAS.length-2 && f>PARADAS[i+1].f) i++;
  const p=PARADAS[i], q=PARADAS[i+1];
  const t=(f-p.f)/Math.max(0.0001,(q.f-p.f));
  let amb=entre(p.amb,q.amb,t);
  if(cielo.deNoche) amb += lunar*0.30;             // una noche de lunas altas se ve
  let r=entre(p.r,q.r,t), g=entre(p.g,q.g,t), b=entre(p.b,q.b,t);
  if(cielo.deNoche && lunar>0.15){                  // la luz de luna es más fría y blanca
    const m=Math.min(1,lunar);
    r=entre(r,0.78,m*0.5); g=entre(g,0.84,m*0.5); b=entre(b,1.00,m*0.5);
  }
  /* ---------- eclipses ----------
     Calavera tiñe el mundo de rojo; Madre, de un blanco pálido.
     El juego no explica por qué. */
  let ecl=null, rojo=0, blanco=0;
  for(const k in a.lunas){
    const E=a.lunas[k].eclipse;
    if(!E) continue;
    /* un eclipse de sol solo se nota de día; uno de luna, de noche y con la luna arriba */
    const peso = E.tipo==='solar' ? (a.deDia?1:0)
                                  : (!a.deDia && a.lunas[k].altura>0 ? 1 : 0);
    if(!peso) continue;
    const fuerza=E.magnitud*peso;
    if(k==='calavera') rojo=Math.max(rojo,fuerza); else blanco=Math.max(blanco,fuerza);
    if(!ecl||fuerza>ecl.fuerza) ecl={luna:a.lunas[k].nombre,...E,fuerza};
  }
  if(rojo||blanco){
    const f=Math.max(rojo,blanco);
    if(ecl.tipo==='solar'){
      amb*=1-0.80*f;                       // el día se apaga
      cielo.sombra.porMetro*=1-0.85*f;     // y las sombras se deshacen
    } else {
      amb*=1-0.55*f;                       // la luna eclipsada deja de alumbrar
    }
    if(rojo>=blanco){ r=entre(r,1.35,rojo); g=entre(g,0.26,rojo); b=entre(b,0.20,rojo); }
    else            { r=entre(r,0.86,blanco); g=entre(g,1.02,blanco); b=entre(b,1.28,blanco); }
  }
  cielo.eclipse=ecl; cielo.rojo=rojo; cielo.blanco=blanco;

  cielo.luz.amb=amb; cielo.luz.r=r*amb; cielo.luz.g=g*amb; cielo.luz.b=b*amb;
  cielo.nombre = ecl ? (ecl.luna==='Calavera'?'la luz se vuelve roja':'una claridad blanca')
                     : (t<0.5 ? p.n : q.n);
  return cielo;
}

/* El cielo en palabras, sin un solo número. */
function cieloEnPalabras(){
  const E=cielo.eclipse;
  if(E) return E.luna==='Calavera'
    ? 'Calavera está delante de la luz y todo se ha teñido de rojo. Nadie sabe por qué.'
    : 'Madre está delante de la luz y el bosque se ha vuelto de un blanco pálido, sin explicación.';
  if(!cielo.deNoche){
    const alto = cielo.elev>45?'alto':cielo.elev>20?'a media altura':'bajo, rasante';
    return 'El sol está '+alto+', '+(cielo.fase<0.5?'al este':'al oeste')+'.';
  }
  const arriba=[];
  for(const k in cielo.lunas){
    const L=cielo.lunas[k];
    if(L.altura>0.05) arriba.push(L.nombre+' '+L.nombreFase+
      (L.altura>0.75?', en lo más alto':L.altura<0.3?', junto al horizonte':''));
  }
  if(!arriba.length) return 'No hay lunas en el cielo; la oscuridad es completa.';
  return (arriba.length>1?'Dos lunas: ':'En el cielo, ')+arriba.join('; ')+'.';
}

NV_.cielo=cielo; NV_.actualizarCielo=actualizarCielo;
NV_.cieloEnPalabras=cieloEnPalabras; NV_.luz=cielo.luz;
