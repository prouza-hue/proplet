from pathlib import Path
import json,xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import vtracer,cairosvg
ROOT=Path(__file__).resolve().parents[2];W=ROOT.parent/'printshop-expansion';O=ROOT/'public/assets/avatars/v3';im=Image.open(ROOT.parent/'generated_images/exec-81913ec0-acc0-4ef2-b487-6c3844cb08b9.png').convert('RGB')
names=[('jednorozec','Jednorožec','🦄✨'),('lebka','Lebka a hnáty','☠️'),('radioaktivita','Radioaktivita','☢️'),('kyticka','Kytička','🌺'),('ufo','UFO','🛸'),('mimozemstan','Mimozemšťan','👽'),('bomba','Bomba','💣'),('dablik','Ďáblík','😈'),('robot','Robot','🤖'),('blesk','Blesk','🌩️')]
man=json.loads((O/'manifest.json').read_text());man['avatars']=man['avatars'][:30];N='http://www.w3.org/2000/svg';ET.register_namespace('',N)
for j,(slug,name,token) in enumerate(names):
 id=j+31;file=f'{id}-{slug}.svg';x=j%5;y=j//5;c=im.crop((round(x*im.width/5),95 if y==0 else 445,round((x+1)*im.width/5),445 if y==0 else 810));a=np.asarray(c);mask=a.min(2)<225;lab,n=ndi.label(mask);sz=np.bincount(lab.ravel());sz[0]=0;mask=ndi.binary_fill_holes(lab==sz.argmax());rgba=c.convert('RGBA');rgba.putalpha(Image.fromarray(np.uint8(mask)*255));rgba=rgba.crop(rgba.getbbox()).resize((512,512),Image.Resampling.LANCZOS);rgba.save(W/'masters'/file.replace('.svg','.png'));temp=W/'avatar-input.png';rgba.save(temp)
 vtracer.convert_image_to_svg_py(str(temp),str(O/file),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=1,color_precision=6,layer_difference=8,corner_threshold=60,length_threshold=3.5,max_iterations=10,splice_threshold=45,path_precision=3)
 root=ET.parse(O/file).getroot();root.set('viewBox','0 0 512 512');g=ET.Element('{'+N+'}g',{'clip-path':'url(#medallion)'});children=list(root);[root.remove(v) for v in children];g.extend(children);defs=ET.SubElement(root,'{'+N+'}defs');cl=ET.SubElement(defs,'{'+N+'}clipPath',{'id':'medallion'});ET.SubElement(cl,'{'+N+'}circle',{'cx':'256','cy':'256','r':'256'});root.append(g);ET.ElementTree(root).write(O/file,encoding='utf-8',xml_declaration=True)
 cairosvg.svg2png(url=str(O/file),write_to=str(W/'renders'/file.replace('.svg','.png')),output_width=192,output_height=192)
 man['avatars'].append(dict(id=id,name=name,slug=f'{id}-{slug}',file=file,category='playful',token=token));print(file,flush=True)
man['count']=40;man['package']='proplet-printshop-40';(O/'manifest.json').write_text(json.dumps(man,ensure_ascii=False,indent=2)+'\n')
