/* ============================================================
   NYAM FM — server game tebak lagu
   Zero dependency. Node 18+ (pakai global fetch).  node server.js
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const WIN  = 30000;   // durasi jawab per ronde (ms)
const CERE = 5;       // sandung di bawah berapa kali -> dapat gelar sendok

/* ---------- database lagu (2000-2025) ----------
   tag: k=kekinian n=nostalgia 2000an i=pop indo p=kpop m=melow d=party */
const SONGS = [
["Blinding Lights","The Weeknd",2020,"k d"],["Cruel Summer","Taylor Swift",2019,"k"],
["As It Was","Harry Styles",2022,"k m"],["Heat Waves","Glass Animals",2021,"k m"],
["Stay","The Kid LAROI, Justin Bieber",2021,"k d"],["Espresso","Sabrina Carpenter",2024,"k d"],
["Birds of a Feather","Billie Eilish",2024,"k m"],["Beautiful Things","Benson Boone",2024,"k m"],
["Die With a Smile","Lady Gaga, Bruno Mars",2024,"k m"],["APT.","ROSÉ, Bruno Mars",2024,"k p d"],
["Paint the Town Red","Doja Cat",2023,"k d"],["Kill Bill","SZA",2022,"k"],
["Anti-Hero","Taylor Swift",2022,"k"],["Million Dollar Baby","Tommy Richman",2024,"k d"],
["Not Like Us","Kendrick Lamar",2024,"k d"],["Ordinary","Alex Warren",2025,"k m"],
["No One Noticed","The Marías",2024,"k m"],["toxic till the end","ROSÉ",2024,"k m"],
["Golden","HUNTR/X, EJAE, AUDREY NUNA, REI AMI",2025,"k p d"],
["Super Shy","NewJeans",2023,"k p"],["Supernova","aespa",2024,"k p"],
["Dynamite","BTS",2020,"p d"],["How You Like That","BLACKPINK",2020,"p d"],
["Super","SEVENTEEN",2023,"p"],["Perfect Night","LE SSERAFIM",2023,"p"],
["Komang","Raim Laode",2022,"i m"],["Lantas","Juicy Luicy",2019,"i m"],
["Sialnya, Hidup Harus Tetap Berjalan","Bernadya",2024,"i m"],["Satu Bulan","Bernadya",2024,"i"],
["Bunga Hati","Bernadya",2024,"i m"],["Amin Paling Serius","Sal Priadi, Nadin Amizah",2019,"i m"],
["Secukupnya","Hindia",2019,"i m"],["Evaluasi","Hindia",2022,"i"],
["Hati-Hati di Jalan","Tulus",2022,"i m"],["Monokrom","Tulus",2016,"i"],
["Sepatu","Tulus",2022,"i"],["Cinta Luar Biasa","Andmesh",2019,"i m"],
["Tak Ingin Usai","Keisya Levronka",2022,"i m"],["Lathi","Weird Genius, Sara Fajira",2020,"i d"],
["Garam dan Madu","Tenxi, Jemsii, Sukarno",2024,"i d"],["Kupu-Kupu","Adrian Khalif",2024,"i d"],
["Nina","FEAST",2024,"i"],["Akad","Payung Teduh",2017,"i m"],
["Takut","Fiersa Besari",2017,"i m"],["Asal Kau Bahagia","Armada",2017,"i"],
["Separuh Aku","NOAH",2012,"i m"],["Kau Adalah","Isyana Sarasvati, Rayi Putra",2017,"i"],
["Perahu Kertas","Maudy Ayunda",2012,"i m"],["Surat Cinta untuk Starla","Virgoun",2016,"i m"],
["Complicated","Avril Lavigne",2002,"n"],["Numb","Linkin Park",2003,"n"],
["Bring Me to Life","Evanescence",2003,"n"],["Yeah!","Usher, Lil Jon, Ludacris",2004,"n d"],
["Crazy in Love","Beyoncé, Jay-Z",2003,"n d"],["This Love","Maroon 5",2004,"n"],
["Don't Cha","The Pussycat Dolls, Busta Rhymes",2005,"n d"],["Hey There Delilah","Plain White T's",2006,"n m"],
["Viva la Vida","Coldplay",2008,"n"],["Poker Face","Lady Gaga",2008,"n d"],
["I Gotta Feeling","The Black Eyed Peas",2009,"n d"],["Chasing Cars","Snow Patrol",2006,"n m"],
["Risalah Hati","Dewa 19",2000,"n i"],["Semua Tentang Kita","Peterpan",2005,"n i m"],
["Seberapa Pantas","Sheila on 7",2006,"n i"],["Aku Terjatuh","ST12",2008,"n i m"],
["Tentang Aku, Kau dan Dia","Kangen Band",2007,"n i"],["Laskar Pelangi","Nidji",2008,"n i"],
["Tak Ada Logika","Agnes Monica",2005,"n i d"],["Animals","Martin Garrix",2013,"d"],
["Faded","Alan Walker",2015,"d"],["Wake Me Up","Avicii",2013,"d"],
["Party Rock Anthem","LMFAO",2011,"d"],["Counting Stars","OneRepublic",2013,"d m"],
].map(x => ({ t:x[0], a:x[1], y:x[2], g:x[3] }));

