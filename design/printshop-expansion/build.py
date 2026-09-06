"""Faithful raster tracing. No procedural replacement drawing. Inputs kept by SHA."""
from pathlib import Path
import json,hashlib,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from scipy import ndimage as ndi
import vtracer,cairosvg
ROOT=Path(__file__).resolve().parents[2]; WORK=ROOT.parent/'printshop-expansion'; WORK.mkdir(exist_ok=True)
for d in ['masters','renders']: (WORK/d).mkdir(exist_ok=True)
G=ROOT.parent/'generated_images'; OUT=ROOT/'public/rewards/printshop'
items=json.loads((ROOT/'public/rewards/printshop/collection.json').read_text())['items']
manifest=json.loads((OUT/'manifest.json').read_text()); old={"novacek","alchymista","legenda","prvni-proplet","achievement-tajenka-10","nemesis","streak-02","tyden","streak-10","medaile","medal-2","medal-3"}
a=[x for x in items if x['category']=='achievement' and x['key'] not in old]
r=[x for x in items if x['category']=='rank' and x['key'] not in old]
tail=[x for x in items if x['category'] in ['streak','symbol'] and x['key'] not in old]
specs=[('exec-b31af56e-4b8d-4c4c-a81a-fdac8b9f7592.png',4,4,r[:16]),('exec-c8798532-645f-4993-8453-b2dcc6e76cd7.png',4,4,r[16:]),('exec-5de10bc7-1c4f-416a-9175-ac4380555a93.png',5,4,a[:20]),('exec-68907daf-73af-475f-a48f-21cecb7e6d9d.png',5,4,a[20:35]+[a[39]]+a[35:39]),('exec-8205f5bd-4162-429b-b155-1d89d540e277.png',5,4,a[40:60]),('exec-f02457d2-866c-40be-8392-71a7f777cbbc.png',5,4,a[60:80]),('exec-a3d8ee27-bbe2-44db-99c7-cf999c418b02.png',6,3,a[80:]+tail)]
assert [len(s[3]) for s in specs]==[16,16,20,20,20,20,18], [len(s[3]) for s in specs]
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS)
def trace(source,out,avatar=False):
 w,h=source.size;temp=WORK/'trace-input.png';source.save(temp)
 vtracer.convert_image_to_svg_py(str(temp),str(out),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=1,color_precision=6,layer_difference=8,corner_threshold=60,length_threshold=3.5,max_iterations=10,splice_threshold=45,path_precision=3)
 root=ET.parse(out).getroot();root.set('viewBox',f'0 0 {w} {h}')
 if avatar:
  root.set('viewBox','0 0 512 512');root.set('width','512');root.set('height','512')
  group=ET.Element('{'+NS+'}g',{'transform':f'scale({512/(w*2)})','clip-path':'url(#medallion)'});group.extend(list(root));root.clear();root.attrib.update({'viewBox':'0 0 512 512','width':'512','height':'512'})
  defs=ET.SubElement(root,'{'+NS+'}defs');clip=ET.SubElement(defs,'{'+NS+'}clipPath',{'id':'medallion'});ET.SubElement(clip,'{'+NS+'}circle',{'cx':str(w),'cy':str(h),'r':str(w)})
  root.append(group)
 ET.ElementTree(root).write(out,encoding='utf-8',xml_declaration=True)
 cairosvg.svg2png(url=str(out),write_to=str(WORK/'renders'/out.with_suffix('.png').name),output_width=192,output_height=192)
def cut(crop):
 arr=np.asarray(crop.convert('RGB')); # neutral white paper removed; colored ivory retained
 lo=arr.min(2).astype(float);hi=arr.max(2).astype(float)
 white=(lo>222)&((hi-lo)<19)
 bg=ndi.binary_propagation(np.pad(np.ones((1,1),bool),((0,crop.height-1),(0,crop.width-1))),mask=white) if False else white
 # Remove exterior neutral paper and internal white holes; preserve enclosed specular highlights.
 border=np.zeros(white.shape,bool);border[0]=white[0];border[-1]=white[-1];border[:,0]=white[:,0];border[:,-1]=white[:,-1]
 outside=ndi.binary_propagation(border,mask=white)
 mask=~outside
 labs,n=ndi.label(mask);sizes=np.bincount(labs.ravel());sizes[0]=0;edge=set(np.concatenate([labs[0],labs[-1],labs[:,0],labs[:,-1]]));edge.discard(int(sizes.argmax()));keep=np.array([i not in edge and size>25 for i,size in enumerate(sizes)]);mask=keep[labs]&(labs>0)
 rgba=crop.convert('RGBA');rgba.putalpha(Image.fromarray(np.uint8(mask)*255));return rgba.crop(rgba.getbbox())
log=[]
for filename,cols,rows,group in specs:
 im=Image.open(G/filename).convert('RGB');arr=np.asarray(im);lo=arr.min(2).astype(float);hi=arr.max(2).astype(float);white=(lo>222)&((hi-lo)<19);border=np.zeros(white.shape,bool);border[0]=white[0];border[-1]=white[-1];border[:,0]=white[:,0];border[:,-1]=white[:,-1];mask=~ndi.binary_propagation(border,mask=white);labels,n=ndi.label(mask);sizes=np.bincount(labels.ravel());centers=ndi.center_of_mass(mask,labels,range(1,n+1));assigned=[[] for _ in group];
 for lab,(cy,cx) in enumerate(centers,1):
  cell=min(rows-1,int(cy*rows/im.height))*cols+min(cols-1,int(cx*cols/im.width));
  if sizes[lab]>25:assigned[cell].append(lab)
 if filename=='exec-8205f5bd-4162-429b-b155-1d89d540e277.png':
  main=max(assigned[1],key=lambda lab:sizes[lab]);rays=[lab for lab in assigned[1] if sizes[lab]<sizes[main]*.02];assigned[0].extend(rays);assigned[1]=[lab for lab in assigned[1] if lab not in rays]
 digest=hashlib.sha256((G/filename).read_bytes()).hexdigest()
 for j,item in enumerate(group):
  key=item['key'];out=OUT/(key+'.svg')
  entry={'name':item['name'],'file':key+'.svg','source_sheet':filename,'source_sha256':digest,'cell':j,'category':item['category']}
  manifest[key]=entry;log.append(dict(key=key,**entry))
  if __import__("os").environ.get("ONLY_KEYS") and key not in __import__("os").environ["ONLY_KEYS"].split(","):continue
  if out.exists() and not __import__("os").environ.get("RETRACE"):continue
  selected=assigned[j];mask=np.isin(labels,selected);rgba=im.convert('RGBA');rgba.putalpha(Image.fromarray(np.uint8(mask)*255));rgba=rgba.crop(rgba.getbbox());rgba.thumbnail((300,300),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(336,336));canvas.alpha_composite(rgba,((336-rgba.width)//2,(336-rgba.height)//2));canvas.save(WORK/'masters'/(key+'.png'));trace(canvas,out);print(key,flush=True)
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'design/printshop-expansion/provenance.json').write_text(json.dumps(log,ensure_ascii=False,indent=2)+'\n')
