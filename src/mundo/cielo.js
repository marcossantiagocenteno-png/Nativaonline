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

/* Relámpago: un golpe de luz que dura un cuarto de segundo. Determinista,
   calculado sobre el reloj real para que tenga el ritmo nervioso que le toca. */
function relampago(ms, tormenta){
  if(!tormenta) return 0;
  const ranura=Math.floor(ms/85);                 // ranuras tres veces más cortas
  if(NV_.hash3(ranura,7,3)%1000 > 15) return 0;   // y proporcionalmente más raras
  const sub=(ms%85)/85;
  return Math.max(0, 1-sub*1.35);                 // golpe seco y vuelta enseguida
}

const LUZ_FIJA={amb:0.72, r:0.72, g:1.00, b:0.88, sombra:[1,0.30,1.7]};   // la luz de la muestra
const cielo = {
  t:0, dia:1, ano:0, estacion:'primavera', fase:0.4, deNoche:false,
  elev:40, azimut:140,
  sombra:{dx:-1, dy:0, porMetro:1.7},
  luz:{amb:1, r:1, g:1, b:1},
  lunas:null, brilloLunar:0, nombre:'mañana', eclipse:null, rojo:0, blanco:0,
  clima:null, visibilidad:1, relampago:0
};

function actualizarCielo(ms){
  const a = NV_.astroEn(ms);
  cielo.t=a.t; cielo.dia=a.dia; cielo.mes=a.mes; cielo.diaMes=a.diaMes; cielo.ano=a.ano; cielo.estacion=a.estacion;
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
  /* nubes y lluvia: tapan la luz y le quitan color */
  const cl = NV_.clima ? NV_.clima(a.t) : null;
  cielo.clima = cl;
  if(cl){
    amb *= 1 - 0.46*cl.nubes - 0.16*cl.lluvia;
    NV_.vientoFactor = cl.viento;
    /* la cortina de lluvia tapa la distancia, aparte de la oscuridad */
    cielo.visibilidad = 1 - 0.30*cl.lluvia - (cl.tormenta?0.28:0);
    const gris = cl.nubes*0.55 + cl.lluvia*0.25;
    const med = (r+g+b)/3;
    r=entre(r,med*0.96,gris); g=entre(g,med*0.99,gris); b=entre(b,med*1.08,gris);
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

  /* relámpago: el fogonazo muestra el bosque entero aunque sea noche cerrada */
  const fl = relampago(ms, cl&&cl.tormenta);
  cielo.relampago=fl;
  if(fl>0){
    amb = Math.min(1.5, amb + fl*1.25);
    r=entre(r,1.02,fl*0.85); g=entre(g,1.06,fl*0.85); b=entre(b,1.12,fl*0.85);
  }

  cielo.luz.amb=amb; cielo.luz.r=r*amb; cielo.luz.g=g*amb; cielo.luz.b=b*amb;
  /* LUZ FIJA (NV.CONFIG.luzFija): el sistema de luz está en pausa. El día y la noche, las
     nubes, los eclipses y los relámpagos se siguen calculando pero no se usan: la luz es
     siempre la de la muestra de referencia —penumbra fría y verdosa, con sombras largas
     hacia el este—. Poner luzFija en false lo devuelve entero. */
  if(NV_.CONFIG && NV_.CONFIG.luzFija){
    const F=NV_.CONFIG.luzFijaValores||LUZ_FIJA;
    cielo.deNoche=false; cielo.relampago=0; cielo.rojo=0; cielo.blanco=0; cielo.eclipse=null;
    cielo.visibilidad=1; cielo.brilloLunar=0;
    cielo.sombra.dx=F.sombra[0]; cielo.sombra.dy=F.sombra[1]; cielo.sombra.porMetro=F.sombra[2];
    cielo.luz.amb=F.amb; cielo.luz.r=F.r*F.amb; cielo.luz.g=F.g*F.amb; cielo.luz.b=F.b*F.amb;
    cielo.nombre='una penumbra fría';
    return cielo;
  }
  cielo.nombre = ecl ? (ecl.luna==='Calavera'?'la luz se vuelve roja':'una claridad blanca')
                     : (t<0.5 ? p.n : q.n);
  return cielo;
}

/* El cielo en palabras, sin un solo número. */
function cieloEnPalabras(){
  const c=cielo.clima;
  const tiempo = c ? ' '+c.palabras : '';
  const E=cielo.eclipse;
  if(E) return E.luna==='Calavera'
    ? 'Calavera está delante de la luz y todo se ha teñido de rojo. Nadie sabe por qué.'
    : 'Madre está delante de la luz y el bosque se ha vuelto de un blanco pálido, sin explicación.';
  if(!cielo.deNoche){
    const alto = cielo.elev>45?'alto':cielo.elev>20?'a media altura':'bajo, rasante';
    return 'El sol está '+alto+', '+(cielo.fase<0.5?'al este':'al oeste')+'.'+tiempo;
  }
  const arriba=[];
  for(const k in cielo.lunas){
    const L=cielo.lunas[k];
    if(L.altura>0.05) arriba.push(L.nombre+' '+L.nombreFase+
      (L.altura>0.75?', en lo más alto':L.altura<0.3?', junto al horizonte':''));
  }
  if(!arriba.length) return 'No hay lunas en el cielo; la oscuridad es completa.'+tiempo;
  return (arriba.length>1?'Dos lunas: ':'En el cielo, ')+arriba.join('; ')+'.'+tiempo;
}

NV_.probarRelampago=relampago;
NV_.cielo=cielo; NV_.actualizarCielo=actualizarCielo;
NV_.cieloEnPalabras=cieloEnPalabras; NV_.luz=cielo.luz;
/* Cuántas estrellas se ven: 0 de día, 1 en plena noche, y las nubes las tapan.
   Lo usa el agua quieta para reflejarlas. */
NV_.nocheEstrellas=function(){
  const nub=cielo.clima?cielo.clima.nubes:0;
  const oscuro=Math.max(0,Math.min(1,(0.36-cielo.luz.amb)/0.30));
  return oscuro*(1-Math.max(0,Math.min(1,nub*1.4)));
};