const THEMES = {all:'Semua 2000—2026',k:'Kekinian',n:'Nostalgia 2000-an',i:'Pop Indonesia',p:'K-Pop',m:'Melow',d:'Party / EDM'};
const BOTNAMES = ["Ucup Surucup","Bang Toyib","Neng Ohim","Mamang Kesbor","Kucing Oren","Anak Warnet","Tukang Bakso Keliling","Robot Gagal Move On","Sultan Titipan","Polisi Tidur"];
const PCOLORS  = ['#FF6B1A','#CDF24B','#FFB01A','#F25C88','#7FE0C3','#E8E1D3','#C6873F','#9AE66E','#FF8DA1','#B7E3FF'];

/* ---------- util grading ---------- */
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/&/g,'and').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const feat = s => String(s||'').replace(/\s*[\(\[]?\s*(feat|ft|featuring)\b.*$/i,'').trim();
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  let prev=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){const cur=[i];
    for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur}return prev[n]}
function similar(a,b){a=norm(a);b=norm(b);if(!a||!b)return false;
  if(a===b)return true;
  if(lev(a,b)<=Math.floor(Math.max(a.length,b.length)/7))return true;
  if(a.length>=4&&b.length>=4&&(a.includes(b)||b.includes(a)))return true;
  return false}
function matchTitle(guess,song){
  const g=norm(feat(guess)),t=norm(song.t);if(!g)return false;
  return similar(g,t)||(g.includes(t)&&t.length>=4)}
function matchArtist(guess,song){
  const g=norm(feat(guess));if(!g)return false;
  return song.a.split(',').some(seg=>{
    const s=seg.trim();
    if(similar(g,s))return true;
    if(s.length>=4&&g.includes(norm(s)))return true;
    return false})}
/* closeness: 0..1, seberapa mirip dua teks (1 = identik) */
function closeness(a,b){
  a=norm(a);b=norm(b);
  if(!a||!b)return 0;
  if(a===b)return 1;
  const m=Math.max(a.length,b.length);
  return m?Math.max(0,1-lev(a,b)/m):0}
/* ambang "nyaris": di bawah ini dianggap salah total */
const NEAR=0.5;
function nearScore(song,gt,ga){
  const c=Math.max(
    closeness(gt,song.t),closeness(ga,song.a),
    closeness(ga,song.t),closeness(gt,song.a));
  return c>=NEAR?c:0}
function gradeAgainst(song,gt,ga){
  const a=(matchTitle(gt,song)&&matchArtist(ga,song))?2:((matchTitle(gt,song)||matchArtist(ga,song))?1:0);
  const b=(matchTitle(ga,song)&&matchArtist(gt,song))?2:((matchArtist(ga,song)||matchTitle(gt,song))?1:0);
  const g=Math.max(a,b);
  if(g>0)return g;
  /* belum kena, tapi kalau ejaannya dekat tetap dapat poin kecil */
  return nearScore(song,gt,ga)>0?3:0}

