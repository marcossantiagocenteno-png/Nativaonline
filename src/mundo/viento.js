/* Nativa Online — VIENTO AMBIENTAL GLOBAL.
   Un solo motor para todo lo vegetal. Contesta, para cualquier punto y momento: dirección
   (siempre de ESTE a OESTE: x crece al este, así que empuja a -x), intensidad local,
   velocidad de la corriente, evolución de las ráfagas y cuándo empiezan y terminan.
   Pasto, árboles, arbustos, flores y lo que venga lo CONSULTAN; ninguno tiene su propio
   viento. Cada tipo se registra con sus propiedades físicas (V.registrar) y el motor le
   devuelve cuánto se mueve (V.respuesta).

   Ciclo de 20 s que se repite sin saltos (vale 0 en el segundo 0 y en el 20):
      0-12 s  CALMA    quieto; grupitos dispersos se inclinan apenas, cada 4 a 8 s
     12-15 s  BRISA    sube despacio hasta 0,30
     15-18 s  RÁFAGA   sube a 1 y se sostiene, con una onda que cruza el terreno
     18-20 s  REPOSO   baja suave hasta 0
   Lo que está más al este recibe cada fase antes: la corriente cruza el escenario. Cada sector
   de 1,7 m tiene su propia intensidad y desfase. Perfil elegido: A, viento muy sutil y natural.
   Desarrollado y aprobado en preview/viento.html. Sin dependencias ni compilación. */

