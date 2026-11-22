'use strict';
/* 漢文句法 Phase 1 — データ(data/*.json)と学習記録(IndexedDB)は完全に分離 */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sh=a=>[...a].sort(()=>Math.random()-.5);
const norm=s=>String(s).normalize('NFKC').replace(/[\s〜~～、。,.!！?？「」・]/g,'').toLowerCase();
let S,G=[],T=[],X=[],AG=[],AX=[],SG=[],ST=[],SX=[],GM={},view='home',P={},Q=null,E=null,FX=null,CS={text:'',plan:null},EF={tags:[]};
const CFG={type:'m',input:false,mode:'all',tags:[],n:10};

/* ---------- 保存 (IndexedDB) ---------- */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('kanbun',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function load(){try{const d=await idb();return await new Promise(res=>{const q=d.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})}catch(e){return null}}
async function save(){try{const d=await idb();d.transaction('kv','readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(S)),'state')}catch(e){toast('保存に失敗しました')}}
function toast(m){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';document.body.append(t)}t.textContent=m;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2600)}

/* ---------- 学習状態 ---------- */
const gp=id=>S.g[id]||(S.g[id]={ok:0,ng:0,streak:0,last:0,fav:false});
const sp=id=>S.s[id]||(S.s[id]={st:'',fav:false,last:0});
const weakG=id=>{const p=S.g[id];return !!p&&p.ng>0&&p.streak<2};
const tagName=id=>(T.find(t=>t.id===id)||{name:id}).name;
const status=id=>{const p=S.g[id];if(!p||p.ok+p.ng===0)return['未学習','n'];if(p.streak>=3)return['習得','ok'];if(weakG(id))return['苦手','ng'];return['学習中','mid']};
/* 復習優先度。ここだけ差し替えれば復習アルゴリズムを変更できる */
const pri=id=>{const p=S.g[id]||{ok:0,ng:0,streak:0,last:0};const days=p.last?Math.min(30,(Date.now()-p.last)/864e5):5;return(p.ok+p.ng===0?2:0)+(weakG(id)?2:0)-Math.min(p.streak,4)*.4+days*.05+Math.random()};
function record(gid,ok,q){const p=gp(gid);if(ok){p.ok++;p.streak++}else{p.ng++;p.streak=0}p.last=Date.now();S.log.push({t:Date.now(),g:gid,ok:ok?1:0,q});if(S.log.length>3000)S.log.splice(0,500);save()}

/* ---------- 出題 ---------- */
function pool(){const via=new Set(CFG.tags.length?X.filter(x=>(x.tags||[]).some(t=>CFG.tags.includes(t))).flatMap(x=>x.occ.map(o=>o.g)):[]);let a=G.filter(g=>!CFG.tags.length||g.tags.some(t=>CFG.tags.includes(t))||via.has(g.id));
  if(CFG.mode==='weak')a=a.filter(g=>weakG(g.id));if(CFG.mode==='fav')a=a.filter(g=>S.g[g.id]?.fav);return a}
function dis(g,key,n,sim){const near=sim?G.filter(x=>x.id!==g.id&&(g.similar.includes(x.id)||x.similar.includes(g.id))):[];
  const rest=sh(G.filter(x=>x.id!==g.id&&!near.includes(x)));const out=[];
  for(const x of[...sh(near),...rest]){if(x[key]!==g[key]&&!out.includes(x[key]))out.push(x[key]);if(out.length>=n)break}return out}
function mk(g){
  if(CFG.type==='m')return{t:'m',gid:g.id,prompt:g.form,ask:'この句法の意味は？',correct:g.meaning,choices:sh([g.meaning,...dis(g,'meaning',3,true)]),answers:[g.meaning,...g.answers],expl:g.note};
  const d=CFG.type==='d';
  return{t:CFG.type,gid:g.id,prompt:g.meaning,ask:d?'この意味を表す句法は？（似た形に注意）':'あてはまる句法は？',correct:g.form,choices:sh([g.form,...dis(g,'form',3,d)]),answers:[g.form,g.name],expl:g.note}}
function build(){const a=pool();
  if(CFG.type==='k'){const ids=new Set(a.map(g=>g.id));
    const sc=x=>Math.max(-9,...x.occ.map(o=>ids.has(o.g)?pri(o.g):-9));
    return X.filter(x=>x.kundoku&&(x.occ.some(o=>ids.has(o.g))||(CFG.mode==='all'&&CFG.tags.length&&(x.tags||[]).some(t=>CFG.tags.includes(t))))).map(x=>[x,sc(x)]).sort((p,q)=>q[1]-p[1]).slice(0,CFG.n).map(([x])=>({t:'k',gid:x.occ[0]?x.occ[0].g:null,prompt:x.original,ask:'正しい書き下し文は？',correct:x.kundoku,
      choices:sh([x.kundoku,...sh(X.filter(y=>y.id!==x.id&&y.kundoku&&y.kundoku!==x.kundoku)).slice(0,3).map(y=>y.kundoku)]),answers:[x.kundoku],expl:x.explanation||'',sub:x.translation}))}
  return a.map(g=>[g,pri(g.id)]).sort((p,q)=>q[1]-p[1]).slice(0,CFG.n).map(([g])=>mk(g))}

/* ---------- 画面 ---------- */
const head=(t,back='home')=>`<header><button class=back data-a=go data-v=${back} aria-label="戻る">‹</button><h1>${esc(t)}</h1></header>`;
const V={};
V.home=()=>{const w=G.filter(g=>weakG(g.id)).length+X.filter(x=>S.s[x.id]?.st==='ng').length,f=G.filter(g=>S.g[g.id]?.fav).length+X.filter(x=>S.s[x.id]?.fav).length;
  const t=(v,a,b,c='')=>`<button class="tile ${c}" data-a=go data-v=${v}><b>${a}</b><span>${b}</span></button>`;
  return`<header><h1>漢文句法</h1></header><div class=grid>${t('setup','クイズに挑戦','4形式・分類別','main')}${t('exmenu','例文トレーニング',X.length+'例文')}${t('glist','句法一覧',G.length+'句法')}${t('weak','苦手克服',w+'件')}${t('fav','お気に入り',f+'件')}${t('rec','学習記録','正答率・履歴')}${t('add','例文・句法の追加・管理','手動・CSV・表示切替')}${t('set','設定','テーマ・バックアップ')}</div><p class=sm style="margin-top:16px">写真からの登録（OCR・AI提案）は次のステップで追加します。</p>`};

V.setup=()=>{const types=[['m','句法→意味'],['f','意味→句法'],['k','書き下し文'],['d','識別（似た形の句法を区別）']];
  const modes=[['all','すべて（苦手を優先）'],['weak','苦手な句法だけ'],['fav','お気に入りの句法だけ']];
  return head('クイズに挑戦')+`<div class=sec>出題形式</div>`+types.map(([k,l])=>`<label class=opt><input type=radio name=ty data-cfg=type value=${k} ${CFG.type===k?'checked':''}>${l}</label>`).join('')+
  (CFG.type==='k'?`<p class=sm>書き下し文は選択式のみです。</p>`:`<label class=opt><input type=checkbox data-cfg=input ${CFG.input?'checked':''}>入力式で答える</label>`)+
  `<div class=sec>範囲</div>`+modes.map(([k,l])=>`<label class=opt><input type=radio name=mo data-cfg=mode value=${k} ${CFG.mode===k?'checked':''}>${l}</label>`).join('')+
  `<div class=sec>分類（複数選択可・未選択=全分類）</div>`+T.map(t=>`<label class=opt><input type=checkbox data-cfg=tag value=${t.id} ${CFG.tags.includes(t.id)?'checked':''}>${esc(t.name)}</label>`).join('')+
  `<div class=sec>問題数</div><select class=inp data-cfg=n>${[5,10,20,30].map(n=>`<option ${CFG.n===n?'selected':''}>${n}</option>`).join('')}</select>`+
  `<p class=sm>対象の句法：${pool().length}件</p><button class="btn pri" data-a=start>始める</button>`};

V.quiz=()=>{const q=Q.qs[Q.i],r=Q.res,inp=CFG.input&&q.t!=='k';
  let b=head(`${Q.i+1} / ${Q.qs.length}`,'setup')+`<div class=card><div class=sm>${esc(q.ask)}</div><div class="${q.t==='m'||q.t==='k'?'kanji':'ptxt'}">${esc(q.prompt)}</div></div>`;
  if(!r){b+=inp?`<input id=inp class=inp placeholder="答えを入力" autocomplete=off><button class="btn pri" data-a=submit>回答する</button>`
    :q.choices.map((c,i)=>`<button class="btn ch" data-a=pick data-i=${i}>${esc(c)}</button>`).join('')}
  else{b+=`<div class="res ${r.ok?'ok':'ng'}">${r.ok?'正解':'不正解'}</div>`;
    if(inp)b+=`<div class=sm>あなたの答え：${esc(r.given||'（未入力）')}</div>`;
    b+=`<div class=ans>正解：${esc(q.correct)}</div>`+(q.sub?`<div class=tr>${esc(q.sub)}</div>`:'')+(q.expl?`<div class=note>${esc(q.expl)}</div>`:'');
    if(inp)b+=`<button class=btn data-a=flip>${r.ok?'不正解に変更する':'正解にする（言い換えで合っていた）'}</button>`;
    b+=`${q.gid?`<button class=btn data-a=favg data-id=${q.gid}>${S.g[q.gid]?.fav?'★ お気に入り解除':'☆ この句法をお気に入りに'}</button>`:''}<button class="btn pri" data-a=next>${Q.i+1<Q.qs.length?'次へ':'結果を見る'}</button>`}
  return b};
V.result=()=>`${head('結果','setup')}<div class=score>${Q.okc} / ${Q.qs.length}</div><p class=sm style="text-align:center">${Math.round(Q.okc/Q.qs.length*100)}%</p>`+
  (Q.miss.length?`<div class=sec>間違えた問題</div>`+Q.miss.map(q=>`<div class=gb><b>${esc(q.prompt)}</b><br>正解：${esc(q.correct)}</div>`).join(''):'<p>全問正解です。</p>')+
  `<button class="btn pri" data-a=start>もう一度</button><button class=btn data-a=go data-v=home>ホームへ</button>`;

const exf=(m,nf)=>X.filter(x=>(m==='fav'?S.s[x.id]?.fav:m==='ng'?S.s[x.id]?.st==='ng':true)&&(nf||!EF.tags.length||(x.occ.some(o=>GM[o.g]&&GM[o.g].tags.some(t=>EF.tags.includes(t)))||(x.tags||[]).some(t=>EF.tags.includes(t)))));
V.exmenu=()=>{const c={ok:X.filter(x=>S.s[x.id]?.st==='ok').length,ng:X.filter(x=>S.s[x.id]?.st==='ng').length};
  return head('例文トレーニング')+`<p class=sm>理解できた ${c.ok} ／ まだ覚えていない ${c.ng} ／ 未学習 ${X.length-c.ok-c.ng}</p><div class=sec>分類で絞り込む（複数選択可・未選択=全分類）</div><div class=chips>${T.map(t=>`<button class="chip ${EF.tags.includes(t.id)?'on':''}" data-a=etag data-t=${t.id}>${esc(t.name)}</button>`).join('')}</div>`+
  [['all','すべて（未学習・苦手を優先）'],['ng','まだ覚えていない例文だけ'],['fav','お気に入りの例文だけ']].map(([m,l])=>`<button class=btn data-a=exstart data-m=${m}>${l}（${exf(m).length}）</button>`).join('')};
V.ex=()=>{const x=E.xs[E.i],s=S.s[x.id]||{},R=window.SpeechRecognition||window.webkitSpeechRecognition,v=E.v,
  kt=(x.kunten||'').trim(),kd=(x.kundoku||'').trim(),tr=(x.translation||'').trim();
  const bt=(k,l,has)=>`<button class=btn data-a=vt data-k=${k} ${has?'':'disabled'}>${has?l+(v[k]?'を隠す':'を見る'):l+'は未登録'}</button>`;
  let b=head(`例文 ${E.i+1} / ${E.xs.length}`,'exmenu')+`<div class=card><div class="kanji xl">${esc(x.original)}</div></div>`+
  `<div class=three>${bt('k','訓読文',kt)}${bt('s','書き下し文',kd)}${bt('t','現代語訳',tr)}</div>`;
  if(v.k&&kt)b+=`<div class=kt><div class=sm>訓読文</div>${esc(kt)}</div>`;
  if(v.s&&kd)b+=`<div class=kb><div class=sm>書き下し文</div>${esc(kd)}</div>`;
  if(v.t&&tr)b+=`<div class=tr><div class=sm>現代語訳</div>${esc(tr)}</div>`+x.occ.map(o=>GM[o.g]).filter(Boolean).map(g=>`<div class=gb><b>${esc(g.form)}</b>　${esc(g.meaning)}<br>書き下し：${esc(g.kundoku)}<br><span class=sm>${esc(g.note)}</span></div>`).join('')+(x.explanation?`<div class=note>${esc(x.explanation)}</div>`:'')+(x.verified?'':`<p class=sm>※ この例文は確認前のデータです（要確認）。教材で照合してください。</p>`);
  b+=`<textarea id=tx class=inp rows=3 placeholder="現代語訳を考える（入力は任意。頭の中だけでもOK）">${esc(E.text)}</textarea><div class=two>${R?`<button class=btn data-a=mic>🎤 音声入力</button>`:`<p class=sm>キーボードのマイクで音声入力できます</p>`}<button class=btn data-a=clr>入力を消す</button></div>`+
  `<div class=two><button class=btn data-a=mark data-st=ok>理解できた${s.st==='ok'?' ✓':''}</button><button class=btn data-a=mark data-st=ng>まだ覚えていない${s.st==='ng'?' ✓':''}</button></div><div class=two><button class=btn data-a=favs data-id=${x.id}>${s.fav?'★ お気に入り解除':'☆ お気に入り'}</button><button class=btn data-a=exn>次へ</button></div><div class=two><button class=btn data-a=hidex data-id=${x.id}>この例文を非表示</button><button class=btn data-a=xedit data-id=${x.id}>編集</button></div>`;
  return b};
V.glist=()=>{const f=P.tag,a=G.filter(g=>!f||g.tags.includes(f));
  return head('句法一覧')+`<div class=chips><button class="chip ${f?'':'on'}" data-a=gtag data-t="">すべて</button>${T.map(t=>`<button class="chip ${f===t.id?'on':''}" data-a=gtag data-t=${t.id}>${esc(t.name)}</button>`).join('')}</div>`+
  a.map(g=>{const[s,c]=status(g.id);return`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}${S.g[g.id]?.fav?' <span class=star>★</span>':''}</span><span class="badge ${c}">${s}</span><span class=sub>${esc(g.meaning)}</span></button>`}).join('')};
V.gdet=()=>{const g=GM[P.id],p=S.g[g.id]||{ok:0,ng:0,streak:0},ex=X.filter(x=>x.occ.some(o=>o.g===g.id)),sim=G.filter(x=>g.similar.includes(x.id)||x.similar.includes(g.id));
  return head(g.name,'glist')+`<div class=card><div class=kanji>${esc(g.form)}</div></div>
  <div class=chips>${g.tags.map(t=>`<span class=badge>${esc(tagName(t))}</span>`).join('')}<span class=badge>難易度 ${g.diff}</span>${g.verified?'':'<span class="badge unv">要確認</span>'}</div>
  <div class=tr>${esc(g.meaning)}</div><div class=kb>${esc(g.kundoku)}</div>${g.answers.length?`<div class=sm>別解・許容：${g.answers.map(esc).join(' ／ ')}</div>`:''}
  <div class=note>${esc(g.note)}</div><p class=sm>正解 ${p.ok} ／ 不正解 ${p.ng} ／ 連続正解 ${p.streak}</p>
  <button class=btn data-a=favg data-id=${g.id} data-r=gdet>${p.fav?'★ お気に入り解除':'☆ お気に入りに追加'}</button><button class=btn data-a=hide data-id=${g.id}>この句法を非表示にする</button><button class=btn data-a=gedit data-id=${g.id}>編集</button>`+
  (sim.length?`<div class=sec>似た句法</div>`+sim.map(x=>`<button class=row data-a=gdet data-id=${x.id}><span class=kn>${esc(x.form)}</span><span></span><span class=sub>${esc(x.meaning)}</span></button>`).join(''):'')+
  (ex.length?`<div class=sec>例文</div>`+ex.map(x=>`<div class=gb><span class=kanji style="font-size:20px">${esc(x.original)}</span><br><span style="color:var(--kun)">${esc(x.kundoku)}</span><br><span style="color:var(--tr)">${esc(x.translation)}</span></div>`).join(''):'')};

V.weak=()=>{const wg=G.filter(g=>weakG(g.id)),wx=X.filter(x=>S.s[x.id]?.st==='ng');
  return head('苦手克服')+(wg.length||wx.length?'':'<p>苦手はまだありません。クイズや例文トレーニングで間違えるとここに集まります。</p>')+
  (wg.length?`<button class="btn pri" data-a=weakquiz>苦手な句法でクイズ（${wg.length}）</button>`+wg.map(g=>`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}</span><span class="badge ng">苦手</span><span class=sub>${esc(g.meaning)}</span></button>`).join(''):'')+
  (wx.length?`<button class="btn pri" data-a=exstart data-m=ng data-nf=1>まだ覚えていない例文を練習（${wx.length}）</button>`:'')};
V.fav=()=>{const fg=G.filter(g=>S.g[g.id]?.fav),fx=X.filter(x=>S.s[x.id]?.fav);
  return head('お気に入り')+(fg.length||fx.length?'':'<p>★を付けた句法・例文がここに並びます。</p>')+
  (fg.length?`<button class="btn pri" data-a=favquiz>お気に入り句法でクイズ（${fg.length}）</button>`+fg.map(g=>`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}</span><span></span><span class=sub>${esc(g.meaning)}</span></button>`).join(''):'')+
  (fx.length?`<button class="btn pri" data-a=exstart data-m=fav data-nf=1>お気に入り例文を練習（${fx.length}）</button>`+fx.map(x=>`<div class=gb><span class=kanji style="font-size:20px">${esc(x.original)}</span></div>`).join(''):'')};

const bar=(l,o,n)=>{const t=o+n,pc=t?Math.round(o/t*100):0;return`<div class=bar><div class=bl>${esc(l)}<span>${t?pc+'%（'+o+'/'+t+'）':'未学習'}</span></div><div class=bt><i style="width:${pc}%"></i></div></div>`};
V.rec=()=>{const att=G.filter(g=>S.g[g.id]&&S.g[g.id].ok+S.g[g.id].ng>0);const tot=att.reduce((s,g)=>s+S.g[g.id].ok+S.g[g.id].ng,0),ok=att.reduce((s,g)=>s+S.g[g.id].ok,0);
  const days=new Set(S.log.map(l=>new Date(l.t).toDateString())).size,sc={ok:X.filter(x=>S.s[x.id]?.st==='ok').length,ng:X.filter(x=>S.s[x.id]?.st==='ng').length};
  return head('学習記録')+`<div class=card><div class=score style="margin:0">${tot?Math.round(ok/tot*100):0}%</div><div class=sm>総合正答率（${ok}/${tot}問）／ 学習日数 ${days}日</div></div>
  <div class=sec>分類別の正答率</div>${T.map(t=>{let o=0,n=0;G.forEach(g=>{if(g.tags.includes(t.id)&&S.g[g.id]){o+=S.g[g.id].ok;n+=S.g[g.id].ng}});return bar(t.name,o,n)}).join('')}
  <div class=sec>句法別の正答率（低い順）</div>${att.sort((a,b)=>S.g[a.id].ok/(S.g[a.id].ok+S.g[a.id].ng)-S.g[b.id].ok/(S.g[b.id].ok+S.g[b.id].ng)).map(g=>bar(g.form,S.g[g.id].ok,S.g[g.id].ng)).join('')||'<p class=sm>まだ記録がありません。</p>'}
  <div class=sec>例文の習得状況</div><p>理解できた ${sc.ok} ／ まだ覚えていない ${sc.ng} ／ 未学習 ${X.length-sc.ok-sc.ng}</p>
  <div class=sec>最近の解答</div>${S.log.slice(-15).reverse().map(l=>`<div class=sm>${new Date(l.t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}　${l.ok?'○':'×'}　${esc(GM[l.g]?.form||l.g)}</div>`).join('')}`};
V.set=()=>head('設定')+`<div class=sec>バックアップ</div><p class=sm>学習記録（正答率・習得状況・お気に入り）と、自作の句法・例文、表示設定、テーマをJSONで保存・復元します。機種変更や初期化の前に書き出してください。</p>
  <button class="btn pri" data-a=export>書き出す</button><label class=btn style="text-align:center">復元する（JSONを選択）<input id=imp type=file accept=".json,application/json" hidden></label>
  <div class=sec>テーマ</div><p class=sm>基本の色</p><div class=chips>${[['#2b4a7a','藍'],['#2f7a5a','若竹'],['#b3392f','朱'],['#6a4c93','藤'],['#b8651b','橙'],['#3a3f47','墨']].map(([c,n])=>`<button class=sw style="background:${c}" data-a=thc data-c=${c} title=${n} aria-label=${n}></button>`).join('')}</div><input type=color id=thc value="${S.th.c||'#2b4a7a'}"><p class=sm>明るさ</p><div class=chips>${[['auto','自動'],['light','ライト'],['dark','ダーク']].map(([m,n])=>`<button class="chip ${(S.th.m||'auto')===m?'on':''}" data-a=thm data-m=${m}>${n}</button>`).join('')}</div><button class=btn data-a=thr>テーマを初期設定に戻す</button>
  <div class=sec>データ</div><p class=sm>句法 ${G.length}件／例文 ${X.length}件（うち要確認 ${G.filter(g=>!g.verified).length+X.filter(x=>!x.verified).length}件）<br>学習記録は端末内に保存されます。</p>
  <button class=btn data-a=reset style="color:var(--ng)">学習記録をすべて削除</button>`;

/* ---------- Phase 2: 追加・編集・表示切替・CSV・テーマ ---------- */
const defS=()=>({v:2,g:{},s:{},log:[],ug:[],ux:[],ut:[],td:{},tn:{},ed:{},hid:{},th:{c:'',m:'auto'}});
/* AG/AX=全データ(初期+編集上書き+自作)。G/X=表示中のものだけ。学習側は常にG/Xを使う */
function rebuild(){
  T=ST.filter(t=>!S.td[t.id]).map(t=>S.tn[t.id]?{...t,name:S.tn[t.id]}:t).concat(S.ut);
  const tv=new Set(T.map(t=>t.id)),ft=a=>(a||[]).filter(t=>tv.has(t));
  CFG.tags=CFG.tags.filter(t=>tv.has(t));EF.tags=EF.tags.filter(t=>tv.has(t));
  AG=SG.map(g=>S.ed[g.id]||g).concat(S.ug).map(g=>({...g,tags:ft(g.tags)}));
  AX=SX.map(x=>S.ed[x.id]||x).concat(S.ux).map(x=>({...x,tags:ft(x.tags)}));
  G=AG.filter(g=>!S.hid[g.id]);X=AX.filter(x=>!S.hid[x.id]);GM=Object.fromEntries(AG.map(g=>[g.id,g]))}
function applyTheme(){const r=document.documentElement,t=S.th||{};
  if(t.m&&t.m!=='auto')r.dataset.t=t.m;else delete r.dataset.t;
  if(t.c){r.style.setProperty('--ai',t.c);const h=t.c.replace('#','');const l=(.299*parseInt(h.slice(0,2),16)+.587*parseInt(h.slice(2,4),16)+.114*parseInt(h.slice(4,6),16))/255;r.style.setProperty('--on',l>.6?'#10141a':'#fff')}
  else{r.style.removeProperty('--ai');r.style.removeProperty('--on')}
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t.c||'#2b4a7a'}
function setTheme(o){Object.assign(S.th,o);applyTheme();save();render()}
const keep=f=>{const y=scrollY;f();scrollTo(0,y)};
const blankX=()=>({kind:'x',id:'',original:'',kunten:'',kundoku:'',translation:'',explanation:'',gids:[],tags:[],newtag:'',_tm:false,verified:true});
const blankG=()=>({kind:'g',id:'',name:'',form:'',meaning:'',kundoku:'',answers:'',note:'',tags:[],diff:1,newtag:'',_tm:false,verified:true});
const fld=(l,k,v,r)=>`<div class=sec>${l}</div><textarea class=inp rows=${r} data-f=${k}>${esc(v)}</textarea>`;
function putItem(kind,it){const L=kind==='x'?S.ux:S.ug,i=L.findIndex(x=>x.id===it.id);
  if(i>=0)L[i]=it;else if(it.id.startsWith(kind==='x'?'ux_':'ug_'))L.push(it);else S.ed[it.id]=it}
function parseCSV(t){const rows=[];let r=[],c='',q=false;t=t.replace(/^\uFEFF/,'');
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===','||ch==='\t'){r.push(c);c=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
  if(c||r.length){r.push(c);rows.push(r)}return rows.filter(r=>r.some(x=>x.trim()))}

function tagId(name){let t=T.find(x=>x.name===name);if(!t){t={id:'ut_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name};S.ut.push(t);save();rebuild()}return t.id}
const tagBox=()=>{const f=FX;return `<div class=sec>分類（複数選択可）</div><div class=chips>${T.map(t=>`<button class="chip ${f.tags.includes(t.id)?'on':''}" data-a=gt data-id=${t.id}>${esc(t.name)}</button>`).join('')||'<span class=sm>分類がありません。下から追加できます。</span>'}</div>
  <div class=two><input class=inp data-f=newtag value="${esc(f.newtag)}" placeholder="新しい分類名"><button class=btn data-a=tadd>分類を追加</button></div>
  <button class=btn data-a=tmgr>${f._tm?'分類の管理を閉じる':'分類の名前変更・削除'}</button>`+(f._tm?T.map(t=>`<div class=gb><b>${esc(t.name)}</b><div class=two><button class=btn data-a=tren data-id=${t.id}>名前を変更</button><button class=btn data-a=tdel data-id=${t.id} style="color:var(--ng)">削除</button></div></div>`).join(''):'')};
V.add=()=>head('例文・句法の追加・管理')+[['xnew','例文を追加','白文・書き下し文・現代語訳・句法を入力'],['gnew','句法を追加','意味・書き下し方・分類などを入力'],['go" data-v="csv','例文をCSVで一括登録','貼り付け／ファイルから'],['go" data-v="manage','表示・非表示と編集','初期データも自作データも1件ずつ切り替え']].map(([a,t,d])=>`<button class=btn data-a="${a}"><b>${t}</b><br><span class=sm>${d}</span></button>`).join('')+`<p class=sm>写真からの登録（OCR・AI提案）は次のステップで追加します。</p>`;

V.xform=()=>{const f=FX,own=f.id.startsWith('ux_');
  return head(f.id?'例文を編集':'例文を追加','add')+fld('原文（白文）*','original',f.original,2)+fld('訓読文（返り点・送り仮名付き）','kunten',f.kunten,2)+`<p class=sm>書き下し文とは別の項目として保存されます。</p>`+fld('書き下し文','kundoku',f.kundoku,2)+fld('現代語訳','translation',f.translation,2)+fld('解説（任意）','explanation',f.explanation,3)+
  `<div class=sec>含まれる句法（複数選択可）</div><div class=chips>${AG.map(g=>`<button class="chip ${f.gids.includes(g.id)?'on':''}" data-a=xg data-id=${g.id}>${esc(g.form)}</button>`).join('')}</div>`+
  tagBox()+`<p class=sm>句法に付いた分類は自動で反映されます。ここでは例文そのものの分類を設定します。</p>`+`<label class=opt><input type=checkbox data-fc=verified ${f.verified?'checked':''}>教材などで確認済み</label><p class=sm>未確認のデータは「要確認」と表示されます。書き下し文が空の例文は、書き下し文クイズに出ません。</p>`+
  `<button class="btn pri" data-a=xsave>保存する</button>`+(own?`<button class=btn data-a=xdel style="color:var(--ng)">この例文を削除</button>`:(S.ed[f.id]?`<button class=btn data-a=xrev>初期データに戻す</button>`:''))};
V.gform=()=>{const f=FX,own=f.id.startsWith('ug_');
  return head(f.id?'句法を編集':'句法を追加','add')+`<div class=sec>句法名*</div><input class=inp data-f=name value="${esc(f.name)}" placeholder="例：不亦～乎">`+`<div class=sec>代表的な形*</div><input class=inp data-f=form value="${esc(f.form)}" placeholder="例：不亦～乎">`+
  fld('意味*','meaning',f.meaning,2)+fld('書き下し方','kundoku',f.kundoku,2)+fld('別解・許容する表現（1行に1つ）','answers',f.answers,3)+fld('注意点・解説','note',f.note,3)+
  tagBox()+
  `<div class=sec>難易度</div><select class=inp data-f=diff>${[1,2,3].map(n=>`<option ${+f.diff===n?'selected':''}>${n}</option>`).join('')}</select>`+
  `<label class=opt><input type=checkbox data-fc=verified ${f.verified?'checked':''}>教材などで確認済み</label>`+`<button class="btn pri" data-a=gsave>保存する</button>`+(own?`<button class=btn data-a=gdel style="color:var(--ng)">この句法を削除</button>`:(S.ed[f.id]?`<button class=btn data-a=grev>初期データに戻す</button>`:''))};

V.manage=()=>{const k=P.k||'g',L=k==='g'?AG:AX;
  return head('表示・非表示と編集','add')+`<div class=chips><button class="chip ${k==='g'?'on':''}" data-a=mtab data-k=g>句法 ${AG.length}</button><button class="chip ${k==='x'?'on':''}" data-a=mtab data-k=x>例文 ${AX.length}</button></div><p class=sm>非表示にした項目は、クイズ・例文トレーニング・一覧に出ません。学習記録は残ります。</p><button class=btn data-a=showall data-k=${k}>すべて表示にする</button>`+
  L.map(it=>{const h=S.hid[it.id],own=/^u[gx]_/.test(it.id);return`<div class="gb ${h?'dim':''}"><b>${esc(k==='g'?it.form:it.original)}</b><br><span class=sm>${esc(k==='g'?it.meaning:it.translation)}</span><div class=chips><span class=badge>${own?'自作':'初期'}</span>${it.verified?'':'<span class="badge unv">要確認</span>'}${h?'<span class="badge ng">非表示</span>':''}</div><div class=two><button class=btn data-a=hide data-id=${it.id}>${h?'表示する':'非表示にする'}</button><button class=btn data-a=${k==='g'?'gedit':'xedit'} data-id=${it.id}>編集</button></div></div>`}).join('')};

V.csv=()=>head('例文をCSVで一括登録','add')+`<p class=sm>列の順番：白文, 書き下し文, 現代語訳, 句法, 解説, 訓読文（解説・訓読文は省略可）。句法は名前かIDで、複数なら | で区切ります。1行目が「白文」なら見出しとして読み飛ばします。文字コードはUTF-8にしてください。</p>
  <button class=btn data-a=csvtpl>ひな形を保存</button><label class=btn style="text-align:center">CSVファイルを選ぶ<input id=csvf type=file accept=".csv,.txt,text/csv" hidden></label>
  <textarea class=inp rows=6 data-f=csvtext placeholder="ここに貼り付け（スプレッドシートからも可）">${esc(CS.text)}</textarea><button class="btn pri" data-a=csvplan>内容を確認する</button>`+
  (CS.plan?`<div class=card><b>${CS.plan.add.length}件を登録できます</b><div class=sm>重複でスキップ ${CS.plan.dup}件</div></div>`+(CS.plan.warn.length?`<div class=note>${CS.plan.warn.slice(0,10).map(esc).join('<br>')}${CS.plan.warn.length>10?`<br>ほか${CS.plan.warn.length-10}件`:''}</div>`:'')+(CS.plan.add.length?`<p class=sm>登録した例文は「要確認」になります。確認後に編集画面で「確認済み」にしてください。</p><button class="btn pri" data-a=csvgo>${CS.plan.add.length}件を登録する</button>`:''):'');

const A2={
  xnew(){FX=blankX();go('xform')},gnew(){FX=blankG();go('gform')},
  xedit(d){const x=AX.find(x=>x.id===d.id);FX={kind:'x',id:x.id,original:x.original,kundoku:x.kundoku||'',translation:x.translation||'',explanation:x.explanation||'',gids:x.occ.map(o=>o.g),kunten:x.kunten||'',tags:[...(x.tags||[])],newtag:'',_tm:false,verified:!!x.verified};go('xform')},
  gedit(d){const g=AG.find(g=>g.id===d.id);FX={kind:'g',id:g.id,name:g.name,form:g.form,meaning:g.meaning,kundoku:g.kundoku||'',answers:(g.answers||[]).join('\n'),note:g.note||'',tags:[...g.tags],diff:g.diff||1,newtag:'',_tm:false,verified:!!g.verified};go('gform')},
  xg(d){keep(()=>{FX.gids=FX.gids.includes(d.id)?FX.gids.filter(x=>x!==d.id):[...FX.gids,d.id];render()})},
  gt(d){keep(()=>{FX.tags=FX.tags.includes(d.id)?FX.tags.filter(x=>x!==d.id):[...FX.tags,d.id];render()})},
  xsave(){const f=FX,o=f.original.trim();if(!o)return toast('原文（白文）を入力してください');
    if(!f.id&&AX.some(x=>x.original===o)&&!confirm('同じ原文がすでにあります。追加しますか？'))return;
    const old=f.id&&AX.find(x=>x.id===f.id);
    const tags=[...f.tags],nt=f.newtag.trim();if(nt){const id=tagId(nt);if(!tags.includes(id))tags.push(id)}
    putItem('x',{id:f.id||'ux_'+Date.now().toString(36),passage_id:old?old.passage_id:null,order:old?old.order:0,original:o,kundoku:f.kundoku.trim(),translation:f.translation.trim(),
      occ:f.gids.map(g=>(old&&old.occ.find(c=>c.g===g))||{g,start:null,end:null}),explanation:f.explanation.trim(),kunten:f.kunten.trim(),tags,src:old?old.src:'ユーザー登録',verified:f.verified});
    save();rebuild();toast('保存しました');go('manage',{k:'x'})},
  gsave(){const f=FX;if(!f.name.trim()||!f.form.trim()||!f.meaning.trim())return toast('句法名・代表的な形・意味は必須です');
    const tags=[...f.tags],nt=f.newtag.trim();
    if(nt){let t=T.find(x=>x.name===nt);if(!t){t={id:'ut_'+Date.now().toString(36),name:nt};S.ut.push(t)}if(!tags.includes(t.id))tags.push(t.id)}
    if(!tags.length)return toast('分類を1つ以上選んでください');
    const old=f.id&&AG.find(g=>g.id===f.id);
    putItem('g',{id:f.id||'ug_'+Date.now().toString(36),name:f.name.trim(),form:f.form.trim(),meaning:f.meaning.trim(),kundoku:f.kundoku.trim(),tags,similar:old?old.similar:[],
      answers:f.answers.split('\n').map(x=>x.trim()).filter(Boolean),note:f.note.trim(),diff:+f.diff,verified:f.verified});
    save();rebuild();toast('保存しました');go('manage',{k:'g'})},
  xdel(){if(!confirm('この例文を削除します。元に戻せません。'))return;const id=FX.id;S.ux=S.ux.filter(x=>x.id!==id);delete S.s[id];delete S.hid[id];save();rebuild();go('manage',{k:'x'})},
  gdel(){if(!confirm('この句法を削除します。この句法に紐付いた例文は残りますが、紐付けは外れます。元に戻せません。'))return;const id=FX.id;S.ug=S.ug.filter(x=>x.id!==id);delete S.g[id];delete S.hid[id];save();rebuild();go('manage',{k:'g'})},
  xrev(){delete S.ed[FX.id];save();rebuild();go('manage',{k:'x'})},grev(){delete S.ed[FX.id];save();rebuild();go('manage',{k:'g'})},
  mtab(d){P.k=d.k;render()},
  hide(d){keep(()=>{S.hid[d.id]?delete S.hid[d.id]:S.hid[d.id]=1;save();rebuild();view==='gdet'?go('glist'):render()})},
  showall(d){S.hid={};save();rebuild();toast('すべて表示にしました');render()},
  hidex(d){S.hid[d.id]=1;save();rebuild();E.xs=E.xs.filter(x=>x.id!==d.id);if(E.i>=E.xs.length){toast('対象の例文がなくなりました');go('exmenu')}else{E.v={k:false,s:false,t:false};E.text='';render();scrollTo(0,0)}},
  etag(d){keep(()=>{EF.tags=EF.tags.includes(d.t)?EF.tags.filter(x=>x!==d.t):[...EF.tags,d.t];render()})},
  thc(d){setTheme({c:d.c})},thm(d){setTheme({m:d.m})},thr(){setTheme({c:'',m:'auto'})},
  tadd(){const n=FX.newtag.trim();if(!n)return toast('分類名を入力してください');const id=tagId(n);if(!FX.tags.includes(id))FX.tags.push(id);FX.newtag='';keep(render)},
  tmgr(){FX._tm=!FX._tm;keep(render)},
  tren(d){const t=T.find(x=>x.id===d.id),n=prompt('新しい分類名',t.name);if(n==null)return;const nn=n.trim();if(!nn)return toast('分類名を入力してください');
    if(T.some(x=>x.id!==t.id&&x.name===nn))return toast('同じ名前の分類がすでにあります');
    const u=S.ut.find(x=>x.id===t.id);u?u.name=nn:S.tn[t.id]=nn;save();rebuild();keep(render)},
  tdel(d){const t=T.find(x=>x.id===d.id);if(!confirm(`分類「${t.name}」を削除します。この分類が付いた句法・例文からは外れますが、句法・例文そのものは消えません。`))return;
    S.ut.some(x=>x.id===d.id)?S.ut=S.ut.filter(x=>x.id!==d.id):S.td[d.id]=1;FX.tags=FX.tags.filter(x=>x!==d.id);save();rebuild();keep(render)},
  csvtpl(){const b=new Blob(['\uFEFF白文,書き下し文,現代語訳,句法,解説,訓読文\n"國被圍於敵軍。","国、敵軍に囲まる。","国は敵軍に包囲される。","被～於A","（例）",""\n'],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='kanbun-template.csv';a.click()},
  csvplan(){const rows=parseCSV(CS.text);if(rows.length&&rows[0][0].trim()==='白文')rows.shift();
    const add=[],warn=[],seen=new Set(AX.map(x=>x.original));let dup=0;
    rows.forEach((r,i)=>{const o=(r[0]||'').trim();if(!o){warn.push(`${i+1}行目：白文が空のためスキップ`);return}if(seen.has(o)){dup++;return}seen.add(o);
      const gids=[];(r[3]||'').split(/[|｜;；]/).map(s=>s.trim()).filter(Boolean).forEach(n=>{const g=AG.find(g=>g.id===n||g.name===n||g.form===n);g?gids.push(g.id):warn.push(`${i+1}行目：句法「${n}」は未登録のため紐付けません`)});
      add.push({id:'ux_'+Date.now().toString(36)+i,passage_id:null,order:0,original:o,kundoku:(r[1]||'').trim(),translation:(r[2]||'').trim(),occ:gids.map(g=>({g,start:null,end:null})),explanation:(r[4]||'').trim(),kunten:(r[5]||'').trim(),tags:[],src:'CSV登録',verified:false})});
    CS.plan={add,warn,dup};render()},
  csvgo(){const n=CS.plan.add.length;S.ux.push(...CS.plan.add);CS.plan=null;CS.text='';save();rebuild();toast(n+'件を登録しました');go('add')}
};

/* ---------- 操作 ---------- */
const A={
  go:d=>go(d.v),
  start(){if(CFG.type==='k'&&X.length<4)return toast('例文が足りません');const qs=build();if(!qs.length)return toast('条件に合う問題がありません');Q={qs,i:0,okc:0,miss:[],res:null};go('quiz')},
  pick(d){const q=Q.qs[Q.i],c=q.choices[+d.i];Q.res={ok:c===q.correct,given:c};render()},
  submit(){const q=Q.qs[Q.i],v=$('#inp').value,y=norm(v);Q.res={ok:!!y&&q.answers.some(a=>{const x=norm(a);return x===y||(x.length>=4&&y.includes(x))}),given:v};render()},
  flip(){Q.res.ok=!Q.res.ok;render()},
  next(){const q=Q.qs[Q.i];if(q.gid)record(q.gid,Q.res.ok,q.t);Q.res.ok?Q.okc++:Q.miss.push(q);Q.i++;Q.res=null;Q.i>=Q.qs.length?go('result'):render()},
  favg(d){const p=gp(d.id);p.fav=!p.fav;save();render()},
  favs(d){const p=sp(d.id);p.fav=!p.fav;save();render()},
  weakquiz(){CFG.mode='weak';CFG.tags=[];A.start()},favquiz(){CFG.mode='fav';CFG.tags=[];A.start()},
  exstart(d){const xs=exf(d.m,d.nf);if(!xs.length)return toast('対象の例文がありません');
    const w=x=>{const s=S.s[x.id]||{};return(s.st==='ok'?2:s.st==='ng'?0:1)+Math.random()*1.2};xs.sort((a,b)=>w(a)-w(b));E={xs,i:0,v:{k:false,s:false,t:false},text:''};go('ex')},
  vt(d){keep(()=>{E.v[d.k]=!E.v[d.k];render()})},clr(){E.text='';render()},
  mark(d){const x=E.xs[E.i],s=sp(x.id);s.st=d.st;s.last=Date.now();save();A.exn()},
  exn(){E.i++;if(E.i>=E.xs.length){toast('一巡しました');go('exmenu')}else{E.v={k:false,s:false,t:false};E.text='';render();scrollTo(0,0)}},
  mic(){const R=window.SpeechRecognition||window.webkitSpeechRecognition,r=new R();r.lang='ja-JP';r.onresult=e=>{E.text=(E.text?E.text+'\n':'')+e.results[0][0].transcript;render()};
    r.onerror=()=>toast('音声認識を使えません。キーボードのマイクをお使いください');try{r.start();toast('話してください')}catch(e){toast('音声認識を開始できません')}},
  gtag(d){P.tag=d.t;render()},gdet(d){go('gdet',{id:d.id})},
  export(){const b=new Blob([JSON.stringify({app:'kanbun',exported:new Date().toISOString(),...S})],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download='kanbun-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();toast('書き出しました')},
  reset(){if(confirm('学習記録をすべて削除します。元に戻せません。先に書き出しておくことをおすすめします。削除しますか？')){S.g={};S.s={};S.log=[];save();toast('削除しました');render()}}
};
Object.assign(A,A2);
function go(v,p={}){view=v;P=p;history.pushState({},'');render();scrollTo(0,0)}
function render(){const f=V[view]||V.home;$('#app').innerHTML=f()}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(el&&A[el.dataset.a])A[el.dataset.a](el.dataset)});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='tx'&&E)E.text=t.value;const f=t.dataset.f;if(f==='csvtext')CS.text=t.value;else if(f&&FX)FX[f]=t.value});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='imp'){const f=t.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.g||!d.s||!Array.isArray(d.log))throw 0;
    if(confirm('現在の学習記録をこのバックアップで置き換えます。よろしいですか？')){const{app,exported,...r}=d;S=Object.assign(defS(),r);rebuild();applyTheme();save();toast('復元しました');render()}}catch(_){toast('このファイルは読み込めません')}};r.readAsText(f);return}
  if(t.id==='csvf'){const f=t.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{CS.text=String(r.result);CS.plan=null;render()};r.readAsText(f);return}
  if(t.id==='thc'){setTheme({c:t.value});return}
  if(t.dataset.fc&&FX){FX[t.dataset.fc]=t.checked;return}
  const k=t.dataset.cfg;if(!k)return;
  if(k==='tag')CFG.tags=t.checked?[...CFG.tags,t.value]:CFG.tags.filter(x=>x!==t.value);else if(k==='input')CFG.input=t.checked;else if(k==='n')CFG.n=+t.value;else CFG[k]=t.value;
  const y=scrollY;render();scrollTo(0,y)});
addEventListener('popstate',()=>{if(view!=='home'){view='home';P={};render()}});

(async()=>{
  S=Object.assign(defS(),await load()||{});applyTheme();
  try{const[g,x]=await Promise.all([fetch('grammar.json').then(r=>r.json()),fetch('sentences.json').then(r=>r.json())]);SG=g.grammar;ST=g.tags;SX=x.sentences}
  catch(e){$('#app').innerHTML='<p class=pad>データを読み込めませんでした。ファイルを直接開かず、Webサーバー（GitHub Pagesなど）経由で開いてください。</p>';return}
  rebuild();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  render();
})();
