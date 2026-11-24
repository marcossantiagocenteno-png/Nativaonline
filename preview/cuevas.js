/* Nativa Online — LABORATORIO DE CUEVAS Y UMBRALES (independiente del juego).
   Todo lo que se ve lo genera NV.cuevas en este momento; cada control cambia un parámetro real de la spec.
   Vistas: Muestrario (los seis tipos, tres estados de cada uno) · Banco (una cueva con todas las perillas y una linterna que sigue al ratón) · Umbrales. */
(function(){
'use strict';
const NV=window.NV, CV=NV.cuevas, UM=NV.umbrales, EN=NV.entorno;
const ASP=1.393, FONT_K=1/0.42, HPMr=6.8, RPMr=4;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
EN.usar(EN.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const ESTADO={vista:'muestrario',cw:5,cpm:5,osc:0.35,mem:0.12,detalle:1,sem:3,
  banco:{spec:CV.limpiar({tipo:'galeria',sem:7,edad:0.5,estado:{cristales:0.5,derrumbe:0.3,charcos:0.3,musgo:0.4}}),linterna:true,lx:0,lz:0,cpm:8,cw:5.2},
  um:{log:[],j:{mapa:'mundo',x:0,y:6},cuevaSpec:null}};

function pintarGrid(cv,g,cw){
  const chh=cw*ASP, dpr=Math.min(2,window.devicePixelRatio||1), W=Math.ceil(g.cols*cw), H=Math.ceil(g.rows*chh);
  cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px';
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='rgb(3,4,6)'; ctx.fillRect(0,0,W,H);
  ctx.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; ctx.textBaseline='middle';
  const adv=ctx.measureText('W').width, canRun=('letterSpacing' in ctx);
  if(canRun){ ctx.textAlign='left'; ctx.letterSpacing=(cw-adv).toFixed(2)+'px'; } else ctx.textAlign='center';
  const x0=canRun?(cw-adv)/2:cw/2;
  for(let r=0;r<g.rows;r++){
    const y=r*chh+chh/2; let start=-1,col=0,buf='';
    for(let c=0;c<=g.cols;c++){
      const i=r*g.cols+c, hay=c<g.cols&&g.G[i];
      if(hay&&(start<0||g.C[i]===col)){ if(start<0){ start=c; col=g.C[i]; buf=''; } buf+=String.fromCharCode(g.G[i]); continue; }
      if(start>=0){ ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
        if(canRun) ctx.fillText(buf,start*cw+x0,y); else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],(start+q)*cw+x0,y); start=-1; }
      if(hay){ start=c; col=g.C[i]; buf=String.fromCharCode(g.G[i]); }
    }
  }
}
/* una cueva entera a una cuadrícula; luces: dinámicas extra */
function dibujarCueva(S,cpm,extra){
  const k=cpm/13, ctx0={CPM:cpm,HPM:HPMr*k,RPM:RPMr*k,detalle:ESTADO.detalle}, m=CV.marco(S,ctx0);
  const G=new Uint16Array(m.cols*m.rows), C=new Int32Array(m.cols*m.rows);
  CV.pintar(S,Object.assign({bc:m.bc,br:m.br,cols:m.cols,rows:m.rows,t:performance.now()/1000,oscuridad:ESTADO.osc,memoria:ESTADO.mem,
    put:(c,r,ch,col)=>{ if(c<0||c>=m.cols||r<0||r>=m.rows) return; const i=r*m.cols+c; G[i]=typeof ch==='string'?ch.charCodeAt(0):ch; C[i]=col; }},ctx0,extra||{}));
  return {cols:m.cols,rows:m.rows,G,C,m,k};
}

/* ---- interfaz ---- */
const css=document.createElement('style');
css.textContent=
 ':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}*{box-sizing:border-box}'+
 'body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
 '#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
 '#barra label,.ctl label{display:flex;align-items:center;gap:6px;color:var(--dim)}input[type=range]{width:110px;accent-color:var(--oro)}'+
 'button,select,input[type=number]{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
 'button.on{background:var(--oro);color:#000}'+
 'h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
 'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:110ch}'+
 '.fila{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px;align-items:flex-start}'+
 'figure{margin:0;border:1px solid #2a2a26;background:#000;max-width:100%;overflow:auto}figure canvas{display:block}'+
 'figcaption{padding:5px 9px;border-top:1px solid #2a2a26;font-size:12px;color:var(--dim)}'+
 '.cuadro{position:relative}.rotulo{position:absolute;top:6px;left:8px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}'+
 '#panel{width:330px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:6px}'+
 '#panel .p{display:grid;grid-template-columns:1fr 54px;gap:2px 8px;align-items:center}#panel .p span{color:var(--dim);font-size:12px}'+
 '#panel .p b{text-align:right;color:var(--oro);font-weight:normal}#panel .p input{grid-column:1/3;width:100%}#panel select{width:100%}'+
 '#panel h3{margin:6px 0 0;font-size:12px;color:var(--oro);letter-spacing:.06em;text-transform:uppercase}'+
 '#panel .bt{display:flex;flex-wrap:wrap;gap:6px}'+
 '.reg{padding:0 14px 14px;color:var(--dim);font-size:12px;max-width:110ch}.reg b{color:var(--oro);font-weight:normal}.reg .no{color:#d98b6a}.reg .si{color:#9fd09a}'+
 '.reg div{padding:2px 0;border-bottom:1px solid #1c1c1a}';
document.head.appendChild(css);
document.title='Laboratorio de cuevas — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };
const sel=(opts,val,fn)=>{ const s=el('select'); for(const k of Object.keys(opts)){ const o=el('option',{value:k,textContent:opts[k]}); if(String(k)===String(val)) o.selected=true; s.appendChild(o); } s.onchange=()=>fn(s.value); return s; };
const TIPN=CV.TIPOS_ID.reduce((a,k)=>(a[k]=CV.TIPOS[k].nombre,a),{}), MATN=CV.MATS.reduce((a,k)=>(a[k]=CV.MATERIALES[k].nombre,a),{});
const VIVOS=[];
function figura(titulo,S,cpm,cw,pie,extraFn){
  const cv=el('canvas'), t0=performance.now(); const g=dibujarCueva(S,cpm,extraFn&&extraFn()); const ms=Math.round(performance.now()-t0); pintarGrid(cv,g,cw);
  const f=el('figure',{},[el('div',{className:'cuadro'},[cv,el('span',{className:'rotulo',textContent:titulo})]),el('figcaption',{textContent:(pie||'')+(ms>=1?'  ·  '+ms+' ms':'')})]);
  VIVOS.push({cv,S,cpm,cw,g,extraFn}); return {fig:f,cv,g};
}
let _tr=0; function refrescar(){ clearTimeout(_tr); _tr=setTimeout(()=>{ for(const v of VIVOS){ const g=dibujarCueva(v.S,v.cpm,v.extraFn&&v.extraFn()); v.g=g; pintarGrid(v.cv,g,v.cw); } },50); }
function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['muestrario','Muestrario'],['banco','Banco'],['umbrales','Umbrales']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const sl=(txt,min,max,val,fn)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,value:val})]); l.lastChild.oninput=e=>{ fn(+e.target.value); refrescar(); }; return l; };
  b.appendChild(sl('Oscuridad',0,100,Math.round(ESTADO.osc*100),v=>{ ESTADO.osc=v/100; }));
  b.appendChild(sl('Se adivina',0,30,Math.round(ESTADO.mem*100),v=>{ ESTADO.mem=v/100; }));
  const dt=el('select'); [[0,'detalle bajo'],[1,'detalle medio'],[2,'detalle alto']].forEach(([k,t])=>{ const o=el('option',{value:k,textContent:t}); if(k===ESTADO.detalle) o.selected=true; dt.appendChild(o); });
  dt.onchange=()=>{ ESTADO.detalle=+dt.value; dibujar(); }; b.appendChild(dt);
}
function dibujar(){ VIVOS.length=0; barra(); const c=$('#cuerpo'); c.innerHTML='';
  ({muestrario:vMuestrario,banco:vBanco,umbrales:vUmbrales}[ESTADO.vista])(c); }

