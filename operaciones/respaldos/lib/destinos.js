/* Nativa Online — respaldos: a dónde van las copias. Dos destinos con la misma interfaz:
     · «carpeta:/ruta»  una carpeta (pruebas, o un segundo destino montado); escribe una vez por nombre, como un bucket con candado;
     · «b2»             Backblaze B2 (lib/b2.js), un bucket por nivel.
   Interfaz:  subir(nivel, nombre, rutaLocal) · subirTexto(nivel, nombre, texto) · listar(nivel, prefijo) · leer(nivel, nombre) · bajar(nivel, nombre, ruta)
   Los niveles son: seisHoras, diario, semanal. El destino de SUBIDA nunca necesita listar, leer ni borrar. */
'use strict';
const fs=require('fs'), path=require('path');
const {B2}=require('./b2.js');
const {hashArchivo,escribirAtomico}=require('./comun.js');

const NIVELES=['seisHoras','diario','semanal'];
const CUBOS_POR_DEFECTO={seisHoras:'nativa-seis-horas',diario:'nativa-diario',semanal:'nativa-semanal'};

function destinoCarpeta(raiz){
  const dir=nivel=>{ if(!NIVELES.includes(nivel)) throw new Error('nivel desconocido: '+nivel); return path.join(raiz,nivel); };
  const ruta=(nivel,nombre)=>{ if(nombre.includes('..')||path.isAbsolute(nombre)) throw new Error('nombre inválido'); return path.join(dir(nivel),nombre); };
  return {
    tipo:'carpeta',
    async subir(nivel,nombre,local){
      const d=ruta(nivel,nombre);
      if(fs.existsSync(d)){ if(hashArchivo(d)===hashArchivo(local)) return {nombre,repetido:true}; throw new Error('ya existe «'+nombre+'» con otro contenido (los respaldos no se pisan)'); }
      fs.mkdirSync(path.dirname(d),{recursive:true}); const tmp=d+'.tmp-'+process.pid; fs.copyFileSync(local,tmp); fs.renameSync(tmp,d);
      return {nombre};
    },
    async subirTexto(nivel,nombre,texto){
      const d=ruta(nivel,nombre);
      if(fs.existsSync(d)){ if(fs.readFileSync(d,'utf8')===texto) return {nombre,repetido:true}; throw new Error('ya existe «'+nombre+'» con otro contenido'); }
      escribirAtomico(d,texto); return {nombre};
    },
    async listar(nivel,prefijo){
      const out=[]; (function rec(rel){
        const a=path.join(dir(nivel),rel); if(!fs.existsSync(a)) return;
        for(const e of fs.readdirSync(a,{withFileTypes:true})){ const r=rel?rel+'/'+e.name:e.name;
          if(e.isDirectory()) rec(r); else if(!e.name.includes('.tmp-')&&r.startsWith(prefijo||'')){ const st=fs.statSync(path.join(dir(nivel),r)); out.push({nombre:r,subido:Math.round(st.mtimeMs),tamano:st.size,id:r}); } }
      })('');
      return out.sort((a,b)=>a.nombre<b.nombre?-1:1);
    },
    async leer(nivel,nombre){ return fs.readFileSync(ruta(nivel,nombre)); },
    async bajar(nivel,nombre,local){ fs.copyFileSync(ruta(nivel,nombre),local); }
  };
}

function destinoB2({id,clave,cubos}){
  const b=new B2({id,clave}), cubo=nivel=>{ const c=(cubos||CUBOS_POR_DEFECTO)[nivel]; if(!c) throw new Error('nivel desconocido: '+nivel); return c; };
  return {
    tipo:'b2', cliente:b, cubos:cubos||CUBOS_POR_DEFECTO,
    async subir(nivel,nombre,local){ return b.subirArchivo(cubo(nivel),nombre,local,'application/octet-stream'); },
    async subirTexto(nivel,nombre,texto){ return b.subir(cubo(nivel),nombre,Buffer.from(texto),'application/json'); },
    async listar(nivel,prefijo){ return (await b.listar(cubo(nivel),prefijo)).sort((x,y)=>x.nombre<y.nombre?-1:1); },
    async leer(nivel,nombre){ return b.descargar(cubo(nivel),nombre); },
    async bajar(nivel,nombre,local){ return b.descargarA(cubo(nivel),nombre,local); }
  };
}

/* modo: 'escritura' (la VM) o 'lectura' (vigilancia y ensayos, desde fuera de Oracle) */
function destinoDesdeEntorno(env,modo){
  const spec=env.NATIVA_RESPALDO_DESTINO||'';
  if(spec.startsWith('carpeta:')) return destinoCarpeta(path.resolve(spec.slice(8)));
  if(spec==='b2'){
    const suf=modo==='lectura'?'LECTURA':'ESCRITURA', id=env['B2_ID_'+suf], clave=env['B2_CLAVE_'+suf];
    if(!id||!clave) throw new Error('faltan B2_ID_'+suf+' y B2_CLAVE_'+suf);
    return destinoB2({id,clave,cubos:{seisHoras:env.B2_CUBO_SEIS_HORAS||CUBOS_POR_DEFECTO.seisHoras,diario:env.B2_CUBO_DIARIO||CUBOS_POR_DEFECTO.diario,semanal:env.B2_CUBO_SEMANAL||CUBOS_POR_DEFECTO.semanal}});
  }
  throw new Error('NATIVA_RESPALDO_DESTINO debe ser «b2» o «carpeta:/ruta»');
}
module.exports={destinoCarpeta,destinoB2,destinoDesdeEntorno,NIVELES,CUBOS_POR_DEFECTO};
