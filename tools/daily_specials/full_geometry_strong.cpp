// Bounded, seeded geometry search for the private eight-board revision.
// Backbite moves preserve one Hamiltonian cover. Segment lengths are the
// original 14-word / 100-cell multiset. Annealing now rewards contacts between
// DIFFERENT words and genuine row/column interdigitation, not just curls.
// Endpoint parity forbids accidental end-to-start chaining. Python independently
// rechecks every accepted layout, its letters, and exact-cover uniqueness.
// The xorshift RNG is specified here; this helper has no network or DB access.
// Usage: ./geometry SEED MAX_ATTEMPTS REQUIRED_POOL > geometry-pool.jsonl
// Exit 3 is an incomplete pool, NEVER permission to publish a partial bank.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <set>
#include <string>
#include <vector>
using namespace std;
using Path=array<int,100>;
using Lens=array<int,14>;
struct RNG{uint64_t s; uint64_t next(){s^=s<<13;s^=s>>7;s^=s<<17;return s;} int pick(int n){return next()%n;} double unit(){return (next()>>11)*0x1.0p-53;}};
array<vector<int>,100> adj;
struct M{int cross=0,gaps=0,degree=0,mindegree=99,seam=99,turns=0,deficit=0;bool valid=true;array<int,14> flip{};};
M eval(const Path&p,const Lens&len){
 M m;array<int,100>owner,endpoint;endpoint.fill(-1);array<int,14>start,end;array<uint16_t,14>near{};int off=0;
 for(int i=0;i<14;i++){
  start[i]=off;end[i]=off+len[i]-1;int t=0;
  for(int j=off;j<=end[i];j++){owner[p[j]]=i;if(j>off&&j<end[i]&&p[j]-p[j-1]!=p[j+1]-p[j])t++;}
  endpoint[p[off]]=2*i;endpoint[p[end[i]]]=2*i+1;m.turns+=t;m.deficit+=max(0,3-t);off+=len[i];
 }
 for(int c=0;c<100;c++)for(int n:adj[c])if(c<n&&owner[c]!=owner[n]){m.cross++;near[owner[c]]|=1<<owner[n];near[owner[n]]|=1<<owner[c];}
 for(auto x:near){int n=__builtin_popcount(x);m.degree+=n;m.mindegree=min(m.mindegree,n);}
 for(int axis=0;axis<2;axis++){
  for(int line=0;line<10;line++){
   uint16_t seen=0;int last=-1;
   for(int j=0;j<10;j++){int v=owner[axis?j*10+line:line*10+j];if(v!=last){if(seen&(1<<v))m.gaps++;seen|=1<<v;}last=v;}
  }
  for(int cut=3;cut<=7;cut++){
   int cross=0;for(int i=0;i<14;i++){int lo=10,hi=-1;for(int j=start[i];j<=end[i];j++){int v=axis?p[j]%10:p[j]/10;lo=min(lo,v);hi=max(hi,v);}if(lo<cut&&cut<=hi)cross++;}m.seam=min(m.seam,cross);
  }
 }
 m.flip.fill(-1);
 for(int i=0;i<14;i++){
  if(m.flip[i]>=0)continue;m.flip[i]=0;array<int,14>todo;int n=1;todo[0]=i;
  while(n){int k=todo[--n];for(int e=0;e<2;e++){int c=p[e?end[k]:start[k]];for(int z:adj[c])if(endpoint[z]>=0){int j=endpoint[z]/2,parity=e^(endpoint[z]%2);if(j==k)continue;int need=m.flip[k]^parity;if(m.flip[j]>=0){if(m.flip[j]!=need){m.valid=false;return m;}}else{m.flip[j]=need;todo[n++]=j;}}}}
 }
 return m;
}
double score(const M&m){return 1.5*m.cross+3.5*m.gaps+.3*m.degree-24*m.deficit-8*max(0,66-m.turns)-10*max(0,2-m.seam)-8*max(0,3-m.mindegree)-(m.valid?0:22);}
string signature(const Path&p,const Lens&len){vector<string>parts;int off=0;for(int n:len){vector<int>a(p.begin()+off,p.begin()+off+n);sort(a.begin(),a.end());string s;for(int x:a)s+=char(x+1);parts.push_back(s);off+=n;}sort(parts.begin(),parts.end());string s;for(auto a:parts){s+=a;s+='\0';}return s;}
int main(int argc,char**argv){
 if(argc!=4){cerr<<"seed attempts pool-size required\n";return 2;}uint64_t seed=stoull(argv[1]);int limit=stoi(argv[2]),want=stoi(argv[3]);if(!seed||limit<1||limit>100000000||want<1||want>256)return 2;RNG rng{seed};
 for(int i=0;i<100;i++){if(i>=10)adj[i].push_back(i-10);if(i<90)adj[i].push_back(i+10);if(i%10)adj[i].push_back(i-1);if(i%10<9)adj[i].push_back(i+1);}
 Path p;int j=0;for(int r=0;r<10;r++)for(int c=0;c<10;c++)p[j++]=r*10+(r%2?9-c:c);
 Lens len={5,6,6,6,7,7,7,7,8,8,8,8,8,9};M m=eval(p,len);double s=score(m);int count=0;set<string>seen;
 for(int step=0;step<limit;step++){
  Path pp=p;Lens ll=len;
  if(rng.pick(100)<16){int i=rng.pick(14),j=rng.pick(14);swap(ll[i],ll[j]);}
  else{if(rng.pick(2))reverse(pp.begin(),pp.end());int cell=adj[pp[0]][rng.pick(adj[pp[0]].size())];int idx=find(pp.begin(),pp.end(),cell)-pp.begin();if(idx<2)continue;reverse(pp.begin(),pp.begin()+idx);}
  M mm=eval(pp,ll);double ss=score(mm);double temp=1.6+7.4*(1-(step%20000)/20000.0);
  if(ss>=s||rng.unit()<exp((ss-s)/temp)){p=pp;len=ll;m=mm;s=ss;}
  if(mm.valid&&mm.deficit==0&&mm.turns>=66&&mm.cross>=76&&mm.gaps>=4&&mm.mindegree>=3&&mm.seam>=2&&mm.degree>=56){
   auto sig=signature(pp,ll);if(!seen.insert(sig).second)continue;
   cout<<"{\"step\":"<<step<<",\"seed\":"<<seed<<",\"paths\":[";int off=0;
   for(int i=0;i<14;i++){if(i)cout<<",";cout<<"[";for(int k=0;k<ll[i];k++){if(k)cout<<",";cout<<pp[off+(mm.flip[i]?ll[i]-1-k:k)];}cout<<"]";off+=ll[i];}
   cout<<"],\"geometry\":{\"crossContacts\":"<<mm.cross<<",\"axisReentries\":"<<mm.gaps<<",\"totalTurns\":"<<mm.turns<<",\"degreeSum\":"<<mm.degree<<",\"minNeighbors\":"<<mm.mindegree<<",\"minSeamCrossers\":"<<mm.seam<<"}}\n"<<flush;
   if(++count>=want)break;
  }
 }
 cerr<<"saved="<<count<<" seed="<<seed<<" requested="<<want<<"\n";return count==want?0:3;
}

