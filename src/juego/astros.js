/* Nativa Online — ventana ASTROS. Solo presentación: lee de astro, mareas y
   clima, y no calcula nada por su cuenta. Sin números: símbolos y palabras. */

const NVx = window.NV;

/* La cara de la luna, dibujada: un disco oscuro y encima la parte iluminada.
   El terminador es una elipse que se va aplastando según la fase. */
function lunaSVG(fase, grande){
  const k=(1-Math.cos(fase*Math.PI*2))/2;        // fracción iluminada
  const R=grande?9:7, C=grande?10:8, L=C*2;
  const rx=(R*Math.abs(1-2*k)).toFixed(2);
  const lado=fase<0.5?1:0;                       // creciente ilumina por el este
  const barrido=k>0.5?lado:1-lado;
  const d='M'+C+','+(C-R)+' A'+R+','+R+' 0 0 '+lado+' '+C+','+(C+R)+
          ' A'+rx+','+R+' 0 0 '+barrido+' '+C+','+(C-R)+' Z';
  return '<svg class="luna" viewBox="0 0 '+L+' '+L+'" width="'+L+'" height="'+L+'">'+
    '<circle cx="'+C+'" cy="'+C+'" r="'+R+'" fill="#121c24" stroke="#3b5566" stroke-width="1"/>'+
    '<path d="'+d+'" fill="#eef4f7"/></svg>';
}

const SIG={ estrella:'*', calavera:'@', madre:'o', marea:'~', nube:'=',
            lluvia:'/', tormenta:'%', rojo:'#', blanco:'O' };

/* Resumen del cielo, compacto, para la esquina del mapa.
   El borde dice qué luna es —ámbar Calavera, pálido Madre— y el dibujo dice la
   fase: no hace falta leer nada. */
function resumenCielo(){
  const ms=Date.now();
  const a=NVx.astroEn(ms), c=NVx.clima(a.t), m=NVx.marea(a.t), cielo=NVx.cielo;
  const luna=(L,clase)=>{
    const ecl=L.eclipse;
    return '<span class="ml '+clase+(ecl?' ecl':'')+'" title="'+L.nombre+' '+L.nombreFase+'">'+
      lunaSVG(L.fase,false)+'</span>';
  };
  const tiempo = c.tormenta?'tormenta' : c.lluvia>0.42?'lluvia' : c.lluvia>0.06?'llovizna'
               : (cielo.nieblaAqui>0.3?'niebla' : c.nubes>0.5?'nublado':'despejado');
  return '<div class="mcab">'+
      luna(a.lunas.calavera,'cal')+luna(a.lunas.madre,'mad')+
      '<span class="mh">'+cielo.nombre+'</span>'+
    '</div>'+
    '<div class="mpie">'+a.estacion+' · día '+a.diaMes+' del mes '+a.mes+
      '<span>'+tiempo+' · marea '+m.clase+'</span></div>';
}

NVx.lunaSVG=lunaSVG; NVx.resumenCielo=resumenCielo;
