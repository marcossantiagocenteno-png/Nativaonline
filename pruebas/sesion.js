// Ayuda de las pruebas del servidor: entra como administrador por POST /entrar (el único camino) y devuelve la sesión.
const http=require('http');
module.exports=function sesionAdmin(puerto,clave){
  return new Promise((res,rej)=>{
    const cuerpo=JSON.stringify({clave});
    const q=http.request({host:'127.0.0.1',port:puerto,path:'/entrar',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(cuerpo)}},r=>{
      const t=[]; r.on('data',x=>t.push(x)); r.on('end',()=>{ let j=null; try{ j=JSON.parse(Buffer.concat(t).toString()); }catch(e){} if(r.statusCode===200&&j&&j.sesion) res(j.sesion); else rej(new Error('POST /entrar respondió '+r.statusCode)); });
    });
    q.on('error',rej); q.end(cuerpo);
  });
};
