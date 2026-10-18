"""Independent structural and bounded exact-cover validation for experimental boards."""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
import re
import time

from .catalog import ROOT, digest, norm, read_json


class BudgetExceeded(Exception):
    pass


@dataclass
class Budget:
    deadline: float
    node_limit: int = 250_000
    nodes: int = 0

    def step(self):
        self.nodes += 1
        if self.nodes > self.node_limit or time.monotonic() > self.deadline:
            raise BudgetExceeded('unknown_budget')


def adjacent(a, b, cols):
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return abs(ar - br) + abs(ac - bc) == 1


def neighbours(cell, rows, cols, mask):
    r, c = divmod(cell, cols)
    return [rr * cols + cc for rr, cc in ((r-1,c),(r+1,c),(r,c-1),(r,c+1))
            if 0 <= rr < rows and 0 <= cc < cols and rr * cols + cc in mask]


def components(cells, rows, cols):
    rest, sizes = set(cells), []
    while rest:
        todo, size = [min(rest)], 0
        rest.remove(todo[0])
        while todo:
            cell = todo.pop()
            size += 1
            for n in neighbours(cell, rows, cols, rest):
                rest.remove(n)
                todo.append(n)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def path_metrics(path, cols):
    dirs = [(b//cols-a//cols, b%cols-a%cols) for a,b in zip(path,path[1:])]
    turns, straight, longest, curl, maxcurl, previous_sign = 0, 1, 1, 0, 0, None
    for a, b in zip(dirs, dirs[1:]):
        if a == b:
            straight += 1
            longest = max(longest, straight)
        else:
            straight = 1
            turns += 1
            cross = a[1]*b[0]-a[0]*b[1]
            sign = 1 if cross > 0 else -1
            curl = curl+1 if sign == previous_sign else 1
            maxcurl = max(maxcurl, curl)
            previous_sign = sign
    return turns, longest/max(1,len(path)-1), maxcurl


def structural(board):
    rows, cols = board['rows'], board['cols']
    if type(rows) is not int or type(cols) is not int or not 2 <= rows <= 12 or not 2 <= cols <= 12:
        raise ValueError('dimensions')
    letters, rawmask, answers = board['letters'], board['mask'], board['answers']
    if not isinstance(rawmask, list) or not rawmask or any(type(i) is not int or not 0 <= i < rows*cols for i in rawmask):
        raise ValueError('mask_indices')
    mask = set(rawmask)
    if len(mask) != len(rawmask) or len(letters) != rows*cols:
        raise ValueError('mask_duplicates_or_letter_count')
    for i, letter in enumerate(letters):
        if i in mask and (not isinstance(letter,str) or not re.fullmatch('[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]',letter)):
            raise ValueError('active_letter')
        if i not in mask and letter != '':
            raise ValueError('unmasked_letter')
    if not answers:
        raise ValueError('no_answers')
    covered, words, lengths, paths, metrics = set(), set(), [], [], []
    for answer in answers:
        word, path = norm(answer['word']), answer['path']
        if not 4 <= len(word) <= 24 or word in words:
            raise ValueError('target_word')
        if not isinstance(path,list) or len(path) != len(word) or any(type(i) is not int for i in path):
            raise ValueError('target_path')
        if len(set(path)) != len(path) or not set(path) <= mask or covered & set(path):
            raise ValueError('path_overlap')
        if any(not adjacent(a,b,cols) for a,b in zip(path,path[1:])):
            raise ValueError('non_orthogonal_path')
        if norm(''.join(letters[i] for i in path)) != word:
            raise ValueError('spelling')
        words.add(word)
        covered.update(path)
        lengths.append(len(word))
        paths.append(path)
        metrics.append(path_metrics(path, cols))
    if covered != mask or Counter(board['lengths']) != Counter(lengths):
        raise ValueError('coverage_or_lengths')
    if len(components(mask,rows,cols)) != 1:
        raise ValueError('disconnected_board')
    chain = sum(adjacent(a[-1],b[0],cols) for i,a in enumerate(paths) for j,b in enumerate(paths) if i != j)
    blank = components(set(range(rows*cols))-mask, rows, cols)
    return {'rows':rows,'cols':cols,'cells':len(mask), 'wordCount':len(words), 'fourWords':sum(n==4 for n in lengths),
            'minLength':min(lengths),'maxLength':max(lengths),
            'minPathTurns':min(m[0] for m in metrics),'maxPathTurns':max(m[0] for m in metrics),
            'maxPathStraightShare':max(m[1] for m in metrics),
            'meanTurns':sum(m[0] for m in metrics)/len(metrics),
            'meanStraightShare':sum(m[1] for m in metrics)/len(metrics),
            'curvyShare':sum(m[0]>=2 for m in metrics)/len(metrics),
            'maxCurlRun':max(m[2] for m in metrics), 'curlPathCount':sum(m[2]>=2 for m in metrics),
            'endpointStartPairs':chain, 'blankComponents':len(blank), 'isolatedBlanks':blank.count(1),
            'bboxRows':max(i//cols for i in mask)-min(i//cols for i in mask)+1,
            'bboxCols':max(i%cols for i in mask)-min(i%cols for i in mask)+1}


def geometry_errors(m, p):
    checks = {
        'dimensions':m['rows']==p['rows'] and m['cols']==p['cols'],
        'word_lengths':m['minLength']>=p['min_len'] and m['maxLength']<=p['max_len'],
        'path_turns':m['minPathTurns']>=p['min_path_turns'] and m['maxPathTurns']<=p['max_path_turns'],
        'path_straight_share':m['maxPathStraightShare']<=p['max_path_straight_share'],
        'cell_count':p['cells'][0] <= m['cells'] <= p['cells'][1],
        'word_count':p['words'][0] <= m['wordCount'] <= p['words'][1],
        'short_word_cap':m['fourWords'] <= p['max_four_words'],
        'mean_turns':p['min_mean_turns'] <= m['meanTurns'] <= p['max_mean_turns'],
        'straight_share':m['meanStraightShare'] <= p['max_mean_straight_share'],
        'curvy_share':m['curvyShare'] >= p['min_curvy_share'],
        'curl_run':m['maxCurlRun'] <= p['max_curl_run'],
        'curl_count':m['curlPathCount'] <= p['max_curl_paths'],
        'chainable':m['endpointStartPairs'] == 0,
        'cutouts':m['blankComponents'] <= p['max_blank_components'],
        'isolated_cutouts':m['isolatedBlanks'] <= p['max_isolated_blanks'],
        'bbox':m['bboxRows'] >= p['min_bbox_rows'] and m['bboxCols'] >= p['min_bbox_cols'],
    }
    return [name for name, ok in checks.items() if not ok]


def validation_words(catalog, *, recognition_path=None, overlay_words=None):
    # Finite, explicit recognizer union; frequency fallback is intentionally not
    # claimed enumerable. No truncation after appending targets.
    words = {norm(w) for w in (recognition_path or ROOT/'data/words.txt').read_text(encoding='utf-8').splitlines()}
    words |= set(catalog.entries)
    for e in read_json(ROOT/'data/lexicon_v2_wikidata_raw.json')['entries']:
        raw = str(e.get('lemma') or '').strip()
        if raw == raw.lower():
            words.add(norm(raw))
    # Historical receipts must pin this input too: their finite base dictionary
    # does not imply an editorial overlay from today's bonus-word recognizer.
    if overlay_words is None:
        # Read only the literal server overlay; no FastAPI/server import or DB calls.
        import ast
        tree = ast.parse((ROOT/'word_recognition_v3330.py').read_text(encoding='utf-8'))
        overlay_words = set()
        for n in tree.body:
            if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id=='RECOGNITION_OVERLAY' for t in n.targets):
                overlay_words |= set(ast.literal_eval(n.value))
    words |= {norm(w) for w in overlay_words}
    return sorted(w for w in words if 4 <= len(w) <= 24 and w != 'negr' and re.fullmatch('[a-záčďéěíňóřšťúůýž]+',w))


class Solver:
    def __init__(self, words):
        self.words = sorted(set(words))
        self.hash = digest(self.words)
        self.trie = {}
        self.prefixes = {i:set() for i in range(1,6)}
        for word in self.words:
            node = self.trie
            for char in word:
                node = node.setdefault(char,{})
            node['$'] = word
            for i in self.prefixes:
                if len(word)>=i:
                    self.prefixes[i].add(word[:i])

    def enumerate(self, board, budget):
        required = set(board['lengths'])
        maximum = max(required)
        mask = set(board['mask'])
        adj = {i:neighbours(i,board['rows'],board['cols'],mask) for i in mask}
        letters = [norm(x) for x in board['letters']]
        result = []
        def dfs(cell, node, path, used):
            budget.step()
            node = node.get(letters[cell])
            if node is None:
                return
            path = path+(cell,)
            used |= 1<<cell
            if '$' in node and len(path) in required:
                result.append((node['$'],path,used))
            if len(path)<maximum:
                for n in adj[cell]:
                    if not used & (1<<n):
                        dfs(n,node,path,used)
        for cell in sorted(mask):
            dfs(cell,self.trie,(),0)
        return result

    def verify(self, board, seconds=8, node_limit=250_000):
        budget = Budget(time.monotonic()+seconds,node_limit)
        solutions, count, cover_nodes, forced_nodes, target_unique = 0, 0, 0, 0, False
        try:
            candidates = self.enumerate(board,budget)
            count = len(candidates)
            targets = {norm(a['word']):tuple(a['path']) for a in board['answers']}
            target_unique = all([path for word,path,_ in candidates if word==w]==[p] for w,p in targets.items())
            by_cell = defaultdict(list)
            for word,path,bits in candidates:
                for cell in path:
                    by_cell[cell].append((word,path,bits))
            all_bits = sum(1<<i for i in board['mask'])
            lengths = Counter(board['lengths'])
            def cover(used, remaining, used_words):
                nonlocal solutions,cover_nodes,forced_nodes
                budget.step()
                cover_nodes += 1
                if used==all_bits:
                    if not any(remaining.values()):
                        solutions += 1
                    return
                best = None
                for cell in sorted(board['mask']):
                    if used & (1<<cell):
                        continue
                    viable = [c for c in by_cell[cell] if not c[2]&used and remaining[len(c[1])]>0 and c[0] not in used_words]
                    if not viable:
                        return
                    if best is None or len(viable)<len(best):
                        best=viable
                        if len(best)==1:
                            break
                if len(best)==1:
                    forced_nodes += 1
                for word,path,bits in best:
                    remaining[len(path)] -= 1
                    cover(used|bits,remaining,used_words|{word})
                    remaining[len(path)] += 1
                    if solutions>=2:
                        return
            cover(0,lengths,set())
            status = 'unique' if solutions==1 else 'multiple' if solutions>=2 else 'none'
        except BudgetExceeded:
            status = 'unknown_budget'
        return {'status':status,'solutionsLowerBound':solutions,'targetPathsUnique':target_unique,
                'candidateCount':count,'searchNodes':cover_nodes,'enumerationAndSearchNodes':budget.nodes,
                'forcedNodeShare':forced_nodes/max(1,cover_nodes),'dictionaryHash':self.hash,
                'dictionarySize':len(self.words)}

