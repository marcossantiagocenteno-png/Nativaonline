/* Nativa Online — ALMACÉN del mundo oficial: dónde viven los datos que el código nunca toca.
   Un almacén guarda tres cosas y nada más:
     · el DIARIO: una línea por cambio del mundo (número de secuencia, hora, autor, la operación, su inversa y la huella del mundo
       que quedó). Sólo se agrega al final; nada se reescribe.
     · las INSTANTÁNEAS: el mundo entero en un número de secuencia. Nunca se pisan: una versión, una vez escrita, no cambia.
     · los RESPALDOS: copias completas de todo lo anterior, con fecha y motivo.
   No sabe nada de motores ni de cómo se aplica una operación: de eso se ocupa servidor/mundo-oficial.js. Por eso esta interfaz se puede
   cambiar por una de SQLite sin tocar el resto: lo que hace falta es cumplir el mismo contrato (pruebas/almacen.js lo exige).

   Interfaz (todo devuelve promesas, para que un almacén en base de datos entre sin cambiar a quien lo usa):
     abrirAlmacen({dir})  →  almacén
     almacén.iniciar({semilla})                   fija la semilla del mundo; si ya hay otra, falla
     almacén.meta()  ·  almacén.ultimaSeq()  ·  almacén.ultimaSeqDiario()
     almacén.registrar(entrada)                   agrega al diario (entrada.seq tiene que ser la siguiente)
     almacén.guardarInstantanea({seq,ts,motivo,semilla,huella,mundo})
     almacén.instantaneaHasta(seq)  ·  almacén.instantaneas()
     almacén.diario(desde,hasta)  ·  almacén.historial({antes,limite})
     almacén.respaldar(motivo)  ·  almacén.verificar()  ·  almacén.cerrar()

   Archivos (en dir, que NO es parte del código: se pasa por NATIVA_DATOS o se usa ./datos, que git ignora):
     meta.json · diario.ndjson · instantaneas/000000000.json … · respaldos/<fecha>-<motivo>/ · .lock
   Cada escritura va a un archivo temporal, se fuerza a disco y se renombra: o queda entera o no queda.
   Un diario cuyo último renglón quedó a medias (se cortó la luz) se repara solo: se guarda la cola cortada aparte y se sigue.
   Un renglón dañado en el medio NO se repara solo: el almacén se niega a abrir y dice cuál es. */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const FORMATO=1;
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const pad=n=>String(n).padStart(9,'0');

