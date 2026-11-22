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

/* Lo que acompaña al mapa: las dos lunas y la marea. Nada más: la hora, la
   fecha y el tiempo ya están en el pie de la pantalla. */
function resumenCielo(){
  const a=NVx.astroEn(Date.now()), m=NVx.marea(a.t);
  const luna=L=>{
    const ecl=L.eclipse;
    return '<span class="ml '+(L.nombre==='Calavera'?'cal':'mad')+(ecl?' ecl':'')+
      '" title="'+L.nombre+' '+L.nombreFase+'">'+lunaSVG(L.fase,false)+'</span>';
  };
  const barra='|'.repeat(Math.max(1,Math.round(m.amplitud*8))).padEnd(8,'.');
  return '<div class="mcab">'+luna(a.lunas.calavera)+luna(a.lunas.madre)+
    '<span class="mh">'+m.clase+' ['+barra+']</span></div>';
}

NVx.lunaSVG=lunaSVG; NVx.resumenCielo=resumenCielo;
