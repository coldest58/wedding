/* 首屏的貓新娘與狗新郎：點新娘（電腦版游標移上去也算）→ 整隻晃一下、蝴蝶結甩一下；點新郎 → 整隻晃一下、戒指亮一下。
   要動到 SVG 裡面的部位，所以把 <img> 換成內嵌 SVG（同 flowers.js，直接雙擊 index.html／file:// 時讀不到，保留原本的圖、不能點）。
   晃動用 composite:'add' 疊在 SVG 原本的搖擺動畫上，不會把原本的動作停掉 */
(function(){
  "use strict";
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.fetch) return;
  const img = document.querySelector('img.couple-img');
  if(!img || !Element.prototype.animate) return;

  // 繞腳底輕輕晃：先往一邊倒、彈回來再小晃一下；稍微跳起一點
  const WIGGLE = [
    { transform:'rotate(0deg) translateY(0)' },
    { transform:'rotate(-2.2deg) translateY(-3px)', offset:.2 },
    { transform:'rotate(1.6deg) translateY(0)', offset:.45 },
    { transform:'rotate(-.7deg)', offset:.7 },
    { transform:'rotate(0deg) translateY(0)' },
  ];
  const wiggle = els => els.forEach(el => el.animate(WIGGLE, { duration:750, easing:'ease-out', composite:'add' }));

  function bride(svg){
    wiggle(svg.querySelectorAll('.swc'));
    const bow = svg.querySelector('.bow');
    // 蝴蝶結繞著結甩：比身體慢一拍、幅度大一點
    if(bow) bow.animate([
      { transform:'rotate(0deg)' }, { transform:'rotate(14deg)', offset:.25 }, { transform:'rotate(-10deg)', offset:.5 },
      { transform:'rotate(5deg)', offset:.75 }, { transform:'rotate(0deg)' },
    ], { duration:900, delay:80, easing:'ease-out' });
    // 兩條帶子再多甩一點（疊在原本的擺動上）
    svg.querySelectorAll('.rib').forEach((r, i) => r.animate([
      { transform:'rotate(0deg)' }, { transform:`rotate(${i ? 12 : 16}deg)`, offset:.3 }, { transform:`rotate(${i ? -8 : -10}deg)`, offset:.6 }, { transform:'rotate(0deg)' },
    ], { duration:1000, delay:140, easing:'ease-out', composite:'add' }));
  }

  function groom(svg){
    wiggle(svg.querySelectorAll('.swd'));
    // 鑽石後面的光暈由小放大、亮一下再淡掉；旁邊冒出一顆星星轉半圈
    const halo = svg.querySelector('.rg-halo'), star = svg.querySelector('.rg-star');
    const t = { duration:1100, delay:120, easing:'ease-out' };
    if(halo) halo.animate([{ opacity:0, transform:'scale(.3)' }, { opacity:1, transform:'scale(1.15)', offset:.35 }, { opacity:1, offset:.6 }, { opacity:0, transform:'scale(1)' }], t);
    if(star) star.animate([{ opacity:0, transform:'scale(0) rotate(0deg)' }, { opacity:1, transform:'scale(1.1) rotate(60deg)', offset:.35 }, { opacity:1, offset:.6 }, { opacity:0, transform:'scale(.6) rotate(90deg)' }], t);
  }

  fetch(img.getAttribute('src')).then(r => { if(!r.ok) throw r.status; return r.text(); }).then(t => {
    const svg = document.importNode(new DOMParser().parseFromString(t, 'image/svg+xml').documentElement, true);
    svg.setAttribute('class', img.className + ' couple-art');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', img.alt);
    img.replaceWith(svg);
    // 正在晃的那隻不重來，免得游標移上去馬上又點一下時兩次疊在一起晃太大
    const who = el => el.closest('.swc') ? 'bride' : el.closest('.swd') ? 'groom' : null;
    const busy = {};
    function play(w){
      if(!w || busy[w]) return;
      busy[w] = true;
      (w === 'bride' ? bride : groom)(svg);
      setTimeout(() => { busy[w] = false; }, 1000);
    }
    // 用 click（不是 pointerdown）：手指從新人身上開始捲動頁面時不會誤觸
    svg.addEventListener('click', e => play(who(e.target)));
    // 電腦版：游標移到新娘／新郎身上就晃一下（只在剛移上去時，停在身上或在同一隻身上移動不會一直晃）
    let over = null;
    svg.addEventListener('pointerover', e => {
      if(e.pointerType !== 'mouse') return;
      const w = who(e.target);
      if(w !== over) play(w);
      over = w;
    });
    svg.addEventListener('pointerout', e => { if(!e.relatedTarget || !svg.contains(e.relatedTarget) || who(e.relatedTarget) !== over) over = null; });
  }).catch(() => {});
})();
