/* ---------- 高雄小抄 tabs ----------
   兩組切換都用這段：上面的「家庭版／個人版」，和家庭版第 1 日的「路線 A／B」。
   每組 [role="tablist"] 各自切換；切完發出 guide:tab 事件（detail＝顯示的 panel id），地圖跟著換點 */
(function(){
  document.querySelectorAll('#guide [role="tablist"]').forEach(list=>{
    const tabs=[...list.querySelectorAll('[role="tab"]')];
    function sel(t){
      tabs.forEach(x=>{const on=x===t; x.setAttribute('aria-selected',on); x.tabIndex=on?0:-1; document.getElementById(x.getAttribute('aria-controls')).hidden=!on;});
      document.dispatchEvent(new CustomEvent('guide:tab',{detail:t.getAttribute('aria-controls')}));
    }
    tabs.forEach((t,i)=>{
      t.addEventListener('click',()=>sel(t));
      t.addEventListener('keydown',e=>{ if(e.key==='ArrowRight'||e.key==='ArrowLeft'){ const n=tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length]; sel(n); n.focus(); e.preventDefault(); } });
    });
  });
})();