const NVv=window.NV;
(function(g){
'use strict';
const CICLO=20;
const sm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const mod=(a,n)=>((a%n)+n)%n;
/* azar determinista de 0 a 1 por tres enteros */
function H(a,b,c){
  let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1274126177);
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296;
}
/* ruido de valores suave: variación lenta de un sector a otro */
function ruido(x,y,s){
  const X=Math.floor(x), Y=Math.floor(y), fx=sm(x-X), fy=sm(y-Y);
  const a=H(X,Y,s), b=H(X+1,Y,s), c=H(X,Y+1,s), d=H(X+1,Y+1,s);
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}

/* la envolvente global del ciclo, 0 a 1 */
function envolvente(tc){
  if(tc<12) return 0;
  if(tc<15) return 0.30*sm((tc-12)/3);
  if(tc<18) return 0.30+0.70*sm((tc-15)/1.6);
  return 1-sm((tc-18)/2);
}
function fase(tc){ return tc<12?'calma':tc<15?'brisa':tc<18?'ráfaga':'reposo'; }

const V={
  CICLO, DIR:{x:-1,y:0}, NOMBRE_DIR:'ESTE → OESTE',
  /* ajustes en vivo (los mueve la demo; el juego usaría los de fábrica) */
  cfg:{intensidad:1, vel:8, amplitud:1, hojas:1, ramas:1, pasto:1, x0:0},
  perfilActivo:'A',                            // el perfil elegido por Marcos: viento muy sutil y natural
  /* tres perfiles de ganancia para comparar */
  PERFILES:{A:{g:0.60,nombre:'A · muy sutil'}, B:{g:1.00,nombre:'B · moderado'}, C:{g:1.40,nombre:'C · marcado'}},
  tipos:{}, SECTOR:1.7                       // metros de un grupo
};

/* estado GLOBAL (en el punto de referencia): para el indicador y para quien necesite saber la fase */
V.estado=function(t){
  const tc=mod(t,CICLO), e=envolvente(tc)*V.cfg.intensidad;
  return {t, tc, ciclo:Math.floor(t/CICLO), fase:fase(tc), intensidad:e,
          velocidad:V.cfg.vel*(0.35+0.65*e),
          inicioRafaga:Math.floor(t/CICLO)*CICLO+15, finRafaga:Math.floor(t/CICLO)*CICLO+18};
};

/* movimientos ambientales de la calma: grupitos pequeños y dispersos, cada 4 a 8 s */
function ambiente(gx,gy,t){
  const per=4+4*H(gx,gy,11), off=per*H(gx,gy,12);
  const u=(t+off)/per, k=Math.floor(u);
  if(H(gx,gy,100+(k&1023))>=0.16) return 0;       // sólo ~1 de cada 6 grupos en cada turno
  const dur=1.9, s=(u-k)*per/dur;
  if(s>=1) return 0;
  const a=Math.sin(Math.PI*s); return a*a*(0.20+0.14*H(gx,gy,13+(k&1023)));
}

/* intensidad LOCAL en (x,y) metros al instante t, ya con el desfase de la corriente */
V.local=function(x,y,t,perfil){
  const S=V.SECTOR, gx=Math.floor(x/S), gy=Math.floor(y/S);
  const nz=ruido(x/9,y/9,5);                                   // variación lenta entre sectores
  const gan=(0.72+0.56*H(gx,gy,1))*(0.86+0.28*nz);              // intensidad propia del grupo
  const des=(H(gx,gy,2)-0.5)*1.0+(nz-0.5)*1.4;                 // desfase propio del grupo, en s
  /* la ráfaga entra por el este: lo que está más al este va más adelantado en el ciclo */
  const tc=mod(t+(x-V.cfg.x0)/V.cfg.vel+des,CICLO);
  let e=envolvente(tc);
  e*=1+0.10*sm((e-0.4)/0.4)*Math.sin(6.283*(tc*0.30+x/11)+gy);   // la onda que atraviesa el terreno, sin escalón
  const P=V.PERFILES[perfil||V.perfilActivo]||V.PERFILES.A;
  return Math.min(1.2,Math.max(e*gan,ambiente(gx,gy,t))*V.cfg.intensidad*P.g);
};

/* ---------- registro de tipos de vegetación ----------
   amp      cuánto se mueve con el viento a tope (en celdas de 1/13 m; el pasto, en unidades de inclinación)
   lag      retraso en segundos respecto al viento (inercia: lo pesado llega tarde)
   inercia  ventana de suavizado en s (lo pesado se mueve más lento y no se detiene de golpe)
   expo     exposición: >1 sólo responde a lo fuerte, <1 responde a todo
   oscila   {amp, f}: temblor superpuesto, en celdas y Hz (hojas, flores)  */
V.registrar=(nombre,props)=>{ V.tipos[nombre]=Object.assign({amp:1,lag:0,inercia:0.3,expo:1,oscila:null,ajuste:null},props); return V.tipos[nombre]; };
V.registrar('pasto',        {amp:1.0, lag:0.00, inercia:0.35, expo:1.00, ajuste:'pasto'});
V.registrar('arbol.tronco', {amp:0.9, lag:0.55, inercia:1.30, expo:1.25});
V.registrar('arbol.rama',   {amp:2.8, lag:0.30, inercia:0.85, expo:1.00, ajuste:'ramas'});
V.registrar('arbol.hoja',   {amp:0.8, lag:0.75, inercia:0.40, expo:0.95, ajuste:'hojas', oscila:{amp:0.95,f:1.15}});
V.registrar('arbusto',      {amp:2.0, lag:0.25, inercia:0.70, expo:1.00, oscila:{amp:0.45,f:0.95}});
V.registrar('flor',         {amp:3.2, lag:0.08, inercia:0.30, expo:0.90, oscila:{amp:0.55,f:1.40}});
V.registrar('cultivo',      {amp:1.6, lag:0.12, inercia:0.35, expo:1.00, oscila:{amp:0.25,f:1.0}});

/* Respuesta de un elemento: {mov, osc, I}
     mov  desplazamiento hacia el OESTE (>=0), en las unidades del tipo
     osc  amplitud del temblor superpuesto (el que lo dibuja la multiplica por sin(2π f t + fase))
     I    intensidad local ya suavizada y retrasada (0..1,2)
   opt: {perfil, lag (extra), fase}  */
V.respuesta=function(tipo,x,y,t,opt){
  const P=V.tipos[tipo]; if(!P) return {mov:0,osc:0,I:0,f:0};
  opt=opt||{};
  const aj=P.ajuste?V.cfg[P.ajuste]:1;
  const lag=P.lag*(P.ajuste==='hojas'?V.cfg.hojas:1)+(opt.lag||0), w=P.inercia;
  /* promedio de tres instantes: es la inercia, y hace que al aflojar el viento no se detenga de golpe */
  let I=0; for(let j=0;j<3;j++) I+=V.local(x,y,t-lag-j*w*0.5,opt.perfil);
  I/=3;
  const Ie=P.expo===1?I:Math.pow(I,P.expo);
  const P0=V.PERFILES[opt.perfil||V.perfilActivo]||V.PERFILES.A;
  const mov=P.amp*Ie*aj*V.cfg.amplitud;
  const osc=P.oscila?P.oscila.amp*Math.pow(I,0.7)*(P.ajuste==='hojas'?V.cfg.hojas:1)*V.cfg.amplitud:0;
  return {mov, osc, I, f:P.oscila?P.oscila.f:0};
};

/* sugerencia de uso: el pasto pide el empuje de un grupo y decide el glifo con él */
V.empujePasto=(x,y,t,perfil)=>V.respuesta('pasto',x,y,t,{perfil}).mov;


V.envolvente=envolvente; V.fase=fase;
g.NV.viento=V;

/* el tiempo del viento, en segundos: el reloj del juego (tictac) o, si no hay, el que le pasen */
const reloj=t=>NVv.tViento!==undefined?NVv.tViento:t;
const factor=()=>NVv.vientoFactor!==undefined?NVv.vientoFactor:1;     // sólo lo mueven las pruebas
/* para quien sólo necesita "cuánto viento hay aquí" (estado en pantalla, polvo, hojas): 0 calma a ~1 ráfaga */
NVv.windAt=(mx,my,t)=>{ V.cfg.intensidad=factor(); return V.local(mx,my,reloj(t))*1.6; };
/* la copa de los árboles: pesada, con retraso e inercia. Devuelve la magnitud; el árbol la resta (oeste). */
NVv.windArbol=(mx,my,t)=>{ V.cfg.intensidad=factor(); return V.respuesta('arbol.rama',mx,my,reloj(t)).I*1.6; };
/* el pasto: empuje de un sector, en unidades de inclinación (1 = una brizna de pie pasa a tendida) */
NVv.vientoPasto=(mx,my,t)=>{ V.cfg.intensidad=factor(); return V.respuesta('pasto',mx,my,reloj(t)).mov; };
/* la ráfaga viaja con la cámara: el centro de la pantalla es la referencia del ciclo */
NVv.vientoCentro=x=>{ V.cfg.x0=x; };
/* Alta en el registro de motores. El viento es una consulta de ambiente: cuánto y hacia dónde se mueve cada tipo de cosa. */
if(NVv.motores) NVv.motores.registrar({id:'viento',nombre:'Viento',estado:'integrado',
  archivo:'src/mundo/viento.js',preview:'preview/viento.html',prueba:'pruebas/viento.js',
  caras:{ambiente:(mx,my,t,tipo)=>V.respuesta(tipo||'pasto',mx,my,t),
         editor:{parametros:{intensidad:{tipo:'cantidad',min:0,max:2,def:1},perfil:{tipo:'eleccion',opciones:['A','B','C'],def:V.perfilActivo}}}}});
})(window);