/* ---- Muestrario ---- */
const ESTADOS=[['limpia',{edad:0.1,estado:{cristales:0,derrumbe:0,charcos:0,musgo:0.1,humedad:0.2}}],['con vida',{edad:0.6,estado:{cristales:0.6,derrumbe:0.15,charcos:0.35,musgo:0.55,humedad:0.6}}],['antigua y caída',{edad:0.95,estado:{cristales:0.2,derrumbe:0.8,charcos:0.6,musgo:0.2,humedad:0.9}}]];
function vMuestrario(c){
  c.appendChild(el('p',{className:'nota',textContent:'Seis tipos de cueva, tres estados de cada uno, todo generado por el motor en este momento. Es un corte: se ve el suelo y las paredes desde arriba y el techo no se dibuja. La luz que se ve es la de las bocas (día) y la de los cristales; con "Oscuridad" en 0 se ve todo.'}));
  for(const tipo of CV.TIPOS_ID){
    c.appendChild(el('h2',{textContent:CV.TIPOS[tipo].nombre}));
    const f=el('div',{className:'fila'});
    ESTADOS.forEach(([n,o],i)=>{ const S=CV.crear(Object.assign({tipo,sem:11+i*5+tipo.length},o)); const r=figura(CV.TIPOS[tipo].nombre+' · '+n,S,ESTADO.cpm,ESTADO.cw,'edad '+o.edad+' · bocas '+S.g.meta.bocas+' · cristales '+S.g.meta.cristales+' · bloques '+S.g.meta.bloques); f.appendChild(r.fig); });
    c.appendChild(f);
  }
}

