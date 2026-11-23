/* Nativa Online — PUENTE entre el juego y el motor de rocas (NV.rocoso).
   El motor no sabe que existe el juego: recibe un `put` y unas medidas. Acá se le entregan las del juego
   (cámara, búfer, altura del terreno, bruma) para dibujar los objetos {k:'rocoso', r:receta} que el Modo Dios
   coloca. Una receta = una roca o una formación; la forma sale del motor, nunca de este archivo.
   Se cachea el sólido de cada receta (la roca se calcula una vez; el motor cachea además su imagen por luz). */
(function(NV){
  const cache=new Map();
  function sólido(r){
    const k=JSON.stringify(r); let S=cache.get(k);
    if(!S){ if(cache.size>160) cache.clear(); S=r.tipo?NV.rocoso.crearFormacion(r):NV.rocoso.crearRoca(r); cache.set(k,S); }
    return S;
  }
  /* la sombra proyectada oscurece sólo el suelo ya pintado de esta fila y las de atrás (nunca un objeto ni un personaje) */
  function sombrear(c,r,k){
    if(c<0||c>=cols) return;
    r+=liftR-alzaR-(usaCol?colAlza[c]:0);
    if(r<0||r>=rowsN) return;
    const i=r*cols+c; if(!fbG[i]||fbL[i]>0) return;
    const f=1-k, v=fbC[i]; fbC[i]=packc(((v>>16)&255)*f,((v>>8)&255)*(f+0.02),(v&255)*(f+0.05));
  }
  function ctxBase(tr,t,haze,bc,br,x,y){
    return {x,y,t,CPM,HPM,RPM,bc,br,put,cols,haze,contorno:true,pasto:0.35,rmin:-100000,sombrear};
  }
  NV.dibujarRocoso=function(tr,haze,t){
    const R=NV.rocoso; if(!R||!tr.r) return;
    const S=sólido(tr.r);
    const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1;
    if(S.tipo==='formacion'){
      const izq=bc-Math.round(S.W*CPM/2);
      if(izq>cols+8||izq+S.W*CPM<-8) return;
      const ctx=ctxBase(tr,t,haze,izq,br,tr.x,tr.y);
      ctx.ventana=[-izq-6,cols-izq+6];
      R.pintarSombra(S,ctx); R.pintarFormacion(S,ctx);
      if(S.spec.pie!==false) for(const e of R.pieDe(S)){
        const cE=izq+Math.round(e.x*CPM); if(cE<-4*CPM||cE>cols+4*CPM) continue;
        const c2=ctxBase(tr,t,haze,cE,br+Math.round(e.y*RPM),tr.x-S.W/2+e.x,tr.y+e.y);
        R.pintarSombra(e.S,c2); R.pintar(e.S,c2);
      }
      return;
    }
    const ancho=(S.box.umax-S.box.umin)*CPM;
    if(bc+ancho<-8||bc-ancho>cols+8) return;
    const ctx=ctxBase(tr,t,haze,bc,br,tr.x,tr.y);
    R.pintarSombra(S,ctx); R.pintar(S,ctx);
  };
  /* para pruebas y para el editor: la receta ya resuelta */
  NV.rocosoSolido=sólido;
})(window.NV);