/* ---------- codec ruangan ---------- */
const rooms = new Map();
const rid   = () => crypto.randomBytes(6).toString('hex');
const genCode = () => Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join('');
const shuffle = a => {for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};

function newRoom(code){
  return { code, players:[], hostId:null, phase:'lobby', round:0, total:8,
    settings:{themes:['k'],rounds:8,src:'db',custom:[],plLink:''},
    pool:[], activeIdx:0, q:null, qEndsAt:0, countEnds:0, locked:new Set(),
    graded:{}, results:null, lastRows:[], podStats:[], streams:new Map(),
    leaveTimers:{}, timers:[], touched:Date.now() };
}
function clearTimers(room){room.timers.forEach(clearTimeout);room.timers=[]}
function themeLabel(st){
  if(!st.themes.length||st.themes.includes('all'))return 'Semua 2000—2026';
  return st.themes.map(t=>THEMES[t]).filter(Boolean).join(' + ')||'—';
}
function snap(room){
  return {
    code:room.code, phase:room.phase, round:room.round, total:room.total,
    hostId:room.hostId, themeLabel:themeLabel(room.settings),
    players:room.players.map(p=>({id:p.id,name:p.name,bot:p.bot,score:p.score,sp:p.sp,
      spectate:!!p.spectate,host:p.id===room.hostId})),
    board:room.players.filter(p=>!p.spectate).slice().sort((a,b)=>b.score-a.score)
      .map(p=>({id:p.id,name:p.name,bot:p.bot,score:p.score,sp:p.sp,host:p.id===room.hostId})),
    settings:{themes:room.settings.themes,rounds:room.settings.rounds,src:room.settings.src,plLink:room.settings.plLink},
    locked:[...room.locked].map(id=>{const p=room.players.find(x=>x.id===id);return{id,name:p?p.name:'?'}}),
    q:  room.phase==='q' ? {url:room.q.url, endsAt:room.qEndsAt} : null,
    count: room.phase==='count' ? {endsAt:room.countEnds} : null,
    reveal: room.results,
    pod: room.phase==='pod' ? {rows:room.lastRows, stats:room.podStats} : null,
  };
}
function pushSnap(room){
  room.touched=Date.now();
  const msg=JSON.stringify({type:'state',now:Date.now(),s:snap(room)});
  room.streams.forEach(st=>{try{st.res.write('data: '+msg+'\n\n')}catch(e){}});
}
function ev(room,type,data){
  const msg=JSON.stringify(Object.assign({type},data));
  room.streams.forEach(st=>{try{st.res.write('data: '+msg+'\n\n')}catch(e){}});
}
function destroyRoom(room){
  ev(room,'dead',{});clearTimers(room);
  room.streams.forEach(st=>{try{st.res.end()}catch(e){}});
  rooms.delete(room.code);
}
function addPlayer(room,name,bot){
  const p={id:rid(),token:rid(),name:String(name||'Anonim').slice(0,18),bot:!!bot,
    score:0,sp:0,spectate:room.phase!=='lobby',skill:bot?(.35+Math.random()*.55):1,
    lastGr:-1,lastPts:0,lastGt:'',lastGa:''};
  room.players.push(p);
  if(!bot&&!room.hostId)room.hostId=p.id;
  return p;
}
function removePlayer(room,pid){
  const p=room.players.find(x=>x.id===pid);if(!p)return;
  room.players=room.players.filter(x=>x.id!==pid);
  ev(room,'toast',{msg:p.name+' keluar room',icn:'log-out'});
  if(p.id===room.hostId){
    const next=room.players.find(x=>!x.bot);
    if(next){room.hostId=next.id;ev(room,'toast',{msg:'Host baru: '+next.name,icn:'crown'})}
    else return destroyRoom(room);
  }
  if(!room.players.some(x=>!x.bot))return destroyRoom(room);
  pushSnap(room);
}