/* ---- Banco ---- */
function vBanco(c){
  const B=ESTADO.banco, f=el('div',{className:'fila'}), panel=el('div',{id:'panel'}), cont=el('div');
  const rehacer=()=>{ cont.innerHTML=''; VIVOS.length=0; const S=CV.crear(B.spec);
    const r=figura(S.nombre,S,B.cpm,B.cw,'bocas '+S.g.meta.bocas+' · espeleotemas '+S.g.meta.espeleotemas+' · columnas '+S.g.meta.columnas+' · bloques '+S.g.meta.bloques+' · racimos de cristal '+S.g.meta.cristales+' · charcos '+S.g.meta.charcos,
      ()=>B.linterna?{luces:[{x:B.lx,z:B.lz,y:1.3,rad:7.5,r:1,g:0.78,b:0.5,i:1.1}]}:null);
    cont.appendChild(r.fig); VIVOS[0].S=S;
    const cv=r.cv; cv.style.cursor='crosshair';
    cv.onmousemove=e=>{ if(!B.linterna) return; const rc=cv.getBoundingClientRect(), g=VIVOS[0].g, m=g.m, col=(e.clientX-rc.left)/B.cw, row=(e.clientY-rc.top)/(B.cw*ASP), k=g.k;
      const phi=Math.atan2(RPMr*k,HPMr*k), K=HPMr*k/Math.cos(phi); B.lx=(col-m.bc)/B.cpm; B.lz=(row-m.br)/(K*Math.sin(phi)); refrescarLinterna(); };
  };
  let _l=0; const refrescarLinterna=()=>{ if(_l) return; _l=requestAnimationFrame(()=>{ _l=0; const v=VIVOS[0]; if(!v) return; const g=dibujarCueva(v.S,v.cpm,v.extraFn&&v.extraFn()); v.g=g; pintarGrid(v.cv,g,v.cw); }); };
  const aplicar=ch=>{ B.spec=CV.editar(B.spec,ch).spec; rehacer(); };
  const num=(txt,k,min,max,st,estado)=>{ const v=estado?B.spec.estado[k]:B.spec[k], lab=el('b',{textContent:Math.round(v*100)/100}), inp=el('input',{type:'range',min,max,step:st,value:v});
    inp.oninput=e=>{ lab.textContent=Math.round(+e.target.value*100)/100; clearTimeout(num.t); num.t=setTimeout(()=>aplicar(estado?{estado:{[k]:+e.target.value}}:{[k]:+e.target.value}),60); };
    panel.appendChild(el('div',{className:'p'},[el('span',{textContent:txt}),lab,inp])); };
  panel.appendChild(el('h3',{textContent:'Forma'}));
  panel.appendChild(sel(TIPN,B.spec.tipo,v=>{ const sem=B.spec.sem; B.spec=CV.nuevo(v,sem); B.spec=CV.limpiar(Object.assign({},B.spec,{estado:Object.assign({},B.spec.estado,{cristales:0.5,derrumbe:0.3,charcos:0.3,musgo:0.4})})); vBancoRehacer(); }));
  panel.appendChild(sel(MATN,B.spec.mat,v=>aplicar({mat:v})));
  num('Largo (m)','largo',6,80,1); num('Ancho (m)','ancho',0.9,30,0.1); num('Altura real (m)','alto',1.6,10,0.1); num('Corte de la roca (m)','corte',0.5,4.5,0.1); num('Bocas','salidas',1,3,1);
  panel.appendChild(el('h3',{textContent:'Tiempo y estado'}));
  num('Edad (más calcita)','edad',0,1,0.05); num('Derrumbe','derrumbe',0,1,0.05,true); num('Charcos','charcos',0,1,0.05,true); num('Cristales','cristales',0,1,0.05,true); num('Musgo','musgo',0,1,0.05,true); num('Humedad','humedad',0,1,0.05,true);
  panel.appendChild(el('h3',{textContent:'Semillas'}));
  const bt=el('div',{className:'bt'}); const rg=(tx,p)=>{ const b=el('button',{textContent:tx}); b.onclick=()=>{ B.spec=CV.regenerar(B.spec,p); rehacer(); }; bt.appendChild(b); };
  rg('Otra forma','forma'); rg('Otro derrumbe','derrumbe'); rg('Otro musgo','vegetacion'); panel.appendChild(bt);
  const ln=el('button',{textContent:B.linterna?'Linterna: sí (mueve el ratón)':'Linterna: no',className:B.linterna?'on':''}); ln.onclick=()=>{ B.linterna=!B.linterna; ln.className=B.linterna?'on':''; ln.textContent=B.linterna?'Linterna: sí (mueve el ratón)':'Linterna: no'; refrescarLinterna(); };
  panel.appendChild(ln);
  const js=el('button',{textContent:'Copiar spec (JSON)'}); js.onclick=()=>{ const t=JSON.stringify(CV.aObjeto(B.spec)); try{ navigator.clipboard.writeText(t); js.textContent='Copiada'; }catch(e){ js.textContent='No se pudo copiar'; } }; panel.appendChild(js);
  const vBancoRehacer=()=>{ dibujar(); };
  f.appendChild(panel); f.appendChild(cont); c.appendChild(f); rehacer();
}

