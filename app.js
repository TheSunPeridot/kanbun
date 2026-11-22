'use strict';
/* 漢文句法 Phase 1 — データ(data/*.json)と学習記録(IndexedDB)は完全に分離 */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sh=a=>[...a].sort(()=>Math.random()-.5);
const norm=s=>String(s).normalize('NFKC').replace(/[\s〜~～、。,.!！?？「」・]/g,'').toLowerCase();
let S,G=[],T=[],X=[],GM={},view='home',P={},Q=null,E=null;
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
function pool(){let a=G.filter(g=>!CFG.tags.length||g.tags.some(t=>CFG.tags.includes(t)));
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
    const sc=x=>Math.max(...x.occ.map(o=>ids.has(o.g)?pri(o.g):-9));
    return X.filter(x=>x.occ.some(o=>ids.has(o.g))).map(x=>[x,sc(x)]).sort((p,q)=>q[1]-p[1]).slice(0,CFG.n).map(([x])=>({t:'k',gid:x.occ[0].g,prompt:x.original,ask:'正しい書き下し文は？',correct:x.kundoku,
      choices:sh([x.kundoku,...sh(X.filter(y=>y.id!==x.id&&y.kundoku!==x.kundoku)).slice(0,3).map(y=>y.kundoku)]),answers:[x.kundoku],expl:x.explanation||'',sub:x.translation}))}
  return a.map(g=>[g,pri(g.id)]).sort((p,q)=>q[1]-p[1]).slice(0,CFG.n).map(([g])=>mk(g))}

/* ---------- 画面 ---------- */
const head=(t,back='home')=>`<header><button class=back data-a=go data-v=${back} aria-label="戻る">‹</button><h1>${esc(t)}</h1></header>`;
const V={};
V.home=()=>{const w=G.filter(g=>weakG(g.id)).length+X.filter(x=>S.s[x.id]?.st==='ng').length,f=G.filter(g=>S.g[g.id]?.fav).length+X.filter(x=>S.s[x.id]?.fav).length;
  const t=(v,a,b,c='')=>`<button class="tile ${c}" data-a=go data-v=${v}><b>${a}</b><span>${b}</span></button>`;
  return`<header><h1>漢文句法</h1></header><div class=grid>${t('setup','クイズに挑戦','4形式・分類別','main')}${t('exmenu','例文トレーニング',X.length+'例文')}${t('glist','句法一覧',G.length+'句法')}${t('weak','苦手克服',w+'件')}${t('fav','お気に入り',f+'件')}${t('rec','学習記録','正答率・履歴')}${t('set','設定','バックアップ')}</div><p class=sm style="margin-top:16px">例文・問題の追加（手動・CSV・写真）はPhase 2で追加予定です。</p>`};

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
    b+=`<button class=btn data-a=favg data-id=${q.gid}>${S.g[q.gid]?.fav?'★ お気に入り解除':'☆ この句法をお気に入りに'}</button><button class="btn pri" data-a=next>${Q.i+1<Q.qs.length?'次へ':'結果を見る'}</button>`}
  return b};
V.result=()=>`${head('結果','setup')}<div class=score>${Q.okc} / ${Q.qs.length}</div><p class=sm style="text-align:center">${Math.round(Q.okc/Q.qs.length*100)}%</p>`+
  (Q.miss.length?`<div class=sec>間違えた問題</div>`+Q.miss.map(q=>`<div class=gb><b>${esc(q.prompt)}</b><br>正解：${esc(q.correct)}</div>`).join(''):'<p>全問正解です。</p>')+
  `<button class="btn pri" data-a=start>もう一度</button><button class=btn data-a=go data-v=home>ホームへ</button>`;

V.exmenu=()=>{const n=m=>X.filter(x=>m==='fav'?S.s[x.id]?.fav:m==='ng'?S.s[x.id]?.st==='ng':true).length;
  const c={ok:X.filter(x=>S.s[x.id]?.st==='ok').length,ng:X.filter(x=>S.s[x.id]?.st==='ng').length};
  return head('例文トレーニング')+`<p class=sm>理解できた ${c.ok} ／ まだ覚えていない ${c.ng} ／ 未学習 ${X.length-c.ok-c.ng}</p>`+
  [['all','すべて（未学習・苦手を優先）'],['ng','まだ覚えていない例文だけ'],['fav','お気に入りの例文だけ']].map(([m,l])=>`<button class=btn data-a=exstart data-m=${m}>${l}（${n(m)}）</button>`).join('')};
