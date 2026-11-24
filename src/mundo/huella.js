/* Nativa Online — HUELLA DEL MUNDO: un código que dice si dos copias del mundo son exactamente la misma.
   NV.canonico(valor): el JSON con las claves ordenadas, igual en cualquier navegador o servidor.
   NV.sha256(texto): SHA-256 en hexadecimal, escrito acá a mano para no depender de nada (el navegador y el servidor dan lo mismo).
   NV.huella(valor): sha256(canonico(valor)). El servidor la guarda con cada versión del mundo oficial y cada cliente puede
   calcular la de lo que tiene cargado: si son iguales, los datos son idénticos. Pruebas: pruebas/almacen.js */
(function(NV){
'use strict';
function canonico(v){
  if(v===null||typeof v!=='object') return JSON.stringify(v);
  if(Array.isArray(v)) return '['+v.map(x=>x===undefined?'null':canonico(x)).join(',')+']';
  const ks=Object.keys(v).filter(k=>v[k]!==undefined).sort();
  return '{'+ks.map(k=>JSON.stringify(k)+':'+canonico(v[k])).join(',')+'}';
}
/* las constantes de SHA-256 salen de las raíces de los primeros primos (así no hay 72 números escritos a mano que puedan tener un error) */
const K=[], H0=[];
(function(){ let n=2, hallados=0; while(hallados<64){ let primo=true; for(let d=2;d*d<=n;d++) if(n%d===0){ primo=false; break; }
  if(primo){ if(hallados<8) H0.push(Math.floor((Math.sqrt(n)%1)*4294967296)>>>0); K.push(Math.floor((Math.cbrt(n)%1)*4294967296)>>>0); hallados++; } n++; } })();
function utf8(s){
  const o=[];
  for(let i=0;i<s.length;i++){
    let c=s.charCodeAt(i);
    if(c>=0xd800&&c<0xdc00&&i+1<s.length){ const d=s.charCodeAt(i+1); if(d>=0xdc00&&d<0xe000){ c=0x10000+((c-0xd800)<<10)+(d-0xdc00); i++; } }
    if(c>=0xd800&&c<0xe000) c=0xfffd;                       // una mitad suelta de un par no es texto válido: como hace Node
    if(c<0x80) o.push(c);
    else if(c<0x800) o.push(0xc0|(c>>6),0x80|(c&63));
    else if(c<0x10000) o.push(0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
    else o.push(0xf0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
  }
  return o;
}
const rotd=(x,n)=>(x>>>n)|(x<<(32-n));
function sha256(texto){
  const b=utf8(String(texto)), len=b.length;
  b.push(0x80); while(b.length%64!==56) b.push(0);
  const hi=Math.floor(len/536870912), lo=(len<<3)>>>0;
  for(const w of [hi,lo]) b.push((w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255);
  const h=H0.slice(), w=new Array(64);
  for(let i=0;i<b.length;i+=64){
    for(let t=0;t<16;t++) w[t]=((b[i+4*t]<<24)|(b[i+4*t+1]<<16)|(b[i+4*t+2]<<8)|b[i+4*t+3])>>>0;
    for(let t=16;t<64;t++){
      const s0=rotd(w[t-15],7)^rotd(w[t-15],18)^(w[t-15]>>>3), s1=rotd(w[t-2],17)^rotd(w[t-2],19)^(w[t-2]>>>10);
      w[t]=(w[t-16]+s0+w[t-7]+s1)>>>0;
    }
    let [a,bb,c,d,e,f,g,hh]=h;
    for(let t=0;t<64;t++){
      const S1=rotd(e,6)^rotd(e,11)^rotd(e,25), ch=(e&f)^(~e&g), t1=(hh+S1+ch+K[t]+w[t])>>>0;
      const S0=rotd(a,2)^rotd(a,13)^rotd(a,22), mj=(a&bb)^(a&c)^(bb&c), t2=(S0+mj)>>>0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=bb; bb=a; a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+bb)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0; h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
  }
  return h.map(x=>('00000000'+x.toString(16)).slice(-8)).join('');
}
NV.canonico=canonico; NV.sha256=sha256; NV.huella=v=>sha256(canonico(v));
})(window.NV);