/* ---- Umbrales ---- */
function vUmbrales(c){
  const U=ESTADO.um;
  if(!U.listo){ U.listo=true; UM.reiniciar();
    UM.registrarMapa('mundo',{nombre:'El bosque (mapa principal)',tipo:'mundo'});
    UM.registrar({id:'mundo:boca1',mapa:'mundo',tipo:'entrada',x:0,y:0,dx:0,dy:-1,radio:1.0,nota:'boca de la cueva, al pie de la loma'});
    UM.registrar({id:'mundo:boca2',mapa:'mundo',tipo:'entrada',x:14,y:0,dx:0,dy:-1,radio:1.0,nota:'una segunda boca, sin mapa elegido'});
    UM.desdeCueva('cueva-1',CV.crear({tipo:'galeria',sem:7,estado:{cristales:0.5}}),{nombre:'Galería del lado norte'});
    UM.desdeCueva('cueva-2',CV.crear({tipo:'camara',sem:4}),{nombre:'Cámara baja'});
    U.j={mapa:'mundo',x:0,y:5};
  }
  c.appendChild(el('p',{className:'nota',textContent:'Umbrales no dibuja nada: sólo sabe qué puntos hay, a qué mapa lleva cada uno y si se puede cruzar. La boca de afuera y la salida de adentro son dos umbrales que se atan con "Vincular". Un umbral sin mapa elegido es un tope: nadie entra. Aquí se ve la lógica; el juego todavía no la usa.'}));
  const reg=el('div',{className:'reg'}), acc=el('div',{className:'fila'}), log=el('div',{className:'reg'});
  const pintarReg=()=>{
    reg.innerHTML='';
    const jug=U.j; reg.appendChild(el('div',{innerHTML:'<b>Quien camina</b> está en el mapa <b>'+jug.mapa+'</b>, en ('+jug.x.toFixed(1)+', '+jug.y.toFixed(1)+')'}));
    for(const m of UM.mapas()){
      reg.appendChild(el('div',{innerHTML:'<b>Mapa '+m.id+'</b> — '+m.nombre+' ('+m.tipo+')'}));
      for(const u of UM.lista(m.id)){ const p=UM.puede(u.id);
        const row=el('div',{innerHTML:'&nbsp;&nbsp;umbral <b>'+u.id+'</b> ('+u.tipo+') en ('+u.x.toFixed(1)+', '+u.y.toFixed(1)+') → '+(u.destino?(u.destino.mapa+(u.destino.umbral?' / '+u.destino.umbral:'')):'<span class="no">sin mapa elegido</span>')+' · '+(p.ok?'<span class="si">se puede cruzar</span>':'<span class="no">no se puede: '+p.motivo+'</span>')+' '});
        const opts={'':'— sin mapa —'}; for(const q of UM.mapas()) if(q.id!==u.mapa) opts[q.id]=q.id; opts['cueva-3']='cueva-3 (no existe)';
        row.appendChild(sel(opts,u.destino?u.destino.mapa:'',v=>{ UM.elegirMapa(u.id,v||null); pintarReg(); }));
        const cr=el('button',{textContent:'Cruzar'}); cr.onclick=()=>{ U.j.mapa=u.mapa; U.j.x=u.x-u.dx*2.5; U.j.y=u.y-u.dy*2.5; U.j.sobre=null; const r=UM.cruzar(u.id,U.j); nota(r); pintarReg(); }; row.appendChild(cr);
        reg.appendChild(row); }
    }
  };
  const nota=r=>{ U.log.unshift(r.ok?'cruzó '+r.umbral+' → apareció en '+r.mapa+' ('+r.x.toFixed(1)+', '+r.y.toFixed(1)+') mirando ('+r.dx.toFixed(1)+', '+r.dy.toFixed(1)+')':'no pasó por '+r.umbral+': '+r.motivo+' — «'+r.mensaje+'»'); U.log.length=Math.min(U.log.length,12); pintarLog(); };
  const pintarLog=()=>{ log.innerHTML=''; log.appendChild(el('div',{innerHTML:'<b>Registro</b>'})); for(const l of U.log) log.appendChild(el('div',{textContent:l})); };
  const b=(tx,fn)=>{ const x=el('button',{textContent:tx}); x.onclick=()=>{ fn(); pintarReg(); }; acc.appendChild(x); };
  b('Vincular boca 1 ↔ cueva-1:a',()=>UM.vincular('mundo:boca1','cueva-1:a'));
  b('Vincular boca 2 ↔ cueva-2:a',()=>UM.vincular('mundo:boca2','cueva-2:a'));
  b('Soltar boca 1 (ambos lados)',()=>UM.desvincular('mundo:boca1',true));
  b('Caminar hacia la boca 1',()=>{ U.j.mapa='mundo'; U.j.x=0; U.j.y=5; U.j.sobre=null; let r=null; for(let y=5;y>=-0.5&&!r;y-=0.5){ U.j.y=y; r=UM.paso(U.j); } if(r) nota(r); else U.log.unshift('caminó sin cruzar nada'); pintarLog(); });
  b('Caminar hacia la boca 2',()=>{ U.j.mapa='mundo'; U.j.x=14; U.j.y=5; U.j.sobre=null; let r=null; for(let y=5;y>=-0.5&&!r;y-=0.5){ U.j.y=y; r=UM.paso(U.j); } if(r) nota(r); else U.log.unshift('caminó sin cruzar nada'); pintarLog(); });
  b('Volver al bosque',()=>{ U.j={mapa:'mundo',x:0,y:5}; });
  c.appendChild(acc); c.appendChild(reg); c.appendChild(log); pintarReg(); pintarLog();
}
{ const q=new URLSearchParams(location.search); if(q.get('vista')) ESTADO.vista=q.get('vista'); if(q.get('osc')!=null) ESTADO.osc=+q.get('osc'); if(q.get('mem')!=null) ESTADO.mem=+q.get('mem');
  if(q.get('tipo')) ESTADO.banco.spec=CV.nuevo(q.get('tipo'),+q.get('sem')||7); if(q.get('cpm')) ESTADO.banco.cpm=+q.get('cpm'); if(q.get('cw')) ESTADO.banco.cw=+q.get('cw'); }
dibujar();
})();
