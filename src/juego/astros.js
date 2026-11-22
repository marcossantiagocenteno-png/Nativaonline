/* Nativa Online — ventana ASTROS. Solo presentación: lee de astro, mareas y
   clima, y no calcula nada por su cuenta. Sin números: símbolos y palabras. */

const NVx = window.NV;

/* Cara de la luna según su fase, con los glifos del juego. */
const CARAS=['·',')','D','0','O','0','C','('];
function cara(f){ return CARAS[Math.floor(((f+1/16)%1)*8)]; }

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
  return '<div class="ax"><b>'+cara(L.fase)+'</b><span class="an">'+L.nombre+'</span>'+
    '<span class="af">'+L.nombreFase+'</span>'+
    '<i>'+donde+(ecl?' · <u>eclipse '+ecl.clase+'</u>':'')+' · '+hacia+' '+cuando+'</i></div>';
}

function panelAstros(){
  const ms=Date.now();
  const a=NVx.astroEn(ms), m=NVx.marea(a.t), c=NVx.clima(a.t), cielo=NVx.cielo;
  let h='';
  h+='<div class="ah">'+SIG.estrella+' cielo</div>';
  h+='<div class="ax"><b>'+(a.deDia?'*':'·')+'</b><span class="an">'+(a.deDia?'día':'noche')+
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
      ev.push({h:p.enHorasReales, t:(k==='calavera'?SIG.calavera:SIG.madre)+' '+L.nombre+' '+etq});
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

NVx.toggleAstros=toggleAstros; NVx.panelAstros=panelAstros;
