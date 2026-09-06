"""Compose the share card from the unchanged logo and an authentic game capture."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
S=2
im=Image.new('RGB',(1200*S,630*S),'#F7F2E6')
d=ImageDraw.Draw(im)
def box(xy,fill,r=0):
    coords=tuple(int(v*S) for v in xy)
    if r:d.rounded_rectangle(coords,radius=r*S,fill=fill)
    else:d.rectangle(coords,fill=fill)
def text(x,y,value,size,color,font='DejaVuSans.ttf'):
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+font,size*S)
    d.text((x*S,y*S),value,font=f,fill=color,stroke_width=0)
box((0,0,1200,9),'#2556B8')
mark=Image.open(ROOT/'public/brand/mark-master.png').convert('RGBA')
mark.thumbnail((116*S,116*S),Image.Resampling.LANCZOS)
im.paste(mark,(46*S,49*S),mark)
text(178,62,'Proplet',67,'#25252D','DejaVuSerif-Bold.ttf')
text(182,145,'ČESKÁ SLOVNÍ HRA',16,'#665E57')
text(48,242,'Rozpleť si',65,'#25252D','DejaVuSans-Bold.ttf')
text(48,316,'hlavu.',65,'#2556B8','DejaVuSans-Bold.ttf')
text(51,424,'Najdi slova.',27,'#38363A')
text(51,463,'Propleť celou plochu.',27,'#38363A')
text(51,566,'hrajproplet.cz',24,'#2556B8','DejaVuSans-Bold.ttf')
# Uniform scale of a real screenshot; never repaint, relabel or fabricate cells.
box((618,46,1180,608),'#2556B8',26)
box((618,34,1180,596),'#FFFFFF',26)
board=Image.open(ROOT/'design/brand/board-source.jpg').convert('RGB').resize((538*S,538*S),Image.Resampling.LANCZOS)
im.paste(board,(630*S,46*S))
im.resize((1200,630),Image.Resampling.LANCZOS).save(ROOT/'public/share-card.png',optimize=True)
