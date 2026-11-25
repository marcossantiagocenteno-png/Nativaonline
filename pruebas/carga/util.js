/* Arnés de carga — utilidades comunes: azar reproducible, percentiles, lectura de /proc. Sin dependencias. */
'use strict';
const fs=require('fs');
/* mulberry32: el mismo número de semilla da siempre la misma secuencia. */
function prng(semilla){ let a=(semilla>>>0)||1; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function percentiles(v){
  if(!v.length) return {n:0};
  const a=v.slice().sort((x,y)=>x-y), q=p=>a[Math.min(a.length-1,Math.floor(a.length*p))];
  return {n:a.length,p50:+q(.5).toFixed(1),p95:+q(.95).toFixed(1),p99:+q(.99).toFixed(1),max:+a[a.length-1].toFixed(1)};
}
const media=v=>v.length?+(v.reduce((s,x)=>s+x,0)/v.length).toFixed(1):null;
const maximo=v=>v.length?+Math.max(...v).toFixed(1):null;
let CLK=null;
const ticksPorSeg=()=>{ if(CLK===null){ try{ CLK=+require('child_process').execSync('getconf CLK_TCK',{encoding:'utf8'}).trim()||100; }catch(e){ CLK=100; } } return CLK; };
/* CPU acumulada (segundos) y RSS (MB) de un proceso; null si ya no existe */
function leerProc(pid){
  try{
    const s=fs.readFileSync('/proc/'+pid+'/stat','utf8'), r=s.slice(s.lastIndexOf(')')+2).split(' ');
    const rss=+/VmRSS:\s+(\d+)/.exec(fs.readFileSync('/proc/'+pid+'/status','utf8'))[1]/1024;
    return {cpu:(+r[11]+ +r[12])/ticksPorSeg(),rss};
  }catch(e){ return null; }
}
function descendientes(pid){
  let out=[pid]; try{ const k=fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim(); if(k) for(const c of k.split(/\s+/)) out=out.concat(descendientes(+c)); }catch(e){}
  return out;
}
module.exports={prng,percentiles,media,maximo,leerProc,descendientes,ticksPorSeg};
