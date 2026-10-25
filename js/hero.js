/* 首屏動態：開場由下往上就位、捲動視差、滑鼠跟隨、離開首屏時暫停動畫 */
(function(){
  "use strict";
  /* ---- 0. 重整時回到頁首（瀏覽器預設會還原到重整前的位置）；網址帶 #錨點 時照錨點走 ---- */
  if('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if(!location.hash) scrollTo({ top:0, behavior:'instant' });
  // manual 之後重新整理不會自動跳錨點，等 load（版面大致就緒）再自己捲過去
  else addEventListener('load', ()=>{
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if(target) target.scrollIntoView({ block:'start', behavior:'instant' });
  }, { once:true });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.getElementById('top');
  if(!hero) return;

  /* ---- 1. 開場＋捲動視差：每層依 data-f 的比例跟著捲動 ---- */
  const layers = [...hero.querySelectorAll('.layer')].map((el,i)=>({el, f:parseFloat(el.dataset.f), i}));
  const cue = document.getElementById('cue');
  const ease = t => 1 - Math.pow(1-t, 3);
  const t0 = performance.now();
  // iPhone 等觸控裝置：捲動在另一條執行緒上跑，JS 每格追 scrollY 會慢半拍，各層就會先跟著頁面跑、再被拉回來（抖）。
  // 瀏覽器支援 scroll-driven animation 時，捲動視差交給 css/hero.css 的 heroParallax（依 --f），JS 只做開場
  const cssPar = !reduce && matchMedia('(hover:none)').matches && window.CSS && CSS.supports('animation-timeline: scroll()');
  if(cssPar) layers.forEach(({el,f})=>el.style.setProperty('--f', f));
  const fadeCue = () => { cue.style.opacity = Math.max(0, 1 - scrollY/150); };
  function frame(now){
    const y = scrollY;
    let done = true;
    if(cssPar || y < hero.offsetHeight + 200) for(const {el,f,i} of layers){
      // 開場：每層由下往上就位
      const it = reduce ? 1 : Math.min(1, Math.max(0, (now - t0 - i*110) / 1000));
      if(it < 1) done = false;
      const intro = (1 - ease(it)) * 160 * (1 - f*.5);
      el.style.transform = `translate3d(0,${((cssPar || reduce ? 0 : y*f) + intro).toFixed(1)}px,0)`;
      if(!el.matches('.ground,.near')) el.style.opacity = Math.min(1, it*1.5);
    }
    fadeCue();
    // 交給 CSS 視差時，開場跑完就不用每格更新了；提示箭頭改成捲動時才更新
    if(cssPar && done){ addEventListener('scroll', fadeCue, {passive:true}); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- 2. 首屏不在視窗內時暫停動畫（省電） ---- */
  if('IntersectionObserver' in window){
    new IntersectionObserver(([e])=>{
      document.documentElement.classList.toggle('hero-off', !e.isIntersecting);
    }, {rootMargin:'120px 0px 120px 0px'}).observe(hero);
  }

  /* ---- 3. 滑鼠跟隨視差（僅桌機；觸控與 reduced-motion 不啟用） ---- */
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches || reduce) return;
  [...hero.querySelectorAll('.layer[data-m]')].forEach(el=>el.style.setProperty('--m', el.dataset.m));
  const AMP = 12;               // 游標在視窗邊緣時，data-m=1 的那層位移的像素
  let tx=0, ty=0, cx=0, cy=0, raf=0;
  function tick(){
    cx += (tx-cx)*.08; cy += (ty-cy)*.08;
    hero.style.setProperty('--mx', cx.toFixed(2));
    hero.style.setProperty('--my', cy.toFixed(2));
    raf = (Math.abs(tx-cx)>.01 || Math.abs(ty-cy)>.01) ? requestAnimationFrame(tick) : 0;
  }
  addEventListener('pointermove', e=>{
    if(e.pointerType!=='mouse' || scrollY > hero.offsetHeight) return;
    tx = (e.clientX/innerWidth - .5) * 2 * -AMP;
    ty = (e.clientY/innerHeight - .5) * 2 * -AMP;
    if(!raf) raf = requestAnimationFrame(tick);
  }, {passive:true});
  document.addEventListener('mouseleave', ()=>{ tx=ty=0; if(!raf) raf=requestAnimationFrame(tick); });
})();
