/* Arnés de carga — jugadores simulados. NO son conexiones inertes: cada uno entra con el protocolo real (hola → bienvenida con el mundo completo),
   camina por casillas libres respetando la colisión del juego (carga el mismo motor que el servidor), se detiene a ratos, cambia de dirección
   con cierta inercia, manda ping, y su sesión termina y es reemplazada por otro jugador nuevo (rotación). Opcionalmente un administrador
   edita el mundo a un ritmo dado (la única fuente de crecimiento del diario).
   Es un MODELO: sus parámetros (inercia, pausas, duración de sesión) son suposiciones declaradas, no una medición de personas reales.
   Reproducible en las DECISIONES (cada jugador tiene su propio generador con semilla); los tiempos dependen de la máquina. */
'use strict';
const path=require('path');
const RAIZ=path.resolve(__dirname,'..','..');
const WS=require(path.join(RAIZ,'servidor','node_modules','ws'));
const {cargarMundo}=require(path.join(RAIZ,'servidor','cargar-mundo.js'));
const {prng}=require('./util.js'), {edicion}=require('./mundo.js');
const PERFILES={ agrupado:{inercia:.55,pausa:.08}, mixto:{inercia:.8,pausa:.08}, disperso:{inercia:.95,pausa:.05} };
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

class Enjambre{
  /* opc: puerto, jugadores, semilla, perfil('agrupado'|'mixto'|'disperso'), sesionMediaS (0 = sin rotación), pasoMs, editor:{sesion,porMin}|null */
  constructor(opc){
    this.o=Object.assign({jugadores:25,semilla:1,perfil:'mixto',sesionMediaS:240,pasoMs:200,editor:null},opc);
    this.perfil=PERFILES[this.o.perfil]; if(!this.perfil) throw new Error('perfil desconocido: '+this.o.perfil);
    this.NV=cargarMundo(); this.mundoCargado=false; this.azar=prng(this.o.semilla); this.n=0; this.fin=false; this.bots=new Set();
    this.enviados=new Map(); this.m={lat:[],rtt:[],entrada:[],ack:[]}; this.c={conectados:0,entradas:0,caidos:0,rechazos:0,errores:{},recibidos:0,bytes:0,pasos:0,pings:0,ediciones:0,rotaciones:0};
    this.libre=(x,y)=>!!this.NV.sueloEn(x,y)&&!this.NV.solidoEn(x,y);
  }
  async iniciar(){
    for(let i=0;i<this.o.jugadores;i++){ this.nuevoBot(); if(i%20===19) await new Promise(r=>setTimeout(r,50)); }
    if(this.o.editor) this.arrancarEditor();
    this.limpieza=setInterval(()=>{ const ya=Date.now()-5000; for(const [k,t] of this.enviados) if(t<ya) this.enviados.delete(k); },2000);
  }
  nuevoBot(){
    const i=this.n++, azar=prng(this.o.semilla*100003+i), t0=Date.now(), url='ws://127.0.0.1:'+this.o.puerto;
    const b={i,azar,ws:new WS(url),me:null,dir:DIRS[Math.floor(azar()*4)],pausadoHasta:0,vivo:true,timers:[]}; this.bots.add(b);
    b.ws.on('open',()=>b.ws.send(JSON.stringify({t:'hola',v:1,token:'bot-de-carga-'+String(i).padStart(8,'0')})));
    b.ws.on('message',d=>{ this.c.recibidos++; this.c.bytes+=d.length; let m; try{ m=JSON.parse(d.toString()); }catch(e){ return; }
      if(m.t==='bienvenida'){
        this.c.entradas++; this.c.conectados++; b.entro=true; this.m.entrada.push([Date.now(),Date.now()-t0]); b.me={id:m.yo.id,x:m.yo.x,y:m.yo.y,e:m.yo.e};
        if(!this.mundoCargado&&m.mundo){ this.NV.mundo.cargar(m.mundo); this.NV.olvidarObjetos(); this.mundoCargado=true; }
        b.timers.push(setInterval(()=>this.paso(b),this.o.pasoMs*(.95+azar()*.15)), setInterval(()=>{ if(b.ws.readyState===1){ this.c.pings++; b.ws.send(JSON.stringify({t:'ping',ts:Date.now()})); } },2000));
        if(this.o.sesionMediaS>0) b.timers.push(setTimeout(()=>this.rotar(b),-Math.log(1-azar())*this.o.sesionMediaS*1000));
      }
      else if(m.t==='pos'){ this.c.rechazos++; if(b.me){ b.me.x=m.x; b.me.y=m.y; b.me.e=m.e; } }
      else if(m.t==='pong'){ this.m.rtt.push([Date.now(),Date.now()-m.ts]); }
      else if(m.t==='mov'){ if(azar()<.1){ const t=this.enviados.get(m.id+':'+m.x+':'+m.y); if(t) this.m.lat.push([Date.now(),Date.now()-t]); } }
      else if(m.t==='error'){ this.c.errores[m.codigo||m.code||'sin_codigo']=(this.c.errores[m.codigo||m.code||'sin_codigo']||0)+1; } });
    b.ws.on('close',()=>{ if(b.entro) this.c.conectados--; if(b.vivo&&!this.fin&&!b.rotando){ this.c.caidos++; } this.quitar(b); });
    b.ws.on('error',()=>{});
  }
  quitar(b){ b.vivo=false; for(const t of b.timers){ clearInterval(t); clearTimeout(t); } this.bots.delete(b); }
  rotar(b){ b.rotando=true; this.c.rotaciones++; try{ b.ws.close(); }catch(e){} setTimeout(()=>{ if(!this.fin) this.nuevoBot(); },1000+Math.floor(b.azar()*4000)); }
  paso(b){
    if(!b.me||b.ws.readyState!==1) return; const ahora=Date.now(); if(ahora<b.pausadoHasta) return;
    if(b.azar()<this.perfil.pausa/10){ b.pausadoHasta=ahora+2000+Math.floor(b.azar()*6000); return; }
    const orden=[]; if(b.azar()<this.perfil.inercia) orden.push(b.dir);
    const resto=DIRS.filter(d=>d!==b.dir).sort(()=>b.azar()-.5); orden.push(...resto, b.dir);
    for(const d of orden){ const x=b.me.x+d[0], y=b.me.y+d[1]; if(this.libre(x,y)){ b.dir=d; this.enviados.set(b.me.id+':'+x+':'+y,ahora); b.me.x=x; b.me.y=y; this.c.pasos++; b.ws.send(JSON.stringify({t:'mover',x,y,e:b.me.e})); return; } }
  }
  arrancarEditor(){
    const e=this.o.editor, azar=prng(this.o.semilla+7919), ws=new WS('ws://127.0.0.1:'+this.o.puerto), pend=new Map(); let n=0; this.editor={ws};
    ws.on('open',()=>ws.send(JSON.stringify({t:'hola',v:1,sesion:e.sesion})));
    ws.on('message',d=>{ let m; try{ m=JSON.parse(d.toString()); }catch(x){ return; }
      if(m.t==='bienvenida'){ this.editor.listo=true; this.editor.timer=setInterval(()=>{ if(ws.readyState!==1) return; const k=++n; pend.set(k,Date.now()); this.c.ediciones++; ws.send(JSON.stringify({t:'editar',n:k,op:edicion(azar)})); },60000/e.porMin); }
      else if(m.t==='ok'&&pend.has(m.n)){ this.m.ack.push([Date.now(),Date.now()-pend.get(m.n)]); pend.delete(m.n); }
      else if(m.t==='error'){ const k='editor:'+(m.codigo||m.code||'sin_codigo'); this.c.errores[k]=(this.c.errores[k]||0)+1; } });
    ws.on('error',()=>{});
  }
  detener(){ this.fin=true; clearInterval(this.limpieza); if(this.editor){ clearInterval(this.editor.timer); try{ this.editor.ws.terminate(); }catch(e){} } for(const b of [...this.bots]){ try{ b.ws.terminate(); }catch(e){} this.quitar(b); } }
}
module.exports={Enjambre,PERFILES};
