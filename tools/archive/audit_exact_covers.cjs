'use strict';

function audit(archive, rawWords, limit = 50) {
  const wordSet = new Set(rawWords.map(word => String(word).trim().normalize('NFC').toUpperCase())
    .filter(word => word.length >= 4 && word.length <= 24 &&
      /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/.test(word) && word !== 'NEGR'));
  const trie = {};
  for (const word of wordSet) {
    let node = trie;
    for (const character of word) node = node[character] || (node[character] = {});
    node.$ = word;
  }
function coverSolutions(puzzle,limit=20){
 const cells=new Set(puzzle.mask),lengthCounts={};for(const l of puzzle.lengths)lengthCounts[l]=(lengthCounts[l]||0)+1;
 const maxLen=Math.max(...puzzle.lengths),validLengths=new Set(puzzle.lengths);
 const neighbors={};for(const c of cells){const r=Math.floor(c/puzzle.cols),col=c%puzzle.cols;neighbors[c]=[];if(r>0&&cells.has(c-puzzle.cols))neighbors[c].push(c-puzzle.cols);if(r+1<puzzle.rows&&cells.has(c+puzzle.cols))neighbors[c].push(c+puzzle.cols);if(col>0&&cells.has(c-1))neighbors[c].push(c-1);if(col+1<puzzle.cols&&cells.has(c+1))neighbors[c].push(c+1);}
 const candidates=[],path=[];
 function visit(i,node,bits){const n=node[puzzle.letters[i]];if(!n)return;const newbits=bits|(1n<<BigInt(i));path.push(i);if(n.$&&validLengths.has(path.length))candidates.push({word:n.$,path:[...path],bits:newbits,length:path.length});
 if(path.length<maxLen)for(const j of neighbors[i])if(!(newbits&(1n<<BigInt(j))))visit(j,n,newbits);
 path.pop();}
 for(const c of cells)visit(c,trie,0n);
 const byCell={};for(const c of cells)byCell[c]=[];for(const c of candidates)for(const i of c.path)byCell[i].push(c);
 const all=puzzle.mask.reduce((b,i)=>b|(1n<<BigInt(i)),0n),usedWords=new Set(),found=[],solutions=[];let nodes=0;
 function solve(used){nodes++;if(solutions.length>=limit)return;if(used===all){solutions.push(found.map(c=>({word:c.word,path:c.path})));return;}
 let opts=null;for(const i of cells){if(used&(1n<<BigInt(i)))continue;const poss=byCell[i].filter(c=>!(c.bits&used)&&lengthCounts[c.length]>0&&!usedWords.has(c.word));if(!poss.length)return;if(opts===null||poss.length<opts.length){opts=poss;if(poss.length===1)break;}}
 for(const c of opts){usedWords.add(c.word);lengthCounts[c.length]--;found.push(c);solve(used|c.bits);found.pop();lengthCounts[c.length]++;usedWords.delete(c.word);if(solutions.length>=limit)return;}}
 solve(0n);return {candidates:candidates.length,nodes,solutions};
}

  const records = [];
  const ambiguous = [];
  for (const puzzle of Object.values(archive.free).flat()) {
    const result = coverSolutions(puzzle, limit);
    records.push({puzzleId: puzzle.id, candidateCount: result.candidates,
      solverNodes: result.nodes, completeSolutionCount: result.solutions.length});
    if (result.solutions.length !== 1) ambiguous.push({puzzleId: puzzle.id, solutions: result.solutions});
  }
  const solutionHistogram = {};
  for (const record of records) {
    solutionHistogram[record.completeSolutionCount] = (solutionHistogram[record.completeSolutionCount] || 0) + 1;
  }
  return {wordCount: wordSet.size, boardCount: records.length, solutionHistogram, records, ambiguous,
    scope: 'Fixed original target count and length multiset; orthogonal unique-cell paths, distinct words and complete active-mask coverage.'};
}
module.exports = {audit};

if (typeof require === 'function' && require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const zlib = require('node:zlib');
  const cp = require('node:child_process');
  const root = path.resolve(__dirname, '../..');
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const manifest = JSON.parse(read('content/archives/free-gen3-v1/manifest.json'));
  const archive = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, manifest.originalBank.path))).toString('utf8'));
  const lexicon = JSON.parse(read(manifest.reviewLexicon.path));
  const source = read('word_recognition_v3330.py');
  const overlaySection = source.split('RECOGNITION_OVERLAY = {')[1].split('\n}')[0];
  const overlay = Array.from(overlaySection.matchAll(/"([^"]+)"/g), match => match[1]);
  let words = read(manifest.recognitionWords.path).split(/\r?\n/)
    .concat(lexicon.entries.filter(entry => entry.review === 'approved').map(entry => entry.word), overlay);
  const broadIndex = process.argv.indexOf('--broad-ref');
  const broad = broadIndex >= 0;
  if (broad) {
    const requested = process.argv[broadIndex + 1];
    if (requested !== manifest.broadRecognitionSnapshot.sourceRef) throw new Error('broad snapshot ref must match manifest');
    const fromGit = relative => cp.execFileSync('git', ['show', requested + ':' + relative], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
    words = words.concat(
      fromGit('content/lexicon-v3/working/recognition-words.txt').split(/\r?\n/),
      fromGit('content/gen6/round3-eight/wordfreq-cs-runtime.txt').split(/\r?\n/),
      JSON.parse(fromGit('content/lexicon-v3/working/variant-groups.json')).groups.flatMap(group => group.members || []),
    );
  }
  const result = audit(archive, words);
  const expectedWordCount = broad ? manifest.broadRecognitionSnapshot.wordCount : manifest.recognitionWords.combinedStaticWordCount;
  if (result.wordCount !== expectedWordCount) throw new Error('audit word count no longer matches pinned manifest');
  for (const record of result.records) {
    const entry = manifest.boards.find(board => board.puzzleId === record.puzzleId);
    const expected = broad ? entry.quality.broadSnapshotExactCoverSolutions : entry.quality.staticExactCoverSolutions;
    if (record.completeSolutionCount !== expected) throw new Error('cover count differs on ' + record.puzzleId);
  }
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({status: 'PASS', mode: broad ? 'broad-pinned-gen6' : 'production-static',
    wordCount: result.wordCount, boardCount: result.boardCount, solutionHistogram: result.solutionHistogram}, null, 2));
}