V.ex=()=>{const x=E.xs[E.i],s=S.s[x.id]||{},R=window.SpeechRecognition||window.webkitSpeechRecognition;
  let b=head(`例文 ${E.i+1} / ${E.xs.length}`,'exmenu')+`<div class=card><div class="kanji xl">${esc(x.original)}</div>${E.k?`<div class=kun>${esc(x.kundoku)}</div>`:''}</div>`;
  if(!E.k)b+=`<button class=btn data-a=exk>書き下し文を見る（任意）</button>`;
  b+=`<textarea id=tx class=inp rows=3 placeholder="現代語訳を考える（入力は任意。頭の中だけでもOK）">${esc(E.text)}</textarea><div class=two>${R?`<button class=btn data-a=mic>🎤 音声入力</button>`:`<p class=sm>キーボードのマイクで音声入力できます</p>`}<button class=btn data-a=clr>入力を消す</button></div>`;
  if(!E.a)return b+`<button class="btn pri" data-a=exa>現代語訳・解説を見る</button>`;
  b+=`<div class=tr>${esc(x.translation)}</div>`+x.occ.map(o=>GM[o.g]).filter(Boolean).map(g=>`<div class=gb><b>${esc(g.form)}</b>　${esc(g.meaning)}<br>書き下し：${esc(g.kundoku)}<br><span class=sm>${esc(g.note)}</span></div>`).join('')+(x.explanation?`<div class=note>${esc(x.explanation)}</div>`:'')+
    (x.verified?'':`<p class=sm>※ この例文は確認前のデータです（要確認）。教材で照合してください。</p>`)+
    `<div class=two><button class=btn data-a=mark data-st=ok>理解できた${s.st==='ok'?' ✓':''}</button><button class=btn data-a=mark data-st=ng>まだ覚えていない${s.st==='ng'?' ✓':''}</button></div><div class=two><button class=btn data-a=favs data-id=${x.id}>${s.fav?'★ お気に入り解除':'☆ お気に入り'}</button><button class=btn data-a=exn>次へ</button></div>`;
  return b};

V.glist=()=>{const f=P.tag,a=G.filter(g=>!f||g.tags.includes(f));
  return head('句法一覧')+`<div class=chips><button class="chip ${f?'':'on'}" data-a=gtag data-t="">すべて</button>${T.map(t=>`<button class="chip ${f===t.id?'on':''}" data-a=gtag data-t=${t.id}>${esc(t.name)}</button>`).join('')}</div>`+
  a.map(g=>{const[s,c]=status(g.id);return`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}${S.g[g.id]?.fav?' <span class=star>★</span>':''}</span><span class="badge ${c}">${s}</span><span class=sub>${esc(g.meaning)}</span></button>`}).join('')};
V.gdet=()=>{const g=GM[P.id],p=S.g[g.id]||{ok:0,ng:0,streak:0},ex=X.filter(x=>x.occ.some(o=>o.g===g.id)),sim=G.filter(x=>g.similar.includes(x.id)||x.similar.includes(g.id));
  return head(g.name,'glist')+`<div class=card><div class=kanji>${esc(g.form)}</div></div>
  <div class=chips>${g.tags.map(t=>`<span class=badge>${esc(tagName(t))}</span>`).join('')}<span class=badge>難易度 ${g.diff}</span>${g.verified?'':'<span class="badge unv">要確認</span>'}</div>
  <div class=tr>${esc(g.meaning)}</div><div class=kb>${esc(g.kundoku)}</div>${g.answers.length?`<div class=sm>別解・許容：${g.answers.map(esc).join(' ／ ')}</div>`:''}
  <div class=note>${esc(g.note)}</div><p class=sm>正解 ${p.ok} ／ 不正解 ${p.ng} ／ 連続正解 ${p.streak}</p>
  <button class=btn data-a=favg data-id=${g.id} data-r=gdet>${p.fav?'★ お気に入り解除':'☆ お気に入りに追加'}</button>`+
  (sim.length?`<div class=sec>似た句法</div>`+sim.map(x=>`<button class=row data-a=gdet data-id=${x.id}><span class=kn>${esc(x.form)}</span><span></span><span class=sub>${esc(x.meaning)}</span></button>`).join(''):'')+
  (ex.length?`<div class=sec>例文</div>`+ex.map(x=>`<div class=gb><span class=kanji style="font-size:20px">${esc(x.original)}</span><br><span style="color:var(--kun)">${esc(x.kundoku)}</span><br><span style="color:var(--tr)">${esc(x.translation)}</span></div>`).join(''):'')};

