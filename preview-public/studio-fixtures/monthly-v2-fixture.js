/* Synthetic response contract for the native monthly screen. No player data or backend writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PropletMonthlyV2Fixture=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function response(requested='ready',version=3){
 const v3=version!==2;
 const kind=['ready','provisional','ties','closed','clarity'].includes(requested)?requested:'ready',closed=kind==='closed',pending=kind==='ties';
 const days=Array.from({length:21},(_,i)=>({date:'2026-11-'+String(i+1).padStart(2,'0'),points:i===20?(v3?95:82):90,counted:i===20?v3:i===19?!v3:true,completionPoints:55,independencePoints:v3?(i===20?20:25):undefined,cleanPoints:v3?0:i===20?0:15,hintPoints:v3?0:i===20?7:10,speedPoints:i===20?20:10,hints:i===20?1:0,clean:i<20,verifiedTimeMs:180000,provisional:!closed}));
 const me={id:'studio-review',name:'Ukázkový hráč',rank:4,points:v3?2055:2050,dailyPoints:v3?1805:1800,otherPoints:250,otherEarnedXp:3000,countedDays:20,validDays:21,cleanCount:v3?19:20,hintCount:v3?1:0,verifiedTimeMs:3600000,unverifiedDays:0,drawPending:false,tieBreakReason:'points',isMine:true,days};
 let standings=[{...me,id:'fixture-a',name:'Ukázková Klára',rank:1,points:2300,dailyPoints:1850,otherPoints:450,otherEarnedXp:5400,isMine:false}, {...me,id:'fixture-b',name:'Ukázkový Lukáš',rank:2,points:2300,dailyPoints:1850,otherPoints:450,otherEarnedXp:5400,cleanCount:18,isMine:false,tieBreakReason:'cleanCount'}, {...me,id:'fixture-c',name:'Ukázková Eva',rank:3,points:2200,dailyPoints:1800,otherPoints:400,otherEarnedXp:4800,isMine:false}, me];
 if(kind==='clarity')standings=[{...me,id:'fixture-clarity-daily',name:'Ukázková Klára',rank:1,points:502.5,dailyPoints:90,otherPoints:412.5,otherEarnedXp:4950,countedDays:1,validDays:1,cleanCount:1,hintCount:0,isMine:false,days:[days[0]]},{...me,id:'studio-review',name:'Ukázkový hráč',rank:2,points:16.7,dailyPoints:0,otherPoints:16.7,otherEarnedXp:200,countedDays:0,validDays:0,cleanCount:0,hintCount:0,verifiedTimeMs:null,days:[]}];
 if(pending)standings=standings.map((r,i)=>({...r,points:2500,dailyPoints:2000,otherPoints:500,otherEarnedXp:6000,rank:1,cleanCount:20,hintCount:0,drawPending:true,tieBreakReason:'pendingDraw',days:r.days.map(d=>({...d,points:100,independencePoints:v3?25:undefined,cleanPoints:v3?0:15,hintPoints:v3?0:10,hints:0,clean:true,speedPoints:20}))}));
 if(closed){Object.assign(standings[0],{cleanCount:20,tieBreakReason:'draw'});Object.assign(standings[1],{cleanCount:20,tieBreakReason:'draw'});}
 return {enabled:true,month:'2026-11',status:closed?'closed':kind==='provisional'?'provisional':'open',scoringVersion:v3?3:2,rulesVersion:v3?'monthly-independence-v3':'monthly-quality-v2',scoring:{dailyMax:2000,otherMax:500,totalMax:2500,dailyLimit:20,xpPerPoint:12,otherXpCap:6000},endDate:'2026-12-01',endsAt:'2026-11-30T23:00:00Z',closesAt:'2026-12-02T23:00:00Z',scenarioViewer:true,onlineBackend:false,isolatedScenario:(v3?'monthly-v3-':'monthly-v2-')+kind,standings,me:standings.find(r=>r.isMine),badges:[],previousPodium:[]};
}
return {response};
});
