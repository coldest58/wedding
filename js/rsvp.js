/* ---------- 回函（RSVP）：分步填寫 → 產生回函 → 寄出動畫 → 送進 Google 表單 ---------- */
(function(){
  const $ = s => document.querySelector(s);
  const form = $('#rsvpForm');
  const sheets = [...form.querySelectorAll('.sheet')];
  let cur = 1;
  const stage = $('#letterStage'), flight = $('#flight'), envelope = $('#envelope'), letter = $('#letter');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'leomin-rsvp';

  // ---- steppers ----
  const steppers = {};
  form.querySelectorAll('.stepper').forEach(el => {
    const name = el.dataset.name, out = el.querySelector('output');
    const st = { el, min:+el.dataset.min, max:+el.dataset.max, val:+el.dataset.val };
    const minus = el.querySelector('.minus'), plus = el.querySelector('.plus');
    st.set = v => { st.val = Math.max(st.min, Math.min(st.max, v)); out.textContent = st.val; minus.disabled = st.val <= st.min; plus.disabled = st.val >= st.max; };
    minus.addEventListener('click', () => { st.set(st.val - 1); sync(); });
    plus.addEventListener('click', () => { st.set(st.val + 1); sync(); });
    st.set(st.val); steppers[name] = st;
  });
  function sync(){ // 素食、兒童座椅不超過出席人數
    const g = steppers.guests.val;
    steppers.veg.max = g; steppers.veg.set(steppers.veg.val);
    steppers.chairs.max = Math.max(0, Math.min(6, g - 1)); steppers.chairs.set(steppers.chairs.val);
  }
  sync();

  const val = n => { const el = form.elements[n]; return el ? (el.value || '').trim() : ''; };
  const attending = () => val('attend').startsWith('親自出席');

  function show(n, scroll = true){
    cur = n;
    sheets.forEach((sh, i) => {
      sh.classList.toggle('is-active', i + 1 === n);
      sh.classList.toggle('is-past', i + 1 < n);
      sh.querySelector('.err').textContent = '';
    });
    const first = sheets[n - 1].querySelector('input:not([type=radio]),textarea');
    if (first && n !== 1) setTimeout(() => first.focus({ preventScroll:true }), reduce ? 0 : 60);
    const r = form.getBoundingClientRect();     // 新的一張若在畫面外，才捲回來
    if (scroll && (r.top < 70 || r.bottom > innerHeight + 40)) form.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  // 電話只收數字：全形數字轉半形，其他字元（-、空白、括號…）打了就濾掉；選字中（注音）先不動，選完再濾
  const phone = form.elements.phone;
  const digitsOnly = s => (s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\D/g, '');
  const cleanPhone = () => { const v = digitsOnly(phone.value); if (v !== phone.value) phone.value = v; };
  phone.addEventListener('input', e => { if (!e.isComposing) cleanPhone(); });
  phone.addEventListener('compositionend', cleanPhone);

  function validate(n){
    const s = sheets[n - 1], err = s.querySelector('.err');
    let msg = '';
    s.querySelectorAll('input[required]').forEach(i => {
      if (i.type === 'radio') return;
      const v = i.value.trim();
      const fmt = (i.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) || (i === phone && !/^\d+$/.test(v));
      const bad = !v || fmt;
      i.setAttribute('aria-invalid', bad);
      if (bad && !msg) msg = !v ? '還有欄位沒填喔' : i.type === 'email' ? '請填一個可以收信的 Email' : '電話請只填數字';
    });
    const radios = new Set([...s.querySelectorAll('input[type=radio][required]')].map(r => r.name));
    radios.forEach(nm => { if (!val(nm) && !msg) msg = '請選一個選項'; });
    err.textContent = msg;
    return !msg;
  }
  const nextOf = n => (n === 2 && !attending()) ? 4 : n + 1;
  const prevOf = n => (n === 4 && !attending()) ? 2 : n - 1;
  let composing = false;
  sheets.forEach((sh, i) => {
    sh.querySelector('.next').addEventListener('click', () => {
      if (!validate(i + 1) || composing) return;
      if (i + 1 === sheets.length) return compose();
      show(nextOf(i + 1));
    });
    sh.querySelector('.prev').addEventListener('click', () => show(prevOf(i + 1)));
  });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); sheets[cur - 1].querySelector('.next').click(); } });

  // ---- 產生回函 ----
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const hl = s => `<span class="hl">${esc(s)}</span>`;
  function data(){
    const att = attending();
    return {
      name: val('name'), phone: val('phone'), email: val('email'), relation: val('relation'),
      attend: val('attend'), invite: val('invite'), message: val('message'),
      guests: att ? steppers.guests.val : 0, chairs: att ? steppers.chairs.val : 0, veg: att ? steppers.veg.val : 0, att
    };
  }
  // ---- 動畫小工具 ----
  const desk = $('#desk'), sheet4 = sheets[sheets.length - 1], actions = $('#letterActions');
  const flap = envelope.querySelector('.env-flap'), seal = envelope.querySelector('.seal'), envLetter = $('#envLetter');
  const birds = [...envelope.querySelectorAll('.carrier')];
  const T = { fade:220, line:420, stagger:160, fold:440, rise:360, slide:360, flap:380, seal:280, shrink:420, arrive:1100, away:1800, done:320 }; // 各階段時長（ms）
  const ease = 'cubic-bezier(.45,0,.25,1)';
  // 跑一段動畫；減少動態效果時直接跳過。動畫卡住時最多多等 250ms 就往下走
  const run = (el, kf, o) => reduce ? Promise.resolve() : Promise.race([
    el.animate(kf, { fill:'both', ...o }).finished,
    new Promise(r => setTimeout(r, (o.delay || 0) + o.duration + 250))
  ]).catch(() => {});
  // 高度改變時從舊高度過渡到新高度，頁面才不會突然跳
  async function morphHeight(el, change){
    const h0 = el.offsetHeight; change(); const h1 = el.offsetHeight;
    if (h0 !== h1) run(el, [{ height:h0 + 'px', overflow:'hidden' }, { height:h1 + 'px', overflow:'hidden' }], { duration:300, easing:'ease', fill:'none' });
  }
  const lockDesk = () => { desk.style.transition = ''; desk.style.minHeight = desk.offsetHeight + 'px'; };
  const reveal = el => { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight) el.scrollIntoView({ block: r.height > innerHeight ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' }); };
  const fieldsOf4 = () => [...sheet4.children].filter(el => el !== letter);

  // ---- 產生回函：直接寫在第 4 張紙上 ----
  async function writeLetter(){
    const fields = fieldsOf4();
    await Promise.all(fields.map(el => run(el, [{ opacity:1 }, { opacity:0 }], { duration:T.fade })));
    morphHeight(form, () => sheet4.classList.add('is-letter'));
    fields.forEach(el => el.getAnimations().forEach(a => a.cancel()));
    reveal(sheet4);
    const lines = [...letter.querySelectorAll('.to, .body p, .from')];
    // 按鈕的動畫要跟字一起開始（用 delay 排在最後），一開始就藏著；等字寫完才開跑的話，按鈕會先露出來再閃一下
    const linesDone = (lines.length - 1) * T.stagger + T.line;
    await Promise.all([
      ...lines.map((el, i) => run(el, [{ opacity:0, clipPath:'inset(0 100% 0 0)' }, { opacity:1, clipPath:'inset(0 0 0 0)' }], { duration:T.line, delay:i * T.stagger, easing:'ease-out', fill:'backwards' })),
      run(actions, [{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], { duration:260, delay:linesDone, easing:'ease-out', fill:'backwards' })
    ]);
  }
  async function compose(){
    composing = true;
    const d = data();
    // 回函格式：一行一欄，第三人稱
    const row = (k, v) => `<p><span class="k">${k}</span><span>${v}</span></p>`;
    const rel = { '認識新郎這邊':'新郎親友', '認識新娘這邊':'新娘親友', '雙方我都認識':'雙方親友' }[d.relation];
    let html = row('賓客姓名', hl(d.name)) + row('與新人的關係', esc(rel));
    if (d.att) {
      const extra = [];
      if (d.chairs) extra.push(`兒童座椅 ${d.chairs} 張`);
      if (d.veg) extra.push(`素食 ${d.veg} 位`);
      html += row('出席意願', hl('欣然出席') + '（12/13 午宴）');
      html += row('出席人數', `${hl(`共 ${d.guests} 位`)}${extra.length ? `（${extra.join('、')}）` : ''}`);
    } else {
      html += row('出席意願', hl('不克出席') + '，衷心祝福');
    }
    const inv = { '需要，請寄電子喜帖給我':`電子喜帖（寄至 ${esc(d.email)}）`, '需要，請寄紙本喜帖給我':'紙本喜帖', '不用啦，相關資訊我都清楚':'不需要' }[d.invite];
    html += row('喜帖寄送', inv) + row('聯絡電話', esc(d.phone));
    if (d.message) html += row('給新人的話', hl(d.message));
    $('#letterBody').innerHTML = html;
    const t = new Date(); $('#letterDate').textContent = `${t.getFullYear()}.${t.getMonth()+1}.${t.getDate()}`;
    await writeLetter();
    composing = false;
  }
  $('#editBtn').addEventListener('click', () => {
    if (busy || composing) return;
    morphHeight(form, () => sheet4.classList.remove('is-letter'));
    fieldsOf4().forEach(el => run(el, [{ opacity:0 }, { opacity:1 }], { duration:T.fade, fill:'none' }));
    show(4);
  });

  // ---- 寄出 ----
  async function submit(d, { correction = false } = {}){ // correction：更正上一封，訊息前面加【更正】
    const E = CONFIG.entries || {};
    const KEYS = ['name', 'phone', 'relation', 'attend', 'invite', 'guests', 'chairs', 'veg', 'message'];
    if (KEYS.some(k => !E[k] || /\[/.test(E[k]))) { console.warn('[RSVP] CONFIG.entries 還有題目沒設定，資料沒有送出'); return 'demo'; } // 任何一題是佔位文字就不送
    const fd = new FormData();
    const put = (k, v) => { if (k) fd.append(k, v); };
    const choice = (k, v, opts) => { // 選項外的數字走「其他」
      if (!k) return;
      if (opts.includes(String(v))) fd.append(k, String(v));
      else { fd.append(k, '__other_option__'); fd.append(k + '.other_option_response', String(v)); }
    };
    put('emailAddress', d.email);
    put(E.name, d.name); put(E.phone, d.phone); put(E.relation, d.relation); put(E.attend, d.attend); put(E.invite, d.invite);
    choice(E.guests, d.guests, ['1','2','3','4']);
    choice(E.chairs, d.chairs, ['1','2','3','4']);
    choice(E.veg, d.veg, ['0','1','2','3','4']);
    put(E.message, (correction ? '【更正】' : '') + d.message);
    await fetch(CONFIG.formAction, { method:'POST', mode:'no-cors', body: fd });
    return 'ok';
  }

  // 1 信紙對折：複製成上下兩片，下片往上翻蓋到上片
  async function foldLetter(){
    if (reduce) return null;
    const dr = desk.getBoundingClientRect(), r = sheet4.getBoundingClientRect();
    const W = r.width, H = r.height, h = H / 2;
    const wrap = document.createElement('div'); wrap.className = 'fold-wrap';
    wrap.style.cssText = `left:${r.left - dr.left}px;top:${r.top - dr.top}px;width:${W}px;height:${H}px`;
    const panel = (i, origin) => {
      const p = document.createElement('div'); p.className = 'fold-panel';
      p.style.cssText = `top:${i * h}px;height:${h}px;transform-origin:50% ${origin}`;
      const face = document.createElement('div'); face.className = 'fold-face';
      const c = sheet4.cloneNode(true);
      c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
      c.style.cssText = `position:absolute;left:0;top:${-i * h}px;margin:0;width:${W}px;height:${H}px;box-sizing:border-box;transform:none;transition:none`;
      const shade = document.createElement('div'); shade.className = 'fold-shade';
      face.append(c, shade);
      const back = document.createElement('div'); back.className = 'fold-back';
      p.append(face, back);
      return p;
    };
    const top = panel(0, '50%'), bot = panel(1, '0');
    wrap.append(top, bot); desk.appendChild(wrap);
    form.classList.add('is-folding');
    const shadeIn = p => run(p.querySelector('.fold-shade'), [{ opacity:0 }, { opacity:.22 }], { duration:T.fold });
    await Promise.all([run(bot, [{ transform:'rotateX(0deg)' }, { transform:'translateZ(1px) rotateX(180deg)' }], { duration:T.fold, easing:ease }), shadeIn(bot)]);
    return { wrap, left:r.left, top:r.top, width:W, height:h };
  }

  // 2 信封從下方升起，折好的信移到開口上方、滑進信封
  async function intoEnvelope(folded){
    form.hidden = true; stage.hidden = false;
    flight.className = 'flight'; flight.hidden = false;
    const er0 = envelope.getBoundingClientRect();
    const flapH = flap.getBoundingClientRect().height;
    // 讓信封中心對齊折好的信，但至少留出打開的蓋子的高度，蓋子才不會蓋到上方標題
    const shift = folded ? folded.top + folded.height / 2 - (er0.top + er0.height / 2) : 0;
    stage.style.paddingTop = Math.max(flapH, shift) + 'px';
    const er = envelope.getBoundingClientRect();
    const ratio = folded ? folded.height / folded.width : .34;
    let w = er.width * .88, h = w * ratio;
    if (h > er.height * .8) { h = er.height * .8; w = h / ratio; }
    const top = er.height * .12, lift = top + h * .8;
    envLetter.style.cssText = `width:${w}px;height:${h}px;left:${(er.width - w) / 2}px;top:${top}px`;
    if (folded) {
      const s = w / folded.width;
      const tx = er.left + (er.width - w) / 2 - folded.left;
      const ty = er.top + top - lift - folded.top;
      envLetter.style.borderWidth = Math.max(1.5, 3 * s).toFixed(2) + 'px';
      await Promise.all([
        run(envelope, [{ opacity:0, transform:'translateY(70px)' }, { opacity:1, transform:'none' }], { duration:T.rise, easing:'cubic-bezier(.2,.8,.3,1)' }),
        run(folded.wrap, [{ transform:'none' }, { transform:`translate(${tx}px,${ty}px) scale(${s})` }], { duration:T.rise, easing:ease })
      ]);
      folded.wrap.remove();
    }
    flight.classList.add('inserted');
    await run(envLetter, [{ transform:`translateY(${-lift}px)` }, { transform:'none' }], { duration:T.slide, easing:'cubic-bezier(.5,0,.3,1)' });
  }

  // 3 蓋子翻下、封蠟壓下去再彈回來
  const SEALS = ['assets/seal-cat.png', 'assets/seal-dog.png'];
  SEALS.forEach(src => { new Image().src = src; }); // 先載好，蓋章時才不會閃空白
  async function sealEnvelope(){
    seal.src = SEALS[Math.floor(Math.random() * SEALS.length)]; // 每次封信隨機挑一個封蠟
    await run(flap, [{ transform:'rotateX(180deg)', zIndex:1 }, { transform:'rotateX(0deg)', zIndex:4 }], { duration:T.flap, easing:'ease-in-out' });
    flight.classList.add('sealed');
    await run(seal, [{ transform:'scale(0)' }, { transform:'scale(1.35)', offset:.55 }, { transform:'scale(.88)', offset:.8 }, { transform:'scale(1)' }], { duration:T.seal, easing:'ease-out' });
  }

  // 4 信封縮小，兩隻鳥從上方沿弧線俯衝到信封兩角，停著拍翅
  // 鳥在縮小的信封裡，位移也會跟著縮 .65 倍，所以數字放大回來
  const birdPath = s => [ // s = -1 左邊那隻、1 右邊那隻
    { transform:`translate(${s * 400}px,-490px) rotate(${-s * 25}deg)`, opacity:0 },
    { transform:`translate(${s * 230}px,-200px) rotate(${-s * 10}deg)`, opacity:1, offset:.45 },
    { transform:`translate(${s * 46}px,-18px) rotate(${s * 6}deg)`, opacity:1, offset:.8 },
    { transform:'none', opacity:1 }
  ];
  const side = b => b.classList.contains('r') ? 1 : -1; // 每隻鳥有身體、爪子兩層，同一邊走同一條路徑
  async function birdsArrive(){
    if (!flight.classList.contains('small')) {
      await run(envelope, [{ transform:'none' }, { transform:'scale(.65)' }], { duration:T.shrink, easing:ease });
      flight.classList.add('small');
      envelope.getAnimations().forEach(a => a.cancel());
    }
    flight.classList.add('flapping');
    await Promise.all(birds.map(b => run(b, birdPath(side(b)), { duration:T.arrive, easing:'ease-out' })));
    flight.classList.add('carried');
  }
  async function birdsLeave(){
    await Promise.all(birds.map(b => run(b, birdPath(side(b)).reverse().map(k => ({ ...k, offset: k.offset == null ? undefined : 1 - k.offset })), { duration:T.arrive * .7, easing:'ease-in' })));
    flight.classList.remove('carried', 'flapping');
    birds.forEach(b => b.getAnimations().forEach(a => a.cancel()));
  }

  // 5 鳥抓著信封往右上飛出畫面
  async function flyAway(){
    await run(flight, [
      { transform:'none', opacity:1 },
      { transform:'translate(4vw,-6vh) rotate(-3deg)', opacity:1, offset:.25 },
      { transform:'translate(22vw,-45vh) rotate(-10deg) scale(.7)', opacity:1, offset:.6 },
      { transform:'translate(45vw,-95vh) rotate(-16deg) scale(.4)', opacity:0 }
    ], { duration:T.away, easing:'cubic-bezier(.4,0,.6,1)' });
    flight.style.visibility = 'hidden';
  }

  // 6 完成卡片在信封原位浮出，區塊高度慢慢收回
  async function showDone(){
    done.hidden = false;
    done.querySelector('h3').focus({ preventScroll:true });
    await run(done, [{ opacity:0, transform:'translateY(18px) scale(.96)' }, { opacity:1, transform:'none' }], { duration:T.done, easing:'ease-out' });
    // 收起信封留下的空位：完成卡片和區塊高度一起滑到新位置
    const y0 = done.getBoundingClientRect().top, h0 = desk.offsetHeight;
    desk.style.minHeight = ''; stage.style.paddingTop = ''; flight.hidden = true;
    const y1 = done.getBoundingClientRect().top, h1 = desk.offsetHeight;
    await Promise.all([
      run(done, [{ transform:`translateY(${y0 - y1}px)` }, { transform:'none' }], { duration:500, easing:'ease', fill:'none' }),
      run(desk, [{ height:h0 + 'px' }, { height:h1 + 'px' }], { duration:500, easing:'ease', fill:'none' })
    ]);
    reveal(done);
  }

  const done = $('#done'), sendFail = $('#sendFail');
  let busy = false;
  async function deliver(d, sending){ // sending：按下寄出時就已經送出的請求
    await birdsArrive();
    const result = await sending;
    if (result === 'fail') {
      await birdsLeave();
      sendFail.hidden = false; $('#retryBtn').focus({ preventScroll:true });
      busy = false; return;
    }
    await flyAway();
    // 真的寄出才記下這份回函，之後才能「寫錯了，改一下重寄」
    $('#fixBtn').hidden = !(result === 'ok' && saveLast(d));
    if (result === 'ok') endCorrection();
    $('#doneMsg').textContent = result === 'demo'
      ? '（示範模式：還沒接上表單，這份回函沒有真的寄出）'
      : (d.att ? `${d.name}，我們 12/13 中午見！` : `${d.name}，謝謝你的祝福，我們收到了！`);
    await showDone();
    busy = false;
  }
  $('#sendBtn').addEventListener('click', async () => {
    if (busy || composing) return;
    busy = true;
    const d = data(), sending = submit(d, { correction:correcting }).catch(() => 'fail');
    sheet4.classList.add('is-sending');
    lockDesk();
    const folded = await foldLetter();
    await intoEnvelope(folded);
    await sealEnvelope();
    await deliver(d, sending);
  });
  $('#retryBtn').addEventListener('click', () => {
    if (busy) return;
    busy = true; sendFail.hidden = true;
    const d = data();
    deliver(d, submit(d, { correction:correcting }).catch(() => 'fail'));
  });

  // ---- 再填一份 ----
  function clearMotion(){
    desk.getAnimations({ subtree:true }).forEach(a => a.cancel());
    desk.querySelectorAll('.fold-wrap').forEach(w => w.remove());
    flight.className = 'flight'; flight.style.visibility = ''; flight.hidden = false;
    stage.style.paddingTop = ''; envLetter.style.cssText = '';
    desk.style.transition = ''; desk.style.minHeight = '';
    sheet4.classList.remove('is-letter', 'is-sending'); form.classList.remove('is-folding');
    sendFail.hidden = true; done.hidden = true; busy = false;
  }
  function reset(){
    form.reset(); steppers.guests.set(1); steppers.chairs.set(0); steppers.veg.set(0); sync();
    clearMotion(); stage.hidden = true; form.hidden = false; show(1);
  }
  $('#againBtn').addEventListener('click', () => { endCorrection(); reset(); form.scrollIntoView({ block:'center' }); });
  $('#writeAnother').addEventListener('click', () => { $('#sentBefore').hidden = true; endCorrection(); reset(); });

  // ---- 更正：帶回上一封，改完重寄（只在同一台裝置、同一個瀏覽器有效） ----
  let correcting = false;
  const correctNote = $('#correctNote');
  const loadLast = () => { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.name ? r : null; } catch(e){ return null; } };
  const canCorrect = r => !!(r && r.attend); // 舊格式只有 { name, at }，帶不回內容
  function saveLast(d){
    try {
      const { name, phone, email, relation, attend, invite, guests, chairs, veg, message } = d;
      localStorage.setItem(KEY, JSON.stringify({ name, phone, email, relation, attend, invite, guests, chairs, veg, message, at:Date.now() }));
      return true;
    } catch(e){ return false; }
  }
  function endCorrection(){ correcting = false; correctNote.hidden = true; }
  function restore(r){
    reset();
    const set = (n, v) => { const el = form.elements[n]; if (el instanceof RadioNodeList) [...el].forEach(x => x.checked = x.value === v); else if (el) el.value = v || ''; };
    ['name', 'phone', 'email', 'relation', 'attend', 'invite', 'message'].forEach(k => set(k, r[k]));
    cleanPhone();                                       // 舊回函的電話可能有 -，帶回來時一併濾掉
    steppers.guests.set(r.guests || 1); sync();          // 先設人數，座椅與素食的上限才會對
    steppers.chairs.set(r.chairs || 0); steppers.veg.set(r.veg || 0); sync();
    correcting = true; correctNote.hidden = false;
    show(1);
  }
  const startFix = () => { const r = loadLast(); if (!canCorrect(r)) return; $('#sentBefore').hidden = true; restore(r); correctNote.scrollIntoView({ block:'start', behavior: reduce ? 'auto' : 'smooth' }); };
  $('#fixBtn').addEventListener('click', startFix);
  $('#fixPrev').addEventListener('click', startFix);

  const prev = loadLast();
  if (prev) { $('#sentName').textContent = prev.name; $('#fixPrev').hidden = !canCorrect(prev); $('#sentBefore').hidden = false; }
  show(1, false);                               // 初始化不捲動，停在頁首
})();