function escribirAtomico(ruta,texto){
  const tmp=ruta+'.tmp-'+process.pid+'-'+Date.now();
  const fd=fs.openSync(tmp,'w');
  try{ fs.writeSync(fd,texto); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
  fs.renameSync(tmp,ruta);
  try{ const d=fs.openSync(path.dirname(ruta),'r'); try{ fs.fsyncSync(d); } finally{ fs.closeSync(d); } }catch(e){ /* algunos sistemas no dejan sincronizar carpetas */ }
}
function vivo(pid){ try{ process.kill(pid,0); return true; }catch(e){ return e.code==='EPERM'; } }
const copiar=o=>JSON.parse(JSON.stringify(o));
/* el renglón del diario lleva su propia suma: así se nota un renglón alterado o cortado */
const sumaDe=e=>sha(JSON.stringify(e)).slice(0,16);
const lineaDe=e=>{ const c=copiar(e); delete c.c; return JSON.stringify(Object.assign({},c,{c:sumaDe(c)}))+'\n'; };

class AlmacenArchivos{
  constructor(dir){ this.dir=dir; this.entradas=[]; this.reparado=null; this.cerrado=false; }

  static async abrir(op){
    const dir=path.resolve(op.dir), a=new AlmacenArchivos(dir);
    fs.mkdirSync(path.join(dir,'instantaneas'),{recursive:true}); fs.mkdirSync(path.join(dir,'respaldos'),{recursive:true});
    a._tomarCandado(); try{ a._leerDiario(); a._leerInstantaneas(); }catch(e){ a._soltarCandado(); throw e; }
    return a;
  }
  _tomarCandado(){
    const f=path.join(this.dir,'.lock');
    try{ const pid=+fs.readFileSync(f,'utf8'); if(pid&&vivo(pid)) throw new Error('el almacén ya está abierto por el proceso '+pid+' ('+this.dir+')'); }catch(e){ if(e.code!=='ENOENT'&&/ya está abierto/.test(e.message)) throw e; }
    fs.writeFileSync(f,String(process.pid)); this._candado=f;
  }
  _soltarCandado(){ try{ if(this._candado) fs.unlinkSync(this._candado); }catch(e){} this._candado=null; }

  _leerDiario(){
    const f=path.join(this.dir,'diario.ndjson'); this.entradas=[];
    if(!fs.existsSync(f)) return;
    const buf=fs.readFileSync(f,'utf8'); let pos=0, n=0, ultimoBueno=0;
    while(pos<buf.length){
      const fin=buf.indexOf('\n',pos), completo=fin>=0, linea=buf.slice(pos,completo?fin:buf.length); n++;
      let e=null, bien=false;
      if(linea.trim()===''){ pos=completo?fin+1:buf.length; if(completo) ultimoBueno=pos; continue; }
      try{ e=JSON.parse(linea); const c=e.c; delete e.c; bien=completo&&c===sumaDe(e); }catch(x){ bien=false; }
      if(!bien){
        const resto=buf.slice(pos);
        if(!completo||resto.slice(linea.length).trim()===''){      // el último renglón quedó a medias: se repara
          this.reparado={linea:n,bytes:Buffer.byteLength(resto)};
          fs.writeFileSync(path.join(this.dir,'diario.cola-'+Date.now()+'.txt'),resto);
          fs.truncateSync(f,Buffer.byteLength(buf.slice(0,ultimoBueno))); return;
        }
        throw new Error('el diario está dañado en el renglón '+n+' (no es el último): no se abre para no perder nada; hay que revisarlo a mano');
      }
      const previa=this.entradas.length?this.entradas[this.entradas.length-1].seq:null;
      if(previa!==null&&e.seq!==previa+1) throw new Error('el diario salta del '+previa+' al '+e.seq+' en el renglón '+n);
      this.entradas.push(e); pos=fin+1; ultimoBueno=pos;
    }
  }
  _leerInstantaneas(){
    const d=path.join(this.dir,'instantaneas'); this._snaps=[];
    for(const nom of fs.readdirSync(d).sort()){
      if(!/^\d{9}\.json$/.test(nom)) continue;
      const seq=+nom.slice(0,9); let cab=null;
      try{ const s=JSON.parse(fs.readFileSync(path.join(d,nom),'utf8')); cab={seq:s.seq,ts:s.ts,motivo:s.motivo,huella:s.huella}; }catch(e){ throw new Error('la instantánea '+nom+' no se puede leer: '+e.message); }
      if(cab.seq!==seq) throw new Error('la instantánea '+nom+' dice ser la '+cab.seq);
      this._snaps.push(cab);
    }
  }
  _ver(){ if(this.cerrado) throw new Error('el almacén está cerrado'); }

  async meta(){ const f=path.join(this.dir,'meta.json'); return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null; }
  async iniciar({semilla}){
    this._ver(); const m=await this.meta();
    if(m){ if(m.semilla!==semilla) throw new Error('este almacén es del mundo de la semilla "'+m.semilla+'", no de "'+semilla+'"'); return m; }
    const nuevo={formato:FORMATO,semilla,creado:Date.now()}; escribirAtomico(path.join(this.dir,'meta.json'),JSON.stringify(nuevo,null,1)); return nuevo;
  }
  async ultimaSeqDiario(){ return this.entradas.length?this.entradas[this.entradas.length-1].seq:0; }
  async ultimaSeq(){ return Math.max(await this.ultimaSeqDiario(),this._snaps.length?this._snaps[this._snaps.length-1].seq:0); }

  async registrar(e){
    this._ver(); const sig=(await this.ultimaSeqDiario())+1;
    if(e.seq!==sig) throw new Error('el diario espera el cambio '+sig+' y llegó el '+e.seq);
    const l=lineaDe(e), fd=fs.openSync(path.join(this.dir,'diario.ndjson'),'a');
    try{ fs.writeSync(fd,l); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
    const c=copiar(e); delete c.c; this.entradas.push(c);
  }
  async guardarInstantanea(s){
    this._ver(); const f=path.join(this.dir,'instantaneas',pad(s.seq)+'.json'), cab={seq:s.seq,ts:s.ts,motivo:s.motivo,huella:s.huella};
    const ya=this._snaps.find(x=>x.seq===s.seq);
    if(ya){ if(ya.huella!==s.huella) throw new Error('la versión '+s.seq+' ya existe con otro contenido: una versión guardada no se cambia'); return; }
    escribirAtomico(f,JSON.stringify({formato:FORMATO,seq:s.seq,ts:s.ts,motivo:s.motivo,semilla:s.semilla,huella:s.huella,mundo:s.mundo}));
    this._snaps.push(cab); this._snaps.sort((a,b)=>a.seq-b.seq);
  }
  async instantaneas(){ return this._snaps.map(copiar); }
  async instantaneaHasta(seq){
    let el=null; for(const s of this._snaps) if(s.seq<=seq) el=s; if(!el) return null;
    return JSON.parse(fs.readFileSync(path.join(this.dir,'instantaneas',pad(el.seq)+'.json'),'utf8'));
  }
  async diario(desde,hasta){ return this.entradas.filter(e=>e.seq>desde&&e.seq<=hasta).map(copiar); }
  async historial({antes,limite}={}){
    const tope=antes==null?Infinity:antes, out=[];
    for(let i=this.entradas.length-1;i>=0&&out.length<(limite||50);i--){ const e=this.entradas[i]; if(e.seq>=tope) continue;
      const r={seq:e.seq,ts:e.ts,autor:e.autor,t:e.t,h:e.h}; if(e.t==='op') r.op=e.op&&e.op.t; if(e.desde!=null) r.desde=e.desde; if(e.motivo) r.motivo=e.motivo; out.push(r); }
    return out;
  }
  async respaldar(motivo){
    this._ver(); const t=new Date().toISOString().replace(/[:.]/g,'-'), limpio=String(motivo||'respaldo').replace(/[^a-zA-Z0-9áéíóúñ_-]+/g,'-').slice(0,40);
    let dest=path.join(this.dir,'respaldos',t+'-'+limpio), i=1; while(fs.existsSync(dest)) dest=path.join(this.dir,'respaldos',t+'-'+limpio+'-'+(i++));
    fs.mkdirSync(path.join(dest,'instantaneas'),{recursive:true});
    for(const nom of ['meta.json','diario.ndjson']){ const o=path.join(this.dir,nom); if(fs.existsSync(o)) fs.copyFileSync(o,path.join(dest,nom)); }
    for(const nom of fs.readdirSync(path.join(this.dir,'instantaneas'))) if(/^\d{9}\.json$/.test(nom)) fs.copyFileSync(path.join(this.dir,'instantaneas',nom),path.join(dest,'instantaneas',nom));
    return dest;
  }
  async verificar(){
    const problemas=[];
    try{ this._leerDiario(); }catch(e){ problemas.push(e.message); }
    for(const s of this._snaps){
      try{ const o=JSON.parse(fs.readFileSync(path.join(this.dir,'instantaneas',pad(s.seq)+'.json'),'utf8'));
        if(o.seq!==s.seq||typeof o.huella!=='string'||!o.mundo) problemas.push('la instantánea '+s.seq+' está incompleta'); }
      catch(e){ problemas.push('la instantánea '+s.seq+' no se puede leer'); }
    }
    return {ok:!problemas.length,problemas,entradas:this.entradas.length,instantaneas:this._snaps.length};
  }
  async cerrar(){ if(this.cerrado) return; this.cerrado=true; this._soltarCandado(); }
}

async function abrirAlmacen(op){
  const tipo=(op&&op.tipo)||'archivos';
  if(tipo==='archivos') return AlmacenArchivos.abrir(op);
  throw new Error('almacén "'+tipo+'" desconocido (hoy: archivos; después: sqlite)');
}
const DIR_POR_DEFECTO=()=>process.env.NATIVA_DATOS||path.resolve(__dirname,'..','datos');
module.exports={abrirAlmacen,DIR_POR_DEFECTO,FORMATO};
