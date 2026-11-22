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

function filaLuna(L){
  const ecl=L.eclipse;
  const visible = L.altura>0.05;
  const donde = !visible ? 'bajo el horizonte'
              : L.altura>0.8 ? 'en lo más alto'
              : L.altura>0.4 ? 'alta' : 'junto al horizonte';
  const prox = NVx.proximaFase(L.nombre==='Calavera'?'calavera':'madre',
                               L.fase<0.5?0.5:0, Date.now());
  const hacia = L.fase<0.5?'llena':'nueva';
  const cuando = prox.enHorasReales<1 ? 'en un rato'
               : prox.enHorasReales<4 ? 'dentro de unas horas' : 'más adelante';
  return '<div class="ax"><b>'+lunaSVG(L.fase,true)+'</b><span class="an">'+L.nombre+'</span>'+
    '<span class="af">'+L.nombreFase+'</span>'+
    '<i>'+donde+(ecl?' · <u>eclipse '+ecl.clase+'</u>':'')+' · '+hacia+' '+cuando+'</i></div>';
}

function panelAstros(){
  const ms=Date.now();
  const a=NVx.astroEn(ms), m=NVx.marea(a.t), c=NVx.clima(a.t), cielo=NVx.cielo;
  let h='';
  h+='<div class="ah">'+SIG.estrella+' cielo</div>';
  h+='<div class="ax"><b class="sol">'+(a.deDia?'&#9788;':'&#9790;')+'</b><span class="an">'+(a.deDia?'día':'noche')+
     '</span><span class="af">'+cielo.nombre+'</span><i>'+a.estacion+' · día '+a.diaMes+' del mes '+a.mes+' · año '+a.ano+'</i></div>';
  h+='<div class="ah">'+SIG.calavera+' lunas</div>';
  h+=filaLuna(a.lunas.calavera)+filaLuna(a.lunas.madre);

  h+='<div class="ah">'+SIG.marea+' mareas</div>';
  const barra=n=>'['+'|'.repeat(Math.max(1,Math.round(n*10))).padEnd(10,'.')+']';
  h+='<div class="ax"><b>'+SIG.marea+'</b><span class="an">'+m.clase+'</span>'+
     '<span class="af">'+(m.subiendo?'subiendo':'bajando')+'</span><i>'+m.palabras+'</i></div>';
  h+='<div class="ab">'+barra(m.amplitud)+'</div>';

  h+='<div class="ah">'+SIG.nube+' clima</div>';
  const estado = c.tormenta?SIG.tormenta : c.lluvia>0.1?SIG.lluvia : c.nubes>0.4?SIG.nube : '*';
  h+='<div class="ax"><b>'+estado+'</b><span class="an">'+
     (c.tormenta?'tormenta':c.lluvia>0.1?'lluvia':c.nubes>0.4?'nublado':'despejado')+
     '</span><span class="af">'+(c.temp>22?'calor':c.temp>12?'templado':c.temp>4?'fresco':'frío')+
     '</span><i>'+c.humedadEnPalabras+'</i></div>';
  h+='<div class="ab">nubes '+barra(c.nubes)+'</div>';

  h+='<div class="ah">próximos fenómenos</div>';
  const ev=[];
  for(const k of ['calavera','madre']){
    const L=a.lunas[k];
    for(const [obj,etq] of [[0,'nueva'],[0.5,'llena']]){
      const p=NVx.proximaFase(k,obj,ms);
      ev.push({h:p.enHorasReales, t:lunaSVG(obj,false)+' '+L.nombre+' '+etq});
    }
  }
  const pe=NVx.proximoEclipse(a.t, 30);
  if(pe) ev.push({h:pe.enDias*NVx.msPorDiaAstro/3600000,
                  t:(pe.luna==='Calavera'?SIG.rojo:SIG.blanco)+' eclipse '+pe.tipo+' de '+pe.luna});
  const pm=NVx.proximaMarea('excepcional',a.t,30);
  if(pm) ev.push({h:pm*NVx.msPorDiaAstro/3600000, t:SIG.marea+' marea excepcional'});
  const pl=NVx.proximaLluvia(a.t,20);
  if(pl) ev.push({h:pl*NVx.msPorDiaAstro/3600000, t:SIG.lluvia+' vuelve la lluvia'});
  ev.sort((x,y)=>x.h-y.h);
  const cuando=x=> x<1?'en un rato' : x<5?'en unas horas' : x<26?'hoy o mañana' : 'en unos días';
  h+=ev.slice(0,6).map(e=>'<div class="ae">'+e.t+' <i>'+cuando(e.h)+'</i></div>').join('');
  return h;
}

let astrosOn=false, astrosTimer=null;
function toggleAstros(v){
  astrosOn = v===undefined?!astrosOn:v;
  NVx.$('astros').classList.toggle('show',astrosOn);
  NVx.$('bAstros').classList.toggle('on',astrosOn);
  if(astrosTimer){ clearInterval(astrosTimer); astrosTimer=null; }
  if(astrosOn){ pintar(); astrosTimer=setInterval(pintar,4000); }
}
function pintar(){ if(astrosOn) NVx.$('astrosTx').innerHTML=panelAstros(); }

NVx.lunaSVG=lunaSVG; NVx.toggleAstros=toggleAstros; NVx.panelAstros=panelAstros;
