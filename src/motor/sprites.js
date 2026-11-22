/* Nativa Online — sprites: de imagen a glifos.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación.

   El arte entra como IMAGEN y no como ASCII, y la diferencia importa. Un pack
   ASCII viene dibujado a un solo tamaño; al achicarlo se deshace, porque un
   glifo no se promedia. Una imagen se achica sola y se convierte a glifos al
   tamaño que haga falta, así el mismo dibujo sirve de cerca y de lejos.

   En la imagen van separadas dos cosas que el ASCII trae pegadas: el COLOR de
   la celda, en RGB, y la COBERTURA de su glifo, en el canal alfa. Al achicar,
   el color se promedia pesado por su cobertura. Si se hornea la tinta dentro
   del color, la figura se oscurece dos veces y queda un boceto apagado.

   Y cada celda del sprite se pinta con FONDO además de letra. Un glifo ralo
   deja la celda casi vacía: el fondo es lo que le da masa a la figura. Sin él,
   un personaje dibujado con puntos y comas no se ve sobre el negro. Es barato
   porque son los mil rectángulos de un personaje y no los sesenta mil de la
   pantalla entera. */

/* La rampa va de menos a más tinta, como manda la regla 2 del diccionario: el
   brillo de la celda elige el escalón. */
const RAMPA_ARTE=' .,:;-=+ilt/\\|%#@';

const _arte={};              // nombre -> {img, listo, man}
const _cacheArte=new Map();  // "nombre|anim|cuadro|cols|filas" -> celdas
let _lienzoArte=null, _ctxArte=null;

function cargarArte(){
  if(!NV.ARTE) return;
  for(const nombre in NV.ARTE){
    if(_arte[nombre]) continue;
    const man=NV.ARTE[nombre];
    const e={man:man, img:null, listo:false};
    _arte[nombre]=e;
    try{
      const im=new Image();
      im.onload=()=>{ e.listo=true; };
      im.src=man.png;
      e.img=im;
    }catch(err){ /* sin navegador: se dibuja la figura de respaldo */ }
  }
}

/* Convierte un cuadro del arte a celdas, al tamaño pedido, y lo guarda.
   Devuelve {cols,filas,g:Uint16Array,col:Int32Array} o null. */
function celdasArte(nombre,anim,cuadro,cols,filas){
  const e=_arte[nombre];
  if(!e||!e.listo||cols<2||filas<2) return null;
  const clave=nombre+'|'+anim+'|'+cuadro+'|'+cols+'|'+filas;
  let c=_cacheArte.get(clave);
  if(c) return c;
  const man=e.man, A=man.anims[anim];
  if(!A) return null;
  if(!_lienzoArte){
    const cv=document.createElement('canvas');
    if(!cv||!cv.getContext) return null;        // sin lienzo no hay conversión
    _lienzoArte=cv;
    _ctxArte=cv.getContext('2d',{willReadFrequently:true});
    if(!_ctxArte||!_ctxArte.getImageData){ _lienzoArte=null; return null; }
  }
  if(_lienzoArte.width!==cols||_lienzoArte.height!==filas){
    _lienzoArte.width=cols; _lienzoArte.height=filas;
  }
  _ctxArte.clearRect(0,0,cols,filas);
  _ctxArte.imageSmoothingEnabled=true;
  _ctxArte.imageSmoothingQuality='high';
  _ctxArte.drawImage(e.img, (cuadro%A.n)*man.ancho, A.fila*man.alto, man.ancho, man.alto,
                     0,0,cols,filas);
  const d=_ctxArte.getImageData(0,0,cols,filas).data;
  const g=new Uint16Array(cols*filas), col=new Int32Array(cols*filas);
  const borde=new Uint8Array(cols*filas);
  const nR=RAMPA_ARTE.length-1;
  for(let i=0,p=0;i<cols*filas;i++,p+=4){
    const a=d[p+3];
    if(a<58){ g[i]=0; continue; }
    /* El color va tal cual. getImageData YA devuelve el color sin
       premultiplicar: el navegador mezcla en premultiplicado al achicar y lo
       deshace al leer. Volver a dividirlo por la cobertura —que es lo que hay
       que hacer en una herramienta que mezcla a mano— lo multiplicaba acá por
       dos y medio y dejaba al personaje gris claro. */
    /* Donde la cobertura es poca, el color que devuelve el navegador viene del
       redondeo de ocho bits dividido por un alfa chico: el ruido se amplifica y
       salen motas casi blancas. Se atenúa con la cobertura, que además es lo
       que hace una celda apenas pintada. */
    const fa=0.80+0.20*(a/255);
    const r=d[p]*fa, ve=d[p+1]*fa, b=d[p+2]*fa;
    const lum=(r*0.3+ve*0.59+b*0.11)/255;
    const t=Math.pow(lum*(0.45+0.55*(a/255)),0.78);
    g[i]=RAMPA_ARTE.charCodeAt(Math.min(nR,(t*RAMPA_ARTE.length)|0))||32;
    col[i]=(Math.round(r)<<16)|(Math.round(ve)<<8)|Math.round(b);
  }
  /* El contorno: las celdas vacías que tocan una celda dibujada. Se limpian al
     dibujar, así entre la figura y el pasto queda una línea de fondo y la
     silueta se despega en vez de confundirse con la hierba. */
  for(let r=0;r<filas;r++) for(let cc=0;cc<cols;cc++){
    const i=r*cols+cc;
    if(g[i]) continue;
    if((cc>0&&g[i-1])||(cc<cols-1&&g[i+1])||(r>0&&g[i-cols])||(r<filas-1&&g[i+cols]))
      borde[i]=1;
  }
  c={cols:cols,filas:filas,g:g,col:col,borde:borde};
  /* el zoom cambia el tamaño pedido y llena la memoria de tamaños viejos */
  if(_cacheArte.size>220) _cacheArte.clear();
  _cacheArte.set(clave,c);
  return c;
}

