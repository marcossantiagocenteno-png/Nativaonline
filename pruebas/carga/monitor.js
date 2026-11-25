/* Arnés de carga — monitor de recursos. Cada `cada` ms lee /proc del servidor y, aparte, de un grupo de procesos «respaldo» (el proceso y todos
   sus descendientes: respaldar.js lanza hijos para auditar, comprimir y cifrar). Guarda una serie con tiempo; no promedia nada por su cuenta.
   LÍMITE CONOCIDO: la CPU de un hijo que termina entre dos muestras no se ve (se pierde la última fracción de su consumo); el pico de RSS del
   respaldo se muestrea a 100 ms por defecto, no es exacto al instante. Si hay cuota de CPU (cgroup v1) también guarda cuántas veces se frenó. */
'use strict';
const fs=require('fs'), {leerProc,descendientes}=require('./util.js');
class Monitor{
  constructor({pidServidor,cada,cgroup}){ this.pid=pidServidor; this.cada=cada||500; this.cgroup=cgroup||null; this.serie=[]; this.respaldoPid=null; this.picoRespaldo={rssSumado:0,porProceso:{}}; this.cpuRespaldo=0; this.prev=null; }
  marcarRespaldo(pid){ this.respaldoPid=pid; }
  soltarRespaldo(){ this.respaldoPid=null; }
  muestrear(){
    const t=Date.now(), s=leerProc(this.pid); if(!s) return;
    let rssR=0, cpuR=0; const nuevos={};
    if(this.respaldoPid){
      for(const p of descendientes(this.respaldoPid)){ const r=leerProc(p); if(!r) continue; rssR+=r.rss; cpuR+=r.cpu; nuevos[p]=r.cpu;
        let nom='?'; try{ nom=/Name:\s+(\S+)/.exec(fs.readFileSync('/proc/'+p+'/status','utf8'))[1]; }catch(e){} this.picoRespaldo.porProceso[nom]=Math.max(this.picoRespaldo.porProceso[nom]||0,r.rss); }
      this.picoRespaldo.rssSumado=Math.max(this.picoRespaldo.rssSumado,rssR);
    }
    let cpuRespNuevo=0; if(this.prev&&this.prev.hijos) for(const p in nuevos) cpuRespNuevo+=Math.max(0,nuevos[p]-(this.prev.hijos[p]||0));
    const dt=this.prev?(t-this.prev.t)/1000:null;
    const punto={t,srvCpuPct:dt?+(100*(s.cpu-this.prev.srvCpu)/dt).toFixed(1):null,srvRssMB:+s.rss.toFixed(1),respRssMB:+rssR.toFixed(1),respCpuPct:dt&&this.respaldoPid?+(100*cpuRespNuevo/dt).toFixed(1):0};
    if(this.cgroup){ try{ const st=fs.readFileSync(this.cgroup+'/cpu.stat','utf8'); punto.frenos=+/nr_throttled\s+(\d+)/.exec(st)[1]; punto.frenoMs=Math.round(+/throttled_time\s+(\d+)/.exec(st)[1]/1e6); }catch(e){} }
    this.serie.push(punto); this.prev={t,srvCpu:s.cpu,hijos:nuevos};
  }
  iniciar(){ this.muestrear(); this.iv=setInterval(()=>this.muestrear(),this.cada); this.pico=setInterval(()=>{ if(this.respaldoPid){ let r=0; for(const p of descendientes(this.respaldoPid)){ const x=leerProc(p); if(x) r+=x.rss; } this.picoRespaldo.rssSumado=Math.max(this.picoRespaldo.rssSumado,r); } },100); }
  detener(){ clearInterval(this.iv); clearInterval(this.pico); }
}
module.exports={Monitor};
