/* ---------- 高雄小抄 地圖（assets/kaohsiung-map.svg 上面疊交通路線和地點） ----------
   地圖只畫選中那一天會去的點（婚宴永遠顯示）；選中的行程（預設第一站）或滑過的點旁邊貼名稱小標籤。
   ✏️ 要加減地點就改 SPOTS：
   id    和 index.html 行程 <li data-spot="…"> 對應（一行可以寫好幾個 id，空白隔開）：滑到行程，地圖上的點會亮、跳出說明
   kind  venue＝婚宴、sight＝景點、food＝美食、thsr／tra／mrt＝高鐵／台鐵／捷運站
   plan  both＝兩個版本都顯示、fam＝只在家庭版、solo＝只在個人版
   route （可省略）家庭版第 1 日的路線 panel id（g-r-park／g-r-pier）：家庭版只在選到那條路線時顯示；個人版不受影響
   at    [緯度, 經度]（Google 地圖對著地點按右鍵，第一行就是「緯度, 經度」）
   底圖範圍只有橋頭到小港的沿海市區（VIEW），超出範圍的點不會出現 */
(function(){
  "use strict";
  const wrap = document.getElementById('g-map');
  if(!wrap) return;

  const SPOTS = [
    {id:'venue',    kind:'venue', plan:'both', at:[22.7580,120.3135], name:'婚宴・物五會館', note:'12/13 喜宴在這裡！旁邊就是橋頭糖廠，飯後可以散步'},
    {id:'tra-qt',   kind:'tra',   plan:'both', at:[22.7610,120.3100], name:'台鐵橋頭車站', note:'離婚宴約 500 公尺'},
    {id:'mrt-qt',   kind:'mrt',   plan:'both', at:[22.7536,120.3146], name:'捷運橋頭糖廠站', note:'紅線 R22A，離婚宴約 500 公尺'},
    {id:'thsr',     kind:'thsr',  plan:'both', at:[22.6871,120.3077], name:'高鐵左營站', note:'同站轉捷運紅線'},
    {id:'tra-ks',   kind:'tra',   plan:'both', at:[22.6394,120.3026], name:'台鐵高雄車站', note:'同站轉捷運紅線'},
    {id:'yancheng', kind:'food',  plan:'both', route:'g-r-pier', at:[22.6242,120.2841], name:'鹽埕埔', note:'捷運橘線鹽埕埔站。午餐：阿財雞絲麵、鴨肉珍、塩埕鴨肉意麵；奶茶：双妃、松藝、天池冬瓜茶；順路逛塩埕第一公有市場'},
    // 駁二、大港橋、棧貳庫彼此只隔幾百公尺，地圖上分開畫會疊在一起，所以合成一個點（放在大港橋）
    {id:'pier2',    kind:'sight', plan:'fam',  route:'g-r-pier', at:[22.6190,120.2790], name:'駁二・大港橋・棧貳庫', note:'鹽埕埔走路約 10 分鐘。駁二免費、推車好走，蓬萊區有哈瑪星台灣鐵道館（要買票）；大港橋固定時段會旋轉；棧貳庫看海、休息'},
    {id:'park',     kind:'sight', plan:'fam',  route:'g-r-park', at:[22.6163,120.3291], name:'高雄親子遊樂園區', note:'鳳山區武慶二路，輕軌凱旋武昌站走路約 1 分鐘。免費入園，週一、週二休園；園區內有美食區'},
    {id:'wwy',      kind:'sight', plan:'fam',  route:'g-r-park', at:[22.6225,120.3412], name:'衛武營', note:'都會公園的綠地和遊樂園區相連，大草皮適合跑跳；藝文中心有大片屋簷可遮陽躲雨，館內有餐廳'},
    {id:'dream',    kind:'food',  plan:'fam',  at:[22.5951,120.3070], name:'夢時代', note:'兩條路線都能搭輕軌直達。晚餐：6 樓白玉樓（必比登推介台灣菜，建議訂位）'},
    {id:'ferry-gs', kind:'sight', plan:'solo', at:[22.6199,120.2700], name:'鼓山輪渡站', note:'搭渡輪到旗津'},
    {id:'ferry-kw', kind:'sight', plan:'solo', at:[22.6190,120.2771], name:'棧貳庫輪渡站', note:'搭渡輪到旗津'},
    {id:'cijin',    kind:'sight', plan:'solo', at:[22.6135,120.2680], name:'旗津', note:'旗後山看燈塔、礮臺、海港風景；晚餐在廟前路'}
  ];

  // 路線：OpenStreetMap 2026-10 的高鐵、台鐵（主線）、高雄捷運紅橘線、環狀輕軌，已換成底圖座標並簡化（© OpenStreetMap contributors, ODbL）
  const ROUTES = {
    thsr:[
      '145.4,753.5 147.1,750.8 148.5,749.6 150.6,749.0 165.3,749.7 150.6,749.1 148.6,749.6 147.2,750.8 145.5,753.5 143.0,756.6 145.4,753.5',
      '133.6,603.9 141.2,644.6 143.6,651.1 150.1,664.4 167.5,703.4 172.1,714.0 174.1,721.1 174.7,727.0 174.7,740.2 174.7,727.0 174.0,721.1 172.1,714.0 167.4,703.4 150.1,664.5 143.6,651.2 141.1,644.6 133.6,603.9',
      '174.7,740.2 174.0,743.7 171.9,746.8 169.0,748.9 165.3,749.7 168.9,748.8 171.9,746.7 173.9,743.7 174.7,740.2',
      '131.3,768.2 133.5,766.2 136.0,764.0 137.9,761.9 143.0,756.6 138.0,761.9 137.5,762.4 133.6,766.3 131.4,768.3'
    ],
    tra:[
      '133.5,695.7 133.9,697.0 134.1,697.6 133.9,697.0 133.5,695.8 131.3,689.4 131.3,689.1 131.4,689.4 133.5,695.7',
      '129.3,681.1 129.3,681.6 129.7,684.3 131.3,689.1 129.7,684.4 129.3,681.6 129.2,681.1 127.9,669.8 122.6,660.6 127.9,669.6 129.3,681.1',
      '148.1,729.8 146.4,735.2 146.1,736.0 145.9,738.6 146.9,742.5 147.6,748.0 146.7,751.2 142.8,756.7 132.2,767.1 131.5,767.7 128.1,771.5 120.7,780.0 115.4,788.5 114.8,790.6 114.1,802.5 115.1,806.2 116.1,807.2 117.3,807.7 121.5,807.0 125.9,805.0 128.9,805.1 133.6,805.5 143.8,806.4 177.4,813.2 179.2,813.0 180.9,811.9 182.8,810.4 185.9,808.5 189.9,807.5 190.1,807.4 202.8,804.8 211.3,804.5 218.5,804.1 220.6,802.9 222.0,801.1',
      '180.9,812.0 179.2,813.0 177.4,813.3 143.8,806.4 133.6,805.6 128.9,805.1 126.0,805.0 121.5,807.0 117.3,807.7 116.0,807.2 115.1,806.2 114.1,802.5 115.1,789.1 120.8,779.8 128.1,771.5 131.4,767.7 132.5,766.7 132.6,766.6 142.2,757.3 145.4,753.4 147.0,750.4 147.6,748.0 146.8,742.0 145.8,738.6 146.0,736.0 146.3,735.2 148.3,729.2 148.4,728.9 148.7,726.8 148.2,724.6 145.6,720.8 134.4,698.3 134.1,697.6 134.4,698.3 145.3,720.2 148.2,724.6 148.7,726.8 148.4,729.0 148.4,729.2 148.1,729.8 146.9,733.6',
      '180.9,812.0 182.8,810.4 185.9,808.4 189.9,807.4 190.1,807.4 203.5,804.7 217.9,804.2 220.2,803.1 221.9,801.1'
    ],
    red:[
      '130.5,687.8 134.9,699.1 142.2,713.7 142.6,720.5 145.4,731.4 145.1,732.8 144.0,734.3 133.0,738.9 131.9,740.0 130.5,745.6 130.8,754.6 131.8,758.6 134.9,763.4 137.8,766.6 138.2,767.9 137.9,769.1 133.9,774.1 131.6,779.5 131.4,789.6 131.9,793.8 129.9,819.1 134.5,831.9 145.2,847.1 153.7,858.1 158.4,863.3 160.7,864.2 166.5,864.5 168.1,865.0 173.1,870.8 168.1,864.9 166.4,864.4 160.7,864.2 158.4,863.2 153.8,858.1 145.2,847.1 135.1,832.8 130.1,819.3 131.1,806.6 132.0,793.8 131.5,789.9 131.7,779.5 133.9,774.2 135.7,771.6 138.1,769.0 138.3,767.9 138.0,766.7 134.1,762.1 131.9,758.6 130.9,754.9 130.5,745.6 131.9,740.1 132.8,739.1 144.1,734.2 145.2,732.7 145.4,731.0 142.6,720.5 142.2,713.6 134.9,699.1 132.2,692.9 130.5,687.7 129.8,686.0 128.9,684.1 128.5,682.6 127.6,676.0 128.4,682.6 128.9,684.1 129.7,686.1 130.5,687.8',
      '127.5,675.2 127.6,676.0 127.5,675.2'
    ],
    // 環狀輕軌：2026-10 從 OpenStreetMap 抓主線（不含機廠、渡線），雙軌併成一圈
    lrt:[
      '124.4,792.5 125.9,792.7 134.2,790.7 142.0,792.3 148.7,797.6 151.0,805.8 149.3,811.0 146.6,814.6 150.8,826.4 149.7,831.5 148.5,835.2 141.5,842.6 135.0,844.9 133.7,844.1 128.5,830.1 126.9,830.3 122.9,827.9 122.8,827.0 124.1,824.1 123.5,822.5 122.0,822.0 120.5,822.4 119.5,823.5 118.6,823.7 113.1,821.1 112.3,821.8 110.2,820.7 111.4,818.0 115.9,810.3 114.3,803.0 114.9,792.3 122.7,792.4 124.4,792.5'
    ],
    orange:[
      '200.5,821.2 198.1,818.4 198.0,818.3 195.5,815.8 193.6,815.1 192.7,815.2 182.6,819.6 179.3,818.0 174.9,817.1 162.4,818.1 150.2,813.8 130.7,812.2 118.2,816.3 117.1,817.3 115.0,821.5 114.0,822.3 112.4,822.2 108.4,819.8 112.4,822.3 114.1,822.4 114.9,821.7 117.2,817.4 118.3,816.4 130.6,812.2 150.0,813.9 162.4,818.2 175.0,817.1 179.3,818.1 182.5,819.6 192.7,815.3 194.1,815.3 195.5,815.9 198.0,818.4 200.5,821.3'
    ]
  };

  // 經緯度 → 底圖座標（用 28 個行政區的位置對出來的換算，誤差約 200 公尺）
  const xy = ([lat,lon]) => [782.992*lon - 5.22406*lat - 93946.544, 7.88463*lon - 844.589*lat + 18977.898];
  const VIEW = [14,680,186,190];   // 要和 assets/kaohsiung-map.svg 的 viewBox、css/guide.css 的 .g-map aspect-ratio 一樣
  const pct = ([x,y]) => [(x-VIEW[0])/VIEW[2]*100, (y-VIEW[1])/VIEW[3]*100];
  const NS = 'http://www.w3.org/2000/svg';

  const lines = document.createElementNS(NS,'svg');
  lines.setAttribute('class','g-map-lines');
  lines.setAttribute('viewBox', VIEW.join(' '));
  lines.setAttribute('preserveAspectRatio','none');   // 和用百分比放的點對齊
  lines.setAttribute('aria-hidden','true');
  wrap.appendChild(lines);
  // 台鐵畫成黑白相間（黑底線＋白虛線），其他單色
  // 台鐵先畫、壓在最下面：新左營一帶高鐵和台鐵並排，不然高鐵會被蓋住
  ['tra','thsr','lrt','red','orange'].forEach(k=>ROUTES[k].forEach(d=>{
    (k==='tra' ? ['tra','tra-dash'] : [k]).forEach(c=>{
      const pl = document.createElementNS(NS,'polyline');
      pl.setAttribute('points',d); pl.setAttribute('class','g-route g-route-'+c);
      lines.appendChild(pl);
    });
  }));

  const steps = [...document.querySelectorAll('#guide [data-spot]')];
  const ids = el => el.dataset.spot ? el.dataset.spot.split(' ') : [];   // 「回旅宿」這類沒有地點的行程＝空

  // 亮起的點旁邊貼一個只寫名稱的小標籤（說明文字在行程清單／手機行程卡裡，地圖上不重複）
  let labels = [];
  let active = null;   // 目前選中的行程（<li>）；預設是該版本的第一站，點行程或地圖上的點會換
  const spot = id => SPOTS.find(o=>o.id===id);
  function clearLabels(){ labels.forEach(l=>l.remove()); labels = []; }
  function addLabels(list){
    clearLabels();
    list.forEach(s=>{
      const l = document.createElement('span');
      l.className = 'g-label' + (s.px[0] > 58 ? ' is-left' : '');
      l.textContent = s.name;
      l.style.left = s.px[0]+'%'; l.style.top = s.px[1]+'%';
      l.setAttribute('aria-hidden','true');
      wrap.appendChild(l); labels.push(l);
    });
    // 兩個點很近（例如橋頭的台鐵站和捷運站）標籤會疊在一起：同一邊的標籤由上往下排，太近就往下推
    ['', ' is-left'].forEach(side=>{
      const same = labels.filter(l=>(l.classList.contains('is-left') ? ' is-left' : '')===side)
        .map(l=>({l, y:l.offsetTop})).sort((p,q)=>p.y-q.y);
      let prev = -Infinity;
      same.forEach(o=>{
        const h = o.l.offsetHeight, y = Math.max(o.y, prev + h + 4, h/2 + 4);
        if(y !== o.y) o.l.style.top = y+'px';
        prev = y;
      });
    });
  }
  // 地圖只畫「這一天」會去的點（婚宴永遠留著當參考）：day＝行程所在的 .g-col
  function scope(day){
    const here = new Set(day ? [...day.querySelectorAll('[data-spot]')].filter(x=>!x.closest('[hidden]')).flatMap(ids) : []);
    SPOTS.forEach(s=>{ s.dot.style.display = s.planOn && (s.kind==='venue' || here.has(s.id)) ? '' : 'none'; });
  }
  // 亮起某幾個點、貼上名稱（滑過時用；滑開就回到選中的那一站）；step＝這幾個點屬於哪一行行程，用來決定顯示哪一天
  function light(list, step){
    scope((step || active) && (step || active).closest('.g-col'));
    SPOTS.forEach(s=>s.dot.classList.toggle('is-hi', list.includes(s.id)));
    addLabels(list.map(spot).filter(s=>s && s.dot.style.display!=='none'));
  }
  function restore(){
    steps.forEach(x=>{ x.classList.remove('is-hi'); x.classList.toggle('is-active', x===active); });
    light(active ? ids(active) : [], active);
  }
  function activate(x){ active = x; restore(); renderCard(); }

  SPOTS.forEach(s=>{
    s.px = pct(xy(s.at));
    const d = document.createElement('button');
    d.type = 'button'; d.className = 'g-dot g-dot-'+s.kind; d.setAttribute('aria-label', s.name+'：'+s.note);
    d.style.left = s.px[0]+'%'; d.style.top = s.px[1]+'%';
    const hover = ()=>{ light([s.id]); steps.forEach(x=>x.classList.toggle('is-hi', ids(x).includes(s.id))); };
    d.addEventListener('mouseenter',hover);
    d.addEventListener('focus',hover);
    d.addEventListener('mouseleave',restore);
    d.addEventListener('blur',restore);
    // 點地圖上的點：選中行程裡對應的第一行，並閃一下
    d.addEventListener('click',()=>{
      const t = steps.find(x=>ids(x).includes(s.id) && !x.closest('[hidden]'));
      if(!t) return;
      activate(t);
      t.classList.remove('is-flash'); void t.offsetWidth; t.classList.add('is-flash');
    });
    wrap.appendChild(d); s.dot = d;
  });

  // 行程：滑過預覽，點一下（或 Enter）選中
  steps.forEach(x=>{
    x.tabIndex = 0;
    x.addEventListener('mouseenter',()=>{ x.classList.add('is-hi'); light(ids(x), x); });
    x.addEventListener('mouseleave',restore);
    x.addEventListener('click',()=>activate(x));
    x.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); activate(x); } });
  });

  // ---------- 手機版：行程清單收起來，改成地圖下面一張行程卡，按「上一站／下一站」換（桌機用 CSS 藏起來） ----------
  // 卡片內容直接讀行程清單（index.html 的 .g-step），不另外存一份資料
  const fig = wrap.closest('figure');
  const all = [...document.querySelectorAll('#guide .g-step')];
  const seq = () => all.filter(x=>!x.closest('[hidden]'));   // 目前版本、路線看得到的行程，第 1 日接第 2 日

  // 家庭版第 1 日的路線切換：原本的按鈕在清單裡（手機上藏起來），所以在地圖上方放一組一樣的，按了等於按原本的
  const pickM = document.createElement('div');
  pickM.className = 'g-pick g-pick-m';
  pickM.setAttribute('aria-label','第 1 日路線');
  const picks = [...document.querySelectorAll('#g-fam .g-pick [role="tab"]')].map(orig=>{
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = orig.textContent;
    b.addEventListener('click',()=>orig.click());
    pickM.appendChild(b);
    return [b, orig];
  });
  fig.insertBefore(pickM, wrap);
  function syncPick(){
    pickM.hidden = document.getElementById('g-fam').hidden;
    picks.forEach(([b,orig])=>b.setAttribute('aria-pressed', orig.getAttribute('aria-selected')));
  }

  const card = document.createElement('div');
  card.className = 'g-card';
  card.innerHTML =
    '<div class="g-card-box" aria-live="polite">'+
      '<div class="g-card-meta"><span class="g-card-day"></span><span class="g-card-count"></span></div>'+
      '<div class="g-card-row"><span class="g-mk g-card-mk" aria-hidden="true"></span><div><b class="g-card-title"></b><p class="g-card-note"></p></div></div>'+
    '</div>'+
    '<div class="g-card-dots"></div>'+
    '<div class="g-card-nav"><button type="button" class="g-card-prev">‹ 上一站</button><button type="button" class="g-card-next">下一站 ›</button></div>';
  wrap.after(card);
  const $ = c => card.querySelector(c);
  function go(d){ const list = seq(), i = list.indexOf(active) + d; if(list[i]) activate(list[i]); }
  $('.g-card-prev').addEventListener('click',()=>go(-1));
  $('.g-card-next').addEventListener('click',()=>go(1));
  // 卡片左右滑也能換站
  let tx = null;
  $('.g-card-box').addEventListener('touchstart',e=>{ tx = e.touches[0].clientX; },{passive:true});
  $('.g-card-box').addEventListener('touchend',e=>{
    if(tx===null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if(Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  });
  // 卡片高度固定成這條路線最高的那一站，換站時下面的按鈕才不會跳來跳去（切換路線、轉向時重算）
  function fitCard(){
    const box = $('.g-card-box');
    if(!box.offsetParent) return;   // 桌機：卡片藏著，不用算
    box.style.minHeight = '';
    let h = 0;
    seq().forEach(x=>{ fill(x); h = Math.max(h, box.offsetHeight); });
    box.style.minHeight = h+'px';
    renderCard();
  }
  function fill(x){
    const p = x.querySelector('p');
    $('.g-card-day').textContent = x.closest('.g-col').querySelector('h3').textContent.trim();
    $('.g-card-mk').innerHTML = x.querySelector('.g-mk').innerHTML;
    $('.g-card-title').textContent = x.querySelector('b').textContent;
    $('.g-card-note').textContent = p ? p.textContent : '';
    $('.g-card-note').hidden = !p;
  }
  function renderCard(){
    const list = seq(), i = list.indexOf(active);
    if(i < 0) return;
    fill(active);
    $('.g-card-count').textContent = (i+1)+' / '+list.length;
    $('.g-card-prev').disabled = i===0;
    $('.g-card-next').disabled = i===list.length-1;
    // 進度點：一站一點，可以直接點；換日的地方多空一點
    const dots = $('.g-card-dots');
    dots.innerHTML = '';
    list.forEach((x,j)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label','第 '+(j+1)+' 站：'+x.querySelector('b').textContent);
      if(j===i) b.setAttribute('aria-current','step');
      if(j && x.closest('.g-col')!==list[j-1].closest('.g-col')) b.className = 'is-newday';
      b.addEventListener('click',()=>activate(x));
      dots.appendChild(b);
    });
  }

  // 依目前的版本（家庭／個人）和家庭版選的路線決定要顯示哪些點；panelId＝剛切換的 panel，預設選它可見的第一站
  function show(panelId){
    const plan = document.getElementById('g-solo').hidden ? 'fam' : 'solo';
    SPOTS.forEach(s=>{
      s.planOn = (s.plan==='both'||s.plan===plan) && (plan!=='fam' || !s.route || !document.getElementById(s.route).hidden);
    });
    number();
    syncPick();
    activate([...document.querySelectorAll('#'+panelId+' [data-spot]')].find(x=>!x.closest('[hidden]')));
    fitCard();
  }
  // 景點、美食、婚宴照目前看得到的行程順序編號 1、2、3…（車站不編號；第 2 日接續第 1 日的號碼，因為婚宴的點每天都在地圖上）；
  // 地圖圓點裡寫號碼，行程那一行的 ▼ 換成同一個號碼，兩邊對得起來
  function number(){
    const num = {};
    let n = 0;
    // 同一行裡新出現的點共用一個號碼（例如「鼓山輪渡站或棧貳庫輪渡站」二選一，都算第 2 站）
    steps.filter(x=>!x.closest('[hidden]')).forEach(x=>{
      const fresh = ids(x).filter(id=>{ const s = spot(id); return s && (s.kind==='sight'||s.kind==='food'||s.kind==='venue') && !(id in num); });
      if(fresh.length){ n++; fresh.forEach(id=>num[id] = n); }
    });
    SPOTS.forEach(s=>{
      const k = num[s.id];
      s.dot.textContent = k || '';
      s.dot.classList.toggle('has-num', !!k);
      s.dot.setAttribute('aria-label', (k ? k+'. ' : '')+s.name+'：'+s.note);
    });
    steps.forEach(x=>{
      const mk = x.querySelector('.g-mk');
      if(!mk) return;
      if(mk.dataset.orig===undefined) mk.dataset.orig = mk.textContent;
      const s = ids(x).map(spot).find(s=>s && num[s.id]);
      if(s){
        mk.innerHTML = '<span class="g-num g-num-'+s.kind+'"></span>';
        mk.firstChild.textContent = num[s.id];
      } else mk.textContent = mk.dataset.orig;
    });
  }
  show('g-fam');
  // 跟著「家庭版／個人版」和家庭版第 1 日的路線切換
  document.addEventListener('guide:tab', e=>show(e.detail));
  // 字型載入完字寬會變，卡片高度再算一次
  if(document.fonts) document.fonts.ready.then(fitCard);
  // 手機上卡片高度也要重算（寬度變了，字換行的地方就不同）
  let lastW = 0;
  new ResizeObserver(()=>{
    if(labels.length) restore();   // 標籤錯開是用像素算的，版面變了要重排
    if(wrap.clientWidth !== lastW){ lastW = wrap.clientWidth; fitCard(); }
  }).observe(wrap);
})();
