/* 首屏遠山（assets/h-far.svg）：把 <img> 換成內嵌 SVG，手機版才能用 css/hero.css 單獨調整 wedding 字樣和兩側大雲的大小、位置。
   同一張圖拆成兩份：雲和 wedding 字樣放到山後面的「天空雲」那層（index.html 的 #far-clouds，視差比例跟山不同），
   原本這份只留山；所以雲永遠被山擋住，捲動時雲比山慢，看起來比較遠。
   SVG 裡的 class（Illustrator 的 st0… 和 tools/animate-h-far.py 加的 lt、cl…）會跟其他內嵌 SVG 撞名，所以一律加上 hf- 前綴。
   直接雙擊 index.html／file:// 時讀不到檔，保留原本的 <img>（山和雲在同一層，手機版不會放大字樣） */
(function(){
  "use strict";
  const img = document.querySelector('img.sc-far');
  const cloudFrame = document.getElementById('far-clouds');
  if(!img || !window.fetch) return;
  const pre = c => c.split(/\s+/).filter(Boolean).map(x => 'hf-' + x).join(' ');

  // 雲：有 cl（大雲）或 word（字樣）class 的頂層元素，或裡面含大雲的頂層群組；其餘（defs 以外）都算山
  const isCloud = el => el.matches('.hf-cl, .hf-word') || !!el.querySelector('.hf-cl');

  // --upx：螢幕上 1px 等於畫布幾個單位（畫布 1920 寬），讓 CSS 能用螢幕寬高的百分比（vw、svh）移動圖裡的東西
  function watchSize(svg){
    const setUpx = () => { const w = svg.getBoundingClientRect().width; if(w) svg.style.setProperty('--upx', 1920 / w); };
    setUpx();
    if(window.ResizeObserver) new ResizeObserver(setUpx).observe(svg);
  }

  fetch(img.getAttribute('src')).then(r => { if(!r.ok) throw r.status; return r.text(); }).then(t => {
    const svg = document.importNode(new DOMParser().parseFromString(t, 'image/svg+xml').documentElement, true);
    if(svg.nodeName !== 'svg') return;
    svg.removeAttribute('id');
    svg.querySelectorAll('[class]').forEach(el => el.setAttribute('class', pre(el.getAttribute('class'))));
    svg.querySelectorAll('style').forEach(st => { st.textContent = st.textContent.replace(/\.(-?[a-zA-Z_][\w-]*)/g, '.hf-$1'); });
    svg.setAttribute('class', img.className);
    svg.setAttribute('aria-hidden', 'true');

    const svgs = [svg];
    if(cloudFrame){
      const clouds = svg.cloneNode(true);
      // 雲那份拿掉山，山這份拿掉雲（<style> 在 defs 裡，兩份都留著）
      [...clouds.children].forEach(el => { if(el.tagName !== 'defs' && !isCloud(el)) el.remove(); });
      [...svg.children].forEach(el => { if(el.tagName !== 'defs' && isCloud(el)) el.remove(); });
      cloudFrame.append(clouds);
      svgs.push(clouds);
    }
    img.replaceWith(svg);
    svgs.forEach(watchSize);

    // 捲動時暫停圖裡的飄動：內嵌 SVG 的動畫每格都要重畫整張圖，手機上跟捲動視差搶時間會抖；停止捲動 200ms 後再繼續
    let idle = 0;
    addEventListener('scroll', () => {
      if(!idle) svgs.forEach(s => s.classList.add('hf-scrolling'));
      clearTimeout(idle);
      idle = setTimeout(() => { svgs.forEach(s => s.classList.remove('hf-scrolling')); idle = 0; }, 200);
    }, {passive:true});
  }).catch(() => {});
})();