V.weak=()=>{const wg=G.filter(g=>weakG(g.id)),wx=X.filter(x=>S.s[x.id]?.st==='ng');
  return head('苦手克服')+(wg.length||wx.length?'':'<p>苦手はまだありません。クイズや例文トレーニングで間違えるとここに集まります。</p>')+
  (wg.length?`<button class="btn pri" data-a=weakquiz>苦手な句法でクイズ（${wg.length}）</button>`+wg.map(g=>`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}</span><span class="badge ng">苦手</span><span class=sub>${esc(g.meaning)}</span></button>`).join(''):'')+
  (wx.length?`<button class="btn pri" data-a=exstart data-m=ng>まだ覚えていない例文を練習（${wx.length}）</button>`:'')};
V.fav=()=>{const fg=G.filter(g=>S.g[g.id]?.fav),fx=X.filter(x=>S.s[x.id]?.fav);
  return head('お気に入り')+(fg.length||fx.length?'':'<p>★を付けた句法・例文がここに並びます。</p>')+
  (fg.length?`<button class="btn pri" data-a=favquiz>お気に入り句法でクイズ（${fg.length}）</button>`+fg.map(g=>`<button class=row data-a=gdet data-id=${g.id}><span class=kn>${esc(g.form)}</span><span></span><span class=sub>${esc(g.meaning)}</span></button>`).join(''):'')+
  (fx.length?`<button class="btn pri" data-a=exstart data-m=fav>お気に入り例文を練習（${fx.length}）</button>`+fx.map(x=>`<div class=gb><span class=kanji style="font-size:20px">${esc(x.original)}</span></div>`).join(''):'')};

