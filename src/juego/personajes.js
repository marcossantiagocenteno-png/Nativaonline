/* Nativa Online — personajes.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación.

   Un personaje es cualquier cosa que se para en una casilla, se dibuja con un
   sprite, camina, mira hacia un lado y tiene nombre: el jugador, una nativa,
   un lobo, un animal. Todo lo que costó afinar vive ACÁ y no en el dibujo del
   jugador, así que un personaje nuevo nace con todo hecho:

     - se dibuja ENTRE casillas, interpolando el paso, en vez de saltar un
       metro entero de golpe;
     - la animación avanza por distancia caminada y funde un cuadro con el
       siguiente;
     - lleva contorno, para despegarse del pasto;
     - lleva sombra propia, que se estira al oeste;
     - recibe la luz del cielo, la de las lunas y la del fuego que tenga cerca,
       y nunca se apaga del todo;
     - lleva su nombre encima;
     - y si el arte no cargó, se dibuja una figura de respaldo.

   Un personaje es un objeto llano:
     {arte, nombre, alto, x, y, desdeX, desdeY, ultimoPaso, pasoMs, andado,
      mirando, zancada, color}
   NV.personajes es la lista de los que no son el jugador. */

/* Nunca se apaga del todo: de noche sigue irradiando un poco de lo suyo. Sin
   esto, el personaje desaparece en la oscuridad en vez de verse oscurecido. */
const PISO_LUZ=0.16;
/* El arte viene con colores oscuros —verdes y ocres de bosque— mientras que el
   suelo se pinta con los escalones más claros de su familia. Sin ganancia, el
   personaje queda la mitad de brillante que el pasto y se lee como una sombra.
   Esto no es "aclararlo": es compensar que compite contra una paleta que ya
   está en su escalón más alto. */
const GANANCIA=1.34;

NV.personajes=[];

NV.nuevoPersonaje=function(cfg){
  const p=Object.assign({
    arte:null, nombre:'', alto:1.75, x:0, y:0,
    desdeX:undefined, desdeY:undefined,
    ultimoPaso:0, pasoMs:186, andado:0, mirando:'sur',
    zancada:5.1,                       // metros de una zancada entera
    color:0xEEECE4                     // el nombre, en blanco hueso
  },cfg||{});
  return p;
};

/* Un paso. Devuelve false si no se pudo. Lo usan el jugador y los que no lo son. */
NV.avanzarPersonaje=function(p,dx,dy,ahora){
  p.mirando = dy<0?'norte' : dy>0?'sur' : dx>0?'este' : 'oeste';
  p.desdeX=p.x; p.desdeY=p.y;
  p.x+=dx; p.y+=dy;
  p.andado=(p.andado||0)+Math.hypot(dx,dy);
  p.ultimoPaso=ahora||Date.now();
  return true;
};

/* Dónde está AHORA MISMO, entre la casilla de la que salió y a la que va. */
NV.posPersonaje=function(p,ahora){
  const tp=Math.max(0,Math.min(1,(ahora-(p.ultimoPaso||0))/(p.pasoMs||186)));
  const x0=(p.desdeX===undefined?p.x:p.desdeX);
  const y0=(p.desdeY===undefined?p.y:p.desdeY);
  return {x:x0+(p.x-x0)*tp, y:y0+(p.y-y0)*tp, tp:tp};
};

/* La luz que le toca: la del cielo, con piso para que no desaparezca, más el
   calor anaranjado de lo que esté ardiendo cerca. */
NV.luzPersonaje=function(p,px,py,t){
  const L=NV.luz;
  /* continuo: al cruzar de un metro a otro la luz cambia de a poco, no de golpe.
     px,py son casillas; el personaje está en el centro de la suya. */
  const fg=NV.calorEn?NV.calorEn(px+0.5,py+0.5):(NV.fuegoEn?NV.fuegoEn(Math.round(px),Math.round(py)):0);
  const tit=NV.titilar?NV.titilar(t):1;
  /* cuanto más oscuro está todo, más se nota el fuego */
  const crudo = fg ? fg*(1.55-Math.min(1,L.amb)*0.95)*tit : 0;
  /* El calor crudo llega a 2,4 al lado de la hoguera: sumado tal cual
     multiplicaría la luz por más de uno y medio y el personaje saldría
     ardiendo. Se le pone tope, y reparte más rojo que azul porque el fuego es
     anaranjado. */
  const k=Math.min(1,crudo*0.40);
  const piso=PISO_LUZ;
  return {
    r:(Math.max(piso,L.r)+k*0.52)*GANANCIA,
    g:(Math.max(piso*0.97,L.g)+k*0.24)*GANANCIA,
    b:(Math.max(piso*1.04,L.b)+k*0.06)*GANANCIA,
    calor:k
  };
};

NV.dibujarPersonaje=function(p,haze,t,ctx){
  const CPM=NV.CPM(), HPM=NV.HPM(), RPM=ctx.RPM;
  const P=NV.posPersonaje(p,Date.now());
  const bc=Math.round((P.x-ctx.camX)*CPM+CPM/2);
  const br=Math.round((P.y-ctx.camY)*RPM+RPM-1);
  const andando = Date.now()-(p.ultimoPaso||0) < (p.pasoMs||186)+120;
  const dir = p.mirando==='norte'?'back' : p.mirando==='sur'?'front'
            : p.mirando==='este'?'right' : 'left';

  ctx.sombra(bc,br,CPM,RPM);
  /* El resplandor propio: de noche se nota, de día no. Suma luz en vez de
     multiplicarla, porque un seis por ciento de casi nada sigue siendo casi
     nada, y de noche es justo cuando hace falta. */
  ctx.halo(bc,br,CPM,RPM,0.04+0.16*(1-Math.min(1,NV.luz.amb)));

  const luz=NV.luzPersonaje(p,P.x,P.y,t);
  let puesta=false;
  if(p.arte && NV.dibujarArte){
    const filas=Math.max(3,Math.round(p.alto*HPM));
    const nf=NV.cuadrosUtiles(p.arte,filas,!andando);
    const salto=8/nf;
    let fase;
    if(andando){
      /* la distancia incluye la fracción del paso en curso: contando sólo los
         metros enteros, la pose se congela y después salta */
      const rec=(p.andado||0)-1+P.tp;
      fase=salto*(((rec/((p.zancada/8)*salto))%nf)+nf)%8;
    } else {
      /* EN REPOSO SE ESTÁ QUIETO. Una persona parada no se balancea sin parar:
         se queda quieta un rato largo y de golpe cambia el peso de pie. */
      const CICLO=20000, QUIETA=0.74;
      const u=(Date.now()%CICLO)/CICLO;
      fase = u<QUIETA ? 0 : salto*(1+(u-QUIETA)/(1-QUIETA)*(nf-1));
    }
    puesta=NV.dibujarArte(p.arte,(andando?'walk_':'idle_')+dir,fase,bc,br,p.alto,haze,luz);
  }
  if(p.nombre){
    const cn=bc-Math.floor(p.nombre.length/2), rn=br-Math.round(p.alto*HPM)-2;
    ctx.capa(3);
    for(let i=0;i<p.nombre.length;i++) ctx.put(cn+i,rn,p.nombre.charCodeAt(i),p.color);
  }
  return puesta;
};
