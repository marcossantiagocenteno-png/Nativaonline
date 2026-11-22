"""Convierte un pack ascii-sprite-v1 en una hoja de imagen + manifiesto JS.

   Por qué imagen y no ASCII: el pack viene dibujado a un solo tamaño —44 filas
   de alto— y al achicarlo el ASCII se deshace, porque un glifo no se promedia.
   Guardando la IMAGEN que hay detrás, el motor convierte a glifos en el
   momento, al tamaño que haga falta. Una celda del pack es un píxel de la hoja,
   con el color pesado por cuánta tinta pone su glifo.

   La clave está en separar DOS cosas que el ASCII trae pegadas: el COLOR de la
   celda y la COBERTURA de su glifo —cuánta tinta pone, de un punto a una
   arroba—. El color va en RGB y la cobertura en el canal alfa. Así, al achicar,
   el color se promedia pesado por su cobertura y el glifo lo elige la cobertura
   promedio. Si se hornea la tinta dentro del color, como hice primero, la
   figura se oscurece dos veces y al convertirla queda un boceto apagado.

   De paso se corrige lo que el pack trae flojo: está muy oscuro. Una curva de
   tono levanta los claros y deja los oscuros donde están, así la figura se
   despega del fondo negro.

   Uso:  python3 pack2hoja.py entrada.json nombre salida.js
"""
import json, sys, base64, io
from PIL import Image, ImageDraw, ImageFont

ENTRADA, NOMBRE, SALIDA = sys.argv[1], sys.argv[2], sys.argv[3]
FT='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
d=json.load(open(ENTRADA))
pal=d['palette']; R,C=d['grid']['rows'],d['grid']['cols']
anc=d.get('anchor',{'col':C//2,'row':R-2})

F0=ImageFont.truetype(FT,13); _t={}
def tinta(g):
    """cuánta tinta pone un glifo, de 0 a 1. Se mide dibujándolo una vez."""
    if g in _t: return _t[g]
    im=Image.new('L',(7,14),0); ImageDraw.Draw(im).text((0,-1),g,font=F0,fill=255)
    _t[g]=sum(im.tobytes())/(7*14*255); return _t[g]

def curva(rgb):
    """Levanta los claros sin tocar los oscuros: la figura tiene que despegarse
       del fondo negro, pero sin aplanarse."""
    out=[]
    for v in rgb:
        x=v/255.0
        x=x**0.70*1.22
        out.append(max(0,min(255,int(x*255))))
    return out

# 1. la caja que cubre todos los cuadros de todas las animaciones
r0,r1,c0,c1=R,0,C,0
for k,A in d['animations'].items():
    for fr in A['frames']:
        for r,row in enumerate(fr['color']):
            for i in range(0,len(row),2):
                if int(row[i:i+2],16):
                    c=i//2
                    r0=min(r0,r); r1=max(r1,r); c0=min(c0,c); c1=max(c1,c)
AN,AL=c1-c0+1, r1-r0+1

# 2. una tira: una fila por animación, un cuadro por columna
anims=sorted(d['animations'])
NF=max(len(d['animations'][k]['frames']) for k in anims)
hoja=Image.new('RGBA',(AN*NF, AL*len(anims)),(0,0,0,0))
px=hoja.load()
for ia,k in enumerate(anims):
    for f,fr in enumerate(d['animations'][k]['frames']):
        ch,co=fr['chars'],fr['color']
        for r in range(r0,r1+1):
            for c in range(c0,c1+1):
                i=int(co[r][c*2:c*2+2],16)
                if not i: continue
                v=curva(pal[i-1])
                # el piso de cobertura no puede ser bajo 
                a=int(255*(0.42+0.58*tinta(ch[r][c])))
                px[f*AN+(c-c0), ia*AL+(r-r0)]=(v[0],v[1],v[2],a)

buf=io.BytesIO(); hoja.save(buf,'PNG',optimize=True)
b64=base64.b64encode(buf.getvalue()).decode()

man={
 'nombre':NOMBRE,
 'ancho':AN, 'alto':AL, 'cuadros':NF,
 # dónde caen los pies dentro de la caja recortada
 'pieX':anc['col']-c0, 'pieY':anc['row']-r0,
 'anims':{k:{'fila':i,'n':len(d['animations'][k]['frames']),
             'fps':d['animations'][k].get('fps',8)} for i,k in enumerate(anims)}
}
js=('/* Nativa Online — arte de '+NOMBRE+'. Generado por taller/pack2hoja.py.\n'
    '   NO editar a mano: se regenera del pack original.\n'
    '   Es una IMAGEN, no ASCII: el motor la convierte a glifos al tamaño que\n'
    '   haga falta. Ver src/motor/sprites.js. */\n'
    'NV.ARTE=NV.ARTE||{};\n'
    'NV.ARTE["'+NOMBRE+'"]='+json.dumps(man,ensure_ascii=False)+';\n'
    'NV.ARTE["'+NOMBRE+'"].png="data:image/png;base64,'+b64+'";\n')
open(SALIDA,'w').write(js)
print('hoja', hoja.size, '·', len(anims), 'animaciones ×', NF, 'cuadros')
print('caja recortada', AN,'x',AL, '· pies en', man['pieX'], man['pieY'])
print('escrito', SALIDA, round(len(js)/1024), 'KB')
