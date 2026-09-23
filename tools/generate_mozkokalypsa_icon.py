from PIL import Image
import numpy as np,base64,io,math,random
from pathlib import Path
root=Path(__file__).resolve().parents[1]
a=np.asarray(Image.open(root/'public/difficulty/printshop/mozkomor.webp').convert('RGBA')).copy()
# Preserve the approved painted ink texture. Warm the spiral and retain ivory highlights.
rgb=a[:,:,:3].astype(float)/255
shadow=np.array([38,27,63])/255;mid=np.array([133,60,122])/255;light=np.array([231,143,137])/255
lum=(rgb[:,:,0]*.32+rgb[:,:,1]*.44+rgb[:,:,2]*.24)
x=np.clip((lum-.09)/.66,0,1)
col=np.where((x<.5)[:,:,None],shadow+(mid-shadow)*(x*2)[:,:,None],mid+(light-mid)*((x-.5)*2)[:,:,None])
# The center remains warm white, not a new symbol.
high=(rgb.min(axis=2)>.72);col[high]=rgb[high]
a[:,:,:3]=np.uint8(np.clip(col,0,1)*255)
image=Image.fromarray(a);buf=io.BytesIO();image.save(buf,format='WEBP',quality=90)
embedded=base64.b64encode(buf.getvalue()).decode()
rng=random.Random(20260922);paths=[]
# Asymmetric, broad block-print shards: a ruptured vortex, not another round spiral.
for i,deg in enumerate([-99,-62,-21,24,65,111,155,199]):
 theta=math.radians(deg);u=np.array([math.cos(theta),math.sin(theta)]);v=np.array([-u[1],u[0]]);c=np.array([256,256]);length=[242,250,239,247,238,246,241,247][i]
 pts=[c+u*158-v*31,c+u*length-v*8,c+u*(length-13)+v*10,c+u*172+v*34]
 def d(poly):return 'M'+' L'.join(f'{p[0]:.1f} {p[1]:.1f}' for p in poly)+' Z'
 paths.append(f'<path d="{d(pts)}" fill="#30223f"/>')
 inner=[c+u*170-v*20,c+u*(length-11)-v*6,c+u*(length-30)+v*10,c+u*180+v*23]
 paths.append(f'<path d="{d(inner)}" fill="{["#AD554F","#C87259","#BE6460"][i%3]}"/>')
 facet=[c+u*178-v*20,c+u*(length-14)-v*6,c+u*(length-40)+v*2]
 paths.append(f'<path d="{d(facet)}" fill="#E4A179"/>')
 for j in range(3):
  p=c+u*(183+j*12)+v*(j*2-10);pts2=[p,p+u*15+v*2,p+u*11+v*5,p-u*3+v*3]
  paths.append(f'<path d="{d(pts2)}" fill="#F6C69E" opacity=".4"/>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="mk-title"><title id="mk-title">Mozkokalypsa — roztržený vír</title>'+''.join(paths)+f'<image href="data:image/webp;base64,{embedded}" x="60" y="60" width="392" height="392"/>'+'</svg>'
p=root/'public/difficulty/printshop/mozkokalypsa.svg';p.write_text(svg)
print('icon',p.stat().st_size)
