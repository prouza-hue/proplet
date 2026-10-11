"""Documented edition-specific texture edits, after lexical and geometric review."""
from copy import deepcopy
from .core import *

EDITS={
 'g6-ds-hardcore-w03':('VOLÁN','HRNEC','Rozdělit textilní/muzikantskou kumulaci ZÁŠEVEK–VOLÁN–TRYLEK běžným konkrétním slovem.'),
 'g6-ds-mozkomor-w06':('PLOTICE','ENERGIE','Omezit souběh PLOTICE–ŠLAHOUN–BADYÁN; ponechat dva konkrétní přírodní/kuchyňské výrazy.'),
 'g6-ds-hardcore-w12':('ROVER','ROKLE','Omezit cizojazyčnou technickou texturu vedle GENOMU a HYDRY.')}

def main():
    cat=Catalog();solver=cat.solver();bank=read(OUT/'bank.json');log=[]
    for b in bank['boards']:
        if b['id'] not in EDITS:continue
        old,new,reason=EDITS[b['id']]
        if old not in {a['word'] for a in b['answers']}:continue
        assert norm(new) in cat.eligible(b['difficulty'])
        assert norm(new) not in {w for other in bank['boards'] for w in words(other)}
        candidate=deepcopy(b);answer=next(a for a in candidate['answers'] if a['word']==old)
        assert len(old)==len(new);answer['word']=new
        for i,ch in zip(answer['path'],new):candidate['letters'][i]=ch
        v=solver.verify(candidate,seconds=20,node_limit=1000000)
        assert v['status']=='unique' and v['targetPathsUnique']
        assert tier_mix_ok(words(candidate),cat.entries,cat.profiles[b['difficulty']]['policy'])
        b.update(candidate);log.append({'id':b['id'],'from':old,'to':new,'reason':reason})
    write(OUT/'bank.json',bank)
    if log:write(OUT/'editorial-review.json',{'scope':'AI editorial assessment of all 36 word sets; human gameplay not yet measured',
       'edits':log,'knownPolarizingWordExcluded':'HŘEBELEC',
       'narrowVocabularyPolicy':'At most two previously flagged specialist-natural words per board; flag is advisory, not dictionary rejection.',
       'retainedContexts':[
         'KUŇKA / VIOLKA: konkrétní přírodní slova vedle domácích předmětů; ne celá zoologická deska.',
         'ZÁŠEVEK / TRYLEK: přesná česká hesla z ověřené expanze; HRNEC odlehčuje souběh.',
         'MINCÍŘ / KOŠÍKÁŘ: konkrétní řemesla; ostatní slova desky zahrnují kuchyňské, školní a běžné věci.',
         'ŽEBŘIŇÁK / ZÁVLAČKA: dva méně každodenní předměty; bez další řady odborných komponent.',
         'JEHELNÍK / SKALISKO: oddělená témata; nikoli převaha obtížnosti z botanické znalosti.',
         'JOYSTICK / DESIGN / SNOWBOARD / JAZZ / BLUES: známé výpůjčky z autorizovaného lexikonu; nejsou nově přidanými cíli.'],
       'remainingPlaytestQuestions':['Rozpoznatelnost konkrétních B/C hesel napříč hráči','Tempo posledních tří slov','Rozdíl typické a náročnější desky bez vlivu pořadí'],
       'productionAuthorized':False})
if __name__=='__main__':main()