/* Dibuja un cuadro con los pies en (bc, br), de altoM metros de alto.
   Devuelve false si el arte todavía no está listo: ahí el que llama dibuja su
   figura de respaldo. */
NV.dibujarArte=function(nombre,anim,cuadro,bc,br,altoM,luz){
  const e=_arte[nombre];
  if(!e||!e.listo) return false;
  const man=e.man;
  /* La celda del pack mide 7 px de ancho y 14 de alto, así que el ancho en
     metros sale de ahí y no de contar celdas. */
  const anchoM=altoM*man.ancho/(2*man.alto);
  const filas=Math.max(3,Math.round(altoM*NV.HPM()));
  const cols=Math.max(3,Math.round(anchoM*NV.CPM()));
  const cel=celdasArte(nombre,anim,cuadro,cols,filas);
  if(!cel) return false;
  /* Dónde caen los pies, en la rejilla ya achicada. Se mide al CENTRO de la
     celda: tomando el borde, el redondeo se va una fila y la figura queda
     flotando o enterrada. */
  const cPie=Math.min(cols-1,Math.max(0,Math.round((man.pieX+0.5)*cols/man.ancho-0.5)));
  const fPie=Math.min(filas-1,Math.max(0,Math.round((man.pieY+0.5)*filas/man.alto-0.5)));
  const c0=bc-cPie, r0=br-fPie;
  const L=NV.luz;
  for(let r=0;r<filas;r++){
    for(let c=0;c<cols;c++){
      const i=r*cols+c, g=cel.g[i];
      /* el contorno se limpia: deja el fondo entre la figura y el pasto */
      if(!g){ if(cel.borde[i]) NV.put(c0+c, r0+r, 32, 0); continue; }
      const v=cel.col[i];
      /* El color va tal cual, sólo por la luz. La hoja ya trae su curva de
         tono aplicada en pack2hoja.py: multiplicarlo otra vez por uno y medio
         y sumarle treinta lo satura, y el personaje sale todo blanco. */
      const rr=((v>>16)&255)*luz*L.r, gg=((v>>8)&255)*luz*L.g, bb=(v&255)*luz*L.b;
      NV.fondoArte(c0+c, r0+r, NV.packc(rr*0.38,gg*0.38,bb*0.38));
      NV.put(c0+c, r0+r, g, NV.packc(rr*1.06,gg*1.06,bb*1.06));
    }
  }
  return true;
};
/* Cuántos cuadros distintos tiene sentido mostrar a este tamaño. A doce filas,
   los movimientos chicos del reposo se redondean a celdas enteras: en vez de un
   balanceo suave salen celdas que prenden y apagan, y la figura tiembla. Chica,
   menos cuadros; quieta y chica, uno solo. */
NV.cuadrosUtiles=function(nombre,filas,quieta){
  if(filas>=30) return 8;
  if(filas>=20) return 4;
  if(filas>=14) return quieta?2:4;
  return quieta?1:2;
};
NV.filasDe=altoM=>Math.max(3,Math.round(altoM*NV.HPM()));
NV.hayArte=n=>!!(_arte[n]&&_arte[n].listo);
NV.cargarArte=cargarArte;
cargarArte();
