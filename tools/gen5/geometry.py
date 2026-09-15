"""Bounded independent path packing with explicit per-profile geometry policies."""
from __future__ import annotations
import time
from .validation import BudgetExceeded, adjacent, neighbours, path_metrics, geometry_errors, structural


def find_path(length, profile, occupied, starts, ends, rng, deadline):
    rows,cols=profile['rows'],profile['cols']
    grid=set(range(rows*cols))
    adjacency={i:neighbours(i,rows,cols,grid) for i in grid}
    unused=sorted(grid-occupied)
    if occupied:
        candidates=[i for i in unused if any(n in occupied for n in adjacency[i])
                    and not any(adjacent(i,e,cols) for e in ends)]
    else:
        candidates=unused
    rng.shuffle(candidates)
    nodes=0
    for start in candidates[:36]:
        path=[start]; used={start}
        def dfs(last=None):
            nonlocal nodes
            nodes+=1
            if nodes>profile['path_node_limit']:
                return False
            if nodes%128==0 and time.monotonic()>deadline:
                raise BudgetExceeded('geometry_deadline')
            turns,straight,curl=path_metrics(path,cols)
            if turns>profile['max_path_turns'] or curl>profile['max_curl_run']:
                return False
            if len(path)==length:
                return (turns>=profile['min_path_turns']
                        and straight<=profile['max_path_straight_share']
                        and not any(adjacent(path[-1],s,cols) for s in starts))
            ranked=[]
            for nxt in adjacency[path[-1]]:
                if nxt in occupied or nxt in used:
                    continue
                direction=(nxt//cols-path[-1]//cols,nxt%cols-path[-1]%cols)
                turn=int(last is not None and direction!=last)
                contacts=sum(n in occupied for n in adjacency[nxt])
                self_contacts=sum(n in used and n!=path[-1] for n in adjacency[nxt])
                score=turn*profile['turn_bias']-.14*contacts-.18*self_contacts+rng.random()*1.35
                ranked.append((score,nxt,direction))
            for _,nxt,direction in sorted(ranked,reverse=True):
                path.append(nxt);used.add(nxt)
                if dfs(direction):
                    return True
                used.remove(nxt);path.pop()
            return False
        if dfs():
            return path.copy()
        if nodes>profile['path_node_limit']:
            break
    return None


def build(words, difficulty, profile, rng, deadline, diagnostics=None):
    ordered = sorted(words,key=lambda w:(-len(w),rng.random()))
    for _ in range(profile['geometry_restarts']):
        placed,occupied,starts,ends = {},set(),set(),set()
        for word in ordered:
            if time.monotonic()>deadline:
                raise BudgetExceeded('geometry_deadline')
            path = find_path(len(word),profile,occupied,starts,ends,rng,deadline)
            if path is None:
                break
            placed[word]=path
            occupied.update(path)
            starts.add(path[0]);ends.add(path[-1])
        if len(placed)!=len(words):
            if diagnostics is not None:
                diagnostics['packing'] += 1
            continue
        letters=['']*(profile['rows']*profile['cols'])
        answers=[]
        for word,path in placed.items():
            answers.append({'word':word.upper(),'path':path})
            for cell,letter in zip(path,word.upper()):
                letters[cell]=letter
        rng.shuffle(answers)
        board={'difficulty':difficulty,'rows':profile['rows'],'cols':profile['cols'],
               'mask':sorted(occupied),'letters':letters,'answers':answers,
               'lengths':[len(a['word']) for a in answers]}
        errors=geometry_errors(structural(board),profile)
        if diagnostics is not None:
            diagnostics.update(errors)
        if not errors:
            return board
    return None
