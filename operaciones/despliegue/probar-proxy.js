#!/usr/bin/env node
/* Nativa Online — comprueba, con el proxy REAL, la condición 2 de NATIVA_CONFIAR_PROXY: qué X-Forwarded-For le llega al servidor.
   Se hace UNA vez, antes de dejar el juego encendido, con el juego APAGADO (el eco ocupa su puerto 8787):
     1) en la VM:           sudo systemctl stop nativa-juego
                            node operaciones/despliegue/probar-proxy.js eco --ip-esperada <tu dirección pública>
     2) desde tu equipo:    node operaciones/despliegue/probar-proxy.js enviar https://NOMBRE.duckdns.org/prueba
     3) el eco imprime el veredicto (BIEN / FALLA / REVISAR) y termina; después:  sudo systemctl start nativa-juego
   Si da FALLA no se enciende NATIVA_CONFIAR_PROXY (se quita de la unidad): el freno usaría la dirección del proxy. */
'use strict';
const http=require('http'), https=require('https');
const {evaluar,crearEco}=require('./eco-cabeceras.js');
const FALSA='203.0.113.77';          // dirección de documentación (RFC 5737): nunca es un cliente real
const a=process.argv.slice(2), val=k=>{ const i=a.indexOf(k); return i>=0?a[i+1]:undefined; };
(async()=>{
  if(a[0]==='eco'){
    const eco=crearEco({puerto:+val('--puerto')||8787,host:'127.0.0.1'});
    try{ await eco.iniciar(); }catch(e){ console.error('no pude abrir 127.0.0.1:'+(val('--puerto')||8787)+' ('+e.code+'): ¿sigue encendido el juego? Páralo antes.'); process.exit(2); }
    console.log('eco esperando una petición en 127.0.0.1:'+(val('--puerto')||8787)+' … (desde otro equipo: probar-proxy.js enviar https://…/prueba)');
    const t=setTimeout(()=>{ console.error('nadie llegó en 10 minutos'); process.exit(2); },600000);
    const dato=await eco.primera; clearTimeout(t); const r=evaluar(dato.xff,FALSA,val('--ip-esperada'));
    console.log(JSON.stringify({recibido:dato,veredicto:r},null,1)); await eco.cerrar(); process.exit(r.ok===false?1:0);
  }
  if(a[0]==='enviar'&&a[1]){
    const u=new URL(a[1]), mod=u.protocol==='https:'?https:http;
    const r=await new Promise((ok,no)=>{ const q=mod.get(u,{headers:{'X-Forwarded-For':FALSA},timeout:15000},res=>{ res.resume(); res.on('end',()=>ok(res.statusCode)); }); q.on('error',no); q.on('timeout',()=>{ q.destroy(); no(new Error('tiempo agotado')); }); });
    console.log('enviada (respuesta '+r+') con X-Forwarded-For inventado '+FALSA+'; mira el veredicto en la VM.'); process.exit(0);
  }
  console.error('uso: probar-proxy.js eco [--ip-esperada IP] [--puerto N]   |   probar-proxy.js enviar URL'); process.exit(2);
})().catch(e=>{ console.error(e.message); process.exit(1); });
