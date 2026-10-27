/* ============================================================
   ✏️ 只要改這裡
   ============================================================ */
const CONFIG = {
  // 回函資料送進這份 Google 表單（表單 →「取得預先填入的連結」可以查到每題的 entry 編號）
  // ⚠️ 改了表單的題目或選項文字，就要重新核對 entry 編號、選項文字（要和 index.html 的選項一字不差），
  //    並實際寄一封測試信確認試算表有收到——網站看不到 Google 的回應，送錯也會顯示「寄出囉」。
  formAction: "https://docs.google.com/forms/d/e/1FAIpQLSeJ-NkQ6SaHV0LMQ5CCeC4XlaW_sN8icRPwnHF387_jQrXAqA/formResponse",
  entries: {
    name:     "entry.501472742",   // 您的大名
    phone:    "entry.1131748200",  // 您的聯絡電話
    relation: "entry.1987779913",  // 與新人的關係
    attend:   "entry.7450744",     // 請問您是否會出席婚禮？
    invite:   "entry.67653064",    // 是否需要喜帖
    address:  "entry.659117019",   // 紙本喜帖寄送地址（表單上要維持「非必填」，不然沒選紙本的人會被擋下）
    guests:   "entry.1896141077",  // 共幾位出席
    chairs:   "entry.929525616",   // 需要安排兒童座椅幾張？
    veg:      "entry.1899579693",  // 共幾位有素食需求
    message:  "entry.1529789190"   // 有什麼話想和我們說嗎？
  },
  venueName: "橋頭糖廠百世莊園 物五會館",
  venueAddr: "高雄市橋頭區糖廠路24號",
  mapUrl: "https://maps.app.goo.gl/MdSLMZD8Sg4SNq8x9",   // 「開啟 Google 地圖」按鈕的連結；留空就用地址搜尋
  deadline: "[回覆期限]",
  date: "2026-12-13",
  calStart: "20261213T120000",   // 台北時間；留空＝整天
  calEnd: "20261213T150000"
};