/* ---------- gali preview lagu via iTunes Search (gratis, tanpa key) ---------- */
const previewCache=new Map();
async function resolveSong(entry){
  const key=norm(entry.a)+'|'+norm(entry.t);
  if(previewCache.has(key))return previewCache.get(key);
  let out=null;
  try{
    const artist=entry.a.replace(/\s*(feat|ft)\b.*$/i,'');
    const r=await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(artist+' '+entry.t)+
      '&media=music&entity=song&limit=6');
    const j=await r.json();
    const res=j.results||[];
    const nt=norm(entry.t),na=norm(artist);
    const best=res.find(x=>norm(x.trackName||'').includes(nt)&&norm(x.artistName||'').includes(na))
            ||res.find(x=>norm(x.trackName||'').includes(nt))
            ||res.find(x=>norm(x.artistName||'').includes(na))
            ||res[0];
    if(best&&best.previewUrl)out={t:entry.t,a:entry.a,y:entry.y||String(best.releaseDate||'').slice(0,4)||'',
      url:best.previewUrl,art:(best.artworkUrl100||'').replace('100x100','600x600')};
  }catch(e){/* offline / gagal -> null */}
  previewCache.set(key,out);
  return out;
}
function parseList(raw){
  return String(raw||'').split('\n')
    .map(l=>l.replace(/^[\s\d\.\)\-\*•]+/,'').trim())
    .filter(Boolean).slice(0,30)
    .map(l=>{const m=l.split(/\s[-–—]\s|\s+by\s+/i);
      return m.length>=2?{t:m[0].trim(),a:m.slice(1).join(' ').trim()}:null})
    .filter(Boolean);
}

