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
  const E=NV.editor={activo:false, sel:null, fantasma:null, hover:null, ctrl:false,
    modo:'objetos', modos:{}};        // otras herramientas (los caminos) se registran en E.modos y reciben el ratón y el teclado
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
      if(!g.items.some(it=>!it.oculto)) continue;
      const h=document.createElement('div'); h.className='grupo'; h.textContent=g.nombre; cont.appendChild(h);
      for(const it of g.items){
        if(it.oculto) continue;          // los genéricos siguen sabiendo regenerarse y borrarse, pero ya no se ofrecen
        const b=document.createElement('button'); b.textContent=it.nombre; b.dataset.id=it.id; b.className='diosItem';
        b.addEventListener('click',()=>{
          if(it.disenar&&!it.alColocar&&NV.creador){ NV.creador.abrir(NV.motorDeEntrada(it.id),it,null); return; }   // se diseña antes de colocar
          elegir(E.sel&&E.sel.id===it.id?null:it);
        });
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
    /* un objeto ancho (una formación, una roca grande) ocupa todo su pie: nada de agua, de otro objeto ni de vacío */
    const fx=(o&&o.fx)|0, fy=(o&&o.fy)|0;
    if(fx||fy) for(let dy=-fy;dy<=fy;dy++) for(let dx=-fx;dx<=fx;dx++){
      if(!dx&&!dy) continue;
      const g2=NV.sueloEn(x+dx,y+dy);
      if(!g2) return 'Más allá no hay nada todavía.';
      if(g2==='P') return 'Toca el agua: correla un poco.';
      if(NV.solidoEn(x+dx,y+dy)) return 'No cabe: choca con algo.';
      if(me.x===x+dx&&me.y===y+dy) return 'Ahí estás parado.';
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
    if(E.sel.alColocar&&NV.subescenas){ NV.subescenas.preguntar(x,y,E.sel); return; }   // el Umbral pregunta antes de colocarse
    /* lo que se pone es EXACTAMENTE lo que se veía en la vista previa; después sale otra variante */
    if(hacer({t:'objeto+',x,y,objeto:o},(E.sel.etiqueta||E.sel.nombre)+' colocado.'))
      E.fantasma=NV.motorDeEntrada(E.sel.id).caras.objetos.crear(E.sel.id);
  }
  function regenerar(o){
    const r=NV.entradaDeObjeto(o); if(!r){ decir('Ese objeto no se puede regenerar.'); return; }
    const nuevo=Object.assign({},o,r.motor.caras.objetos.variar(o)); delete nuevo.x; delete nuevo.y; delete nuevo.fantasma;
    hacer({t:'lote',ops:[{t:'objeto-',x:o.x,y:o.y},{t:'objeto+',x:o.x,y:o.y,objeto:nuevo}]},(r.entrada.etiqueta||r.entrada.nombre)+': otra variante.');
  }
  /* Si el clic no cayó sobre un pixel de objeto (o el objeto vino de otra sesión), se busca el que tenga esa casilla en su pie. */
  function objetoEnHuella(x,y){
    let mejor=null,d0=1e9;
    for(const o of NV.objetosEn(x-8,y-8,x+8,y+8)){
      const fx=(o.fx|0)+(o.k==='caido'?(o.len||1):0), fy=o.fy|0;
      const dx=Math.abs(o.x-x), dy=Math.abs(o.y-y);
      if(o.k==='caido'?(y===o.y&&x>=o.x&&x<o.x+(o.len||1)):(dx<=fx&&dy<=fy)){ const d=dx+dy; if(d<d0){ d0=d; mejor=o; } }
    }
    return mejor;
  }
  E.objetoEnHuella=objetoEnHuella;
  function eliminar(o){
    const r=NV.entradaDeObjeto(o);
    hacer({t:'objeto-',x:o.x,y:o.y},(r?(r.entrada.etiqueta||r.entrada.nombre):'Objeto')+' eliminado.');
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
  /* lo que la ventana de diseño entrega: armar la herramienta con un objeto exacto, o cambiar uno ya puesto */
  E.armar=function(entrada,objeto){ E.sel=entrada; E.fantasma=objeto; marcarPaleta(); refrescar(); programarCuadro(); };
  E.eliminar=o=>eliminar(o);
  E.reemplazar=function(o,nuevo){
    const n=Object.assign({},nuevo); delete n.x; delete n.y; delete n.fantasma;
    return hacer({t:'lote',ops:[{t:'objeto-',x:o.x,y:o.y},{t:'objeto+',x:o.x,y:o.y,objeto:n}]},'Cambiado.');
  };
  E.deshacer=deshacer; E.rehacer=rehacerUno; E.elegir=elegir;
  E.hacer=hacer; E.decir=decir; E.refrescar=refrescar; E.apoyo={porQueNo};
  /* cambiar de herramienta: la de objetos es la de siempre; las demás son módulos de E.modos */
  E.cambiarModo=function(m){
    if(m===E.modo||(m!=='objetos'&&!E.modos[m])) return;
    const M0=E.modos[E.modo]; if(M0&&M0.cerrar) M0.cerrar();
    if(E.modo==='objetos'){ elegir(null); E.hover=null; }
    E.modo=m; pie='';
    const p=$e('dios'); if(p) { p.classList.toggle('camMode',m==='caminos'); p.classList.toggle('terMode',m==='terreno'); p.classList.toggle('aguMode',m==='aguas'); p.classList.toggle('fluMode',m==='fluidez'); }
    for(const [id,k] of [['diosModoObj','objetos'],['diosModoCam','caminos'],['diosModoTer','terreno'],['diosModoAgu','aguas'],['diosModoFlu','fluidez']]){ const b=$e(id); if(b) b.classList.toggle('on',m===k); }
    const M=E.modos[m]; if(M&&M.abrir) M.abrir();
    refrescar(); programarCuadro();
  };
  E.pilas=()=>({deshacer:pila.length,rehacer:rehacer.length});

  /* ---------- mover el mapa: Espacio + arrastrar ----------
     La cámara se desplaza en metros sobre lo que seguiría al personaje (NV.camLibre). Mientras se arrastra, la cámara no se
     suaviza (NV.camDirecta): el terreno se queda pegado al cursor. El personaje no se mueve. Inicio vuelve a él. */
  E.espacio=false; E.paneo=null;
  function cursorMapa(){ const cv=$e('cv'); if(cv) cv.style.cursor=E.paneo?'grabbing':E.espacio?'grab':'crosshair'; }
  function iniciarPaneo(e){
    const L=NV.camLibre||(NV.camLibre={x:0,y:0});
    E.paneo={px:e.clientX,py:e.clientY,x0:L.x,y0:L.y,id:e.pointerId};
    NV.camDirecta=true;
    try{ $e('cv').setPointerCapture(e.pointerId); }catch(_){}
    cursorMapa(); programarCuadro();
  }
  function moverPaneo(e){
    const P=E.paneo, M=NV.medidas(), L=NV.camLibre; if(!P||!L) return;
    L.x=P.x0-(e.clientX-P.px)/M.pxmX; L.y=P.y0-(e.clientY-P.py)/M.pxmY;
    programarCuadro();
  }
  function finPaneo(){
    if(!E.paneo) return;
    try{ $e('cv').releasePointerCapture(E.paneo.id); }catch(_){}
    E.paneo=null; NV.camDirecta=false; cursorMapa(); programarCuadro();
  }
  E.finPaneo=finPaneo;
  E.volverAlPersonaje=function(){ NV.camLibre=null; finPaneo(); decir('La vista vuelve al personaje.'); programarCuadro(); };

  /* ---------- ampliar el mundo: clic en el vacío, junto a tierra → ¿Expandir? ----------
     El mundo crece de a una parcela de 10 × 10 m, siempre pegada a tierra que ya existe (por un lado). Un clic en el vacío
     marca la parcela y pregunta; Sí la agrega (operación 'parcela', con deshacer), No la descarta. */
  E.expansion=null;
  const hayTierraPanel=(pi,pj)=>NV.sueloEn(pi*NV.LADO+NV.LADO/2,pj*NV.LADO+NV.LADO/2)!==null;
  const kmTxt=()=>NV.LADO+' × '+NV.LADO+' m';
  function cerrarExpansion(){ E.expansion=null; const b=$e('expandir'); if(b) b.classList.remove('show'); programarCuadro(); }
  function abrirExpansion(pi,pj,quitar){
    E.expansion={pi,pj,quitar:!!quitar};
    const t=$e('expTxt'), b=$e('expandir');
    if(t) t.textContent=(quitar?'¿Quitar?\nParcela ':'¿Expandir?\nTerreno ')+NV.nombreDe(pi,pj)+' · '+kmTxt();
    if(b) b.classList.add('show'); programarCuadro();
  }
  function confirmarExpansion(si){
    const X=E.expansion; if(!X){ return; }
    cerrarExpansion();
    if(si&&X.quitar){ hacer({t:'panel',pi:X.pi,pj:X.pj,def:{bioma:'vacio',nombre:'Quitada'}},'Parcela '+NV.nombreDe(X.pi,X.pj)+' quitada.'); return; }
    if(si) hacer({t:'panel',pi:X.pi,pj:X.pj,def:{bioma:'pasto',nombre:'Terreno '+NV.nombreDe(X.pi,X.pj)}},'Terreno '+NV.nombreDe(X.pi,X.pj)+' agregado ('+kmTxt()+').'); else decir(X.quitar?'No se quitó.':'No se amplió.');
  }
  E.confirmarExpansion=confirmarExpansion;
  /* devuelve true si el clic era sobre el vacío (y ya se atendió) */
  /* Parcela › Remover: clic sobre una parcela pregunta ¿Quitar? (no la última, ni la que pisa el personaje) */
  E.parcelaModo='anadir';
  function parcelaModo(m){
    E.parcelaModo=m; cerrarExpansion();
    const a=$e('parAdd'), q=$e('parQuit'), sl=$e('parSel'); if(a) a.classList.toggle('on',m==='anadir'); if(q) q.classList.toggle('on',m==='quitar'); if(sl) sl.classList.toggle('on',m==='seleccionar');
    if(m!=='seleccionar') limpiarSel();
    decir(m==='quitar'?'Remover: clic sobre la parcela que quieres quitar.':m==='seleccionar'?'Seleccionar objetos: arrastrá un rectángulo sobre el terreno (Mayús suma). Supr o "Borrar" elimina lo seleccionado; Esc suelta.':'Añadir: clic en el vacío junto al mapa.'); programarCuadro();
  }
  E.parcelaModoSet=parcelaModo;
  /* ---------- Seleccionar objetos: un rectángulo; lo que queda adentro se selecciona y se puede borrar de una vez ---------- */
  E.selCaja=null; E.selObjs=[];
  const claveO=o=>o.x+','+o.y;
  function actualizarBorrar(){ const b=$e('parBorrar'); if(b) b.disabled=!E.selObjs.length; }
  function limpiarSel(){ E.selCaja=null; E.selObjs=[]; actualizarBorrar(); refrescar(); programarCuadro(); }
  function recalcularSel(){
    const c=E.selCaja; if(!c) return;
    const x0=Math.min(c.x0,c.x1), x1=Math.max(c.x0,c.x1), y0=Math.min(c.y0,c.y1), y1=Math.max(c.y0,c.y1);
    const dentro=NV.objetosEn(x0,y0,x1,y1).filter(o=>o.x>=x0&&o.x<=x1&&o.y>=y0&&o.y<=y1);
    if(c.suma){ const m=new Map(c.base.map(o=>[claveO(o),o])); for(const o of dentro) m.set(claveO(o),o); E.selObjs=Array.from(m.values()); }
    else E.selObjs=dentro;
    actualizarBorrar();
  }
  function iniciarSel(e){
    apuntar(e); const h=E.hover; if(!h) return;
    E.selCaja={x0:h.x,y0:h.y,x1:h.x,y1:h.y,arr:true,suma:!!e.shiftKey,base:e.shiftKey?E.selObjs.slice():[]};
    recalcularSel(); refrescar(); programarCuadro();
  }
  function moverSel(e){
    apuntar(e); const h=E.hover; if(!h||!E.selCaja) return;
    if(h.x===E.selCaja.x1&&h.y===E.selCaja.y1) return;
    E.selCaja.x1=h.x; E.selCaja.y1=h.y; recalcularSel(); refrescar(); programarCuadro();
  }
  function finSel(){
    const c=E.selCaja; if(!c||!c.arr) return; c.arr=false;
    const n=E.selObjs.length;
    decir(n?n+' objeto'+(n>1?'s':'')+' seleccionado'+(n>1?'s':'')+'. Supr o "Borrar" los elimina; Esc suelta.':'No hay objetos dentro del rectángulo.');
    if(!n) E.selCaja=null;
    refrescar(); programarCuadro();
  }
  function borrarSel(){
    const L=E.selObjs; if(!L.length){ decir('No hay nada seleccionado.'); return false; }
    const n=L.length;
    if(hacer({t:'lote',ops:L.map(o=>({t:'objeto-',x:o.x,y:o.y}))},n+' objeto'+(n>1?'s':'')+' eliminado'+(n>1?'s':'')+'. Deshacer los trae de vuelta.')){ E.selCaja=null; E.selObjs=[]; actualizarBorrar(); return true; }
    return false;
  }
  /* para que una perilla en vivo deje un solo paso de deshacer: se anota el largo de la pila al empezar y al soltar se juntan los pasos */
  E.pilaLargo=()=>pila.length;
  E.colapsarPila=n=>{ const t=pila.splice(n); if(t.length>1) pila.push({t:'lote',ops:t.reverse()}); else if(t.length) pila.push(t[0]); };
  E.borrarSeleccion=borrarSel; E.limpiarSeleccion=limpiarSel;
  function intentarQuitar(e){
    apuntar(e); const h=E.hover; if(!h) return true;
    if(NV.sueloEn(h.x,h.y)===null){ cerrarExpansion(); decir('Ahí no hay parcela.'); return true; }
    const L=NV.LADO, pi=Math.floor(h.x/L), pj=Math.floor(h.y/L), b=NV.limites();
    let n=0; for(let j=Math.floor(b.y0/L);j<Math.ceil(b.y1/L);j++) for(let i=Math.floor(b.x0/L);i<Math.ceil(b.x1/L);i++) if(hayTierraPanel(i,j)) n++;
    if(n<=1){ cerrarExpansion(); decir('Es la última parcela: no se puede quitar.'); return true; }
    const yo=(typeof me!=='undefined')?me:null;
    if(yo&&Math.floor(yo.x/L)===pi&&Math.floor(yo.y/L)===pj){ cerrarExpansion(); decir('El personaje está en esa parcela: muévelo antes de quitarla.'); return true; }
    abrirExpansion(pi,pj,true); return true;
  }
  function intentarAmpliar(e){
    if(E.parcelaModo==='quitar') return intentarQuitar(e);
    apuntar(e); const h=E.hover; if(!h) return false;
    if(NV.sueloEn(h.x,h.y)!==null){ if(E.expansion) cerrarExpansion(); return false; }
    const L=NV.LADO, pi=Math.floor(h.x/L), pj=Math.floor(h.y/L);
    const junto=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>hayTierraPanel(pi+a,pj+b));
    if(!junto){ if(E.expansion) cerrarExpansion(); decir('Sólo se puede ampliar junto a terreno que ya existe.'); return true; }
    abrirExpansion(pi,pj); return true;
  }

  /* ---------- el ratón ---------- */
  function alBajar(e){
    if(!E.activo) return;
    e.preventDefault();
    if(E.espacio&&e.button===0){ iniciarPaneo(e); return; }
    if(NV.escena){ decir('Adentro de un sub-mundo: editá la cueva con el botón de abajo. Espacio + arrastrar mueve la vista.'); return; }
    if(E.parcelaModo==='seleccionar'&&E.modo==='objetos'&&e.button===0){ iniciarSel(e); return; }
    if(e.button===0&&!e.ctrlKey&&intentarAmpliar(e)) return;
    if(E.modo!=='objetos'){ E.modos[E.modo].bajar(e); return; }
    apuntar(e);
    const h=E.hover; if(!h) return;
    if(e.button===2){                                   // clic derecho: elimina SOLO el objeto apuntado
      if(e.ctrlKey) return;                             // en Mac, Control+clic es clic derecho: no debe borrar
      const o=h.obj||objetoEnHuella(h.x,h.y);
      if(o) eliminar(o); else decir('Ahí no hay ningún objeto.');
      return;
    }
    if(e.button!==0) return;
    if(e.ctrlKey){                                      // Control + clic: regenerar, con prioridad sobre colocar
      if(h.obj) regenerar(h.obj); else decir('Ahí no hay nada que regenerar.');
      return;
    }
    if(!E.sel){
      const ob=h.obj||objetoEnHuella(h.x,h.y), r=ob&&NV.entradaDeObjeto(ob);
      if(r&&r.entrada.disenar&&NV.creador){ NV.creador.abrir(r.motor,r.entrada,ob); return; }   // se edita con sus perillas
      decir(h.obj?'Control + clic lo regenera; clic derecho lo elimina.':'Elegí algo de la paleta.'); return;
    }
    colocar(h.x,h.y);
  }
  function alMover(e){
    if(!E.activo) return;
    if(E.paneo){ moverPaneo(e); return; }
    if(E.selCaja&&E.selCaja.arr){ moverSel(e); return; }
    if(E.modo!=='objetos'){ E.modos[E.modo].mover(e); return; }
    const antes=E.hover?E.hover.x+','+E.hover.y+','+E.hover.id:'', ctrl0=E.ctrl;
    apuntar(e);
    const ahora=E.hover?E.hover.x+','+E.hover.y+','+E.hover.id:'';
    if(ahora!==antes||ctrl0!==E.ctrl){ refrescar(); programarCuadro(); }
  }

  E.alBajar=alBajar; E.alMover=alMover;          // la entrada del ratón, también como llamada (pruebas, teclado futuro)

  /* ---------- entrar y salir ---------- */
  E.entrar=function(){
    if(E.activo) return;
    E.activo=true; NV.pick(true); NV.zoomLibre(true);
    if(typeof dejarDeCaminar==='function') dejarDeCaminar();
    if(typeof detenerRuta==='function') detenerRuta();
    const p=$e('dios'); if(p){ p.classList.add('show'); p.classList.toggle('subMode',!!NV.escena); }
    $e('cv').style.cursor='crosshair';
    decir('<b>Modo Dios</b>\nElegí algo de la paleta y hacé clic en el terreno.\nRueda o + / − : zoom libre (hasta 200 m).\nEspacio + arrastrar: mover el mapa · Inicio: volver al personaje.\nParcela › Añadir: clic en el vacío junto al mapa. Remover: clic sobre la parcela.');
    refrescar(); programarCuadro();
  };
  E.salir=function(){
    if(!E.activo) return;
    const Mx=E.modos[E.modo]; if(Mx&&Mx.cerrar) Mx.cerrar();
    if(NV.creador) NV.creador.cerrar();
    clearTimeout(tGuardar); NV.mundo.guardarBorrador();   // lo editado ya está en el mundo; además queda guardado
    cerrarExpansion(); E.parcelaModo='anadir'; E.selCaja=null; E.selObjs=[]; { const a=$e('parAdd'), q=$e('parQuit'), sl=$e('parSel'); if(a) a.classList.add('on'); if(q) q.classList.remove('on'); if(sl) sl.classList.remove('on'); actualizarBorrar(); } NV.camLibre=null; NV.camDirecta=false; E.espacio=false; E.paneo=null;
    NV.zoomLibre(false); E.activo=false; E.sel=null; E.fantasma=null; E.hover=null; NV.pick(false);
    const p=$e('dios'); if(p) p.classList.remove('show');
    $e('cv').style.cursor='';
    marcarPaleta(); decir('Mundo guardado. Seguís en el juego normal.'); programarCuadro();
  };

  /* ---------- lo que se ve ---------- */
  function refrescar(){
    const est=$e('diosEstado'); if(!est) return;
    const h=E.hover; let t='';
    motivo=null;
    if(E.modo!=='objetos') t=E.modos[E.modo].estado();
    else if(h&&h.obj){
      const r=NV.entradaDeObjeto(h.obj);
      t='<b>'+(r?(r.entrada.etiqueta||r.entrada.nombre):'Objeto')+'</b>\n'+(r&&r.entrada.disenar?'Clic: editar con perillas\n':'')+'Ctrl + clic: regenerar\nClic derecho: eliminar';
    } else if(E.sel){
      motivo=h?porQueNo(h.x,h.y,E.fantasma):null;
      t='Colocando <b>'+(E.sel.etiqueta||E.sel.nombre)+'</b>\n'+(motivo||'Clic: colocar · Esc: soltar');
    } else t='Elegí algo de la paleta.\nClic en una roca nueva la edita; Ctrl + clic regenera, clic derecho elimina.';
    if(t!==pie){ pie=t; est.innerHTML=t.replace(/\n/g,'<br>'); }
    const d=$e('diosDeshacer'), r2=$e('diosRehacer');
    if(d) d.disabled=!pila.length; if(r2) r2.disabled=!rehacer.length;
  }

  /* la lista de objetos del cuadro, con la vista previa en la casilla del cursor (no se guarda en ningún lado) */
  E.conFantasma=function(objetos){
    const h=E.hover;
    if(!E.sel||!E.fantasma||E.ctrl||!h) return objetos;
    const g=Object.assign({},E.fantasma,{x:h.x,y:h.y,fantasma:true}); g.oy=g.y+(g.dy||0);
    return objetos.concat([g]).sort((a,b)=>a.oy-b.oy);
  };

  const mezcla=(c,col,a)=>{
    const r=(c>>16)&255, g=(c>>8)&255, b=c&255;
    return (((r+(col[0]-r)*a)|0)<<16)|(((g+(col[1]-g)*a)|0)<<8)|((b+(col[2]-b)*a)|0);
  };
  /* resaltado de la silueta bajo el cursor, tinte de la vista previa y marcador de la casilla.
     Se llama dentro de draw_, antes de volcar al lienzo. */
  E.pintar=function(){
    if(E.expansion){
      /* el borde del terreno candidato que cae en pantalla: cruces de oro cada 2 m */
      const L=NV.LADO, X=E.expansion, x0=X.pi*L, y0=X.pj*L, x1=x0+L, y1=y0+L, color=packc(ORO_VIVO[0],ORO_VIVO[1],ORO_VIVO[2]);
      const vx0=camX-1, vx1=camX+cols/CPM+1, vy0=camY-1, vy1=camY+rowsN/RPM+1;
      const cruz=(x,y)=>{ const c0=Math.round((x-camX)*CPM), r0=Math.floor((y-camY)*RPM); ordR=65535; layer=3; alzaR=0; pickId=0; for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,color); layer=0; };
      const ini=(v,m)=>Math.max(m,Math.ceil(v/2)*2);
      for(let x=ini(vx0,x0); x<=Math.min(x1,vx1); x+=2){ if(y0>=vy0&&y0<=vy1) cruz(x,y0); if(y1>=vy0&&y1<=vy1) cruz(x,y1); }
      for(let y=ini(vy0,y0); y<=Math.min(y1,vy1); y+=2){ if(x0>=vx0&&x0<=vx1) cruz(x0,y); if(x1>=vx0&&x1<=vx1) cruz(x1,y); }
    }
    if(E.modo!=='objetos'){ const M=E.modos[E.modo]; if(M&&M.pintar) M.pintar(); return; }
    const h=E.hover, n=cols*rowsN;
    if(E.selCaja||E.selObjs.length){
      /* los objetos seleccionados, teñidos de oro, y el rectángulo, de trazos */
      if(E.selObjs.length&&NV.objetosVista){
        const ks=new Set(E.selObjs.map(claveO)), ids=new Set();
        NV.objetosVista.forEach((o,k)=>{ if(o&&ks.has(claveO(o))) ids.add(k+1); });
        if(ids.size) for(let i=0;i<n;i++) if(ids.has(fbP[i])&&fbG[i]) fbC[i]=mezcla(fbC[i],ORO_VIVO,0.6);
      }
      const c=E.selCaja;
      if(c){
        const x0=Math.min(c.x0,c.x1), x1=Math.max(c.x0,c.x1)+1, y0=Math.min(c.y0,c.y1), y1=Math.max(c.y0,c.y1)+1, color=packc(ORO_VIVO[0],ORO_VIVO[1],ORO_VIVO[2]);
        const ca=Math.round((x0-camX)*CPM), cb=Math.round((x1-camX)*CPM), ra=Math.floor((y0-camY)*RPM), rb=Math.floor((y1-camY)*RPM);
        ordR=65535; layer=3; alzaR=0; pickId=0;
        for(let q=ca;q<=cb;q++){ const g=(q-ca)%2===0?45:32; if(g!==32){ put(q,ra,g,color); put(q,rb,g,color); } }
        for(let r2=ra;r2<=rb;r2++){ put(ca,r2,124,color); put(cb,r2,124,color); }
        for(const [qq,rr] of [[ca,ra],[cb,ra],[ca,rb],[cb,rb]]) put(qq,rr,43,color);
        layer=0;
      }
    }
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
    if(NV.creador) NV.creador.iniciar();
    const cv=$e('cv');
    cv.addEventListener('pointerdown',alBajar);
    cv.addEventListener('pointermove',alMover);
    cv.addEventListener('contextmenu',e=>{ if(E.activo) e.preventDefault(); });
    addEventListener('keydown',e=>{
      const k=(e.key||'').toLowerCase();
      if(k==='g'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); E.activo?E.salir():E.entrar(); return; }
      if(!E.activo) return;
      const campo=/^(INPUT|SELECT|TEXTAREA)$/.test((e.target&&e.target.tagName)||'');
      if(E.expansion&&!campo){ if(k==='s'||k==='enter'){ e.preventDefault(); confirmarExpansion(true); return; } if(k==='n'||k==='escape'){ e.preventDefault(); confirmarExpansion(false); return; } }
      if((e.code==='Space'||k===' ')&&!campo){ e.preventDefault(); if(!E.espacio){ E.espacio=true; cursorMapa(); } return; }
      if(k==='home'&&!campo){ e.preventDefault(); E.volverAlPersonaje(); return; }
      if(E.modo!=='objetos'){ const M=E.modos[E.modo]; if(M.tecla&&M.tecla(e,k)){ e.preventDefault(); return; } }
      if((k==='delete'||k==='backspace')&&!campo&&E.selObjs.length){ e.preventDefault(); borrarSel(); return; }
      if(k==='escape'&&!campo&&E.selObjs.length){ limpiarSel(); return; }
      if(k==='control'){ E.ctrl=true; refrescar(); programarCuadro(); return; }
      if(k==='escape'&&E.sel){ elegir(null); return; }
      if((e.ctrlKey||e.metaKey)&&k==='z'){ e.preventDefault(); e.shiftKey?rehacerUno():deshacer(); return; }
      if((e.ctrlKey||e.metaKey)&&k==='y'){ e.preventDefault(); rehacerUno(); return; }
    });
    addEventListener('keyup',e=>{
      if(E.activo&&(e.key||'').toLowerCase()==='control'){ E.ctrl=false; refrescar(); programarCuadro(); }
      if(E.activo&&(e.code==='Space'||e.key===' ')){ E.espacio=false; cursorMapa(); if(!/^(INPUT|SELECT|TEXTAREA)$/.test((e.target&&e.target.tagName)||'')) e.preventDefault(); }   // un botón con foco no se activa con la barra
    });
    addEventListener('pointerup',finPaneo); addEventListener('pointercancel',finPaneo);
    addEventListener('blur',()=>{ E.espacio=false; finPaneo(); });
    const b=id=>$e(id);
    if(b('parAdd')) b('parAdd').addEventListener('click',()=>parcelaModo('anadir'));
    if(b('parQuit')) b('parQuit').addEventListener('click',()=>parcelaModo('quitar'));
    if(b('parSel')) b('parSel').addEventListener('click',()=>parcelaModo('seleccionar'));
    if(b('parBorrar')) b('parBorrar').addEventListener('click',()=>borrarSel());
    addEventListener('pointerup',finSel);
    if(b('expSi')) b('expSi').addEventListener('click',()=>confirmarExpansion(true));
    if(b('expNo')) b('expNo').addEventListener('click',()=>confirmarExpansion(false));
    b('diosModoObj').addEventListener('click',()=>E.cambiarModo('objetos'));
    b('diosModoCam').addEventListener('click',()=>E.cambiarModo('caminos'));
    b('diosModoTer').addEventListener('click',()=>E.cambiarModo('terreno'));
    if(b('diosModoAgu')) b('diosModoAgu').addEventListener('click',()=>E.cambiarModo('aguas'));
    b('diosModoFlu').addEventListener('click',()=>E.cambiarModo('fluidez'));
    for(const k in E.modos) if(E.modos[k].iniciar) E.modos[k].iniciar();
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
