/* 日期地點的樹叢外框：把 <img data-bushframe> 換成內嵌 SVG，讓外框上的每朵花各自動。
   平常每朵花和葉子輕輕左右晃（各自錯開節奏）；點一下或電腦版游標移過去，都會從莖的底端左右晃幾下。
   換成內嵌要用 fetch，所以直接雙擊 index.html（file://）時讀不到，會保留原本的 <img>，只是花不會動 */
(function(){
  "use strict";
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.fetch) return;
  const img = document.querySelector('img[data-bushframe]');
  if(!img || !Element.prototype.animate) return;
  const card = img.closest('.bushcard') || img.parentNode;

  const BIG = 130;              // SVG 單位：比這小、又帶花瓣顏色的群組才算一朵花（有一朵花和莖包在一起，高約 124）
  // 花瓣是粉紅、紅、橘、黃、米白（紅色比綠色多）；樹叢、葉子都是綠色系
  const isPetal = c => { const m = c.match(/\d+/g); return !!m && +m[0] > 150 && +m[0] >= +m[1]; };
  const shapes = g => [...g.querySelectorAll('path,ellipse,circle,polygon,rect')];
  const NS = 'http://www.w3.org/2000/svg';
  const flowers = [];           // 每朵花是兩層外包的 <g>：外層 idle 一直輕晃，內層 tap 給點擊／游標的動畫

  // origin：繞哪裡動。花不管是平常晃、點擊或游標，都繞底端（莖的根部）；葉子繞中心
  function wrap(el, cls, origin){
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', cls);
    el.before(g); g.append(el);
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = origin || '50% 50%';
    return g;
  }

  function collect(svg){
    const vb = svg.viewBox.baseVal;
    // 一朵花 = 「最外層的小群組」：自己夠小、但父群組不夠小；畫布外 Illustrator 留下的素材不算
    const small = g => { const b = g.getBBox(); return b.width > 0 && b.width < BIG && b.height < BIG &&
      b.x >= vb.x && b.y >= vb.y && b.x + b.width <= vb.x + vb.width && b.y + b.height <= vb.y + vb.height; };
    const cand = [...svg.querySelectorAll('g')].filter(g => small(g) && shapes(g).some(s => isPetal(getComputedStyle(s).fill)));
    cand.forEach((g, i) => {
      if(cand.some(o => o !== g && o.contains(g))) return;
      // 群組上可能有 Illustrator 寫的 transform，CSS 動畫會蓋掉它，所以都在外面另包一層來動
      const tap = wrap(g, 'bf-tap', '50% 100%');
      const idle = wrap(tap, 'bf-idle', '50% 100%');
      // 每朵花晃的速度和起點都不一樣，看起來才像被風吹，不會整排一起擺
      idle.style.animationDuration = (3.2 + Math.random() * 2.4).toFixed(2) + 's';
      idle.style.animationDelay = (-Math.random() * 5).toFixed(2) + 's';
      flowers.push(tap);
    });

    // 葉子 = 最外層的小群組、全是綠色、不是樹叢本體的綠（#1F6F57 是一團團的樹叢）。平常跟花一樣輕輕晃，只是幅度小一點
    const BUSH = 'rgb(31, 111, 87)';
    const leaves = [...svg.querySelectorAll('g')].filter(g => !g.closest('.bf-idle') && small(g) &&
      shapes(g).every(s => { const f = getComputedStyle(s).fill; return !isPetal(f) && f !== BUSH; }));
    leaves.forEach(g => {
      if(leaves.some(o => o !== g && o.contains(g))) return;
      const leaf = wrap(g, 'bf-leaf');
      leaf.style.animationDuration = (2.6 + Math.random() * 2).toFixed(2) + 's';
      leaf.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
    });
  }

  // 點的位置落在哪朵花上（四周多算 14px，手指點不準也算）；好幾朵都算到就挑最近的
  function flowerAt(x, y){
    let best = null, bd = Infinity;
    for(const f of flowers){
      const q = f.getBoundingClientRect();
      if(x < q.left - 14 || x > q.right + 14 || y < q.top - 14 || y > q.bottom + 14) continue;
      const d = Math.hypot(q.left + q.width / 2 - x, q.top + q.height / 2 - y);
      if(d < bd){ bd = d; best = f; }
    }
    return best;
  }

  // 點一下或游標移上去：繞莖的底端左右晃幾下，越晃越小
  function pop(f){
    f.getAnimations().forEach(a => a.cancel());
    f.animate([
      { transform:'rotate(0deg)' }, { transform:'rotate(-16deg)', offset:.18 }, { transform:'rotate(12deg)', offset:.4 },
      { transform:'rotate(-7deg)', offset:.62 }, { transform:'rotate(3deg)', offset:.82 }, { transform:'rotate(0deg)' },
    ], { duration:1000, easing:'ease-out' });
  }

  fetch(img.getAttribute('src')).then(r => { if(!r.ok) throw r.status; return r.text(); }).then(t => {
    // Illustrator 輸出的 class（st0…）和 id 會跟其他內嵌圖撞名，加前綴；metadata 拿掉
    const p = 'bf-';
    t = t.replace(/<metadata[\s\S]*?<\/metadata>/, '')
         .replace(/\bst(\d+)\b/g, p + 'st$1').replace(/id="/g, 'id="' + p).replace(/url\(#/g, 'url(#' + p);
    const svg = document.importNode(new DOMParser().parseFromString(t, 'image/svg+xml').documentElement, true);
    svg.setAttribute('class', img.className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', img.getAttribute('width'));
    svg.setAttribute('height', img.getAttribute('height'));
    img.replaceWith(svg);
    collect(svg);
    // 用 click（不是 pointerdown）：手指在樹叢上開始捲動頁面時不會誤觸
    card.addEventListener('click', e => { const f = flowerAt(e.clientX, e.clientY); if(f) pop(f); });
    // 電腦版：游標剛移到花上時晃一次（跟點擊一樣），停在花上不會一直晃
    let over = null;
    card.addEventListener('pointermove', e => {
      if(e.pointerType !== 'mouse') return;
      const f = flowerAt(e.clientX, e.clientY);
      if(f && f !== over) pop(f);
      over = f;
    }, {passive:true});
  }).catch(() => {});
})();