/* ---------- mesin ronde ---------- */
function beginRound(room,r){
  clearTimers(room);
  room.round=r;room.graded={};room.locked=new Set();room.results=null;
  room.phase='count';
  room.countEnds=Date.now()+3400;
  const idx=room.activeIdx;room.activeIdx++;
  room.q={idx,url:room.pool[idx].url};
  pushSnap(room);
  room.timers.push(setTimeout(()=>startQ(room),3500));
}
function startQ(room){
  room.phase='q';room.locked=new Set();
  room.qEndsAt=Date.now()+WIN;
  pushSnap(room);
  scheduleBots(room,room.pool[room.q.idx]);
  room.timers.push(setTimeout(()=>endRound(room),WIN+400));
}
function onAnswer(room,pid,round,gt,ga){
  if(room.phase!=='q'||round!==room.round||room.graded[pid])return;
  const p=room.players.find(x=>x.id===pid);
  if(!p||p.spectate)return;
  const song=room.pool[room.q.idx];
  const gr=gradeAgainst(song,String(gt||'').slice(0,80),String(ga||'').slice(0,80));
  const remain=Math.max(0,room.qEndsAt-Date.now());
  const pts=gr===2?100+Math.round(100*remain/WIN)
          : gr===1?50+Math.round(50*remain/WIN)
          : gr===3?10+Math.round(15*remain/WIN)
          : 0;
  room.graded[pid]={gr,pts,gt:String(gt||'').trim().slice(0,80),ga:String(ga||'').trim().slice(0,80)};
  room.locked.add(pid);
  pushSnap(room);
  const active=room.players.filter(x=>!x.spectate);
  if(room.locked.size>=active.length){ // semua sudah menjawab -> potong duluan
    clearTimers(room);
    room.timers.push(setTimeout(()=>endRound(room),1200));
  }
}
const pickWrong=(song,list,key)=>{const c=list.filter(s=>s[key]!==song[key]);return c[crypto.randomInt(c.length)][key]};
function scheduleBots(room,song){
  room.players.filter(p=>p.bot&&!p.spectate).forEach(b=>{
    if(Math.random()<b.skill*0.92){
      const gr=Math.random()<0.72?2:1;
      room.timers.push(setTimeout(()=>onAnswer(room,b.id,room.round,
        gr===2?song.t:pickWrong(song,SONGS,'t'), gr===2?song.a:pickWrong(song,SONGS,'a')),
        2500+Math.random()*(2000+(1-b.skill)*14000)));
    }else if(Math.random()<0.6){
      room.timers.push(setTimeout(()=>onAnswer(room,b.id,room.round,
        pickWrong(song,SONGS,'t'),pickWrong(song,SONGS,'a')),16000+Math.random()*10000));
    }
  });
}
function endRound(room){
  if(room.phase!=='q')return;
  clearTimers(room);
  const song=room.pool[room.q.idx];
  room.players.forEach(p=>{
    if(p.spectate){p.lastGr=-2;p.lastPts=0;return}
    const g=room.graded[p.id];
    if(g){p.score+=g.pts;p.lastGr=g.gr;p.lastPts=g.pts;p.lastGt=g.gt;p.lastGa=g.ga}
    else {p.lastGr=-1;p.lastPts=0;p.lastGt='';p.lastGa=''}
  });
  const active=room.players.filter(p=>!p.spectate);
  const min=Math.min(...active.map(p=>p.score));
  const bottoms=active.filter(p=>p.score===min);
  let cere=null;
  bottoms.forEach(p=>{p.sp++;
    if(!p.bot&&p.sp%CERE===0)cere={names:bottoms.map(b=>b.name),n:p.sp}});
  room.lastRows=room.players.filter(p=>!p.spectate)
    .map(p=>({pid:p.id,name:p.name,bot:p.bot,gr:p.lastGr,pts:p.lastPts,gt:p.lastGt,ga:p.lastGa}))
    .sort((a,b)=>b.pts-a.pts);
  room.results={song:{t:song.t,a:song.a,y:song.y,art:song.art},
    rows:room.lastRows,
    board:active.slice().sort((a,b)=>b.score-a.score)
      .map(p=>({id:p.id,name:p.name,bot:p.bot,score:p.score,sp:p.sp,host:p.id===room.hostId})),
    cere};
  room.phase='reveal';pushSnap(room);
  room.timers.push(setTimeout(()=>advance(room),13000));
}
function buildPodStats(room){
  const rows=room.lastRows,st=[];
  const fast=rows.filter(r=>r.gr===2).sort((a,b)=>b.pts-a.pts)[0];
  const half=rows.filter(r=>r.gr===1).sort((a,b)=>b.pts-a.pts)[0];
  const spoons=room.players.filter(p=>!p.spectate).sort((a,b)=>b.sp-a.sp)[0];
  if(fast)st.push({icn:'zap',txt:'SI KILAT',who:fast.name});
  if(half)st.push({icn:'scale',txt:'RAJA SETENGAH',who:half.name});
  if(spoons&&spoons.sp>0)st.push({icn:'spoon',txt:'LEGENDA SPOON',who:spoons.name+' ×'+spoons.sp});
  if(!st.length)st.push({icn:'trophy',txt:'Pemain waras semua. Membosankan.',who:''});
  return st;
}
function advance(room){
  clearTimers(room);
  if(room.phase!=='reveal')return;
  if(room.round<room.total)return beginRound(room,room.round+1);
  room.podStats=buildPodStats(room);
  room.phase='pod';pushSnap(room);
}
async function startGame(room,listRaw){
  if(room.phase!=='lobby')return;
  if(typeof listRaw==='string'){room.settings.custom=parseList(listRaw)}
  let pool;
  if(room.settings.src==='custom')pool=room.settings.custom.map(x=>({t:x.t,a:x.a,y:0}));
  else{
    const th=room.settings.themes;
    pool=SONGS.filter(s=>th.includes('all')||s.g.split(' ').some(g=>th.includes(g)));
  }
  shuffle(pool);
  const target=pool.slice(0,Math.min(pool.length,room.settings.rounds*2));
  if(!target.length){ev(room,'toast',{msg:'Tidak ada lagu di tema/playlist itu',icn:'alert-triangle'});return}
  room.phase='prep';pushSnap(room);
  const resolved=[];let done=0;const queue=[...target];
  async function worker(){
    while(queue.length){
      const e=queue.shift();
      const r=await resolveSong(e);done++;
      ev(room,'prep',{done,total:target.length});
      if(r)resolved.push(r);
    }
  }
  await Promise.all([worker(),worker(),worker(),worker()]);
  if(!resolved.length){room.phase='lobby';pushSnap(room);
    ev(room,'toast',{msg:'Preview lagu tidak ketemu. Cek internet server / ganti lagu.',icn:'unplug'});return}
  room.pool=resolved;
  room.total=Math.max(1,Math.min(room.settings.rounds,resolved.length));
  room.activeIdx=0;
  beginRound(room,1);
}

