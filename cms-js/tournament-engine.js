/* =========================================================
   TOURNAMENT ENGINE (pure, no DOM)
   4 thể thức: Đấu loại trực tiếp (SE) · Đấu loại trực tiếp kép (DE) ·
   Vòng tròn (RR) · Swiss tính mạng (SW).
   Thuật toán port từ Biadi Tournament Manager (đã kiểm chứng) —
   xem Biadi_Tournament_Manager_SPEC.md.
   ========================================================= */
function tbkNextPow2(n){ let s=1; while(s<n) s*=2; return s; }
function tbkBracketSeeds(size){
  let s=[1,2];
  while(s.length<size){ const n=s.length*2, nx=[]; for(const x of s){ nx.push(x); nx.push(n+1-x); } s=nx; }
  return s;
}
function tbkPlace(M,tid,slot,pid){
  const m=M[tid]; if(slot===1) m.p1=pid; else m.p2=pid;
  if(m.p1!=null && m.p2!=null) m.status='ready';
}
function tbkDecide(M,mid,winId,s1,s2){
  const m=M[mid]; m.win=winId;
  if(s1!=null){ m.s1=s1; m.s2=s2; }
  m.status='done';
  const lose=(m.p1===winId?m.p2:m.p1);
  if(m.winTo) tbkPlace(M,m.winTo[0],m.winTo[1],winId);
  if(m.loseTo) tbkPlace(M,m.loseTo[0],m.loseTo[1],lose);
  return lose;
}
function tbkResolveByes(M){
  let chg=true;
  while(chg){ chg=false;
    for(const id in M){ const m=M[id];
      if(m.status==='ready' && (m.p1==='BYE'||m.p2==='BYE')){
        const w=(m.p1==='BYE'&&m.p2==='BYE')?'BYE':(m.p1==='BYE'?m.p2:m.p1);
        tbkDecide(M,m.id,w); chg=true;
      }
    }
  }
}
function tbkGenSE(seedIds){
  const N=seedIds.length, size=tbkNextPow2(N), seeds=tbkBracketSeeds(size), k=Math.log2(size);
  const M={}, rounds=[]; let id=0; const pid=s=>(s<=N?seedIds[s-1]:'BYE');
  let r0=[];
  for(let i=0;i<size/2;i++){ M[id]={id,br:'W',round:0,idx:i,p1:pid(seeds[2*i]),p2:pid(seeds[2*i+1]),win:null,s1:null,s2:null,status:'ready',winTo:null,loseTo:null}; r0.push(id); id++; }
  rounds.push(r0);
  for(let r=1;r<k;r++){ const cur=[], cnt=size/2**(r+1);
    for(let i=0;i<cnt;i++){ M[id]={id,br:'W',round:r,idx:i,p1:null,p2:null,win:null,s1:null,s2:null,status:'wait',winTo:null,loseTo:null}; cur.push(id); id++; }
    rounds[r-1].forEach((mid,i)=>M[mid].winTo=[cur[Math.floor(i/2)],(i%2)+1]); rounds.push(cur);
  }
  tbkResolveByes(M);
  return {matches:M, rounds, type:'SE', size, k};
}
function tbkGenDE(seedIds){
  const N=seedIds.length, size=tbkNextPow2(N), seeds=tbkBracketSeeds(size), k=Math.log2(size);
  const M={}; let id=0; const pid=s=>(s<=N?seedIds[s-1]:'BYE'); const WB=[], LB=[];
  let r0=[];
  for(let i=0;i<size/2;i++){ M[id]={id,br:'W',round:0,idx:i,p1:pid(seeds[2*i]),p2:pid(seeds[2*i+1]),win:null,s1:null,s2:null,status:'ready',winTo:null,loseTo:null}; r0.push(id); id++; }
  WB.push(r0);
  for(let r=1;r<k;r++){ const cur=[], cnt=size/2**(r+1);
    for(let i=0;i<cnt;i++){ M[id]={id,br:'W',round:r,idx:i,p1:null,p2:null,win:null,s1:null,s2:null,status:'wait',winTo:null,loseTo:null}; cur.push(id); id++; }
    WB[r-1].forEach((mid,i)=>M[mid].winTo=[cur[Math.floor(i/2)],(i%2)+1]); WB.push(cur);
  }
  let lbr=0;
  const mk=cnt=>{ const a=[]; for(let i=0;i<cnt;i++){ M[id]={id,br:'L',round:lbr,idx:i,p1:null,p2:null,win:null,s1:null,s2:null,status:'wait',winTo:null,loseTo:null}; a.push(id); id++; } LB.push(a); lbr++; return a; };
  let minor=mk(size/4);
  WB[0].forEach((mid,i)=>M[mid].loseTo=[minor[Math.floor(i/2)],(i%2)+1]);
  let prev=minor;
  for(let r=1;r<k;r++){ const major=mk(prev.length);
    prev.forEach((mid,i)=>M[mid].winTo=[major[i],1]); WB[r].forEach((mid,i)=>M[mid].loseTo=[major[i],2]); prev=major;
    if(r<k-1){ const mn=mk(prev.length/2); prev.forEach((mid,i)=>M[mid].winTo=[mn[Math.floor(i/2)],(i%2)+1]); prev=mn; }
  }
  const lbFinal=prev[0];
  M[id]={id,br:'GF',round:0,idx:0,p1:null,p2:null,win:null,s1:null,s2:null,status:'wait',winTo:null,loseTo:null}; const gfId=id; id++;
  M[id]={id,br:'GF2',round:0,idx:0,p1:null,p2:null,win:null,s1:null,s2:null,status:'void',winTo:null,loseTo:null}; const gf2Id=id; id++;
  M[WB[k-1][0]].winTo=[gfId,1]; M[lbFinal].winTo=[gfId,2]; M[gfId]._gf2=gf2Id;
  tbkResolveByes(M);
  return {matches:M, WB, LB, gfId, gf2Id, type:'DE', size, k};
}
function tbkGenRR(ids){
  let arr=ids.slice(); if(arr.length%2) arr.push('BYE');
  const n=arr.length, rounds=[]; let id=0; const M={};
  for(let r=0;r<n-1;r++){ const rd=[];
    for(let i=0;i<n/2;i++){ const a=arr[i], b=arr[n-1-i];
      if(a!=='BYE'&&b!=='BYE'){ M[id]={id,round:r,a,b,win:null,s1:null,s2:null}; rd.push(id); id++; }
    }
    rounds.push(rd); arr.splice(1,0,arr.pop());
  }
  return {matches:M, rounds, type:'RR'};
}
function tbkRoundName(r,total){
  const fromEnd=total-1-r;
  if(fromEnd===0) return 'Chung kết';
  if(fromEnd===1) return 'Bán kết';
  if(fromEnd===2) return 'Tứ kết';
  return 'Vòng '+(2**(total-r));
}
function tbkElimChampion(eng){
  if(eng.type==='SE'){ const last=eng.rounds[eng.rounds.length-1][0]; const m=eng.matches[last]; return m&&m.status==='done'?m.win:null; }
  const M=eng.matches, gf=M[eng.gfId], gf2=M[eng.gf2Id];
  if(gf2.status==='done') return gf2.win;
  if(gf.status==='done' && gf.win===gf.p1) return gf.win;
  return null;
}
function tbkShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---- Round Robin standings ---- */
function tbkRrStandings(rr, ids, nameOf){
  const st={}; ids.forEach(id=>st[id]={id,w:0,l:0,gd:0,pts:0,opp:{}});
  Object.values(rr.matches).forEach(m=>{ if(m.win==null) return; const lose=m.win===m.a?m.b:m.a;
    st[m.win].w++; st[lose].l++; st[m.win].pts++; st[m.a].gd+=(m.s1-m.s2); st[m.b].gd+=(m.s2-m.s1); st[m.win].opp[lose]=1; });
  return ids.map(id=>st[id]).sort((a,b)=>b.pts-a.pts || b.gd-a.gd || (b.opp[a.id]?1:-1));
}

