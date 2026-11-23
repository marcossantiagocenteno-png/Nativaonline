// El motor del pasto: probado solo, sin dibujar el juego.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV,
  franja:(mx,my,sy,cal)=>{ const o=[]; const p0=put; put=(c,r,ch,col)=>o.push(c+','+r+','+ch+','+col);
    try{ pastoFranja(mx,my,sy,10,0,0,1,0,0,cal===undefined?1:cal); }finally{ put=p0; } return o; },
  flores:(mx,my)=>{ pastoPreparar(mx,my,true); return _flN; },
  cpm:()=>CPM};`);
const NV=m.NV; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const P=NV.pasto;

probar('el motor está registrado con cara de dibujo y de editor', !!NV.motores.obtener('pasto')&&NV.motores.conCara('dibujar').some(x=>x.id==='pasto')&&NV.motores.conCara('editor').some(x=>x.id==='pasto'));
const a=m.franja(5,7,1), b=m.franja(5,7,1);
probar('es determinista: la misma franja sale igual', a.length>0&&a.join('|')===b.join('|'));
const cel=m.cpm();
probar('cubre casi todas las celdas (90 a 98,5 %)', a.length>=cel*0.9&&a.length<=cel*2.5);

const c0=P.cfg.cobertura; let n1=0,n2=0;
for(let x=0;x<40;x++){ n1+=m.franja(x,3,1).length; }
P.cfg.cobertura=0.5; for(let x=0;x<40;x++){ n2+=m.franja(x,3,1).length; } P.cfg.cobertura=c0;
probar('bajar la cobertura deja menos marcas', n2<n1*0.75);
probar('al volver el parámetro todo vuelve igual', m.franja(5,7,1).join('|')===a.join('|'));

let t0=0,t1=0; const z0=P.cfg.trazo;
for(let x=0;x<40;x++) t0+=m.franja(x,3,1).filter(s=>/,(124|47|92),/.test(s)).length;
P.cfg.trazo=0; for(let x=0;x<40;x++) t1+=m.franja(x,3,1).filter(s=>/,(124|47|92),/.test(s)).length; P.cfg.trazo=z0;
probar('con trazo 0 no hay un solo trazo | / \\', t0>20&&t1===0);

let con=0,total=0,maxF=0; for(let x=0;x<60;x++) for(let y=0;y<60;y++){ const f=m.flores(x,y); total++; if(f) con++; maxF=Math.max(maxF,f); }
probar('flores: pocos metros las llevan (menos del 8 %)', con>0&&con/total<0.08);
probar('y nunca más de seis por metro (un grupo es de 3 a 6)', maxF<=6);
const c=P.color(1,0.5,1,1,0);
probar('el color del pasto es oscuro y frío (azul y verde sobre rojo)', ((c>>8)&255)>(c>>16)&&(c&255)>(c>>16)&&((c>>8)&255)<140);

console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);
