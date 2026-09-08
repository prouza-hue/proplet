"""Faithful PNG-to-path-SVG conversion. Stored masters make builds reproducible."""
from pathlib import Path
import json, hashlib, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
import vtracer, cairosvg
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'public/rewards/printshop'
MASTERS=HERE/'masters'; MASTERS.mkdir(exist_ok=True)
SOURCES={'pulmesic':'exec-4781f1a7-c8e8-48b3-91d3-66933d2b16ab.png','challenge':'exec-c38b11f8-c237-449b-89c3-be8dfd4bd786.png','calm':'exec-7de2cbb5-d452-48ef-a1d0-eda2efd39e71.png'}
proof=Image.new('RGB',(640,620),'#f7f0df');d=ImageDraw.Draw(proof)
for row,(key,srcname) in enumerate(SOURCES.items()):
 master=MASTERS/(key+'.png')
 if not master.exists():
  im=Image.open(ROOT.parent/'generated_images'/srcname).convert('RGBA');bbox=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();im=im.crop(bbox);im.thumbnail((310,310),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(336,336));canvas.alpha_composite(im,((336-im.width)//2,(336-im.height)//2));canvas.save(master)
 im=Image.open(master).convert('RGBA');keyed=Image.new('RGBA',im.size);keyed.putdata([(255,0,255,255) if a<128 else (r,g,b,255) for r,g,b,a in im.getdata()]);tmp=HERE/'.tmp';tmp.mkdir(exist_ok=True);keyed.save(tmp/'key.png')
 vtracer.convert_image_to_svg_py(str(tmp/'key.png'),str(tmp/'raw.svg'),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=3,color_precision=5,layer_difference=18,corner_threshold=60,length_threshold=4,max_iterations=10,splice_threshold=45,path_precision=2)
 tree=ET.parse(tmp/'raw.svg');root=tree.getroot();root.set('viewBox','0 0 336 336');root.set('width','336');root.set('height','336')
 for p in list(root):
  fill=p.attrib.get('fill','').lstrip('#')
  if len(fill)==6:
   r,g,b=[int(fill[i:i+2],16) for i in (0,2,4)]
   if r>220 and g<80 and b>180:root.remove(p)
 ET.register_namespace('','http://www.w3.org/2000/svg');dest=OUT/(key+'.svg');tree.write(dest,encoding='unicode')
 for col,bg in enumerate(['#f7f0df','#24232b']):
  x=col*320;y=row*200;d.rectangle((x,y,x+320,y+200),fill=bg);d.text((x+10,y+8),key,fill='#808080')
  for size,dx in [(128,8),(32,170),(24,230)]:
   png=cairosvg.svg2png(url=str(dest),output_width=size,output_height=size);import io
   art=Image.open(io.BytesIO(png));proof.paste(art,(x+dx,y+40),art)
 print(key,dest.stat().st_size)
proof.save(HERE/'contact-proof.png')
(HERE/'provenance.json').write_text(json.dumps({'sources':SOURCES,'method':'Normalized 336px PNG masters, VTracer color paths; magenta key removed; no embedded bitmap'},ensure_ascii=False,indent=2)+'\n')
