/* ---------- 瀏覽器上方色塊（iPhone 狀態列／網址列）跟著目前區塊換色 ----------
   舊版 iOS Safari 與 Android Chrome 看 <meta name="theme-color">；新版 iOS Safari 看頁面（html/body）底色，所以兩個一起換 */
(function(){
  const meta = document.querySelector('meta[name="theme-color"]');
  const zones = [
    ['#top', '#EC92AB'],            // 首屏：粉紅天空
    ['.meadow', '#1F6F57'],         // 草原：深綠
    ['.soil-edge', '#744A2F'],      // 草地與泥土的交界：棕
    ['.soil', '#744A2F'],           // 高雄小抄的泥土層：棕
    ['.underside', '#EC92AB'],      // 泥土與頁尾的交界：粉紅
    ['footer', '#EC92AB']           // 頁尾：粉紅
  ].map(([sel,c])=>[document.querySelector(sel), c]).filter(z=>z[0]);
  let cur = '', ticking = false;
  function pick(){
    ticking = false;
    const probe = 2;                                  // 以視窗最上緣為準
    for(const [el,c] of zones){
      const r = el.getBoundingClientRect();
      if(r.top <= probe && r.bottom > probe){
        if(c !== cur){
          cur = c;
          if(meta) meta.setAttribute('content', c);
          document.documentElement.style.backgroundColor = c;
          document.body.style.backgroundColor = c;
        }
        return;
      }
    }
  }
  addEventListener('scroll', ()=>{ if(!ticking){ ticking = true; requestAnimationFrame(pick); } }, {passive:true});
  addEventListener('resize', pick);
  pick();
})();
