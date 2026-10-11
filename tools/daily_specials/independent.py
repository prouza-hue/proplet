"""Second verifier: prefix-set walks + first-uncovered-cell exact cover.

No import of the manufacturing trie/cover implementation. Failed-state memoization
includes remaining length quotas AND already used words. Unknown is a failure.
"""
from collections import Counter, defaultdict
import time

def check(board, dictionary, seconds=30, node_limit=2000000):
    deadline=time.monotonic()+seconds; nodes=0
    letters=[x.casefold() for x in board['letters']];mask=set(board['mask'])
    lengths=set(board['lengths']);maximum=max(lengths)
    valid={w for w in dictionary if len(w) in lengths};prefix={w[:i] for w in valid for i in range(1,len(w)+1)}
    c=board['cols'];r=board['rows'];adj={}
    for i in mask:
        y,x=divmod(i,c)
        adj[i]=[yy*c+xx for yy,xx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)) if 0<=yy<r and 0<=xx<c and yy*c+xx in mask]
    candidates=[]
    def tick():
        nonlocal nodes
        nodes+=1
        if nodes>node_limit or time.monotonic()>deadline:raise TimeoutError('unknown_budget')
    def scan(i,text,path,bits):
        tick();text+=letters[i]
        if text not in prefix:return
        path=path+(i,);bits|=1<<i
        if text in valid:candidates.append((text,path,bits))
        if len(path)<maximum:
            for n in adj[i]:
                if not bits&(1<<n):scan(n,text,path,bits)
    try:
        for i in sorted(mask):scan(i,'',(),0)
        target={a['word'].casefold():tuple(a['path']) for a in board['answers']}
        target_unique=all([p for w,p,_ in candidates if w==word]==[path] for word,path in target.items())
        bycell=defaultdict(list)
        for word,path,bits in candidates:
            for i in path:bycell[i].append((word,path,bits))
        goal=sum(1<<i for i in mask);quota=Counter(board['lengths']);solutions=[];failed=set()
        def cover(bits,used,chosen):
            tick()
            if len(solutions)>=2:return True
            if bits==goal:
                if not any(quota.values()):solutions.append(tuple(chosen));return True
                return False
            state=(bits,tuple(sorted(used)),tuple(sorted(quota.items())))
            if state in failed:return False
            remaining=goal^bits;i=(remaining&-remaining).bit_length()-1;found=False
            for w,path,b in bycell[i]:
                n=len(path)
                if b&bits or w in used or quota[n]<=0:continue
                quota[n]-=1
                found=cover(bits|b,used|{w},chosen+[(w,path)]) or found
                quota[n]+=1
                if len(solutions)>=2:return True
            if not found:failed.add(state)
            return found
        cover(0,set(),[])
        target_match=len(solutions)==1 and set(solutions[0])==set(target.items())
        return {'status':'unique' if len(solutions)==1 else 'multiple' if solutions else 'none',
                'solutionsLowerBound':len(solutions),'targetPathsUnique':target_unique,
                'uniqueCoverMatchesTargets':target_match,'candidateCount':len(candidates),'nodes':nodes}
    except TimeoutError:
        return {'status':'unknown_budget','nodes':nodes}
