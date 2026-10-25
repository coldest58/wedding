/* 前景灌木的花：把 <img data-sway> 換成內嵌 SVG，讓每朵花（和小葉子）各自微微搖擺；
   游標掃過（桌機）或手指點一下（手機）附近的花，會被晃一下再慢慢停回來。
   換成內嵌要用 fetch，所以直接雙擊 index.html（file://）時讀不到，會保留原本的 <img>，只是花不會動 */
(function(){
  "use strict";
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.fetch) return;
  const imgs = [...document.querySelectorAll('img[data-sway]')];
  if(!imgs.length) return;

  const plants = [];            // 每一株會動的東西：花（連同莖）或小葉子
  const BIG = 150;              // SVG 單位：比這小的群組才算花或葉，灌木本體都比這大

  // 整組挪（在 Illustrator 把小草叢＋花＋葉包成一個群組）：file 圖檔名、at 群組在畫布上的左上角（SVG 單位，差 20 以內都算）、
  // dx/dy 挪多少、media 什麼畫面才挪（拿掉就是所有畫面都挪）
  const MOVES = [
    { file:'h-near1', at:[520, 1254], dx:140, dy:0, media:'(max-aspect-ratio:4/5)' },  // 左下小黃花那叢：手機上往中間挪
    { file:'h-near2', at:[1142, 1202], dx:60, dy:0, media:'(max-aspect-ratio:4/5)' },  // 最靠中間的小紅花那叢：手機上往右挪
  ];

  // 花瓣是粉紅、黃、米白（紅色比綠色多）；灌木、葉、莖都是綠色系
  const isPetal = c => { const m = c.match(/\d+/g); return !!m && +m[0] > 150 && +m[0] >= +m[1]; };
  const fills = g => [...g.querySelectorAll('path,ellipse,circle,polygon,rect')].map(p => getComputedStyle(p).fill);

  async function inline(img, n){
    let t = await fetch(img.getAttribute('src')).then(r => { if(!r.ok) throw r.status; return r.text(); });
    // 兩張圖都是 Illustrator 輸出，class（st0…）和 id 會撞名，各自加前綴；畫布外的參考圖和 metadata 拿掉
    const p = 'sw' + n + '-';
    t = t.replace(/<metadata[\s\S]*?<\/metadata>/, '').replace(/<image[^>]*>/g, '')
         .replace(/\bst(\d+)\b/g, p + 'st$1').replace(/id="/g, 'id="' + p).replace(/url\(#/g, 'url(#' + p);
    const svg = document.importNode(new DOMParser().parseFromString(t, 'image/svg+xml').documentElement, true);
    svg.setAttribute('class', img.className);
    svg.setAttribute('aria-hidden', 'true');
    img.replaceWith(svg);
    collect(svg, (img.getAttribute('src').match(/([\w-]+)\.svg/) || [])[1]);
  }

  // 「一叢」不是一朵花，不能整叢搖：群組裡有草叢（夠大的綠色形狀），或直屬的東西有的帶花瓣、有的完全沒有（花＋葉＋小草團包在一起）。
  // 花＋莖包在一起也會被拆開，之後再由下面找莖的邏輯接回去，效果一樣
  const hasPetal = e => (e.matches('path,ellipse,circle,polygon,rect') ? [e] : [...e.querySelectorAll('path,ellipse,circle,polygon,rect')]).some(p => isPetal(getComputedStyle(p).fill));
  const hasBush = g => [...g.querySelectorAll('path')].some(p => { const b = p.getBBox(); return b.width > 60 && b.height > 60 && !isPetal(getComputedStyle(p).fill); })
    || ([...g.children].some(hasPetal) && [...g.children].some(c => { const b = c.getBBox(); return !hasPetal(c) && (b.width > 15 || b.height > 15); }));

  /* ---- 小樹叢：在 Illustrator 包成群組的「小草團＋花＋葉」。越下面的捲動時升得越慢，MOVES 的位移也套在這層 ---- */
  const clusters = [];          // { g 外包的 <g>, svg, m 對應的 MOVES, mq, k 視差強度 }
  const hero = document.getElementById('top');
  const BUSH = 'rgb(31, 111, 87)';  // 灌木本體的綠（#1F6F57）：小草團也用這個色
  function clusterize(svg, file){
    const vb = svg.viewBox.baseVal;
    const isCl = g => { const b = g.getBBox(); return b.width > 0 && b.width < 400 && b.height < 400 && b.x >= vb.x && b.x + b.width <= vb.x + vb.width &&
      [...g.querySelectorAll('path')].some(p => getComputedStyle(p).fill === BUSH); };
    const all = [...svg.querySelectorAll('g')].filter(isCl);
    const outer = all.filter(g => !all.some(o => o !== g && o.contains(g)));
    outer.forEach(el => {
      const b = el.getBBox();
      const m = MOVES.find(m => m.file === file && Math.abs(b.x - m.at[0]) < 20 && Math.abs(b.y - m.at[1]) < 20);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      el.before(g); g.append(el);
      // 越下面的樹叢越慢：依群組底部在畫布上的高度（1220～1370）給 0～.08，最上面的幾乎跟灌木一起動
      const depth = Math.min(1, Math.max(0, (b.y + b.height - 1220) / 150));
      clusters.push({ g, svg, m, mq: m && matchMedia(m.media || 'all'), k: .08 * depth });
    });
  }
  // 一開始所有樹叢都在原位、跟灌木一起出來；往下捲時越下面的升得越慢，捲完首屏（灌木就定位）後就不再拉開
  function placeClusters(){
    const end = hero ? hero.offsetHeight - innerHeight : 0, gone = Math.max(0, Math.min(scrollY, end));
    const unit = new Map();     // 每張 SVG：1px 等於幾個畫布單位
    for(const c of clusters){
      if(!unit.has(c.svg)) unit.set(c.svg, c.svg.viewBox.baseVal.width / (c.svg.getBoundingClientRect().width || 1));
      const on = c.m && c.mq.matches;
      const x = on ? c.m.dx || 0 : 0, y = (on ? c.m.dy || 0 : 0) + gone * c.k * unit.get(c.svg);
      c.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    }
  }

  function collect(svg, file){
    // 找「最外層的小群組」：自己夠小、但父群組不夠小；畫布外 Illustrator 留下的素材、含草叢的整叢都不算
    const vb = svg.viewBox.baseVal;
    const small = g => { const b = g.getBBox(); return b.width > 0 && b.width < BIG && b.height < BIG &&
      b.x >= vb.x && b.y >= vb.y && b.x + b.width <= vb.x + vb.width && b.y + b.height <= vb.y + vb.height && !hasBush(g); };
    const groups = [...svg.querySelectorAll('g')].filter(g => small(g) && !(g.parentNode.tagName === 'g' && small(g.parentNode)));
    const flowers = [], stems = [], leaves = [];
    for(const g of groups){
      const b = g.getBBox();
      if(fills(g).some(isPetal)) flowers.push(g);
      else if(b.width < b.height / 2) stems.push(g);
      else leaves.push(g);
    }
    for(const f of flowers){
      const fb = f.getBBox(), cx = fb.x + fb.width / 2;
      // 莖：在花底下、水平位置落在花的範圍內 → 包成同一組一起擺
      const stem = stems.find(s => { const b = s.getBBox(); return s.parentNode === f.parentNode && b.y < fb.y + fb.height && b.y + b.height > fb.y + fb.height && Math.abs(b.x + b.width / 2 - cx) < fb.width / 2; });
      // 群組本身就瘦長（莖已經畫在花的群組裡）：軸心在底部；只有花頭：假想花莖往下延伸，讓花頭畫弧
      let el = f, py = fb.height > fb.width * 1.3 ? fb.y + fb.height : fb.y + fb.height * 1.6;
      if(stem){
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const first = stem.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING ? stem : f;
        first.before(el); el.append(stem, f);
        const sb = stem.getBBox(); py = sb.y + sb.height;
      }
      add(el, f, cx, py, 1);
    }
    // 小草團用的是灌木本體的綠（#1F6F57），不是葉子，不搖
    for(const l of leaves){ if(fills(l).includes('rgb(31, 111, 87)')) continue; const b = l.getBBox(); add(l, l, b.x + b.width / 2, b.y + b.height, .45); }
    clusterize(svg, file);
  }

  function add(el, head, px, py, s){
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = `${px.toFixed(1)}px ${py.toFixed(1)}px`;
    plants.push({ el, head, s,
      amp: (2.5 + Math.random() * 2) * s,      // 平常搖擺的角度（度）
      w: (2 * Math.PI) / (2.6 + Math.random() * 1.6), // 一來一回 2.6～4.2 秒
      ph: Math.random() * 6.3, a: 0, v: 0 });
  }

  /* ---- 物理：平常的搖擺（正弦）＋被碰到時的彈簧晃動 ---- */
  const K = 90, C = 5, MAX = 28;  // 彈簧硬度、阻尼、最大晃動角度
  let raf = 0, last = 0, onScreen = false;
  function tick(now){
    const dt = Math.min(.033, (now - last) / 1000 || .016); last = now;
    const t = now / 1000;
    for(const p of plants){
      p.v += (-K * p.a - C * p.v) * dt;
      p.a = Math.max(-MAX, Math.min(MAX, p.a + p.v * dt));
      p.el.style.transform = `rotate(${(p.amp * Math.sin(t * p.w + p.ph) + p.a).toFixed(2)}deg)`;
    }
    placeClusters();
    raf = onScreen && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  const run = () => { if(!raf && onScreen && (plants.length || clusters.length)){ last = performance.now(); raf = requestAnimationFrame(tick); } };
  document.addEventListener('visibilitychange', run);

  // 推一下：離 (x,y) 越近晃越大；dir 正 = 往右倒
  function push(x, y, r, force, dirOf){
    for(const p of plants){
      const b = p.head.getBoundingClientRect();
      const d = Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y);
      if(d < r) p.v += dirOf(b) * force * p.s * (1 - d / r);
    }
    run();
  }

  // 桌機：游標掃過，順著游標移動的方向倒
  let lx = null;
  addEventListener('pointermove', e => {
    if(e.pointerType !== 'mouse' || !onScreen){ lx = null; return; }
    const dx = lx === null ? 0 : e.clientX - lx; lx = e.clientX;
    if(dx) push(e.clientX, e.clientY, 80, Math.max(-50, Math.min(50, dx * 3)), () => 1);
  }, {passive:true});
  // 手機點一下（桌機點擊也算）：附近的花往外倒，範圍大一點，手指點不準也晃得到
  addEventListener('pointerdown', e => {
    if(!onScreen) return;
    push(e.clientX, e.clientY, Math.max(180, innerWidth * .35), 300, b => (b.left + b.width / 2 >= e.clientX ? 1 : -1));
  }, {passive:true});

  Promise.all(imgs.map((img, i) => inline(img, i + 1).catch(() => {}))).then(() => {
    const svgs = [...document.querySelectorAll('svg.hero-near')];
    placeClusters();                                   // 先就定位（含手機的 MOVES），不等動畫開始
    addEventListener('resize', placeClusters, {passive:true});
    if(!('IntersectionObserver' in window)){ onScreen = true; return run(); }
    // 灌木在畫面裡才跑動畫（省電）
    const seen = new Set();
    const io = new IntersectionObserver(es => {
      for(const e of es) e.isIntersecting ? seen.add(e.target) : seen.delete(e.target);
      onScreen = seen.size > 0; run();
    });
    svgs.forEach(s => io.observe(s));
  });
})();
