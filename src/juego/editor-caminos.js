/* Nativa Online — MODO DIOS: la herramienta de caminos.
   Se registra en NV.editor.modos y se enciende con la pestaña "caminos". No sabe pintar un camino: eso es del
   motor (NV.caminos); acá sólo se decide qué hacer con el ratón y se escribe cada cambio en el mundo con
   NV.mundo.editar({t:'camino',id,datos}), que es de donde sale también el deshacer (la pila es la del editor).

     · LÁPIZ: se mantiene el clic izquierdo en el terreno y se arrastra; el camino sigue la mano y se cierra al soltar
     · [ y ] (o - y +, o los botones) cambian el ancho: al dibujar valen para lo que viene (con el clic apretado también);
       con un camino elegido, escalan todo el camino
     · clic (sin arrastrar) sobre un camino: lo elige; los botones de familia y variante lo cambian
     · Shift + arrastrar desde un camino: nace un ramal desde ahí
     · Alt + arrastrar: dibuja un camino nuevo aunque haya otro debajo (para cruzarlos)
     · Control + clic sobre un camino: otra textura, el mismo trazado
     · clic derecho sobre un camino, o Supr: lo borra · Esc mientras se dibuja: lo cancela

   Todo se mide en metros. El motor no guarda nada que no sea el camino; las 12 variantes son familia × (natural, media, detallada). */
