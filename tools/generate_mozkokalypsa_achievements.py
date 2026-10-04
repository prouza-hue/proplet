"""Original, lightweight printshop vector emblems. No embedded raster or runtime animation."""
from pathlib import Path
import math,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/rewards/printshop'
SERIES=[(1,'První trhlina','První deska. První puklina v nemožném.'),(5,'Za bodem zlomu','Pětkrát dovnitř. Pětkrát ven.'),(10,'Oko bouře','Kolem zuří chaos. Ty vidíš cestu.'),(25,'Krotitel pohromy','I pohroma se dá rozplést.'),(50,'Nezlomná mysl','Padesát desek. Hlava stále drží.'),(75,'Vládce epicentra','Uprostřed největšího zmatku máš jasno.'),(100,'Poslední slovo','Mozkokalypsa skončila. Poslední slovo máš ty.')]
INK='#30283e'; COPPER='#bf7050'; GOLD='#e3b85e'; LIGHT='#fff0c9'
def path(d,fill,stroke=INK,w=4,extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round" {extra}/>'
def poly(points,fill,stroke=INK,w=4):
 return path('M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in points)+' Z',fill,stroke,w)
def circle(x,y,r,fill,stroke=INK,w=4):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>'
def pt(r,a,c=(160,153)):
 return c[0]+r*math.cos(a),c[1]+r*math.sin(a)
def star(x,y,r,fill=GOLD):
 return poly([(x,y-r),(x+r*.25,y-r*.25),(x+r,y),(x+r*.25,y+r*.25),(x,y+r),(x-r*.25,y+r*.25),(x-r,y),(x-r*.25,y-r*.25)],fill,w=2)
def spiral(cx=160,cy=153,r=41):
 out=circle(cx,cy,r+5,INK,GOLD,3)
 # A carved triple spiral is the family signature, with generous negative space.
 for k in range(3):
  points=[]
  for j in range(35):
   t=j/34;a=k*2*math.pi/3+t*3.7;rad=r*(1-.83*t)
   points.append((cx+rad*math.cos(a),cy+rad*math.sin(a)))
  out+=path('M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in points),'none',GOLD,7)
 return out+circle(cx,cy,5,LIGHT,'none',0)
def hatch(x,y,angle=0):
 return '<g transform="translate(%s %s) rotate(%s)" stroke="%s" stroke-width="2" opacity=".42">'%(x,y,angle,INK)+''.join(f'<path d="M{i*6} 0l-8 12"/>' for i in range(4))+'</g>'
def ring(r,n,stage):
 out=''
 for k in range(n):
  a=2*math.pi*k/n-math.pi/2
  points=[pt(r,a-.09),pt(r+18+(k%2)*8,a),pt(r,a+.09),pt(r-10,a)]
  out+=poly(points,GOLD if stage>3 else COPPER,w=3)
 return out
def art(stage,n,name):
 out=''
 if stage==0:
  out+=poly([(109,50),(174,36),(237,94),(243,207),(177,261),(77,222),(61,115)],COPPER,w=7)
  out+=poly([(109,50),(153,87),(130,149),(82,199),(61,115)],'#e8aa72',w=0)
  out+=poly([(185,53),(211,110),(187,178),(221,224),(243,207),(237,94)],'#844555',w=0)
  out+=path('M175 39l-28 65 34 26-50 54 15 73','none',INK,15)
  out+=path('M175 39l-25 65 36 26-48 54 13 68','none',LIGHT,4)
  out+=hatch(83,106,-20)+hatch(192,210,10)+star(67,59,12)+star(257,231,10)
 elif stage==1:
  out+=poly([(85,244),(71,125),(99,56),(160,35),(221,56),(249,125),(235,244),(193,258),(197,127),(179,95),(142,94),(123,128),(127,258)],'#bd7756',w=7)
  out+=path('M99 56l29 29-19 43 3 112M221 56l-29 29 19 43-3 112','none',GOLD,10)
  out+=path('M134 42l13 30-17 22M213 72l-28 12 13 22M76 160l33 13-30 25','none',INK,6)
  out+=poly([(119,141),(151,147),(125,179),(157,195),(130,213),(169,205),(193,184),(162,171),(195,139),(163,125)],LIGHT,w=4)
  out+=hatch(90,209)+hatch(209,117,10)+star(48,133,10)+star(272,184,14)
 elif stage==2:
  out+=ring(104,8,stage)
  for k in range(4):
   out+=f'<g transform="rotate({k*90} 160 153)">'+path('M84 78Q192 16 242 113L211 98Q157 58 113 110L121 72Z',COPPER,w=5)+'</g>'
  out+=path('M77 153Q160 72 243 153Q160 234 77 153Z',LIGHT,w=6)
  out+=spiral(r=34)+hatch(105,98,-15)+star(160,286,11)
 elif stage==3:
  out+=ring(107,10,stage)
  out+=circle(160,153,94,'#704759',INK,6)+circle(160,153,78,COPPER,GOLD,5)
  out+=spiral(r=43)
  for k in range(4):
   out+=f'<g transform="rotate({45+k*90} 160 153)">'+path('M135 69l8-23h34l8 23-13 19h-24Z',GOLD,w=5)+path('M147 53h24l5 10h-34Z',LIGHT,w=0)+'</g>'
  out+=path('M93 235l-12 36 36-13 43 20 43-20 36 13-12-36','none',INK,5)
  out+=hatch(89,134,25)
 elif stage==4:
  out+=path('M160 26L254 68V147Q251 226 160 286Q69 226 66 147V68Z',GOLD,w=7)
  out+=path('M160 45L236 79V146Q232 207 160 264Q88 207 84 146V79Z',INK,COPPER,5)
  out+=path('M160 49v209Q225 204 231 147V82Z','#51445f','none',0)
  out+=path('M160 98Q148 73 127 92Q103 88 104 113Q83 126 104 144Q94 166 117 174Q119 199 144 188L160 203L176 188Q201 199 203 174Q226 166 216 144Q237 126 216 113Q217 88 193 92Q172 73 160 98Z',COPPER,LIGHT,4)
  out+=path('M160 98v81M129 106q-18 12-2 24l-10 15M191 106q18 12 2 24l10 15M139 150q-17 3-8 19M181 150q17 3 8 19','none',INK,5)
  out+=poly([(151,139),(164,151),(187,120),(198,130),(165,176),(141,153)],GOLD,w=4)
  out+=star(48,97,11)+star(272,210,13)+hatch(144,238)
 elif stage==5:
  out+=ring(112,12,stage)
  out+=circle(160,153,99,INK,COPPER,7)+circle(160,153,82,'#573f55',GOLD,4)
  out+=f'<ellipse cx="160" cy="153" rx="120" ry="48" transform="rotate(-35 160 153)" fill="none" stroke="{INK}" stroke-width="15"/>'
  out+=f'<ellipse cx="160" cy="153" rx="120" ry="48" transform="rotate(-35 160 153)" fill="none" stroke="{GOLD}" stroke-width="8"/>'
  out+=spiral(r=45)
  for x,y in [(65,207),(255,99)]:out+=circle(x,y,12,LIGHT,INK,4)
  out+=star(160,25,15)+star(160,285,13)+hatch(116,79,-20)
 else:
  out+=ring(110,12,stage)
  # Split laurel wings and an unmistakable high crown give the final tier its own silhouette.
  for flip in [False,True]:
   out+='<g'+(' transform="translate(320 0) scale(-1 1)"' if flip else '')+'>'
   out+=path('M144 267Q62 248 53 146','none',INK,9)+path('M144 267Q62 248 53 146','none',GOLD,4)
   for j in range(5):
    y=158+j*19;x=54+j*j*2
    out+=path(f'M{x+9} {y+22}Q{x-24} {y+8} {x-20} {y-15}Q{x+12} {y-6} {x+9} {y+22}Z',GOLD,w=3)
   out+='</g>'
  out+=circle(160,163,81,INK,COPPER,7)+circle(160,163,69,'#514057',GOLD,4)+spiral(160,163,43)
  out+=path('M100 95L88 45L128 69L160 18L192 69L232 45L220 95Z',GOLD,w=6)
  out+=path('M113 82l-8-17 28 18 27-42 27 42 28-18-8 17Z',LIGHT,w=0)
  out+=path('M104 101h112v15H104Z',COPPER,w=5)
  out+=poly([(160,58),(170,75),(160,91),(150,75)],'#844555',w=3)
  out+=star(160,275,18)+star(39,92,10)+star(282,91,10)
 # Engraved stage marks, deliberately not tiny numeral text.
 out+=''.join(circle(160+(k-(min(stage+1,7)-1)/2)*9,301,2.2,GOLD,'none',0) for k in range(stage+1))
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-labelledby="title"><title id="title">{name} — Mozkokalypsa, {n} dokončených desek</title>{out}</svg>\n'
if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True)
 for i,(n,name,copy) in enumerate(SERIES):
  (OUT/f'achievement-mozkokalypsa-{n}.svg').write_text(art(i,n,name))
 print('Created seven original SVG emblems')
