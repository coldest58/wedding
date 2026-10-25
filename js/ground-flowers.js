/* 首屏草地上的小花：點一下（手指點不準也算）或電腦版游標移過去，那朵花就微微左右擺幾下。
   要動到 SVG 裡的單朵花，所以把 <img data-spin> 換成內嵌 SVG（同 flowers.js，直接雙擊 index.html／file:// 時讀不到，保留原本的圖、花不會轉） */
(function(){
  "use strict";
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.fetch) return;
  const img = document.querySelector('img[data-spin]');
  if(!img || !Element.prototype.animate) return;

  const BIG = 120;              // SVG 單位：比這小、又帶花瓣顏色的群組才算一朵花
  // 花瓣是粉紅、紅、橘、黃（紅色比綠色多）；草地、草叢都是綠色系，描邊是深色
  const isPetal = c => { const m = c.match(/\d+/g); return !!m && +m[0] > 150 && +m[0] >= +m[1]; };
  const shapes = g => [...g.querySelectorAll('path,ellipse,circle,polygon,rect')];
  const flowers = [];

  function collect(svg){
    const vb = svg.viewBox.baseVal;
    // 一朵花 = 「最外層的小群組」：自己夠小、但父群組不夠小；畫布外 Illustrator 留下的素材不算
    const small = g => { const b = g.getBBox(); return b.width > 0 && b.width < BIG && b.height < BIG &&
      b.x >= vb.x && b.y >= vb.y && b.x + b.width <= vb.x + vb.width && b.y + b.height <= vb.y + vb.height; };
    const cand = [...svg.querySelectorAll('g')].filter(g => small(g) && shapes(g).some(s => isPetal(getComputedStyle(s).fill)));
    for(const g of cand){
      if(cand.some(o => o !== g && o.contains(g))) continue;
      // 群組上若有 Illustrator 寫的 transform，CSS 擺動會蓋掉它，所以外面再包一層來擺
      let el = g;
      if(g.hasAttribute('transform')){ el = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.before(el); el.append(g); }
      el.style.transformBox = 'fill-box';
      el.style.transformOrigin = '50% 100%';
      flowers.push(el);
    }
  }

  // 點的位置落在哪朵花上（四周多算 14px）；好幾朵都算到就挑最近的
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

  function sway(f){
    if(f.getAnimations().length) return;   // 還在擺就不重來
    // 繞花的底部左右微微擺幾下，越擺越小
    f.animate([
      { transform:'rotate(0deg)' }, { transform:'rotate(-8deg)', offset:.18 }, { transform:'rotate(6deg)', offset:.42 },
      { transform:'rotate(-3deg)', offset:.66 }, { transform:'rotate(1deg)', offset:.85 }, { transform:'rotate(0deg)' },
    ], { duration:1100, easing:'ease-out' });
  }

  fetch(img.getAttribute('src')).then(r => { if(!r.ok) throw r.status; return r.text(); }).then(t => {
    // Illustrator 輸出的 class（st0…）和 id 會跟其他內嵌圖撞名，加前綴；metadata 拿掉
    const p = 'gd-';
    t = t.replace(/<metadata[\s\S]*?<\/metadata>/, '')
         .replace(/\bst(\d+)\b/g, p + 'st$1').replace(/id="/g, 'id="' + p).replace(/url\(#/g, 'url(#' + p);
    const svg = document.importNode(new DOMParser().parseFromString(t, 'image/svg+xml').documentElement, true);
    svg.setAttribute('class', img.className);
    svg.setAttribute('aria-hidden', 'true');
    img.replaceWith(svg);
    collect(svg);
    // 用 click（不是 pointerdown）：手指在草地上開始捲動頁面時不會誤觸。首屏各層都不接滑鼠，所以掛在整個視窗上自己判斷位置
    addEventListener('click', e => { const f = flowerAt(e.clientX, e.clientY); if(f) sway(f); });
    // 電腦版：游標移到花上也會擺（只在剛移進去時擺一次，停在花上不會一直擺）
    let over = null;
    addEventListener('pointermove', e => {
      if(e.pointerType !== 'mouse') return;
      const f = flowerAt(e.clientX, e.clientY);
      if(f && f !== over) sway(f);
      over = f;
    }, {passive:true});
  }).catch(() => {});
})();