(function(NV){
  const E=NV.editor; if(!E) return;
  const C=()=>NV.caminos;
  const ORO=[200,162,74], ORO_VIVO=[255,232,160], ROJO=[214,70,56];
  const VISTA='__trazo';
  const VARS=['natural','intermedia','detallada'];
  const $e=id=>document.getElementById(id);

  let fam='tierra', vari='intermedia', ancho=null;     // lo que se usa para el camino siguiente
  let traza=null;                                       // el camino en curso: {pts,w,rama,padre}
  let pulsado=false;                                    // el clic izquierdo está apretado dibujando
  let sel=null;                                         // id del camino elegido
  let cur=null, ultVista=null;                // cursor en metros del mundo · último clic · último punto de la vista previa

  const anchoDe=f=>C().FAMILIAS[f].def.ancho;
  const unAncho=()=>ancho==null?anchoDe(fam):ancho;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const lim=C().PARAMS.ancho;

  /* ---------- el mundo ---------- */
  const datosDe=id=>NV.mundo.caminosDatos().find(d=>d.id===id)||null;
  const copia=d=>JSON.parse(JSON.stringify(d));
  const varianteDe=d=>VARS[clamp((d.camino.params.detalle|0),0,2)];
  function libre(){
    let n=1; const usados=new Set(NV.mundo.caminosDatos().map(d=>d.id));
    while(usados.has('camino-'+n)) n++;
    return 'camino-'+n;
  }
  function escribir(id,datos,aviso){
    if(datos){ try{ C().deDatos(datos); }catch(e){ E.decir('No se pudo: '+e.message); return false; } }
    return E.hacer({t:'camino',id,datos},aviso);
  }
  function modificar(id,f,aviso){
    const d=datosDe(id); if(!d){ E.decir('Ese camino ya no está.'); return false; }
    const n=copia(d); f(n); return escribir(id,n,aviso);
  }

  /* ---------- el puntero: el punto exacto del mundo bajo el cursor ---------- */
  function puntero(e){
    const cv=$e('cv'), r=cv.getBoundingClientRect();
    const col=Math.floor((e.clientX-r.left-(NV.desplaceX||0))/cw), fil=Math.floor((e.clientY-r.top-(NV.desplaceY||0))/chh);
    if(col<0||fil<0||col>=cols||fil>=rowsN) return null;
    const q=NV.casillaEn(col,fil);
    return {wx:q.wx,wy:q.wy};
  }
  /* el camino del mundo que está bajo un punto (el más cercano a su eje) */
  function bajo(wx,wy){
    let mejor=null, dm=1e9;
    for(const c of C().red.caminos.values()){
      if(c.id.slice(0,2)==='__') continue;
      const r=C().campo(c,wx,wy); if(!r) continue;
      const d=r.d-r.w*0.5; if(d<=0.35&&d<dm){ dm=d; mejor=c; }
    }
    return mejor;
  }
  function fraccionMasCerca(c,wx,wy){
    let mf=0, md=1e9;
    for(let i=0;i<=240;i++){ const q=C().puntoEn(c,i/240), d=Math.hypot(q.x-wx,q.y-wy); if(d<md){ md=d; mf=i/240; } }
    return mf;
  }

  /* ---------- el trazo en curso: se ve en el suelo como un camino provisional ---------- */
  function armarTraza(extra){
    const pts=traza.pts.map(p=>[p[0],p[1]]), w=traza.w.slice();
    if(extra){ pts.push([extra[0],extra[1]]); w.push(unAncho()); }
    return {pts,w};
  }
  function parametrosTraza(){
    if(traza.rama) return Object.assign({},traza.padre.params,{ancho:traza.w[0]});
    const p=C().variante(fam,vari); p.ancho=traza.w[0]; return p;
  }
  function construir(id,pts,w){
    return C().nuevo({id,familia:traza.rama?traza.padre.familia:fam,puntos:pts,anchos:w,params:parametrosTraza(),
      semTrazado:traza.sem,semTextura:traza.rama?traza.padre.semTextura:traza.sem,fin:traza.rama?'afila':'redondo'});
  }
  function vista(){
    C().quitar(VISTA);
    if(!traza) return;
    const a=armarTraza(cur?[cur.wx,cur.wy]:null);
    if(a.pts.length<2) return;
    const u=a.pts[a.pts.length-1], v=a.pts[a.pts.length-2];
    if(Math.hypot(u[0]-v[0],u[1]-v[1])<0.15) a.pts.pop(), a.w.pop();
    if(a.pts.length<2) return;
    try{ C().agregar(construir(VISTA,a.pts,a.w)); }catch(e){}
  }
  function limpiarVista(){ C().quitar(VISTA); }

  /* ---------- acciones ---------- */
  function empezar(p,rama){
    const sem=((Date.now()&0xffff)^(NV.caminos.red.version*2654435)^((p.wx*131+p.wy*313)|0))&0xffff;
    if(rama){
      const q=C().puntoEn(rama,fraccionMasCerca(rama,p.wx,p.wy));
      traza={pts:[[q.x,q.y],[q.x+q.tx*1.6,q.y+q.ty*1.6]],w:[q.ancho*0.9,q.ancho*0.85],rama:true,padre:rama,sem};
      fam=rama.familia; ancho=null; ancho=q.ancho*0.8;
    } else {
      traza={pts:[[p.wx,p.wy]],w:[unAncho()],rama:false,padre:null,sem};
    }
    sel=null; vista(); marcarUI(); E.refrescar();
  }
  const SEP=0.6;                                        // cada cuántos metros de mano se guarda un punto
  function punto(p){
    const u=traza.pts[traza.pts.length-1];
    if(Math.hypot(p.wx-u[0],p.wy-u[1])<SEP) return;
    if(traza.pts.length>=1500){ E.decir('Ya es muy largo: terminalo y seguí con otro.'); return; }
    traza.pts.push([p.wx,p.wy]); traza.w.push(unAncho());
    vista(); E.refrescar();
  }
  function terminar(){
    if(!traza) return;
    if(traza.pts.length<2){ cancelar(); E.decir('Mantené el clic y arrastrá para dibujar.'); return; }
    suavizar(traza.pts,traza.rama?2:1);
    const id=libre();
    let datos; try{ datos=C().aDatos(construir(id,traza.pts,traza.w)); }catch(e){ E.decir('No se pudo trazar: '+e.message); return; }
    limpiarVista(); traza=null;
    if(escribir(id,datos,'Camino trazado.')) sel=id;
    marcarUI(); E.refrescar();
  }
  /* la mano tiembla: una pasada que mezcla cada punto con sus vecinos (los primeros `desde` no se tocan, ni el último) */
  function suavizar(P,desde){
    const o=P.map(q=>[q[0],q[1]]);
    for(let i=desde;i<P.length-1;i++){ P[i][0]=(o[i-1][0]+2*o[i][0]+o[i+1][0])/4; P[i][1]=(o[i-1][1]+2*o[i][1]+o[i+1][1])/4; }
  }
  function cancelar(){ pulsado=false; traza=null; limpiarVista(); marcarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); }
  function quitarUltimo(){
    if(!traza) return;
    if(traza.pts.length<=(traza.rama?2:1)){ cancelar(); return; }
    traza.pts.pop(); traza.w.pop(); vista(); E.refrescar();
  }
  function borrar(id){ if(escribir(id,null,'Camino borrado.')&&sel===id) sel=null; marcarUI(); E.refrescar(); }
  function textura(id){
    modificar(id,d=>{ d.camino.semTextura=(((d.camino.semTextura|0)*31+7919+(Date.now()&0xffff))&0xffff); },'Otra textura, el mismo trazado.');
  }
  function mudar(nf,nv){
    if(traza){ if(!traza.rama){ if(nf) fam=nf; if(nv) vari=nv; } marcarUI(); vista(); E.refrescar(); return; }
    if(sel&&datosDe(sel)){
      modificar(sel,d=>{
        const f=nf||d.camino.familia, v=nv||varianteDe(d), a=d.camino.params.ancho;
        d.camino.familia=f; d.camino.params=Object.assign(C().variante(f,v),{ancho:a});
      },'Camino cambiado.');
    } else { if(nf){ fam=nf; ancho=null; } if(nv) vari=nv; }
    marcarUI(); E.refrescar();
  }
  function masAncho(k){
    if(traza){ ancho=clamp(unAncho()+k*0.2,lim.min,lim.max); vista(); marcarUI(); E.refrescar(); return; }
    if(sel&&datosDe(sel)){
      modificar(sel,d=>{
        const a0=d.camino.params.ancho, a1=clamp(a0+k*0.2,lim.min,lim.max), r=a1/a0;
        d.camino.params.ancho=a1;
        if(d.camino.anchos) d.camino.anchos=d.camino.anchos.map(w=>w==null?null:clamp(w*r,lim.min,lim.max));
      },k>0?'Más ancho.':'Más angosto.');
    } else { ancho=clamp(unAncho()+k*0.2,lim.min,lim.max); }
    marcarUI(); E.refrescar();
  }

  /* ---------- el ratón y el teclado ---------- */
  function bajar(e){
    const p=puntero(e); if(!p) return;
    cur=p;
    if(e.button===2){
      if(e.ctrlKey) return;                              // en Mac, Control+clic es clic derecho: no debe borrar
      if(traza){ cancelar(); return; }
      const c=bajo(p.wx,p.wy);
      if(c) borrar(c.id); else E.decir('Ahí no hay ningún camino.');
      return;
    }
    if(e.button!==0) return;
    if(traza) return;
    const c=e.altKey?null:bajo(p.wx,p.wy);
    if(e.ctrlKey){ if(c) textura(c.id); else E.decir('Ahí no hay ningún camino.'); return; }
    if(e.shiftKey&&c){ empezar(p,c); pulsado=true; return; }
    if(c){ sel=c.id; marcarUI(); E.refrescar(); if(typeof programarCuadro==='function') programarCuadro(); return; }
    empezar(p,null); pulsado=true;
  }
  /* soltar el clic cierra el camino */
  function soltar(){
    if(!pulsado) return;
    pulsado=false;
    if(traza&&cur){ const u=traza.pts[traza.pts.length-1]; if(Math.hypot(cur.wx-u[0],cur.wy-u[1])>0.2) punto(Object.assign({},cur),true); }
    terminar();
  }
  function mover(e){
    const p=puntero(e); cur=p;
    if(traza&&pulsado&&p) punto(p);
    if(traza){
      if(p&&(!ultVista||Math.hypot(p.wx-ultVista[0],p.wy-ultVista[1])>0.12)){ ultVista=[p.wx,p.wy]; vista(); }
    }
    E.refrescar(); programarCuadro();
  }
  function tecla(e,k){
    if(e.ctrlKey||e.metaKey) return false;               // deshacer y rehacer los maneja el editor
    if(k==='enter'&&traza){ pulsado=false; terminar(); return true; }
    if(k==='escape'){ if(traza){ cancelar(); return true; } if(sel){ sel=null; marcarUI(); E.refrescar(); programarCuadro(); return true; } return false; }
    if(k==='backspace'&&traza){ quitarUltimo(); return true; }
    if((k==='delete')&&!traza&&sel){ borrar(sel); return true; }
    if(k==='['||k==='-'){ masAncho(-1); return true; }
    if(k===']'||k==='+'||k==='='){ masAncho(1); return true; }
    return false;
  }

  /* ---------- lo que se ve ---------- */
  function barra(w){ return '▬'.repeat(clamp(Math.round(w/0.5),1,12)); }
  function anchoMostrado(){
    if(traza) return unAncho();
    const d=sel&&datosDe(sel); return d?d.camino.params.ancho:unAncho();
  }
  function marcarUI(){
    const d=!traza&&sel?datosDe(sel):null;
    const f=d?d.camino.familia:(traza&&traza.rama?traza.padre.familia:fam), v=d?varianteDe(d):vari;
    for(const b of document.querySelectorAll('#diosCaminos .camFam')) b.classList.toggle('on',b.dataset.fam===f);
    for(const b of document.querySelectorAll('#diosCaminos .camVar')) b.classList.toggle('on',b.dataset.var===v);
    const a=$e('camAncho'); if(a) a.textContent=barra(anchoMostrado());
    const t=$e('camTerminar'), x=$e('camTextura'), bo=$e('camBorrar');
    if(t) t.disabled=!traza; if(x) x.disabled=!d; if(bo) bo.disabled=!d;
  }
  const nombreFam=f=>f.replace('-',' ');
  function estado(){
    if(sel&&!datosDe(sel)) sel=null;
    if(traza){
      return '<b>Dibujando '+(traza.rama?'un ramal':nombreFam(fam))+'</b>\nSoltá el clic para terminar\n[ ] ancho · Esc: cancela';
    }
    const d=sel&&datosDe(sel);
    if(d) return '<b>Camino elegido</b> · '+nombreFam(d.camino.familia)+', '+varianteDe(d)+'\nBotones: familia, variante, ancho\nCtrl+clic: otra textura · Supr: borrar\nShift+clic sobre él: ramal';
    return '<b>Caminos</b>\nMantené el clic y arrastrá: lápiz\nClic en un camino: elegirlo\nClic derecho sobre uno: borrarlo';
  }
  const cruz=(x,y,color)=>{
    const c0=Math.round((x-camX)*CPM), r0=Math.floor((y-camY)*RPM);
    ordR=65535; layer=3; alzaR=Math.round(NV.alturaEn(x,y)*HPM); pickId=0;
    for(const [dx,dy] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) put(c0+dx,r0+dy,43,color);
    layer=0; alzaR=0;
  };
  function pintar(){
    const oro=packc(ORO[0],ORO[1],ORO[2]), vivo=packc(ORO_VIVO[0],ORO_VIVO[1],ORO_VIVO[2]);
    if(traza){
      for(const p of traza.pts) cruz(p[0],p[1],vivo);
      if(cur) cruz(cur.wx,cur.wy,oro);
      return;
    }
    const d=sel&&datosDe(sel);
    if(d) for(const p of d.puntos) cruz(p[0],p[1],vivo);
    if(cur){
      const c=bajo(cur.wx,cur.wy);
      cruz(cur.wx,cur.wy,c?vivo:oro);
    }
  }

  /* ---------- el registro en el editor ---------- */
  E.modos.caminos={
    bajar,mover,soltar,tecla,estado,pintar,
    abrir(){ marcarUI(); },
    cerrar(){ pulsado=false; traza=null; limpiarVista(); sel=null; cur=null; },
    iniciar(){
      for(const b of document.querySelectorAll('#diosCaminos .camFam')) b.addEventListener('click',()=>mudar(b.dataset.fam,null));
      for(const b of document.querySelectorAll('#diosCaminos .camVar')) b.addEventListener('click',()=>mudar(null,b.dataset.var));
      addEventListener('pointerup',soltar); addEventListener('pointercancel',soltar);
      $e('camAncMas').addEventListener('click',()=>masAncho(1));
      $e('camAncMenos').addEventListener('click',()=>masAncho(-1));
      $e('camTerminar').addEventListener('click',terminar);
      $e('camTextura').addEventListener('click',()=>{ if(sel) textura(sel); });
      $e('camBorrar').addEventListener('click',()=>{ if(sel) borrar(sel); });
      marcarUI();
    },
    /* para las pruebas */
    _estado:()=>({fam,vari,sel,trazando:!!traza,puntos:traza?traza.pts.length:0})
  };
})(window.NV);
