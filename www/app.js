(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const INTERVALS = [0, 1, 3, 7, 16]; // days until next review, by box 0..4
  const KNOWN_BOX = 3;

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- state ----------
  let custom = store.get('hc.custom', []);
  let progress = store.get('hc.progress', {});
  let settings = Object.assign({ front: 'hanzi', newPerDay: 10, autoSpeak: false }, store.get('hc.settings', {}));
  let cards = [];
  let queue = [];
  let current = null;
  let revealed = false;
  let sessionTotal = 0;
  let sessionDone = 0;

  function today() {
    const d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }

  function buildCards() {
    const starter = (window.STARTER_WORDS || []).map((w, i) => ({
      id: 's' + i, hanzi: w[0], pinyin: w[1], english: w[2], category: w[3] || 'Other', custom: false,
    }));
    const mine = custom.map((c) => ({ ...c, category: 'My cards', custom: true }));
    cards = starter.concat(mine);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newAllowance() {
    const daily = store.get('hc.daily', {});
    const used = daily.day === today() ? daily.n : 0;
    return Math.max(0, settings.newPerDay - used);
  }

  function dueCards() {
    const t = today();
    return cards.filter((c) => progress[c.id] && progress[c.id].due <= t);
  }

  function freshCards() {
    return cards.filter((c) => !progress[c.id]).slice(0, newAllowance());
  }

  // ---------- study ----------
  function startSession(extra) {
    if (extra) {
      const pool = shuffle(cards.filter((c) => !progress[c.id] || progress[c.id].box < KNOWN_BOX));
      queue = (pool.length ? pool : shuffle(cards.slice())).slice(0, 10);
    } else {
      queue = shuffle(dueCards()).concat(freshCards());
    }
    sessionTotal = queue.length;
    sessionDone = 0;
    nextCard();
  }

  function nextCard() {
    current = queue.shift() || null;
    revealed = false;
    updateStats();
    renderStudy();
  }

  function renderStudy() {
    const area = $('study-area');
    const done = $('done-area');
    if (!current) {
      area.hidden = true;
      done.hidden = false;
      const nextDue = Object.values(progress).map((p) => p.due).filter((d) => d > today()).sort((a, b) => a - b)[0];
      const learned = Object.keys(progress).length;
      let msg = learned === 0 ? 'Nothing to study yet.' : 'You have studied ' + learned + ' card' + (learned === 1 ? '' : 's') + ' so far.';
      if (nextDue !== undefined) {
        const days = nextDue - today();
        msg += ' Next review ' + (days === 1 ? 'tomorrow.' : 'in ' + days + ' days.');
      }
      $('done-text').textContent = msg;
      return;
    }
    area.hidden = false;
    done.hidden = true;

    const front = $('face-front');
    const back = $('face-back');
    front.textContent = '';
    back.textContent = '';

    const hanziFirst = settings.front === 'hanzi';
    const len = Array.from(current.hanzi).length;
    const sizeClass = len >= 4 ? 'long' : len >= 2 ? 'mid' : '';

    if (hanziFirst) {
      front.append(el('div', 'hanzi ' + sizeClass, current.hanzi));
      back.append(el('div', 'pinyin', current.pinyin), el('div', 'english', current.english));
    } else {
      front.append(el('div', 'english', current.english));
      back.append(el('div', 'hanzi ' + sizeClass, current.hanzi), el('div', 'pinyin', current.pinyin));
    }

    $('card-tag').textContent = current.category;
    back.hidden = true;
    $('card-hint').textContent = 'Tap to reveal';
    $('card-hint').hidden = false;
    $('answer-row').hidden = true;
    $('bar').style.width = (sessionTotal ? (sessionDone / sessionTotal) * 100 : 0) + '%';
  }

  function reveal() {
    if (!current || revealed) return;
    revealed = true;
    $('face-back').hidden = false;
    $('card-hint').hidden = true;
    $('answer-row').hidden = false;
    if (settings.autoSpeak) speak(current.hanzi);
  }

  function rate(good) {
    if (!current || !revealed) return;
    const t = today();
    const isNew = !progress[current.id];
    const p = progress[current.id] || { box: 0, due: t, seen: 0, wrong: 0 };

    if (isNew) {
      const daily = store.get('hc.daily', {});
      store.set('hc.daily', { day: t, n: (daily.day === t ? daily.n : 0) + 1 });
    }

    p.seen += 1;
    if (good) {
      p.box = Math.min(p.box + 1, INTERVALS.length - 1);
      p.due = t + INTERVALS[p.box];
      sessionDone += 1;
    } else {
      p.box = 0;
      p.due = t;
      p.wrong = (p.wrong || 0) + 1;
      queue.splice(Math.min(3, queue.length), 0, current); // see it again soon
    }
    progress[current.id] = p;
    store.set('hc.progress', progress);
    touchStreak(t);
    nextCard();
  }

  function touchStreak(t) {
    const s = store.get('hc.streak', { last: -1, count: 0 });
    if (s.last === t) return;
    s.count = s.last === t - 1 ? s.count + 1 : 1;
    s.last = t;
    store.set('hc.streak', s);
  }

  function updateStats() {
    const t = today();
    const s = store.get('hc.streak', { last: -1, count: 0 });
    $('st-due').textContent = dueCards().length;
    $('st-new').textContent = Math.min(newAllowance(), cards.filter((c) => !progress[c.id]).length);
    $('st-known').textContent = Object.values(progress).filter((p) => p.box >= KNOWN_BOX).length;
    $('st-streak').textContent = s.last >= t - 1 ? s.count : 0;
  }

  // ---------- speech ----------
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Speech is not supported on this device'); return; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.8;
      const voice = speechSynthesis.getVoices().find((v) => /^zh[-_]?(CN|Hans)|cmn/i.test(v.lang));
      if (voice) u.voice = voice;
      u.onerror = () => toast('No Chinese voice found. Install one in Text-to-speech settings.');
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {
      toast('Could not play audio');
    }
  }

  // ---------- cards list ----------
  function renderCategories() {
    const sel = $('cat');
    const keep = sel.value || 'all';
    const cats = Array.from(new Set(cards.map((c) => c.category)));
    sel.textContent = '';
    sel.append(new Option('All categories', 'all'));
    cats.forEach((c) => sel.append(new Option(c, c)));
    sel.value = cats.includes(keep) || keep === 'all' ? keep : 'all';
  }

  function renderList() {
    const q = $('search').value.trim().toLowerCase();
    const cat = $('cat').value;
    const list = $('list');
    list.textContent = '';
    const rows = cards.filter((c) =>
      (cat === 'all' || c.category === cat) &&
      (!q || c.hanzi.includes(q) || c.pinyin.toLowerCase().includes(q) || c.english.toLowerCase().includes(q)));

    $('count').textContent = rows.length + ' card' + (rows.length === 1 ? '' : 's');
    const frag = document.createDocumentFragment();
    rows.forEach((c) => {
      const li = document.createElement('li');
      const mid = document.createElement('div');
      mid.append(el('div', 'p', c.pinyin), el('div', 'e', c.english));
      const right = document.createElement('div');
      const p = progress[c.id];
      const status = !p ? ['new', 'new'] : p.box >= KNOWN_BOX ? ['known', 'known'] : ['learning', 'learning'];
      right.append(el('span', 'badge ' + status[1], status[0]));
      if (c.custom) {
        const del = el('button', 'del', '✕');
        del.type = 'button';
        del.setAttribute('aria-label', 'Delete card ' + c.hanzi);
        del.addEventListener('click', (ev) => { ev.stopPropagation(); removeCustom(c); });
        right.append(del);
      }
      li.append(el('div', 'h' + (Array.from(c.hanzi).length > 3 ? ' sm' : ''), c.hanzi), mid, right);
      li.addEventListener('click', () => speak(c.hanzi));
      frag.append(li);
    });
    list.append(frag);
  }

  function removeCustom(c) {
    if (!confirm('Delete "' + c.hanzi + '"?')) return;
    custom = custom.filter((x) => x.id !== c.id);
    delete progress[c.id];
    store.set('hc.custom', custom);
    store.set('hc.progress', progress);
    queue = queue.filter((x) => x.id !== c.id);
    refreshAll(!!current && current.id === c.id);
  }

  // ---------- helpers ----------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls.trim();
    if (text !== undefined) n.textContent = text;
    return n;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
    if (name === 'cards') renderList();
    if (name === 'study') { if (current) updateStats(); else startSession(false); }
  }

  function refreshAll(restart = true) {
    buildCards();
    renderCategories();
    renderList();
    if (restart) startSession(false); else updateStats();
  }

  // ---------- events ----------
  $('card').addEventListener('click', reveal);
  $('card').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
  });
  $('btn-speak').addEventListener('click', () => { if (current) speak(current.hanzi); });
  $('btn-good').addEventListener('click', () => rate(true));
  $('btn-again').addEventListener('click', () => rate(false));
  $('btn-extra').addEventListener('click', () => startSession(true));

  document.addEventListener('keydown', (e) => {
    if ($('dlg').open || !$('view-study').classList.contains('active')) return;
    if (e.key === '1') rate(false);
    if (e.key === '2') rate(true);
  });

  document.querySelectorAll('#tabs button').forEach((b) =>
    b.addEventListener('click', () => showView(b.dataset.view)));

  $('search').addEventListener('input', renderList);
  $('cat').addEventListener('change', renderList);

  const dlg = $('dlg');
  $('btn-add').addEventListener('click', () => {
    $('add-form').reset();
    dlg.showModal();
    $('f-hanzi').focus();
  });
  $('f-cancel').addEventListener('click', () => dlg.close());
  $('add-form').addEventListener('submit', () => {
    const card = {
      id: 'c' + Date.now(),
      hanzi: $('f-hanzi').value.trim(),
      pinyin: $('f-pinyin').value.trim(),
      english: $('f-english').value.trim(),
    };
    if (!card.hanzi || !card.pinyin || !card.english) return;
    custom.push(card);
    store.set('hc.custom', custom);
    refreshAll(false);
    toast('Card added');
  });

  $('set-front').addEventListener('change', (e) => { settings.front = e.target.value; saveSettings(); renderStudy(); });
  $('set-new').addEventListener('change', (e) => { settings.newPerDay = parseInt(e.target.value, 10); saveSettings(); startSession(false); });
  $('set-speak').addEventListener('change', (e) => { settings.autoSpeak = e.target.checked; saveSettings(); });
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all progress? Your added cards are kept.')) return;
    progress = {};
    ['hc.progress', 'hc.daily', 'hc.streak'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    refreshAll();
    toast('Progress reset');
  });

  function saveSettings() { store.set('hc.settings', settings); }

  // Install button (browser only; not shown inside the Android app)
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $('btn-install').hidden = false;
  });
  $('btn-install').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('btn-install').hidden = true;
  });

  // Offline support when used as a website. The Android app bundles its files, so it skips this.
  const inNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const inCapacitorHost = location.protocol === 'https:' && location.hostname === 'localhost';
  if ('serviceWorker' in navigator && !inNativeApp && !inCapacitorHost) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- init ----------
  $('set-front').value = settings.front;
  $('set-new').value = String(settings.newPerDay);
  $('set-speak').checked = settings.autoSpeak;
  if ('speechSynthesis' in window) speechSynthesis.getVoices(); // warm up voice list
  refreshAll();
})();