const bar=(l,o,n)=>{const t=o+n,pc=t?Math.round(o/t*100):0;return`<div class=bar><div class=bl>${esc(l)}<span>${t?pc+'%（'+o+'/'+t+'）':'未学習'}</span></div><div class=bt><i style="width:${pc}%"></i></div></div>`};
V.rec=()=>{const att=G.filter(g=>S.g[g.id]&&S.g[g.id].ok+S.g[g.id].ng>0);const tot=att.reduce((s,g)=>s+S.g[g.id].ok+S.g[g.id].ng,0),ok=att.reduce((s,g)=>s+S.g[g.id].ok,0);
  const days=new Set(S.log.map(l=>new Date(l.t).toDateString())).size,sc={ok:X.filter(x=>S.s[x.id]?.st==='ok').length,ng:X.filter(x=>S.s[x.id]?.st==='ng').length};
  return head('学習記録')+`<div class=card><div class=score style="margin:0">${tot?Math.round(ok/tot*100):0}%</div><div class=sm>総合正答率（${ok}/${tot}問）／ 学習日数 ${days}日</div></div>
  <div class=sec>分類別の正答率</div>${T.map(t=>{let o=0,n=0;G.forEach(g=>{if(g.tags.includes(t.id)&&S.g[g.id]){o+=S.g[g.id].ok;n+=S.g[g.id].ng}});return bar(t.name,o,n)}).join('')}
  <div class=sec>句法別の正答率（低い順）</div>${att.sort((a,b)=>S.g[a.id].ok/(S.g[a.id].ok+S.g[a.id].ng)-S.g[b.id].ok/(S.g[b.id].ok+S.g[b.id].ng)).map(g=>bar(g.form,S.g[g.id].ok,S.g[g.id].ng)).join('')||'<p class=sm>まだ記録がありません。</p>'}
  <div class=sec>例文の習得状況</div><p>理解できた ${sc.ok} ／ まだ覚えていない ${sc.ng} ／ 未学習 ${X.length-sc.ok-sc.ng}</p>
  <div class=sec>最近の解答</div>${S.log.slice(-15).reverse().map(l=>`<div class=sm>${new Date(l.t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}　${l.ok?'○':'×'}　${esc(GM[l.g]?.form||l.g)}</div>`).join('')}`};
V.set=()=>head('設定')+`<div class=sec>バックアップ</div><p class=sm>学習記録（正答率・習得状況・お気に入り）をJSONで保存・復元します。機種変更や初期化の前に書き出してください。</p>
  <button class="btn pri" data-a=export>書き出す</button><label class=btn style="text-align:center">復元する（JSONを選択）<input id=imp type=file accept=".json,application/json" hidden></label>
  <div class=sec>データ</div><p class=sm>句法 ${G.length}件／例文 ${X.length}件（うち要確認 ${G.filter(g=>!g.verified).length+X.filter(x=>!x.verified).length}件）<br>学習記録は端末内に保存されます。</p>
  <button class=btn data-a=reset style="color:var(--ng)">学習記録をすべて削除</button>`;

/* ---------- 操作 ---------- */
const A={
  go:d=>go(d.v),
  start(){if(CFG.type==='k'&&X.length<4)return toast('例文が足りません');const qs=build();if(!qs.length)return toast('条件に合う問題がありません');Q={qs,i:0,okc:0,miss:[],res:null};go('quiz')},
  pick(d){const q=Q.qs[Q.i],c=q.choices[+d.i];Q.res={ok:c===q.correct,given:c};render()},
  submit(){const q=Q.qs[Q.i],v=$('#inp').value,y=norm(v);Q.res={ok:!!y&&q.answers.some(a=>{const x=norm(a);return x===y||(x.length>=4&&y.includes(x))}),given:v};render()},
  flip(){Q.res.ok=!Q.res.ok;render()},
  next(){const q=Q.qs[Q.i];record(q.gid,Q.res.ok,q.t);Q.res.ok?Q.okc++:Q.miss.push(q);Q.i++;Q.res=null;Q.i>=Q.qs.length?go('result'):render()},
  favg(d){const p=gp(d.id);p.fav=!p.fav;save();render()},
  favs(d){const p=sp(d.id);p.fav=!p.fav;save();render()},
  weakquiz(){CFG.mode='weak';CFG.tags=[];A.start()},favquiz(){CFG.mode='fav';CFG.tags=[];A.start()},
  exstart(d){const xs=X.filter(x=>d.m==='fav'?S.s[x.id]?.fav:d.m==='ng'?S.s[x.id]?.st==='ng':true);if(!xs.length)return toast('対象の例文がありません');
    const w=x=>{const s=S.s[x.id]||{};return(s.st==='ok'?2:s.st==='ng'?0:1)+Math.random()*1.2};xs.sort((a,b)=>w(a)-w(b));E={xs,i:0,k:false,a:false,text:''};go('ex')},
  exk(){E.k=true;render()},exa(){E.a=true;render()},clr(){E.text='';render()},
  mark(d){const x=E.xs[E.i],s=sp(x.id);s.st=d.st;s.last=Date.now();save();A.exn()},
  exn(){E.i++;if(E.i>=E.xs.length){toast('一巡しました');go('exmenu')}else{E.k=E.a=false;E.text='';render();scrollTo(0,0)}},
  mic(){const R=window.SpeechRecognition||window.webkitSpeechRecognition,r=new R();r.lang='ja-JP';r.onresult=e=>{E.text=(E.text?E.text+'\n':'')+e.results[0][0].transcript;render()};
    r.onerror=()=>toast('音声認識を使えません。キーボードのマイクをお使いください');try{r.start();toast('話してください')}catch(e){toast('音声認識を開始できません')}},
  gtag(d){P.tag=d.t;render()},gdet(d){go('gdet',{id:d.id})},
  export(){const b=new Blob([JSON.stringify({app:'kanbun',exported:new Date().toISOString(),...S})],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download='kanbun-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();toast('書き出しました')},
  reset(){if(confirm('学習記録をすべて削除します。元に戻せません。先に書き出しておくことをおすすめします。削除しますか？')){S={v:1,g:{},s:{},log:[]};save();toast('削除しました');render()}}
};
function go(v,p={}){view=v;P=p;history.pushState({},'');render();scrollTo(0,0)}
function render(){const f=V[view]||V.home;$('#app').innerHTML=f()}
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(el&&A[el.dataset.a])A[el.dataset.a](el.dataset)});
document.addEventListener('input',e=>{if(e.target.id==='tx'&&E)E.text=e.target.value});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='imp'){const f=t.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.g||!d.s||!Array.isArray(d.log))throw 0;
    if(confirm('現在の学習記録をこのバックアップで置き換えます。よろしいですか？')){S={v:1,g:d.g,s:d.s,log:d.log};save();toast('復元しました');render()}}catch(_){toast('このファイルは読み込めません')}};r.readAsText(f);return}
  const k=t.dataset.cfg;if(!k)return;
  if(k==='tag')CFG.tags=t.checked?[...CFG.tags,t.value]:CFG.tags.filter(x=>x!==t.value);else if(k==='input')CFG.input=t.checked;else if(k==='n')CFG.n=+t.value;else CFG[k]=t.value;
  const y=scrollY;render();scrollTo(0,y)});
addEventListener('popstate',()=>{if(view!=='home'){view='home';P={};render()}});

(async()=>{
  S=await load()||{v:1,g:{},s:{},log:[]};S.g=S.g||{};S.s=S.s||{};S.log=S.log||[];
  try{const[g,x]=await Promise.all([fetch('grammar.json').then(r=>r.json()),fetch('sentences.json').then(r=>r.json())]);G=g.grammar;T=g.tags;X=x.sentences}
  catch(e){$('#app').innerHTML='<p class=pad>データを読み込めませんでした。ファイルを直接開かず、Webサーバー（GitHub Pagesなど）経由で開いてください。</p>';return}
  GM=Object.fromEntries(G.map(g=>[g.id,g]));
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  render();
})();