/* ---- Swiss (lives) ---- */
function tbkSwDerive(playerIds, lives, matches){
  const st={}; playerIds.forEach(id=>st[id]={id,wins:0,losses:0,gw:0,gl:0,opps:new Set()});
  matches.filter(m=>m.confirmed).forEach(m=>{
    if(m.bye){ st[m.winnerId].wins++; return; }
    const w=m.winnerId, l=(m.aId===w?m.bId:m.aId);
    st[w].wins++; st[l].losses++;
    st[m.aId].gw+=m.sa; st[m.aId].gl+=m.sb; st[m.bId].gw+=m.sb; st[m.bId].gl+=m.sa;
    st[m.aId].opps.add(m.bId); st[m.bId].opps.add(m.aId);
  });
  playerIds.forEach(id=>{ const s=st[id]; s.alive=s.losses<lives; s.left=lives-s.losses; });
  return st;
}
function tbkSwSos(st,id){ let s=0; st[id].opps.forEach(o=>s+=st[o].wins); return s; }
function tbkSwRoundMatches(sw){ return sw.matches.filter(m=>m.round===sw.round); }
function tbkSwissDrawn(sw){ return tbkSwRoundMatches(sw).length>0; }
function tbkSwRoundComplete(sw){ const ms=tbkSwRoundMatches(sw); return ms.length>0 && ms.every(m=>m.confirmed); }
function tbkSwissDraw(sw, players, lives, nameOf){
  const ids=players.map(p=>p.id);
  const st=tbkSwDerive(ids, lives, sw.matches);
  const active=players.filter(p=>st[p.id].alive);
  const groups={}; for(let L=0;L<lives;L++) groups[L]=[];
  active.forEach(p=>groups[st[p.id].losses].push(p));
  const inner=g=>g.sort((a,b)=>st[b.id].wins-st[a.id].wins || tbkSwSos(st,b.id)-tbkSwSos(st,a.id) || nameOf(a.id).localeCompare(nameOf(b.id),'vi'));
  let pairs=[], fl=null;
  for(let L=0;L<lives;L++){ let g=inner(groups[L].slice()); if(sw.round===1) g=tbkShuffle(g); if(fl){ g=[fl,...g]; fl=null; }
    while(g.length>=2){ const a=g.shift(); let j=0; while(j<g.length && st[a.id].opps.has(g[j].id)) j++; if(j>=g.length) j=0; const b=g.splice(j,1)[0]; pairs.push([a,b]); }
    if(g.length) fl=g[0];
  }
  pairs.forEach(([a,b])=>sw.matches.push({id:sw.seq++, round:sw.round, aId:a.id, bId:b.id, winnerId:null, sa:null, sb:null, bye:false, confirmed:false, ts:null}));
  if(fl) sw.matches.push({id:sw.seq++, round:sw.round, aId:fl.id, bId:null, winnerId:fl.id, sa:null, sb:null, bye:true, confirmed:true, ts:Date.now()});
}
function tbkSwissNext(sw, players, lives){
  if(!tbkSwRoundComplete(sw)) return false;
  const st=tbkSwDerive(players.map(p=>p.id), lives, sw.matches);
  if(players.filter(p=>st[p.id].alive).length<=1) return false;
  sw.round++; return true;
}

