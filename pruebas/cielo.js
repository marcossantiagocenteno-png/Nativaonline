// Recorre un día de juego entero y verifica sol, sombras, luz y lunas.
const cargar=require('./cargar.js');
const NV=cargar();
const D=NV.DIA_MS;
console.log('hora          sol    sombra        luz   lunas');
for(let i=0;i<=12;i++){
  const c=NV.actualizarCielo(i*D/12);
  const dir = c.sombra.porMetro<0.02 ? '—'
    : (Math.abs(c.sombra.dy)>Math.abs(c.sombra.dx) ? (c.sombra.dy<0?'norte':'sur')
                                                   : (c.sombra.dx<0?'oeste':'este'));
  console.log(
    String((i*2).toString().padStart(2,'0')+':00 '+c.nombre).padEnd(26),
    String(Math.round(c.elev)+'°').padStart(4),
    (dir+' x'+c.sombra.porMetro.toFixed(1)).padEnd(13),
    c.luz.amb.toFixed(2).padStart(5),
    ' '+c.lunas.brillo.toFixed(2));
}
// las sombras del mundo cambian de lado entre la mañana y la tarde
const w=NV.build(NV.CONFIG);
function perfil(fase){
  NV.actualizarCielo(fase*D); NV.calcularSombras(w);
  let s=0; for(let i=0;i<w.shade.length;i++) s+=w.shade[i];
  return s/w.shade.length;
}
const m=perfil(0.30), n=perfil(0.50), t=perfil(0.70), noche=perfil(0.95);
console.log('\nsombra media del mundo (1 = sin sombra):');
console.log('  amanecer', m.toFixed(3), '· mediodía', n.toFixed(3), '· tarde', t.toFixed(3), '· noche', noche.toFixed(3));
// conjunción de lunas: ¿cada cuánto?
let conj=0, dias=0;
for(let d=0; d<360; d++){ const c=NV.actualizarCielo(d*D); if(c.lunas.mayor>0.9&&c.lunas.menor>0.9){conj++;} dias++; }
console.log('\ndías del año con las dos lunas casi llenas:', conj, 'de', dias);