/* ---------- HTTP + SSE ---------- */
function readBody(req){return new Promise((ok,bad)=>{
  let d='';req.on('data',c=>{d+=c;if(d.length>1e6)req.destroy()});
  req.on('end',()=>{try{ok(JSON.parse(d||'{}'))}catch(e){ok({})}});
  req.on('error',bad)})}
function json(res,obj,code=200){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))}

const INDEX=path.join(__dirname,'index.html');
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/api'&&req.method==='POST'){
    const b=await readBody(req);
    try{return handleApi(b,res)}catch(e){return json(res,{ok:false,err:'Server error'})}
  }
  if(u.pathname==='/sse')return handleSSE(u,res);
  if((u.pathname==='/'||u.pathname==='/index.html')&&req.method==='GET'){
    return fs.readFile(INDEX,(e,d)=>{
      if(e){res.writeHead(500);return res.end('index.html tidak ditemukan di samping server.js')}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(d)});
  }
  res.writeHead(404);res.end();
});

function handleApi(b,res){
  const A=b.action;
  if(A==='create'){
    if(!String(b.name||'').trim())return json(res,{ok:false,err:'Isi nama dulu'});
    const room=newRoom(genCode());rooms.set(room.code,room);
    const p=addPlayer(room,b.name);
    room.hostId=p.id;
    return json(res,{ok:true,code:room.code,pid:p.id,token:p.token,s:snap(room)});
  }
  if(A==='join'){
    const room=rooms.get(String(b.code||'').toUpperCase().trim());
    if(!room)return json(res,{ok:false,err:'Room tidak ditemukan — cek kodenya'});
    const p=addPlayer(room,b.name);
    ev(room,'toast',{msg:p.name+(p.spectate?' ikut nonton (game jalan)':' masuk room'),icn:'user-round'});
    return json(res,{ok:true,code:room.code,pid:p.id,token:p.token,s:snap(room)});
  }
  const room=rooms.get(String(b.room||'').toUpperCase());
  if(!room)return json(res,{ok:false,err:'Room sudah bubar'});
  const me=room.players.find(p=>p.id===b.pid&&p.token===b.token);
  if(!me)return json(res,{ok:false,err:'Kamu sudah keluar dari room'});
  const isHost=me.id===room.hostId;
  room.touched=Date.now();

  if(A==='settings'){
    if(!isHost||room.phase!=='lobby')return json(res,{ok:false,err:'Bukan wewenangmu'});
    const st=room.settings;
    if(Array.isArray(b.themes)&&b.themes.length)st.themes=b.themes.filter(t=>THEMES[t]);
    if(Number.isFinite(+b.rounds))st.rounds=Math.min(15,Math.max(3,+b.rounds));
    if(b.src==='db'||b.src==='custom')st.src=b.src;
    if(typeof b.plLink==='string'){
      const m=b.plLink.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
      st.plLink=m?m[1]:'';
    }
    pushSnap(room);
    return json(res,{ok:true,s:snap(room)});
  }
  if(A==='bots'){
    if(!isHost||room.phase!=='lobby')return json(res,{ok:false,err:'Bukan wewenangmu'});
    const n=Math.max(1,Math.min(5,+b.n||1));
    for(let i=0;i<n;i++){
      const used=new Set(room.players.map(p=>p.name));
      const pool=BOTNAMES.filter(x=>!used.has(x));
      if(pool.length)room.players.push({id:rid(),token:'',name:pool[crypto.randomInt(pool.length)],
        bot:true,score:0,sp:0,spectate:false,skill:.35+Math.random()*.55,lastGr:-1,lastPts:0,lastGt:'',lastGa:''});
    }
    pushSnap(room);
    return json(res,{ok:true,s:snap(room)});
  }
  if(A==='clearBots'){
    if(!isHost||room.phase!=='lobby')return json(res,{ok:false,err:'Bukan wewenangmu'});
    room.players=room.players.filter(p=>!p.bot);
    pushSnap(room);
    return json(res,{ok:true,s:snap(room)});
  }
  if(A==='start'){
    if(!isHost||room.phase!=='lobby')return json(res,{ok:false,err:'Bukan wewenangmu'});
    json(res,{ok:true,s:snap(room)});          // jawab dulu
    startGame(room,b.listRaw).catch(()=>{});   // lalu siapkan lagu
    return;
  }
  if(A==='answer'){
    onAnswer(room,me.id,+b.round,b.title,b.artist);
    return json(res,{ok:true});
  }
  if(A==='next'){if(isHost)advance(room);return json(res,{ok:true,s:snap(room)})}
  if(A==='again'){
    if(isHost&&room.phase==='pod'){
      room.players.forEach(p=>{p.score=0;p.spectate=false});
      room.round=0;room.results=null;room.activeIdx=0;room.phase='lobby';
      pushSnap(room);
    }
    return json(res,{ok:true,s:snap(room)});
  }
  if(A==='leave'){removePlayer(room,me.id);return json(res,{ok:true})}
  json(res,{ok:false,err:'Aksi ngaco'});
}