/* ---- Simulator ---- */
function tbkWinProb(ra,rb){ return 1/(1+Math.exp(-(ra-rb)/180)); }
function tbkSimScore(aId,bId,ratingOf){
  const p=tbkWinProb(ratingOf(aId), ratingOf(bId));
  const win=Math.random()<p?aId:bId, lose=win===aId?bId:aId;
  const close=1-Math.abs(p-.5)*2;
  const ls=Math.min(4, Math.floor(Math.random()*5*(0.45+0.5*close)));
  return {win,lose,ws:5,ls};
}

/* Trình duyệt nạp file này bằng thẻ <script> nên các hàm trên là biến toàn cục.
   Trong Node (unit test / tournament-seeding.js) thì xuất qua CommonJS. */
if (typeof module === 'object' && module.exports) {
  module.exports = {
    tbkNextPow2, tbkBracketSeeds, tbkPlace, tbkDecide, tbkResolveByes,
    tbkGenSE, tbkGenDE, tbkGenRR, tbkRoundName, tbkElimChampion, tbkShuffle,
    tbkRrStandings, tbkSwDerive, tbkSwSos, tbkSwRoundMatches, tbkSwissDrawn,
    tbkSwRoundComplete, tbkSwissDraw, tbkSwissNext, tbkWinProb, tbkSimScore,
  };
}
