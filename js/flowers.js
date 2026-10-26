/* 前景灌木的花：把 <img data-sway> 換成內嵌 SVG，讓每朵花（和小葉子）各自微微搖擺；
   游標掃過（桌機）或手指點一下（手機）附近的花，會被晃一下再慢慢停回來。
   換成內嵌要用 fetch，所以直接雙擊 index.html（file://）時讀不到，會保留原本的 <img>，只是花不會動 */
(function(){
  "use strict";
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.fetch) return;
  const imgs = [...document.querySelectorAll('img[data-sway]')];
  if(!imgs.length) return;

  const plants = [];            // 每一株會動的東西：花（連同莖）或小葉子
  const ord = new WeakMap();    // 元素在原圖裡的前後順序
  const BIG = 150;              // SVG 單位：比這小的群組才算花或葉，灌木本體都比這大

  // 整組挪（只用在沒命名的圖；在 Illustrator 把小草叢＋花＋葉包成一個群組）：file 圖檔名、at 群組在畫布上的左上角（SVG 單位，差 20 以內都算）、
  // dx/dy 挪多少、media 什麼畫面才挪（拿掉就是所有畫面都挪）
  const MOVES = [
    { file:'h-near1', at:[550, 1297], dx:140, dy:0, media:'(max-aspect-ratio:4/5)' },  // 左下小黃花那叢：手機上往中間挪
    { file:'h-near1', at:[520, 1259], dx:140, dy:0, media:'(max-aspect-ratio:4/5)' },  // 小黃花原本墊底的小草團（另成一組）：跟著一起挪
    { file:'h-near2', at:[1142, 1202], dx:60, dy:0, media:'(max-aspect-ratio:4/5)' },  // 最靠中間的小紅花那叢：手機上往右挪
  ];

  // 有命名的圖：兩朵 flower 在某些畫面互換左右位置（y 不變），花所在、包著 bush 的群組（花＋莖、葉、草團）整組一起挪。
  // a、b 是兩朵花頭在畫布上的左上角（SVG 單位，差 20 以內都算），x 以花頭的中心點互換
  const SWAPS = [
    { file:'h-near1', a:[589, 1296], b:[653, 1388], media:'(max-aspect-ratio:4/5)' },  // 中下角黃花 ⇄ 中下角大粉花：手機上
  ];

  // 有命名的圖：後層（h-near2）的某朵花在某些畫面改畫到前層（h-near1）前面，位置不變、照樣搖。
  // 花有包在含 bush 的群組裡就整組（花、莖、葉、草團）一起抬，沒有就只抬花頭＋莖。
  // at 是花頭在畫布上的左上角（SVG 單位，差 20 以內都算）；dx/dy 是同一個畫面上再挪多少（往右／往下為正）
  const LIFTS = [
    { file:'h-near2', at:[1198, 1376], dx:40, media:'(max-aspect-ratio:4/5)' },  // 靠中間的白花：手機上會被 h-near1 整朵擋住；再往右 40
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
  // 草叢＝夠大、而且是草團的顏色（灌木綠和它的深色外框）；長花莖、大葉子用的是別的綠，再大也不算
  const MOUND = ['rgb(31, 111, 87)', 'rgb(0, 74, 64)'];
  const hasBush = g => [...g.querySelectorAll('path')].some(p => { const b = p.getBBox(); return b.width > 60 && b.height > 60 && MOUND.includes(getComputedStyle(p).fill); })
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
    // 草團上長著沒包進同一群組的花或葉（莖的根落在草團形狀裡）：草團單獨沉下去會跟花錯開，就讓它跟灌木一起動
    const bare = g => { const mounds = [...g.querySelectorAll('path')].filter(p => getComputedStyle(p).fill === BUSH);
      return plants.some(p => svg.contains(p.el) && !g.contains(p.el) && mounds.some(m => m.isPointInFill(new DOMPoint(p.px, p.py)))); };
    const outer = all.filter(g => !all.some(o => o !== g && o.contains(g)) && !bare(g));
    outer.forEach(el => {
      const b = el.getBBox();
      addCluster(svg, el, MOVES.find(m => m.file === file && Math.abs(b.x - m.at[0]) < 20 && Math.abs(b.y - m.at[1]) < 20));
    });
    // 另一叢的花疊在這塊草團上（小黃花和它旁邊的小草團）：草團跟那一叢用一樣的速度，捲動時才不會慢慢錯開
    const mine = clusters.filter(c => c.svg === svg);
    for(const c of mine){
      const mounds = [...c.g.querySelectorAll('path')].filter(p => getComputedStyle(p).fill === BUSH);
      const on = s => { const b = s.getBBox(), pt = new DOMPoint(b.x + b.width / 2, b.y + b.height); return mounds.some(m => m.isPointInFill(pt)); };
      const d = mine.find(d => d !== c && plants.some(p => d.g.contains(p.el) && [...p.el.querySelectorAll('path,ellipse,circle,polygon,rect')].some(on)));
      if(d) c.k = d.k;
    }
  }
  const wraps = new WeakSet();  // addCluster 外包的那層 <g>
  // m：手機上要挪多少（{dx, dy, media}），沒有就不挪
  function addCluster(svg, el, m){
    const b = el.getBBox();
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.before(g); g.append(el); wraps.add(g);
    // 越下面的樹叢越慢：依群組底部在畫布上的高度（1220～1370）給 0～.08，最上面的幾乎跟灌木一起動
    const depth = Math.min(1, Math.max(0, (b.y + b.height - 1220) / 150));
    const c = { g, svg, m, mq: m && matchMedia(m.media || 'all'), k: .08 * depth };
    clusters.push(c);
    return c;
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

  /* ---- 看命名：在 Illustrator 圖層面板替群組取名，匯出後會變成 id（或 data-name），程式只看名字開頭、不分大小寫，
     重複名字 Illustrator 自動加的編號（flower-2）不影響：
       flower  一整株（花頭＋莖＋長在莖上的葉），整株一起搖，軸心在群組底部中間；株裡有 stem 時軸心改在 stem 的底部中間
       stem    莖：包在 flower 裡，或跟花頭分開命名都可以（分開時自動接到正上方那朵 flower，一起搖）
       leaf    單獨搖的葉子，軸心在底部中間
       bush    草團。在 Illustrator 跟花、葉包成一組時，整組有一點捲動視差（越下面的升得越慢）；沒包成組的 bush 自己一塊做視差
     沒取名的不動。圖裡只要有一個 flower／leaf／bush，這張圖就完全照命名，不再用下面的自動判斷、也不套 MOVES（只套 SWAPS、LIFTS） ---- */
  const nameOf = e => (e.getAttribute('data-name') || e.id || '').replace(/^sw\d+-/, '').toLowerCase();
  const kindOf = e => (nameOf(e).match(/^(flower|leaf|stem|bush)/) || [])[1];
  function collectNamed(svg, named, file){
    const heads = [];             // 每朵花：花頭的範圍和整株的元素，給 SWAPS 用
    // 單獨命名的 stem（沒包在 flower 裡）：接到正上方那朵花——莖從花的底部往下長、左右跟花有重疊，有好幾朵就挑最近的
    const loose = named.filter(s => kindOf(s) === 'stem' && !named.some(f => kindOf(f) === 'flower' && f.contains(s)));
    const stemOf = f => { const fb = f.getBBox(), fy = fb.y + fb.height;
      return loose.filter(s => { const b = s.getBBox(); return b.y < fy + 10 && b.y + b.height > fy && b.x < fb.x + fb.width && b.x + b.width > fb.x; })
        .sort((a, b) => Math.abs(a.getBBox().y - fy) - Math.abs(b.getBBox().y - fy))[0]; };
    for(const e of named){
      const k = kindOf(e);
      if(k !== 'flower' && k !== 'leaf') continue;
      let el = e, stem = k === 'flower' && [...e.querySelectorAll('[id],[data-name]')].find(s => kindOf(s) === 'stem');
      const own = k === 'flower' && !stem && stemOf(e);
      if(own){
        // 花頭和莖包成一組，照原圖的前後順序（莖通常在花後面）
        loose.splice(loose.indexOf(own), 1);
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const [a, b] = ord.get(own) < ord.get(e) ? [own, e] : [e, own];
        a.before(el); el.append(a, b); stem = own;
      } else if(e.hasAttribute('transform')){
        // 元素自己帶 Illustrator 的 transform 時，CSS 旋轉會蓋掉它，所以外面另包一層來轉
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g'); e.before(el); el.append(e);
      }
      const b = (stem || el).getBBox();
      add(el, el, b.x + b.width / 2, b.y + b.height, k === 'flower' ? 1 : .45);
      if(k === 'flower') heads.push({ b: e.getBBox(), e, el });
    }
    // 捲動視差：一組＝包著 bush 的群組（在所有 bush 共同的最外層群組底下，各自那一個子群組）；bush 沒包成組就是它自己
    const bushes = named.filter(e => kindOf(e) === 'bush');
    if(bushes.length){
      let root = bushes[0].parentNode;
      while(!bushes.every(b => root.contains(b))) root = root.parentNode;
      new Set(bushes.map(b => { let u = b; while(u.parentNode !== root) u = u.parentNode; return u; })).forEach(u => addCluster(svg, u));
    }
    // 互換位置：花所在、包著 bush 的那個群組（花＋莖、葉、草團）整組挪，外面另包一層來挪（裡面的花照樣搖、外層的捲動視差照舊）
    const at = p => heads.find(h => Math.abs(h.b.x - p[0]) < 20 && Math.abs(h.b.y - p[1]) < 20);
    const group = e => { for(let a = e.parentNode; a !== svg; a = a.parentNode) if([...a.querySelectorAll('[id],[data-name]')].some(s => kindOf(s) === 'bush')) return a; };
    for(const s of SWAPS){
      const a = s.file === file && at(s.a), b = s.file === file && at(s.b);
      const ga = a && group(a.e), gb = b && group(b.e);
      if(!ga || !gb || ga.contains(gb) || gb.contains(ga)) continue;
      const dx = (b.b.x + b.b.width / 2) - (a.b.x + a.b.width / 2);
      addCluster(svg, ga, { dx, media: s.media }).k = 0;
      addCluster(svg, gb, { dx: -dx, media: s.media }).k = 0;
    }
    for(const s of LIFTS){
      const h = s.file === file && at(s.at);
      if(!h) continue;
      let el = group(h.e) || h.el;
      // dx/dy：抬上來的同時整組挪一點（外面另包一層來挪，不做捲動視差）
      if(s.dx || s.dy){ const c = addCluster(svg, el, { dx: s.dx || 0, dy: s.dy || 0, media: s.media }); c.k = 0; el = c.g; }
      lift(svg, el, s.media);
    }
  }

  // 抬到前層前面：在最前面那層灌木之後，加一層跟這張圖所在圖層一模一樣的空圖層（同樣的位置、左右偏移、捲動視差、滑鼠視差），
  // 符合 media 時把整株搬進去，不符合時搬回原位
  function lift(svg, el, media){
    const layer = svg.closest('.layer');
    if(!layer) return;
    if(!layer.lift){
      const front = [...document.querySelectorAll('#top .layer.near')].pop();
      const lay = layer.cloneNode(false), top = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lay.setAttribute('aria-hidden', 'true');
      top.setAttribute('viewBox', svg.getAttribute('viewBox'));
      top.setAttribute('class', svg.getAttribute('class'));
      lay.append(top); front.after(lay);
      // js/hero.js 一直在改原圖層的 style（開場、捲動的位移，--f、--m），照抄過來
      const copy = () => { lay.style.cssText = layer.style.cssText; };
      copy(); new MutationObserver(copy).observe(layer, { attributes: true, attributeFilter: ['style'] });
      layer.lift = top;
    }
    while(wraps.has(el.parentNode)) el = el.parentNode;   // 連同外面挪位置、做視差的那幾層一起搬
    const home = document.createComment('lift'), mq = matchMedia(media);
    el.before(home);
    const place = () => mq.matches ? layer.lift.append(el) : home.after(el);
    place(); mq.addEventListener('change', place);
  }

  function collect(svg, file){
    // 記下原圖裡每個元素的前後順序：之後把零件併進同一株時照這個順序插，前後疊放才跟原圖一樣
    [...svg.querySelectorAll('*')].forEach((e, i) => ord.set(e, i));
    const named = [...svg.querySelectorAll('[id],[data-name]')].filter(kindOf);
    if(named.some(e => kindOf(e) !== 'stem')) return collectNamed(svg, named, file);
    // 沒命名：自動判斷。找「最外層的小群組」：自己夠小、但父群組不夠小；畫布外 Illustrator 留下的素材、含草叢的整叢都不算
    const vb = svg.viewBox.baseVal;
    const small = g => { const b = g.getBBox(); return b.width > 0 && b.width < BIG && b.height < BIG &&
      b.x >= vb.x && b.y >= vb.y && b.x + b.width <= vb.x + vb.width && b.y + b.height <= vb.y + vb.height && !hasBush(g); };
    const groups =[...svg.querySelectorAll('g')].filter(g => small(g) && !(g.parentNode.tagName === 'g' && small(g.parentNode)));
    const flowers = [], stems = [], leaves = [];
    for(const g of groups){
      const b = g.getBBox();
      if(fills(g).some(isPetal)) flowers.push(g);
      else if(b.width < b.height / 2) stems.push(g);
      else leaves.push(g);
    }
    for(const f of flowers){
      const fb = f.getBBox(), cx = fb.x + fb.width / 2;
      // 莖：從花的底部往下長、左右跟花有重疊（往旁邊彎的莖也算）→ 包成同一組一起擺；有好幾個符合就挑最靠花中間的。
      // 莖上帶葉子時群組比較寬、會被歸成葉子，所以葉子也找
      const below = s => { const b = s.getBBox(); return s.parentNode === f.parentNode && b.y < fb.y + fb.height && b.y + b.height > fb.y + fb.height && b.x < fb.x + fb.width && b.x + b.width > fb.x; };
      const near = list => list.filter(below).sort((a, b) => { const d = s => { const r = s.getBBox(); return Math.abs(r.x + r.width / 2 - cx); }; return d(a) - d(b); })[0];
      const stem = near(stems) || near(leaves);
      if(leaves.includes(stem)) leaves.splice(leaves.indexOf(stem), 1);
      // 群組本身就瘦長（莖已經畫在花的群組裡）：軸心在底部；只有花頭：假想花莖往下延伸，讓花頭畫弧
      let el = f, px = cx, py = fb.height > fb.width * 1.3 ? fb.y + fb.height : fb.y + fb.height * 1.6;
      if(stem){
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const [a, b] = ord.get(stem) < ord.get(f) ? [stem, f] : [f, stem];
        a.before(el); el.append(a, b); ord.set(el, ord.get(a));
        // 軸心在莖的底端（彎莖的底端不在花正下方）
        const sb = stem.getBBox(); px = sb.x + sb.width / 2; py = sb.y + sb.height;
      }
      add(el, f, px, py, 1);
    }
    // 小草團用的是灌木本體的綠（#1F6F57），不是葉子，不搖
    for(const l of leaves){ if(fills(l).includes('rgb(31, 111, 87)')) continue; const b = l.getBBox(); add(l, l, b.x + b.width / 2, b.y + b.height, .45); }
    attach(svg);
    clusterize(svg, file);
  }

  // 長在花莖上的葉子（葉子碰到某朵花的莖）：放進那一株裡，莖擺它也跟著擺、自己再輕晃，不會跟莖脫開；
  // 同一群組裡沒被歸到任何一株的小零件（花托的小圓點之類）也放進範圍蓋住它的那一株
  function attach(svg){
    const mine = plants.filter(p => svg.contains(p.el));
    // 先量好原本的範圍和莖的位置：併進葉子後範圍會變大，不能再拿來判斷
    mine.forEach(p => { p.box = p.el.getBBox();
      p.stem = [...p.el.querySelectorAll('path,ellipse,circle,polygon,rect')].filter(s => !isPetal(getComputedStyle(s).fill)).map(s => s.getBBox()); });
    const box = p => p.box;
    const inBox = (b, x, y) => x > b.x - 3 && x < b.x + b.width + 3 && y > b.y - 3 && y < b.y + b.height + 3;
    const touch = (a, b) => a.x < b.x + b.width + 3 && a.x + a.width > b.x - 3 && a.y < b.y + b.height + 3 && a.y + a.height > b.y - 3;
    const put = (el, host) => host.insertBefore(el, [...host.children].find(c => ord.get(c) > ord.get(el)) || null);
    for(const l of mine){
      if(l.s === 1) continue;
      // 只併進花：碰到另一片葉子不算（不然會一路串到旁邊的花上）；只落在花的範圍裡、沒碰到莖也不算
      const host = mine.find(p => p.s === 1 && p.stem.some(b => touch(b, box(l))));
      if(host) put(l.el, host.el);
    }
    for(const p of mine){
      for(const s of [...p.el.parentNode.children]){
        if(s === p.el || s.tagName === 'g' || mine.some(q => q.el.contains(s)) || getComputedStyle(s).fill === BUSH) continue;
        const b = s.getBBox(), pb = box(p);
        if(inBox(pb, b.x, b.y) && inBox(pb, b.x + b.width, b.y + b.height)) put(s, p.el);
      }
    }
  }

  function add(el, head, px, py, s){
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = `${px.toFixed(1)}px ${py.toFixed(1)}px`;
    plants.push({ el, head, s, px, py,
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
