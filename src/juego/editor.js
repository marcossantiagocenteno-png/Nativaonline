/* Nativa Online — MODO DIOS: la herramienta de objetos.
   Se pinta el mundo con el ratón:
     · se elige algo en la paleta (primer clic) y se hace clic en el terreno (segundo): aparece ahí;
       la herramienta sigue activa para poner más
     · Control + clic izquierdo sobre un objeto: lo cambia por OTRA variante real del mismo tipo
     · clic derecho sobre un objeto: lo elimina
   Esto es sólo la interfaz de edición. No sabe cómo se dibuja un árbol ni una roca: la paleta sale de lo
   que los motores registran en su cara "objetos" (catalogo, crear, variar), y cada cambio se escribe con
   NV.mundo.editar(), que es de donde sale también el deshacer. El estado del editor (qué está elegido,
   qué hay bajo el cursor, la pila de deshacer) vive acá; el MAPA vive en NV.mundo y no depende de nada de esto.

   Entrar: Shift+G, o abrir el juego con ?dios en el enlace. Salir: el botón o Shift+G otra vez. */
(function(NV){
  const FANTASMA=65535;                       // id en el búfer de apuntado para la vista previa
  const ORO=[200,162,74], ORO_VIVO=[255,232,160], ROJO=[214,70,56];
  const E=NV.editor={activo:false, sel:null, fantasma:null, hover:null, ctrl:false};
  let pila=[], rehacer=[], tGuardar=null, motivo=null, pie='';

  const $e=id=>document.getElementById(id);
  const decir=t=>{ if(typeof bubble==='function') bubble(t); };

  /* ---------- el mundo editado: se carga antes de generar el primer panel ---------- */
  E.arrancar=function(){ try{ NV.mundo.cargarBorrador(); }catch(e){} };

  /* ---------- la paleta, armada con lo que los motores registraron ---------- */
  function armarPaleta(){
    const cont=$e('diosPaleta'); if(!cont) return;
    cont.innerHTML='';
    for(const g of NV.catalogoObjetos()){
      const h=document.createElement('div'); h.className='grupo'; h.textContent=g.nombre; cont.appendChild(h);
      for(const it of g.items){
        const b=document.createElement('button'); b.textContent=it.nombre; b.dataset.id=it.id; b.className='diosItem';
        b.addEventListener('click',()=>elegir(E.sel&&E.sel.id===it.id?null:it));
        cont.appendChild(b);
      }
    }
  }
  function marcarPaleta(){
    const cont=$e('diosPaleta'); if(!cont||!cont.querySelectorAll) return;
    for(const b of cont.querySelectorAll('button')) b.classList.toggle('on',!!E.sel&&b.dataset.id===E.sel.id);
  }
  function elegir(entrada){
    E.sel=entrada||null;
    E.fantasma=entrada?NV.motorDeEntrada(entrada.id).caras.objetos.crear(entrada.id):null;
    marcarPaleta(); refrescar();
  }

  /* ---------- qué hay bajo el cursor ---------- */
  function apuntar(e){
    const cv=$e('cv'), r=cv.getBoundingClientRect();
    /* la celda que se ve bajo el cursor: el lienzo se corre unos píxeles con la cámara */
    const col=Math.floor((e.clientX-r.left-(NV.desplaceX||0))/cw), fil=Math.floor((e.clientY-r.top-(NV.desplaceY||0))/chh);
    E.ctrl=!!e.ctrlKey;
    if(col<0||fil<0||col>=cols||fil>=rowsN){ E.hover=null; return; }
    const id=fbP?fbP[fil*cols+col]:0;
    let obj=(id>0&&id!==FANTASMA&&NV.objetosVista)?(NV.objetosVista[id-1]||null):null, oid=obj?id:0;
    const q=NV.casillaEn(col,fil);
    if(id===FANTASMA){                                  // la vista previa tapa lo que hay debajo: se busca por casilla
      obj=NV.objetosEn(q.x,q.y,q.x,q.y).find(o=>o.x===q.x&&o.y===q.y)||null;
      if(obj&&NV.objetosVista){ const k=NV.objetosVista.indexOf(obj); oid=k>=0?k+1:0; }
    }
    E.hover={col,fil,x:q.x,y:q.y,obj:obj,id:oid};
  }

  /* por qué NO se puede poner algo ahí (null = se puede) */
  function porQueNo(x,y,o){
    const g=NV.sueloEn(x,y);
    if(!g) return 'Más allá no hay nada todavía.';
    if(g==='P') return 'El agua es honda: ahí no.';
    const largo=o&&o.k==='caido'?(o.len||1):1;
    for(let i=0;i<largo;i++){
      if(NV.solidoEn(x+i,y)) return 'Ahí no cabe: ya hay algo.';
      if(me.x===x+i&&me.y===y) return 'Ahí estás parado.';
    }
    return null;
  }

  /* ---------- acciones: todo pasa por NV.mundo.editar ---------- */
  function hacer(op,aviso){
    const inv=NV.mundo.editar(op);
    if(!inv) return false;
    pila.push(inv); if(pila.length>300) pila.shift();
    rehacer.length=0;
    guardarPronto(); tictac(); olvidarGeneradoCercano(); programarCuadro();
    if(aviso) decir(aviso);
    refrescar();
    return true;
  }
  function olvidarGeneradoCercano(){ NV.olvidarObjetos(); }
  function guardarPronto(){ clearTimeout(tGuardar); tGuardar=setTimeout(()=>NV.mundo.guardarBorrador(),350); }

  function colocar(x,y){
    if(!E.sel||!E.fantasma) return;
    const o=Object.assign({},E.fantasma);
    const no=porQueNo(x,y,o);
    if(no){ decir(no); return; }
    /* lo que se pone es EXACTAMENTE lo que se veía en la vista previa; después sale otra variante */
    if(hacer({t:'objeto+',x,y,objeto:o},E.sel.nombre+' colocado.'))
      E.fantasma=NV.motorDeEntrada(E.sel.id).caras.objetos.crear(E.sel.id);
  }
  function regenerar(o){
    const r=NV.entradaDeObjeto(o); if(!r){ decir('Ese objeto no se puede regenerar.'); return; }
    const nuevo=Object.assign({},o,r.motor.caras.objetos.variar(o)); delete nuevo.x; delete nuevo.y; delete nuevo.fantasma;
    hacer({t:'lote',ops:[{t:'objeto-',x:o.x,y:o.y},{t:'objeto+',x:o.x,y:o.y,objeto:nuevo}]},r.entrada.nombre+': otra variante.');
  }
  function eliminar(o){
    const r=NV.entradaDeObjeto(o);
    hacer({t:'objeto-',x:o.x,y:o.y},(r?r.entrada.nombre:'Objeto')+' eliminado.');
  }
  function deshacer(){
    const op=pila.pop(); if(!op){ decir('No hay nada que deshacer.'); return; }
    const inv=NV.mundo.editar(op); if(inv) rehacer.push(inv);
    guardarPronto(); tictac(); NV.olvidarObjetos(); programarCuadro(); decir('Deshecho.'); refrescar();
  }
  function rehacerUno(){
    const op=rehacer.pop(); if(!op){ decir('No hay nada que rehacer.'); return; }
    const inv=NV.mundo.editar(op); if(inv) pila.push(inv);
    guardarPronto(); tictac(); NV.olvidarObjetos(); programarCuadro(); decir('Rehecho.'); refrescar();
  }
  E.deshacer=deshacer; E.rehacer=rehacerUno; E.elegir=elegir;
  E.pilas=()=>({deshacer:pila.length,rehacer:rehacer.length});

  /* ---------- el ratón ---------- */
  function alBajar(e){
    if(!E.activo) return;
    e.preventDefault();
    apuntar(e);
    const h=E.hover; if(!h) return;
    if(e.button===2){                                   // clic derecho: elimina SOLO el objeto apuntado
      if(e.ctrlKey) return;                             // en Mac, Control+clic es clic derecho: no debe borrar
      if(h.obj) eliminar(h.obj); else decir('Ahí no hay ningún objeto.');
      return;
    }
    if(e.button!==0) return;
    if(e.ctrlKey){                                      // Control + clic: regenerar, con prioridad sobre colocar
      if(h.obj) regenerar(h.obj); else decir('Ahí no hay nada que regenerar.');
      return;
    }
    if(!E.sel){ decir(h.obj?'Control + clic lo regenera; clic derecho lo elimina.':'Elegí algo de la paleta.'); return; }
    colocar(h.x,h.y);
  }
  function alMover(e){
    if(!E.activo) return;
    const antes=E.hover?E.hover.x+','+E.hover.y+','+E.hover.id:'', ctrl0=E.ctrl;
    apuntar(e);
    const ahora=E.hover?E.hover.x+','+E.hover.y+','+E.hover.id:'';
    if(ahora!==antes||ctrl0!==E.ctrl){ refrescar(); programarCuadro(); }
  }

  E.alBajar=alBajar; E.alMover=alMover;          // la entrada del ratón, también como llamada (pruebas, teclado futuro)

  /* ---------- entrar y salir ---------- */
  E.entrar=function(){
    if(E.activo) return;
    E.activo=true; NV.pick(true);
    if(typeof dejarDeCaminar==='function') dejarDeCaminar();
    if(typeof detenerRuta==='function') detenerRuta();
    const p=$e('dios'); if(p) p.classList.add('show');
    $e('cv').style.cursor='crosshair';
    decir('<b>Modo Dios</b>\nElegí algo de la paleta y hacé clic en el terreno.');
    refrescar(); programarCuadro();
  };
  E.salir=function(){
    if(!E.activo) return;
    clearTimeout(tGuardar); NV.mundo.guardarBorrador();   // lo editado ya está en el mundo; además queda guardado
    E.activo=false; E.sel=null; E.fantasma=null; E.hover=null; NV.pick(false);
    const p=$e('dios'); if(p) p.classList.remove('show');
    $e('cv').style.cursor='';
    marcarPaleta(); decir('Mundo guardado. Seguís en el juego normal.'); programarCuadro();
  };

  /* ---------- lo que se ve ---------- */
  function refrescar(){
    const est=$e('diosEstado'); if(!est) return;
    const h=E.hover; let t='';
    motivo=null;
    if(h&&h.obj){
      const r=NV.entradaDeObjeto(h.obj);
      t='<b>'+(r?r.entrada.nombre:'Objeto')+'</b>\nCtrl + clic: regenerar\nClic derecho: eliminar';
    } else if(E.sel){
      motivo=h?porQueNo(h.x,h.y,E.fantasma):null;
      t='Colocando <b>'+E.sel.nombre+'</b>\n'+(motivo||'Clic: colocar · Esc: soltar');
    } else t='Elegí algo de la paleta.\nCtrl + clic regenera, clic derecho elimina.';
    if(t!==pie){ pie=t; est.innerHTML=t.replace(/\n/g,'<br>'); }
    const d=$e('diosDeshacer'), r2=$e('diosRehacer');
    if(d) d.disabled=!pila.length; if(r2) r2.disabled=!rehacer.length;
  }

  /* la lista de objetos del cuadro, con la vista previa en la casilla del cursor (no se guarda en ningún lado) */
  E.conFantasma=function(objetos){
    const h=E.hover;
    if(!E.sel||!E.fantasma||E.ctrl||!h) return objetos;
    const g=Object.assign({},E.fantasma,{x:h.x,y:h.y,fantasma:true});
    return objetos.concat([g]).sort((a,b)=>a.y-b.y);
  };

  const mezcla=(c,col,a)=>{
    const r=(c>>16)&255, g=(c>>8)&255, b=c&255;
    return (((r+(col[0]-r)*a)|0)<<16)|(((g+(col[1]-g)*a)|0)<<8)|((b+(col[2]-b)*a)|0);
  };
  /* resaltado de la silueta bajo el cursor, tinte de la vista previa y marcador de la casilla.
     Se llama dentro de draw_, antes de volcar al lienzo. */
  E.pintar=function(){
    const h=E.hover, n=cols*rowsN;
    if(h&&h.obj){
      const col=E.ctrl?ORO_VIVO:ORO, a=E.ctrl?0.75:0.55;
      for(let i=0;i<n;i++) if(fbP[i]===h.id&&fbG[i]) fbC[i]=mezcla(fbC[i],col,a);
    }
    if(E.sel&&E.fantasma&&!E.ctrl&&h){
      const bad=!!porQueNo(h.x,h.y,E.fantasma);
      for(let i=0;i<n;i++) if(fbP[i]===FANTASMA&&fbG[i]) fbC[i]=mezcla(fbC[i],bad?ROJO:ORO,bad?0.6:0.38);
      /* el marcador: una cruz de oro (o roja) en la casilla donde caerá */
      const c0=(h.x-camX)*CPM+Math.floor(CPM/2), r0=(h.y-camY)*RPM+RPM-1;
      ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(h.x+0.5,h.y+0.5)*HPM); pickId=0;
      const color=packc.apply(null,bad?ROJO:ORO_VIVO);
      for(const [dx,dy] of [[0,0],[-2,0],[2,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,color);
      layer=0; alzaR=0;
    } else if(h&&!h.obj&&!E.sel){
      const c0=(h.x-camX)*CPM+Math.floor(CPM/2), r0=(h.y-camY)*RPM+RPM-1;
      ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(h.x+0.5,h.y+0.5)*HPM); pickId=0;
      put(c0,r0,43,packc(ORO[0],ORO[1],ORO[2]));
      layer=0; alzaR=0;
    }
  };

  /* ---------- puesta en marcha (cuando el juego ya tiene su pantalla) ---------- */
  E.iniciar=function(){
    armarPaleta();
    const cv=$e('cv');
    cv.addEventListener('pointerdown',alBajar);
    cv.addEventListener('pointermove',alMover);
    cv.addEventListener('contextmenu',e=>{ if(E.activo) e.preventDefault(); });
    addEventListener('keydown',e=>{
      const k=(e.key||'').toLowerCase();
      if(k==='g'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); E.activo?E.salir():E.entrar(); return; }
      if(!E.activo) return;
      if(k==='control'){ E.ctrl=true; refrescar(); programarCuadro(); return; }
      if(k==='escape'&&E.sel){ elegir(null); return; }
      if((e.ctrlKey||e.metaKey)&&k==='z'){ e.preventDefault(); e.shiftKey?rehacerUno():deshacer(); return; }
      if((e.ctrlKey||e.metaKey)&&k==='y'){ e.preventDefault(); rehacerUno(); return; }
    });
    addEventListener('keyup',e=>{ if(E.activo&&(e.key||'').toLowerCase()==='control'){ E.ctrl=false; refrescar(); programarCuadro(); } });
    const b=id=>$e(id);
    b('diosDeshacer').addEventListener('click',deshacer);
    b('diosRehacer').addEventListener('click',rehacerUno);
    b('diosSalir').addEventListener('click',E.salir);
    b('diosExportar').addEventListener('click',()=>{
      clearTimeout(tGuardar); NV.mundo.guardarBorrador();
      if(NV.mundo.descargar('mundo-datos.js')) decir('<b>Mundo exportado</b>\nSe bajó mundo-datos.js. Pasámelo y lo publico para todos.');
      else decir('No pude bajar el archivo desde acá.');
    });
    refrescar();
    try{ if(/[?&]dios(=|&|$)/.test(location.search)) E.entrar(); }catch(e){}
  };
})(window.NV);
