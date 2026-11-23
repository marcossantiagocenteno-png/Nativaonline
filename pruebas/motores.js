// El registro de motores: el contrato que cumplen luz, viento y los que vienen.
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV};');
const NV=m.NV, R=NV.motores; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const falla=f=>{ try{ f(); return false; }catch(e){ return true; } };

probar('el registro existe', !!R&&typeof R.registrar==='function');
probar('luz y viento están dados de alta', R.ids().indexOf('luz')>=0&&R.ids().indexOf('viento')>=0);
probar('los dos tienen cara de ambiente', R.conCara('ambiente').length>=2);
probar('el viento responde por la cara de ambiente', typeof R.obtener('viento').caras.ambiente(0,0,13,'pasto')==='object');
probar('un motor sin id se rechaza', falla(()=>R.registrar({})));
probar('un motor repetido se rechaza', falla(()=>R.registrar({id:'luz'})));
probar('una cara desconocida se rechaza', falla(()=>R.registrar({id:'x1',caras:{magia:()=>1}})));
probar('una cara que no es función se rechaza', falla(()=>R.registrar({id:'x2',caras:{dibujar:5}})));
probar('un estado desconocido se rechaza', falla(()=>R.registrar({id:'x3',estado:'raro'})));
const t=R.registrar({id:'prueba-pasto',estado:'pendiente',caras:{generar:()=>0}});
probar('un motor nuevo entra y se encuentra', R.obtener('prueba-pasto')===t&&R.conCara('generar').indexOf(t)>=0);
probar('el motor registrado no se puede modificar', (()=>{ try{ t.id='otro'; }catch(e){} return t.id==='prueba-pasto'; })());
probar('el catálogo lista archivo, preview y prueba', R.catalogo().some(c=>c.id==='viento'&&c.preview&&c.prueba&&c.archivo));
console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);
