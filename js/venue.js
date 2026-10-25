/* 把 CONFIG 裡的場地、地圖、回覆期限填進頁面；日曆連結也在這裡組 */
(function(){
  const $ = s => document.querySelector(s);
  const isPH = v => !v || /^\[.*\]$/.test(v);
  if(!isPH(CONFIG.venueName)) $('#venueName').textContent = CONFIG.venueName;
  if(!isPH(CONFIG.venueAddr)) $('#venueAddr').textContent = CONFIG.venueAddr;
  if(!isPH(CONFIG.deadline))  $('#deadline').textContent  = CONFIG.deadline;
  const q = !isPH(CONFIG.venueAddr) ? CONFIG.venueAddr : (isPH(CONFIG.venueName) ? '' : CONFIG.venueName);
  $('#mapBtn').href = CONFIG.mapUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q));
  const dates = CONFIG.calStart ? `${CONFIG.calStart}/${CONFIG.calEnd||CONFIG.calStart}` : '20261213/20261214';
  $('#calBtn2').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Leo & Min 的婚禮')
    + '&dates=' + dates + '&ctz=Asia/Taipei' + (isPH(CONFIG.venueAddr) ? '' : '&location=' + encodeURIComponent(CONFIG.venueAddr));
})();
