"""Deterministic, presentation-only ribbon artwork. Does not modify reward data.
Pilot SVGs are immutable inputs. New artwork uses broad folded bands and open counters.
"""
from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/rewards/ribbons'
SOURCE=(ROOT/'public/app.js').read_text()
def entries(start,end):
 return [dict(re.findall(r"(name|id|group):'([^']*)'",x)) for x in SOURCE.split(start,1)[1].split(end,1)[0].splitlines() if 'name:' in x]
ranks=entries('const LEVELS=[','];'); achievements=entries('const ACHIEVEMENTS=[','];')
badges=[{'name':n} for n in re.findall(r"name:'([^']+)'",SOURCE.split('const BADGES=[',1)[1].split('];',1)[0])]
PILOT={'rank-01':'novacek','rank-18':'alchymista','rank-35':'legenda','achievement-all-1':'prvni-proplet','achievement-mozkomor-100':'nemesis','streak-04':'tyden','medal-1':'medaile'}
# Centerline drawings are ribbon constructions, not outlines around a pictogram.
# Two face depths and an optional narrow light edge make crossings legible at 24px.
M={
'letter':[('M34 106V26H73Q101 26 101 51T73 76H34','t'),('M19 95H53','c')],
'book':[('M64 105V33Q40 16 18 29V94Q41 84 64 105Q86 84 110 94V29Q88 16 64 33','t'),('M64 35V103','c')],
'search':[('M85 80L111 106','c'),('M92 55A35 35 0 1 1 22 55 35 35 0 1 1 92 55','t')],
'spool':[('M36 27V101M92 27V101','t'),('M23 23H105M23 105H105','g'),('M37 40L91 55 37 72 91 88','c')],
'knot':[('M63 46C23 2 4 40 42 64L82 88C121 111 123 67 84 64L43 62C1 58 16 112 55 86L84 45C107 7 56 8 63 46Z','t'),('M42 64L82 88C111 106 122 81 103 69','c'),('M57 50L77 69','g')],
'loop':[('M22 103V49Q22 21 51 21H77Q105 21 105 49T77 77H50','t'),('M50 77L66 58M50 77L70 96','c')],
'compass':[('M64 15L111 64 64 113 17 64Z','t'),('M79 42L70 74 45 89 56 55Z','c')],
'rook':[('M26 25V47H102V25M64 25V45','g'),('M40 49L32 98H96L88 49','t'),('M23 111H105','c')],
'spark':[('M64 13Q60 58 16 64Q60 70 64 115Q68 70 112 64Q68 58 64 13Z','t'),('M64 29Q64 58 87 64L64 76 41 64Z','g')],
'crown':[('M18 38L30 96H98L110 38 82 61 64 22 45 61Z','g'),('M33 99H95','t'),('M45 65L64 80 83 65','c')],
'route':[('M20 99H48V69H79V39H108','t'),('M20 69H48V39H79V19','c')],
'dragon':[('M19 102C10 69 41 72 48 52L51 26 81 18 106 40 84 50 70 37','t'),('M51 51Q89 59 91 87Q79 117 48 98L39 86','c')],
'spiral':[('M24 106C-2 68 25 14 67 16C123 18 128 99 78 107C35 114 17 54 58 43C84 34 105 62 89 80C78 94 57 77 67 64','t'),('M24 106C-2 68 25 14 67 16','c')],
'maze':[('M18 105V24H105V105H48V53H78V80','t'),('M18 64H48M78 24V53','c')],
'gem':[('M19 46L40 20H88L109 46 64 111Z','t'),('M19 46H109M40 20L49 46 64 111 79 46 88 20','g')],
'ninja':[('M18 39Q63 15 110 39L95 83Q64 101 33 83Z','t'),('M20 52L107 63M95 78L115 102M93 79L108 114','c')],
'snail':[('M20 97H88Q109 97 108 71V61M107 61L94 43M107 61L117 45','c'),('M83 71A31 31 0 1 0 52 101Q80 101 80 77Q80 52 57 52Q39 52 42 71Q43 82 57 77','t')],
'orb':[('M101 53A37 37 0 1 1 27 53 37 37 0 1 1 101 53','t'),('M30 57Q64 23 98 49Q66 84 30 57','c'),('M35 105H93','g')],
'galaxy':[('M111 51C85 12 31 15 18 59C9 96 58 115 93 92C123 72 104 39 77 41C52 42 37 80 66 84','t'),('M26 92Q65 126 108 83','g')],
'brain':[('M57 30Q34 9 24 38Q8 52 24 67Q13 91 38 99Q51 118 64 94Q78 114 94 98Q119 88 103 68Q121 43 100 34Q88 7 68 28V86','t'),('M24 67L47 61 38 41M68 53L89 64 82 85','c')],
'gate':[('M22 105V30H43V47H85V30H106V105M44 105V78Q64 56 84 78V105','t'),('M17 110H111M43 26H85','g')],
'graduate':[('M15 45L64 20 113 45 64 71Z','t'),('M33 63V89Q64 112 95 89V63','c'),('M110 48V90','g')],
'wand':[('M26 103L83 43','t'),('M85 15L92 33 110 40 92 47 85 65 78 47 60 40 78 33Z','g')],
'arch':[('M23 106V59Q23 14 64 14T105 59V106H81V59Q81 40 64 40T47 59V106Z','t'),('M19 109H109','g')],
'infinity':[('M64 64C30 11 8 35 15 72C23 109 49 85 64 64C84 36 111 20 113 59C115 108 85 98 64 64Z','t'),('M64 64C42 30 22 24 15 43M64 64Q93 109 109 82','c')],
'comet':[('M16 107L63 62M17 81L42 56','t'),('M81 16L90 36 112 43 92 56 90 80 71 65 48 67 59 47 54 24 76 30Z','g')],
'orbit':[('M94 62A30 30 0 1 1 34 62 30 30 0 1 1 94 62','t'),('M20 95C-10 71 87 6 112 30C134 54 39 119 20 95Z','g')],
'rocket':[('M36 81Q37 33 97 18Q106 72 57 91Z','t'),('M37 66L18 81 38 84M72 84L61 110 56 90','c'),('M31 95L20 108','g')],
'shield':[('M64 16L103 34V67Q103 94 64 112Q25 94 25 67V34Z','t'),('M43 67L58 83 85 48','g')],
'cup':[('M35 28H93V58Q93 85 64 85T35 58ZM35 36H16V48Q16 69 40 71M93 36H112V48Q112 69 88 71','g'),('M64 85V107M42 110H86','t')],
'key':[('M59 43A23 23 0 1 1 13 43 23 23 0 1 1 59 43','t'),('M54 61L103 109M81 87L98 70M93 99L111 81','g')],
'web':[('M64 15L107 40V88L64 113 21 88V40ZM64 38L86 51V77L64 90 42 77V51Z','t'),('M64 15V113M21 40L107 88M21 88L107 40','c')],
'leaf':[('M30 107Q18 29 105 18Q107 91 30 107Z','t'),('M30 107L82 46','g')],
'tree':[('M64 110V55M64 76Q23 80 20 42Q53 37 64 76M64 59Q106 65 109 25Q75 23 64 59','t'),('M64 57Q34 37 46 15Q71 20 64 57','c')],
'heart':[('M64 108C42 93 8 68 16 40C25 13 52 20 64 40C77 18 106 17 113 43C119 70 84 96 64 108Z','c'),('M24 75Q52 96 64 108Q64 71 97 40','t')],
'bolt':[('M75 12L22 73H59L51 116 108 52H69Z','g'),('M69 52L75 12','c')],
'sun':[('M91 64A27 27 0 1 1 37 64 27 27 0 1 1 91 64','g'),('M64 12V24M64 104V116M12 64H24M104 64H116M27 27L36 36M92 92L101 101M27 101L36 92M92 36L101 27','c')],
'calendar':[('M24 29H104V108H24ZM24 49H104','t'),('M42 16V36M86 16V36','c'),('M43 79L57 91 87 62','g')],
'scroll':[('M29 106V25H97V86H51Q34 86 34 104Q34 115 49 115H92Q107 115 107 98','t'),('M47 46H78M47 65H69','g')],
'eye':[('M14 64Q64 3 114 64Q64 125 14 64Z','t'),('M82 64A18 18 0 1 1 46 64 18 18 0 1 1 82 64','g')],
'branch':[('M28 108V21M28 70Q77 76 103 26M28 47Q50 40 60 17','t'),('M87 27L107 23 107 44','c')],
'lamp':[('M46 105H82L75 70 108 62 85 25 63 29 39 64 56 75Z','t'),('M63 29L15 36 27 64 39 64','g')],
'vase':[('M43 19H85M48 19V40Q15 68 30 95Q39 115 64 115T98 95Q113 68 80 40V19','t'),('M31 77Q64 45 97 77M32 94Q64 66 96 94','g')],
'check':[('M18 65L49 96 110 28','t'),('M18 65L49 96 70 74','g')],
'wing':[('M18 98Q40 19 114 25L84 52 103 54 74 77 87 80 52 98Z','t'),('M18 98L83 44','g')],
'mirror':[('M91 51A27 36 0 1 1 37 51 27 36 0 1 1 91 51','t'),('M64 87V109M43 111H85','g'),('M51 61L75 37','c')],
'coin':[('M105 64A41 41 0 1 1 23 64 41 41 0 1 1 105 64','g'),('M45 40L82 87M82 40L45 87','t')],
'chest':[('M20 58Q20 24 64 24T108 58V106H20ZM20 61H108','t'),('M41 28V104M87 28V104','g'),('M57 59H71V76H57Z','c')],
'bridge':[('M16 101V78Q64 6 112 78V101M16 75H112','t'),('M39 53V96M89 53V96','g')],
'flag':[('M26 113V19M28 23Q48 11 65 26T106 23V74Q87 88 65 72T28 72','t'),('M64 27V72','c')],
'clock':[('M103 67A39 39 0 1 1 25 67 39 39 0 1 1 103 67','t'),('M64 42V67L87 77M51 13H77','g')],
'life':[('M105 64A41 41 0 1 1 23 64 41 41 0 1 1 105 64','t'),('M35 35L47 47M81 81L93 93M35 93L47 81M81 47L93 35','c')],
'flame':[('M67 12Q37 41 25 67Q12 93 63 115Q108 96 105 67Q105 47 85 34Q90 60 71 67Q53 44 67 12Z','c'),('M63 115Q87 84 65 65Q45 49 47 36','g')],
'grid':[('M20 22H108V108H20ZM20 65H108M64 22V108','t'),('M21 65H64V107','c')],
'peak':[('M15 107L46 32 64 66 82 16 114 107Z','t'),('M46 32L64 66 82 16','g')],
'steps':[('M17 107V83H43V59H69V35H95V17','t'),('M44 107H111M70 83H111M96 59H111','c')],
'helix':[('M26 16C108 32 19 94 103 111M103 16C19 32 108 94 26 111','t'),('M34 28H95M46 49H81M47 80H80M34 99H96','g')],
'flower':[('M64 64C12 68 12 15 43 19Q64 23 64 64C60 12 113 12 109 43Q105 64 64 64C116 60 116 113 85 109Q64 105 64 64C68 116 15 116 19 85Q23 64 64 64Z','t'),('M77 64A13 13 0 1 1 51 64 13 13 0 1 1 77 64','g')],
'portal':[('M20 110V62A44 44 0 0 1 88 25M108 18V66A44 44 0 0 1 40 103','t'),('M41 99V65Q41 42 64 42T87 65V99','c')],
}
RANK_MOTIFS=['leaf','letter','search','spool','knot','loop','compass','rook','spark','knot','crown','route','dragon','spiral','maze','gem','ninja','vase','snail','orb','galaxy','brain','gate','graduate','wand','arch','infinity','comet','orbit','rocket','shield','cup','key','web','infinity']
SERIES={
'general':['grid','knot','route','compass','bridge','gate','rocket','flag','infinity'],
'easy':['leaf','tree','flower','tree','gate','tree'],
'medium':['brain','brain','search','helix','graduate','helix'],
'hard':['bolt','flame','shield','peak','arch','cup','peak'],
'hardcore':['brain','dragon','flame','snail','brain','crown','infinity'],
'daily':['sun','sun','calendar','calendar','orbit','flower','sun','compass','orbit'],
'tajenka':['eye','key','orb','scroll'],
'mozkomor':['portal','brain','spiral','web','helix','eye'],
'discovery':['branch','route','lamp','vase'],
'clean':['check','flower','check','gem','wing','mirror','wand'],
'cleanDaily':['sun','wing','orbit','spark'],
'xp':['coin','coin','chest','chest','gate','grid','cup','shield','rocket','cup','key','web','galaxy'],
'speed':['clock','wing','bolt','rocket'],
'rescue':['life','bridge','heart','life']}
STREAK=['flag','heart','flower','flame','cup','bolt','book','crown','gem','rocket']
COL={'t':['#36B9C0','#06828F','#004A59'],'c':['#FF9A76','#FA665C','#B73046'],'g':['#FFF0A3','#FFD564','#CE8E25'],'s':['#EFF5EC','#B8CDC6','#6D918B'],'b':['#FFD1A0','#CF8A51','#835033']}
def svg(motif,stage=0,dark=False,small=False,series='rank'):
 # High ranks have structural gold ties, never a generic surrounding shield.
 palette=dict(COL)
 if not dark:palette['t']=['#1EACB6','#06828F','#004A59']
 if series in ['easy','clean','cleanDaily']:palette['c']=['#B5D996','#65A87F','#286D63']
 if series in ['daily','xp']:palette['c']=COL['g']
 defs='<defs>'+''.join(f'<linearGradient id="{k}" x2="1" y2="1">'+''.join(f'<stop offset="{i/2}" stop-color="{v}"/>' for i,v in enumerate(cs))+'</linearGradient>' for k,cs in palette.items())+'</defs>'
 body='';w=19 if small else 18
 # Every silhouette is left open to the page. Increased stages add a folded tail
 # behind the main object and an increasing set of gold clasps, not a number overlay.
 if stage>=2:
  body+='<path d="M24 76L13 111 33 103 45 118 54 91Z" fill="url(#t)"/>'
 if stage>=4:
  body+='<path d="M75 88L86 118 98 103 116 110 102 74Z" fill="url(#c)"/>'
 for d,k in M[motif]:
  body+=f'<path d="{d}" fill="none" stroke="#083E49" stroke-width="{w+1}" stroke-linecap="butt" stroke-linejoin="round" transform="translate(0 3)"/>'
  body+=f'<path d="{d}" fill="none" stroke="url(#{k})" stroke-width="{w}" stroke-linecap="butt" stroke-linejoin="round"/>'

 if stage:
  n=min(3,1+(stage-1)//2)
  for i in range(n):
   x=64+(i-(n-1)/2)*15
   body+=f'<path d="M{x-6} 103L{x+2} 97L{x+9} 109L{x+1} 115Z" fill="url(#g)"/>'
 return '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">'+defs+'<g transform="translate(5 5) scale(.92)">'+body+'</g></svg>'
# Sculpted ribbon digits; same folded joins as approved 1/7, no font dependency.
DIGITS={2:'M45 66C45 46 82 44 83 64C84 77 50 78 46 98H86',3:'M45 52H83L62 73Q88 71 85 88Q80 106 46 98'}
def medal(n,dark,small):
 s=(OUT/('dark' if dark else 'light')/('medaile-'+('small' if small else 'regular')+'.svg')).read_text()
 # Preserve the exact medal construction, replacing only the central numeral group.
 start=s.find('<!-- ribbon numeral')
 if start<0:
  # Pilot 04 has the numeral as a final group; inspect its explicit revision marker.
  s=re.sub(r'<g id="ribbon-numeral">.*?</g>','',s,flags=re.S)
 else:s=s[:start]+'</svg>'
 if 'data-ribbon-number' not in s and start<0:
  # All paths after the front ribbon highlight are the approved number.
  marker='M41 6h20';pos=s.find(marker)
  if pos>=0:s=s[:s.find('/>',pos)+2]+'</svg>'
  else:
   marker='M54 47';pos=s.find(marker);s=s[:s.find('/>',pos)+2]+'</svg>'
 # The center stays open and the broad figure is optically centered at (64,78).
 color='s' if n==2 else 'b'
 for old,new in zip(COL['g'],COL[color]):s=s.replace(old,new)
 for old,new in ({'#E6A734':COL[color][2],'#E7B647':COL[color][1],'#B57723':COL[color][2],'#E9AE35':COL[color][1],'#FFDF70':COL[color][0],'#FFE99A':COL[color][0],'#FFEAA0':COL[color][0],'#FFE79A':COL[color][0],'#FFF0AF':COL[color][0]}.items()):s=s.replace(old,new)
 d=DIGITS[n]
 num=f'<g transform="translate(5 11) scale(.92 .82)"><path d="{d}" fill="none" stroke="#004A59" stroke-width="10" stroke-linecap="butt" stroke-linejoin="round" transform="translate(0 2)"/><path d="{d}" fill="none" stroke="'+('#D5E8DF' if dark else '#187F83')+'" stroke-width="9" stroke-linecap="butt" stroke-linejoin="round"/></g>'
 return s.replace('</svg>',num+'</svg>')
items=[]
def add(key,name,category,motif,stage=0,group=None):
 item={'id':key,'name':name,'category':category,'group':group,'motif':motif,'stage':stage,'key':PILOT.get(key,key),'pilot':key in PILOT}
 items.append(item)
 if item['pilot']:return
 for dark in [False,True]:
  for small in [False,True]:
   text=medal(int(key[-1]),dark,small) if category=='medal' else svg(motif,stage,dark,small,group or category)
   (OUT/('dark' if dark else 'light')/(key+'-'+('small' if small else 'regular')+'.svg')).write_text(text)
for i,r in enumerate(ranks):add(f'rank-{i+1:02}',r['name'],'rank',RANK_MOTIFS[i],min(6,i//5))
counts={}
for a in achievements:
 g=a['group'];i=counts.get(g,0);counts[g]=i+1
 add('achievement-'+a['id'],a['name'],'achievement',SERIES[g][i],i,g)
for i,b in enumerate(badges):add(f'streak-{i+1:02}',b['name'],'streak',STREAK[i],min(6,i))
for n,name in enumerate(['Zlatá medaile','Stříbrná medaile','Bronzová medaile'],1):add(f'medal-{n}',name,'medal','cup')
manifest={'revision':5,'status':'Complete collection candidate; pilot geometry preserved','sizes':{'small':[24,32],'regular':[40,64]},'items':items}
(OUT/'collection.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Explicit category+name avoids the two unrelated rewards named Blesk.
index={}
for a in items:index.setdefault(a['category'],{})[a['name']]=a['key']
(ROOT/'public/ribbon-catalog.js').write_text('/* Generated by tools/design/build_ribbon_collection.py; presentation only. */\nwindow.PropletRibbonCatalog='+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'{len(items)} rewards, {sum(not i["pilot"] for i in items)*4} new SVG files. Pilots unchanged.')
