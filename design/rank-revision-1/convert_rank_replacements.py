"""Reproducibly trace the five rank replacement PNG masters into path-only SVGs.
Background removal is limited to achromatic connected regions; source artwork is untouched.
"""
from pathlib import Path
import hashlib, json, xml.etree.ElementTree as ET, argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import vtracer, cairosvg

ROOT = Path(__file__).resolve().parents[2]
SRC = Path('/workspace/scratch/deef776315b0/generated_images')
OUT = ROOT/'public/rewards/printshop'
HERE = ROOT/'design/rank-revision-1'
TARGETS = {
 'rank-14':'exec-299def4e-0343-4d34-8f95-d5f9cc60c470.png',
 'rank-16':'exec-8bf8175a-5444-4490-9b60-ea67732d0080.png',
 'rank-24':'exec-30fe8b90-a138-47a1-b0bc-f8e61829c9f1.png',
 'rank-31':'exec-0c7b9106-dfab-4cd8-941c-b39b0c8473f0.png',
 'rank-32':'exec-9406efd3-c6a5-48c3-a296-0a81b9c6bb92.png',
}
NS='http://www.w3.org/2000/svg'; ET.register_namespace('',NS)

def foreground(im):
    a=np.asarray(im)
    if a.shape[2] == 4:
        # Preserve the alpha silhouette while dropping isolated generator specks.
        alpha = a[:,:,3] > 0
        labels,n = ndi.label(alpha, structure=np.ones((3,3),bool))
        sizes = np.bincount(labels.ravel())
        return alpha & (sizes[labels] > 25)
    rgb=a[:,:,:3].astype(np.int16)
    chroma=rgb.max(2)-rgb.min(2)
    # The generated RGB sheets use a gray checkerboard. Remove only achromatic
    # pixels, including enclosed holes; warm ivory remains chromatic (R > G).
    ach=np.max(rgb,2)-np.min(rgb,2) <= 8
    labels,n=ndi.label(ach, structure=np.ones((3,3),bool))
    sizes=np.bincount(labels.ravel())
    remove=(labels>0) & (sizes[labels] > 25)
    # Tiny neutral antialias fragments at the contour are retained as artwork.
    return ~remove

def normalize_source(key, filename):
    im=Image.open(SRC/filename)
    arr=np.asarray(im.convert('RGBA')).copy()
    fg=foreground(im)
    if key == "rank-16":
        labels,n=ndi.label(fg & (arr[:,:,3]>128))
        sizes=np.bincount(labels.ravel());sizes[0]=0
        fg &= ndi.binary_dilation(labels==sizes.argmax(),iterations=2)
    arr[:,:,3]=np.where(fg,arr[:,:,3],0)
    cut=Image.fromarray(arr,'RGBA').crop(Image.fromarray(arr[:,:,3]).getbbox())
    cut.thumbnail((300,300),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(336,336),(0,0,0,0))
    canvas.alpha_composite(cut,((336-cut.width)//2,(336-cut.height)//2))
    master=HERE/'masters'/f'{key}.png'; master.parent.mkdir(parents=True,exist_ok=True); canvas.save(master)
    return im, master

def make_svg(key, filename, extract=False):
    source_path=SRC/filename
    previous={r["key"]:r for r in json.loads((HERE/"provenance.json").read_text())} if (HERE/"provenance.json").exists() else {}
    source_mode=Image.open(source_path).mode if source_path.exists() else previous[key]["source_mode"]
    master=HERE/'masters'/f'{key}.png'
    if extract or not master.exists():
        im, master = normalize_source(key, filename)
    else:
        im=Image.open(master)
    canvas=Image.open(master).convert('RGBA')
    out=OUT/f'{key}.svg'; tmp=HERE/f'.{key}-trace-input.png'; canvas.save(tmp)
    vtracer.convert_image_to_svg_py(str(tmp),str(out), colormode='color', hierarchical='stacked', mode='spline', filter_speckle=1, color_precision=6, layer_difference=8, corner_threshold=60, length_threshold=3.5, max_iterations=10, splice_threshold=45, path_precision=3)
    root=ET.parse(out).getroot(); root.set('viewBox','0 0 336 336'); root.set('width','336'); root.set('height','336'); ET.ElementTree(root).write(out,encoding='utf-8',xml_declaration=True)
    tmp.unlink()
    # Light/dark swatches in one proof sheet, rendered at requested sizes.
    light=HERE/'renders'/f'{key}-light-192.png'; dark=HERE/'renders'/f'{key}-dark-192.png'
    cairosvg.svg2png(url=str(out),write_to=str(light),output_width=192,output_height=192,background_color='#f7f4ee')
    cairosvg.svg2png(url=str(out),write_to=str(dark),output_width=192,output_height=192,background_color='#18202a')
    digest=hashlib.sha256(source_path.read_bytes()).hexdigest() if source_path.exists() else previous[key]['source_sha256']
    return {'key':key,'source_png':filename,'source_sha256':digest,'source_mode':source_mode,'master_png':str(master.relative_to(ROOT)),'svg':str(out.relative_to(ROOT))}

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--extract',action='store_true',help='rebuild normalized masters from generated source PNGs'); args=ap.parse_args()
    records=[make_svg(k,f,args.extract) for k,f in TARGETS.items()]
    (HERE/'provenance.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
    manifest_path=OUT/'manifest.json'; manifest=json.loads(manifest_path.read_text())
    for rec in records:
        old=manifest[rec['key']]
        old.update({'source_png':rec['source_png'],'source_sha256':rec['source_sha256'],'source_mode':rec['source_mode'],'revision':'rank-revision-1'})
        old.pop('source_sheet',None); old.pop('cell',None)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
