/* Nativa Online — MODO DIOS: la ventana de diseño ("el motor de creación gráfica").
   Los motores de objetos (rocas, formaciones, y los que vengan) declaran en su cara "creador" qué perillas tienen
   (campos), cómo se arma un objeto con ellas (aObjeto) y cómo se ve una vista previa (previa). Esta ventana no
   sabe de rocas: lee ese descriptor, arma los controles, dibuja la vista previa con el MISMO motor que dibuja el
   juego, y entrega el resultado al editor para colocarlo (nuevo) o para reemplazar uno ya puesto (editar).
     · nuevo: paleta del Modo Dios → "Roca (diseñar)" → perillas → "colocar" → clic en el terreno
     · editar: clic sobre un objeto ya puesto (sin nada elegido en la paleta) → perillas → "aplicar" (un solo deshacer)
   La luz de la vista previa es de estudio (fija) para poder juzgar el material; se puede pasar a la luz del juego. */
(function(NV){
  const $c=id=>document.getElementById(id);
  const ASP=1.393, FONT_K=1/0.42, CPM0=13, HPM0=6.8, RPM0=4;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const C=NV.creador={};
  let M=null, id=null, entrada=null, objeto=null, spec=null, pan=0.5, estudio=true, tmr=null, tn=null, SIM=null, abierto=false;

  const get=(o,ruta)=>ruta.split('.').reduce((a,k)=>a==null?a:a[k],o);
  function poner(o,ruta,v){
    const p=ruta.split('.'); let a=o;
    for(let i=0;i<p.length-1;i++){ if(a[p[i]]==null) a[p[i]]={}; a=a[p[i]]; }
    if(v===undefined) delete a[p[p.length-1]]; else a[p[p.length-1]]=v;
  }
  const el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  const Cr=()=>M.caras.creador;

  /* ---------- la vista previa ---------- */
  function suelo(G,Cc,cols,rows){
    if(!tn) tn=NV.makeNoise(NV.mulberry(31771));
    const PS=[[36,46,32],[50,64,40],[68,84,50],[88,104,62]];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const i=r*cols+c, n=tn(c*0.21+3,r*0.33,1,1), h=((Math.imul(c,73856093)^Math.imul(r,19349663))>>>0)%100;
      if(h<62){ const p=PS[Math.min(3,(n*4)|0)]; G[i]=(h<10?',':h<20?'.':h<28?':':'`').charCodeAt(0); Cc[i]=(p[0]<<16)|(p[1]<<8)|p[2]; }
    }
  }
  function pintarRejilla(cv,G,Cc,cols,rows,cw){
    const chh=cw*ASP, dpr=Math.min(2,window.devicePixelRatio||1), W=Math.ceil(cols*cw), H=Math.ceil(rows*chh);
    cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px';
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
    g.fillStyle='rgb(5,9,8)'; g.fillRect(0,0,W,H);
    g.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; g.textBaseline='middle';
    const adv=g.measureText('W').width, run=('letterSpacing' in g);
    if(run){ g.textAlign='left'; g.letterSpacing=(cw-adv).toFixed(2)+'px'; } else g.textAlign='center';
    const x0=run?(cw-adv)/2:cw/2;
    for(let r=0;r<rows;r++){
      const y=r*chh+chh/2; let ini=-1, col=0, buf='';
      for(let c=0;c<=cols;c++){
        const i=r*cols+c, hay=c<cols&&G[i];
        if(hay&&(ini<0||Cc[i]===col)){ if(ini<0){ ini=c; col=Cc[i]; buf=''; } buf+=String.fromCharCode(G[i]); continue; }
        if(ini>=0){ g.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
          if(run) g.fillText(buf,ini*cw+x0,y); else for(let q=0;q<buf.length;q++) g.fillText(buf[q],(ini+q)*cw+x0,y); ini=-1; }
        if(hay){ ini=c; col=Cc[i]; buf=String.fromCharCode(G[i]); }
      }
    }
  }
  function vista(det){
    if(!abierto||!M) return;
    const cv=$c('creaVista'), info=$c('creaInfo'); let P;
    try{ P=Cr().previa(spec,{pan,rapido:det===1}); }catch(e){ info.textContent='No se pudo generar: '+e.message; return; }
    const z=P.z, CPM=CPM0*z, HPM=HPM0*z, RPM=RPM0*z, cols=Math.round(P.mw*CPM), rows=Math.round(P.mh*RPM);
    const G=new Uint16Array(cols*rows), Cc=new Int32Array(cols*rows);
    suelo(G,Cc,cols,rows);
    const put=(c,r,ch,col)=>{ if(c<0||c>=cols||r<0||r>=rows) return; const i=r*cols+c; G[i]=ch; Cc[i]=col; };
    const sombrear=(c,r,k)=>{ if(c<0||r<0||c>=cols||r>=rows) return; const i=r*cols+c; if(!G[i]) return; const f=1-k, v=Cc[i]; Cc[i]=(clamp((v>>16&255)*f,0,255)<<16)|(clamp((v>>8&255)*(f+0.02),0,255)<<8)|clamp((v&255)*(f+0.05),0,255); };
    if(!SIM) SIM=NV.entorno.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}});
    const antes=NV.entorno.proveedor(), t0=performance.now();
    if(estudio) NV.entorno.usar(SIM);
    try{
      for(const it of P.items.slice().sort((a,b)=>a.y-b.y))
        it.pintar({x:60+it.x,y:60+it.y,t:0,CPM,HPM,RPM,bc:Math.round(it.x*CPM),br:Math.round(it.y*RPM)-1,put,cols,rows,detalle:det==null?2:det,contorno:true,pasto:0.5,sombrear});
    } finally { if(estudio) NV.entorno.usar(antes); }
    const ms=Math.round(performance.now()-t0);
    const caja=$c('creaVistaCaja'), ancho=Math.max(200,(caja.clientWidth||440)-2);
    pintarRejilla(cv,G,Cc,cols,rows,Math.min(4.2,ancho/cols));
    const fila=$c('creaPanFila'); fila.style.display=(P.vis&&P.S&&P.S.W>P.vis)?'flex':'none';
    info.textContent=P.detalle+(P.vis&&P.S.W>P.vis?' · se ven '+P.vis+' m de '+P.S.W:'')+'  ·  '+ms+' ms';
  }
  /* mientras se arrastra una perilla se dibuja con menos detalle (rápido); al soltarla, completo */
  const pronto=(det)=>{ clearTimeout(tmr); tmr=setTimeout(()=>vista(det),det===1?10:60); };

  /* ---------- las perillas, armadas desde el descriptor del motor ---------- */
  function perilla(f){
    const fila=el('div','ccampo'), et=el('span','cet',f.etq), val=el('span','cval');
    let ctl;
    if(f.tipo==='sel'){
      ctl=el('select'); for(const [v,t] of f.opciones){ const o=el('option',null,t); o.value=v; ctl.appendChild(o); }
      ctl.value=get(spec,f.ruta);
      ctl.onchange=()=>{ poner(spec,f.ruta,ctl.value);
        if(f.ruta==='tipo') for(const k of ['alto','columnas','erosion','derrumbe','estrato']) delete spec[k];   // otro tipo: lo suyo por defecto
        if(f.ruta==='tipo') perillas();
        pronto(); };
      fila.append(et,ctl); return fila;
    }
    if(f.tipo==='chk'){
      ctl=el('input'); ctl.type='checkbox'; ctl.checked=get(spec,f.ruta)!==false&&!!get(spec,f.ruta);
      ctl.onchange=()=>{ poner(spec,f.ruta,ctl.checked); pronto(); };
      fila.append(et,ctl); return fila;
    }
    ctl=el('input'); ctl.type='range'; ctl.min=f.min; ctl.max=f.max; ctl.step=f.paso;
    let v=get(spec,f.ruta); if(v==null) v=f.auto!=null?f.auto:(f.def!=null?f.def:Math.max(f.min,Math.min(0,f.max)));
    ctl.value=v;
    const mostrar=x=>{ val.textContent=(f.auto!=null&&Math.abs(x-f.auto)<1e-9)?'auto':f.fmt==='grados'?Math.round(x*180/Math.PI)+'°':(Math.round(x*100)/100); };
    mostrar(+v);
    ctl.oninput=()=>{ const x=+ctl.value; mostrar(x); poner(spec,f.ruta,(f.auto!=null&&Math.abs(x-f.auto)<1e-9)?undefined:x); pronto(1); };
    ctl.onchange=()=>pronto(2);
    fila.append(et,ctl,val); return fila;
  }
  function perillas(){
    const cont=$c('creaCampos'); cont.innerHTML=''; let g=null;
    for(const f of Cr().campos(id)){
      if(f.grupo!==g){ g=f.grupo; cont.appendChild(el('div','cgrupo',g)); }
      cont.appendChild(perilla(f));
    }
  }

  /* ---------- abrir, cerrar, entregar ---------- */
  const entradaDe=i=>{ const m=NV.motorDeEntrada(i); return m&&m.caras.objetos.catalogo().find(e=>e.id===i); };
  C.abrir=function(motor,ent,obj){
    M=motor; objeto=obj||null;
    if(objeto){ const d=Cr().deObjeto(objeto); id=d.id; spec=d.spec; entrada=entradaDe(id)||ent; }
    else { id=ent.id; entrada=ent; spec=Cr().nuevo(id); }
    pan=0.5; abierto=true;
    $c('creaTit').textContent=(objeto?'Editar · ':'')+Cr().titulo(id);
    $c('creaColocar').style.display=objeto?'none':'';
    $c('creaAplicar').style.display=objeto?'':'none';
    $c('creaPan').value=pan;
    $c('creador').classList.add('show');
    perillas(); vista();
    if(NV.editor) NV.editor.decir(objeto?'Cambiá las perillas y tocá <b>aplicar</b>.':'Armá la pieza a tu gusto y tocá <b>colocar</b>.');
  };
  C.cerrar=function(){ abierto=false; clearTimeout(tmr); const p=$c('creador'); if(p) p.classList.remove('show'); };
  C.abierto=()=>abierto;
  C._estado=()=>({id,spec:spec&&JSON.parse(JSON.stringify(spec)),editando:!!objeto,abierto});

  function entregar(){
    const ob=Cr().aObjeto(spec); if(Cr().recordar) Cr().recordar(id,spec);
    return ob;
  }
  C.colocar=function(){
    if(!abierto||objeto) return false;
    const ob=entregar(); NV.editor.armar(entrada,ob); C.cerrar();
    NV.editor.decir('<b>'+Cr().resumen(ob)+'</b>\nClic en el terreno para colocarla.');
    return true;
  };
  C.aplicar=function(){
    if(!abierto||!objeto) return false;
    const ob=entregar(); const ok=NV.editor.reemplazar(objeto,ob); if(ok) C.cerrar(); return ok;
  };

  C.iniciar=function(){
    const panel=$c('creador'); if(!panel) return;
    /* las teclas de la ventana (flechas en una barra, letras en una lista) no son del juego */
    for(const ev of ['keydown','keyup']) panel.addEventListener(ev,e=>{ e.stopPropagation(); if(ev==='keydown'&&e.key==='Escape') C.cerrar(); });
    panel.addEventListener('contextmenu',e=>e.preventDefault());
    $c('creaCerrar').onclick=C.cerrar;
    $c('creaRegen').onclick=()=>{ if(!M) return; spec=Cr().variar(spec); vista(); };
    $c('creaLuz').onclick=()=>{ estudio=!estudio; $c('creaLuz').textContent='luz: '+(estudio?'estudio':'del juego'); vista(); };
    $c('creaColocar').onclick=C.colocar;
    $c('creaAplicar').onclick=C.aplicar;
    $c('creaPan').oninput=e=>{ pan=+e.target.value; pronto(2); };
  };
})(window.NV);