function handleSSE(u,res){
  const room=rooms.get(String(u.searchParams.get('room')||'').toUpperCase());
  const p=room&&room.players.find(x=>x.id===u.searchParams.get('pid')&&x.token===u.searchParams.get('token'));
  if(!room||!p){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
  res.write('retry: 2000\n\n');
  const st={res,ping:setInterval(()=>{try{res.write(': p\n\n')}catch(e){}},20000)};
  if(room.leaveTimers[p.id]){clearTimeout(room.leaveTimers[p.id]);delete room.leaveTimers[p.id]}
  room.streams.set(p.id,st);
  try{res.write('data: '+JSON.stringify({type:'state',now:Date.now(),s:snap(room)})+'\n\n')}catch(e){}
  res.on('close',()=>{
    clearInterval(st.ping);
    if(room.streams.get(p.id)===st){
      room.streams.delete(p.id);
      room.leaveTimers[p.id]=setTimeout(()=>{ // toleransi reload halaman 6 detik
        if(!room.streams.has(p.id))removePlayer(room,p.id);
      },6000);
    }
  });
}

/* ---------- bersih-bersih room ontak ---------- */
setInterval(()=>{const now=Date.now();
  rooms.forEach(r=>{if(r.streams.size===0&&now-r.touched>10*60*1000)destroyRoom(r)})},60000);

/* ----------grill ---------- */
server.listen(PORT,'0.0.0.0',()=>{
  const ips=[];
  Object.values(os.networkInterfaces()).forEach(l=>l&&l.forEach(n=>{if(n.family==='IPv4'&&!n.internal)ips.push(n.address)}));
  console.log('\n  NYAM FM siap nge-gas.');
  console.log('  Lokal      : http://localhost:'+PORT);
  ips.forEach(ip=>console.log('  Satu Wi-Fi : http://'+ip+':'+PORT));
  console.log('\n  Kirim link itu (tambah ?room=KODE kalau sudah bikin room) ke temanmu.');
  console.log('  Teman di luar jaringan? Bisa lewat tunnel (mis. ngrok) atau deploy ke VPS.\n');
});
