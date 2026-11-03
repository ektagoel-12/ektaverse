'use strict';
/* DOM overlays drawn above the game canvas: HUD, dialogs with typewriter subtitles,
   title cards, the project billboard, studio, hurdle lessons, gameplay video,
   and victory screen. */
const UI = (() => {
  const $ = s => document.querySelector(s);
  let modal = null; // the overlay that currently owns input: { onKey, onTap }
  let auto = false;  // walkthrough / express: dialogs and panels advance by themselves
  function setAuto(v) { auto = !!v; }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Escape, then highlight [FILL: ...] placeholders so they stand out. */
  const rich = s => esc(s).replace(/\[FILL:[^\]]*\]/g, m => `<span class="fill">${m}</span>`);
  const isFill = s => !s || /^\s*\[FILL/i.test(s);
  const safeUrl = u => (/^(https?:|mailto:)/i.test(u) || /^[\w./-]+$/.test(u)) ? u : '#';
  function linkOrChip(url, label, cls = 'btn') {
    if (isFill(url)) return `<span class="${cls} disabled" title="${esc(url || '')}">${esc(label)} <small class="fill">${esc(url || '[FILL: link]')}</small></span>`;
    return `<a class="${cls}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)} ↗</a>`;
  }
  // Each show/hide bumps a version so a late animation frame or timer can't undo a newer call.
  function show(el) {
    const v = el._v = (el._v || 0) + 1;
    el.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => { if (el._v === v) el.classList.add('show'); }));
  }
  function hide(el) {
    const v = el._v = (el._v || 0) + 1;
    el.classList.remove('show');
    setTimeout(() => { if (el._v === v) el.classList.add('hidden'); }, 220);
  }

  // ---------- global input routing ----------
  document.addEventListener('keydown', e => {
    if (!modal || !modal.onKey) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (modal.onKey(e)) e.preventDefault();
  });
  function tap() { if (modal && modal.onTap) modal.onTap(); }
  // leaving for the home page: drop whatever box is open without resuming the scene that opened it
  function closeAll() {
    modal = null; AudioSys.stopVoice();
    ['#dialog', '#card', '#panel'].forEach(id => { const el = $(id); if (!el.classList.contains('hidden')) hide(el); });
  }
  const isOpen = () => !!modal;
  const isAuto = () => auto;

  // ---------- HUD ----------
  function hud(o) {
    if (o.chai != null) $('#hud-chai').textContent = o.chai;
    if (o.bugs != null) $('#hud-bugs').textContent = o.bugs;
    if (o.level != null) $('#hud-level').textContent = o.level;
    if (o.xp != null) $('#hud-xp').textContent = o.xp + '/4';
  }
  function hudVisible(v) { $('#hud').classList.toggle('hidden', !v); $('#touch').classList.toggle('off', !v); }
  function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function scooter(sec) {
    const el = $('#hud-scoot');
    if (sec == null) el.classList.add('hidden');
    else { el.classList.remove('hidden'); el.querySelector('b').textContent = sec; }
  }
  function setMute(m) { $('#mute').textContent = m ? '🔇' : '🔊'; $('#mute').setAttribute('aria-pressed', m ? 'true' : 'false'); }

  // ---------- toast & banner ----------
  let toastTimer = null;
  function toast(html, ms = 1800) {
    const t = $('#toast');
    t.innerHTML = html; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  const banner = {
    show(html, cls = '') { const b = $('#banner'); b.innerHTML = html; b.className = cls; },
    hide() { $('#banner').className = 'hidden'; },
  };

  // ---------- dialog with typewriter subtitles ----------
  function dialog({ title, text, portrait, audio }) {
    return new Promise(resolve => {
      const el = $('#dialog'), body = $('#dlg-text'), hint = $('#dlg-hint');
      $('#dlg-img').src = Art.portraitURL(portrait);
      $('#dlg-title').textContent = title || '';
      body.innerHTML = ''; hint.classList.remove('ready');
      show(el);
      let cps = 34, shown = 0, done = false, closed = false, last = performance.now(), hasVoice = false;
      const clip = AudioSys.playVoice(audio, dur => {
        if (dur && isFinite(dur) && dur > 1) { hasVoice = true; cps = Math.max(10, text.length / Math.max(1, dur - 0.4)); }
      });
      const tick = () => {
        if (closed || done) return;
        const t = performance.now(), dt = (t - last) / 1000; last = t;
        const before = Math.floor(shown);
        shown = Math.min(text.length, shown + dt * cps);
        if (Math.floor(shown) !== before) {
          body.innerHTML = rich(text.slice(0, Math.floor(shown))) + '<span class="caret">▌</span>';
          if (!hasVoice && Math.floor(shown) % 3 === 0) AudioSys.sfx('blip');
        }
        if (shown >= text.length) finish(); else requestAnimationFrame(tick);
      };
      function finish() {
        done = true; body.innerHTML = rich(text); hint.classList.add('ready');
        if (auto) {
          const t0 = performance.now();
          const poll = setInterval(() => {
            if (closed || !auto) { clearInterval(poll); return; }
            if (!AudioSys.isVoicePlaying() && performance.now() - t0 > 1600) { clearInterval(poll); close(); }
          }, 250);
        }
      }
      function close() {
        if (closed) return;
        closed = true; if (clip) clip.stop();
        hide(el); modal = null; resolve();
      }
      function advance() { if (!done) finish(); else close(); }
      modal = {
        onKey(e) {
          if (e.code === 'Space' || e.code === 'Enter') { if (!e.repeat) advance(); return true; }
          if (e.code === 'Escape') { close(); return true; }
          return false;
        },
        onTap: advance,
      };
      requestAnimationFrame(tick);
    });
  }

  // ---------- level title card ----------
  function titleCard(num, name, tagline, ms = 2600) {
    return new Promise(resolve => {
      const el = $('#card');
      $('#card-lvl').textContent = num === 4 ? 'FINAL LEVEL' : 'LEVEL ' + num;
      $('#card-name').textContent = name; $('#card-tag').textContent = tagline;
      show(el);
      let closed = false;
      const close = () => { if (closed) return; closed = true; clearTimeout(timer); hide(el); modal = null; setTimeout(resolve, 150); };
      const timer = setTimeout(close, ms);
      modal = { onKey(e) { if (['Space', 'Enter', 'Escape'].includes(e.code)) { close(); return true; } return false; }, onTap: close };
    });
  }

  // ---------- generic panel ----------
  function panel(cls, html, setup, autoMs) {
    return new Promise(resolve => {
      const wrap = $('#panel'), box = $('#panel-box');
      box.className = 'panel-box ' + cls; box.innerHTML = html; box.scrollTop = 0;
      show(wrap);
      let closed = false;
      const close = () => { if (closed) return; closed = true; hide(wrap); modal = null; setTimeout(resolve, 120); };
      modal = { onKey(e) { if (e.code === 'Escape') { close(); return true; } return false; } };
      if (auto && autoMs) setTimeout(() => { if (auto) close(); }, autoMs);
      box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
      if (setup) setup(box, modal, close);
      const first = box.querySelector('[data-close]');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
    });
  }

  function commaCard(n, text) {
    AudioSys.sfx('power');
    return panel('comma-card', `
      <div class="comma-big">,</div>
      <h2>Comma found! <span class="count">${n}/4</span></h2>
      <p>${rich(text)}</p>
      <button class="btn primary" data-close>Keep going ▶</button>`, (box, m, close) => {
      m.onKey = e => { if (['Space', 'Enter', 'Escape'].includes(e.code)) { close(); return true; } return false; };
    }, 4500);
  }

  function showcase(projects) {
    projects = projects && projects.length ? projects : [];
    const cards = projects.map((p, i) => `
      <article class="bb-card" data-i="${i}">
        <img class="bb-icon" alt="" src="${Art.iconURL(p.icon)}">
        <h3>${esc(p.title)}</h3>
        <p>${rich(p.desc)}</p>
        <div class="tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>
        ${p.link ? linkOrChip(p.link, 'View project', 'btn small') : ''}
      </article>`).join('');
    return panel('billboard', `
      <div class="bb-head">THINGS I BUILD</div>
      <div class="bb-screen">${cards}</div>
      <div class="bb-nav">
        <button class="btn small" data-prev aria-label="Previous project">◀</button>
        <span class="dots">${projects.map((_, i) => `<i data-d="${i}"></i>`).join('')}</span>
        <button class="btn small" data-next aria-label="Next project">▶</button>
      </div>
      <p class="bb-hint">← → to browse · swipe on mobile</p>
      <button class="btn primary" data-close>Back on the road ▶</button>`, (box, m, close) => {
      let i = 0;
      const render = () => {
        box.querySelectorAll('.bb-card').forEach((c, k) => c.classList.toggle('on', k === i));
        box.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
      };
      const go = d => { i = (i + d + projects.length) % projects.length; render(); AudioSys.sfx('blip'); };
      box.querySelector('[data-prev]').onclick = () => go(-1);
      box.querySelector('[data-next]').onclick = () => go(1);
      box.querySelectorAll('.dots i').forEach((d, k) => d.onclick = () => { i = k; render(); });
      let sx = null;
      const scr = box.querySelector('.bb-screen');
      scr.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
      scr.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 30) go(dx < 0 ? 1 : -1); sx = null; });
      m.onKey = e => {
        if (e.code === 'ArrowRight' || e.code === 'KeyD') { go(1); return true; }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') { go(-1); return true; }
        if (e.code === 'Escape' || e.code === 'Enter') { if (e.code === 'Enter' && document.activeElement && document.activeElement.matches('[data-prev],[data-next]')) return false; close(); return true; }
        return false;
      };
      render();
      if (auto) { // walkthrough: flip through every project, then move on
        let shown = 1;
        const flip = setInterval(() => {
          if (!auto || $('#panel').classList.contains('hidden') || !box.querySelector('.bb-card')) { clearInterval(flip); return; }
          if (shown++ >= projects.length) { clearInterval(flip); close(); } else go(1);
        }, 2300);
      }
    });
  }

  function gallery(gal, profile) {
    gal = gal || {};
    const poem = gal.poem || {};
    const videos = (gal.videos || []).map(v => {
      const inner = `<div class="thumb">${v.thumb ? `<img src="${esc(safeUrl(v.thumb))}" alt="" loading="lazy">` : ''}<span class="play">▶</span></div><span>${rich(v.title)}</span>`;
      return isFill(v.url) ? `<div class="vcard">${inner}<small class="fill">${esc(v.url || '[FILL: link]')}</small></div>`
        : `<a class="vcard" href="${esc(safeUrl(v.url))}" target="_blank" rel="noopener">${inner}</a>`;
    }).join('');
    const hasPoem = poem.title || poem.text, row = [
      hasPoem ? `<div class="parchment"><h3>${rich(poem.title)}</h3><div class="poem">${rich(poem.text)}</div></div>` : '',
      videos ? `<div class="videos"><h3>Videos</h3><div class="vlist">${videos}</div></div>` : '',
    ].filter(Boolean);
    return panel('studio', `
      <div class="studio-head"><h2>The Studio</h2><p>I write poetry. I record videos. Code is how I solve problems; art is how I understand them.</p></div>
      <div class="lights" aria-hidden="true"></div>
      ${row.length ? `<div class="studio-row" style="grid-template-columns:${row.length === 2 ? '1.3fr 1fr' : '1fr'}">${row.join('')}</div>` : ''}
      <div class="studio-actions">${profile.poetryPage ? linkOrChip(profile.poetryPage, 'Read my poetry page') : ''}${profile.instagram ? linkOrChip(profile.instagram, 'Instagram') : ''}${profile.medium ? linkOrChip(profile.medium, 'Technical blogs') : ''}
        <button class="btn primary" data-close>Back on the road ▶</button></div>`, null, 9000);
  }

  // ---------- hurdle lesson: a problem Ekta faced and how she solved it ----------
  function lessonCard(lesson, hurdle) {
    AudioSys.sfx('hurt');
    const clip = AudioSys.playVoice(lesson.audio);
    return panel('lesson-card', `
      <span class="lesson-tag">HURDLE · ${esc(hurdle)}</span>
      <h2>Ouch. I've hit this one before.</h2>
      <h3>The problem I faced</h3>
      <p>${rich(lesson.problem)}</p>
      ${lesson.solved ? `<h3 class="ok">How I solved it</h3><p>${rich(lesson.solved)}</p>` : ''}
      ${lesson.learnt ? `<h3 class="ok">What I learnt</h3><p>${rich(lesson.learnt)}</p>` : ''}
      <button class="btn primary" data-close>Got it — keep going ▶</button>`, (box, m, close) => {
      m.onKey = e => { if (['Space', 'Enter', 'Escape'].includes(e.code)) { if (!e.repeat) close(); return true; } return false; };
    }, 9000).then(() => { if (clip) clip.stop(); });
  }

  // ---------- mushroom: experience gained, Ekta grows ----------
  function xpBanner(what, n, total) {
    const ico = Art.iconURL('mushroom');
    const bar = Array.from({ length: total }, (_, i) => `<img class="${i < n ? 'on' : ''}" src="${ico}" alt="" style="height:${2.4 + i * 0.5}cqw">`).join('');
    banner.show(`<div class="xp-title">🍄 EXPERIENCE GAINED · EKTA GREW!</div><div class="xp-what">${rich(what)}</div><div class="xp-bar">${bar}</div>`, 'xp');
  }

  // ---------- chapter map: jump straight to any stop ----------
  function chapterMap(levels, current) {
    let picked = null;
    const stops = levels.map((l, i) => `
      <button class="stop${i === current ? ' here' : ''}" data-i="${i}">
        <span class="dot">${i + 1}</span><b>${esc(l.name)}</b><span>${esc(l.tagline)}</span>${l.note ? `<small>${esc(l.note)}</small>` : ''}
      </button>`).join('');
    return panel('map-card', `
      <h2>Chapter map</h2>
      <p>Jump to any stop. Ekta arrives with the experience she'd have earned by then.</p>
      <div class="map-line">${stops}</div>
      <div class="map-actions"><button class="btn" data-home>⌂ Home — all options</button><button class="btn" data-close>Close</button></div>`, (box, m, close) => {
      box.querySelectorAll('.stop').forEach(b => b.addEventListener('click', () => { picked = +b.dataset.i; close(); }));
      box.querySelector('[data-home]').addEventListener('click', () => { picked = 'home'; close(); });
      m.onKey = e => {
        if (e.code === 'Escape') { close(); return true; }
        if (e.code === 'KeyH' || e.code === 'Digit0') { picked = 'home'; close(); return true; }
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
        if (n != null && n < levels.length) { picked = n; close(); return true; }
        return false;
      };
      setTimeout(() => { const b = box.querySelector('.stop'); if (b) b.focus({ preventScroll: true }); }, 60);
    }).then(() => picked);
  }

  // ---------- captions for every sound with a voice or meaning ----------
  let ccOn = true, capTimer = null;
  try { ccOn = localStorage.getItem('sbe-cc') !== 'off'; } catch (e) { /* storage blocked */ }
  function setCC(v) {
    ccOn = v;
    try { localStorage.setItem('sbe-cc', v ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    $('#cc-btn').setAttribute('aria-pressed', v ? 'true' : 'false');
    if (!v) $('#caption').classList.remove('show');
  }
  function caption(text, who, ms = 1800) {
    if (!ccOn || !text) return;
    const c = $('#caption');
    c.innerHTML = (who ? `<b>${esc(who)}:</b> ` : '') + esc(text);
    c.classList.add('show');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => c.classList.remove('show'), ms);
  }
  function autoPill(html) { const el = $('#auto-pill'); if (html) { el.innerHTML = html; el.classList.remove('hidden'); } else el.classList.add('hidden'); }

  function resume(url) {
    if (isFill(url)) {
      return panel('video-card', `<h2>The boring resume</h2><p>The PDF isn't up yet.</p><p><span class="fill">${esc(url || '[FILL: resume PDF]')}</span></p><button class="btn primary" data-close>Close ✕</button>`);
    }
    window.open(safeUrl(url), '_blank', 'noopener');
    return Promise.resolve();
  }
  function titleLinks(profile) {
    const a = (url, label) => isFill(url) ? '' : `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)}</a>`;
    $('#title-links').innerHTML = [
      profile.linkedin && a(profile.linkedin, 'LinkedIn'),
      profile.github && a(profile.github, 'GitHub'),
      profile.medium && a(profile.medium, 'Technical blogs'),
      profile.poetryPage && a(profile.poetryPage, 'Poetry'),
      profile.instagram && a(profile.instagram, 'Instagram'),
      profile.email && `<a href="mailto:${esc(profile.email)}">Email</a>`,
    ].filter(Boolean).join('');
  }

  // ---------- home-page hello: Ekta pops up, waves and says hi, then blinks now and then ----------
  const TERM = ['shipping mobile security to 20M+ PayZapp users', 'made ML releases 30% faster at Intel',
    'validated 1M+ records with 70% less manual work', 'punctuated speech transcripts at 95.4% accuracy'];
  let heroTimers = [];
  function hello() {
    const img = $('#hello-ekta'), box = $('#hello'), term = $('#term-line');
    heroTimers.forEach(clearTimeout); heroTimers = [];
    const F = n => Art.heroURL(n);
    ['idle', 'blink', 'wave0', 'wave1'].forEach(F); // draw every frame once up front
    img.src = F('wave0');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { term.textContent = TERM[0]; return; }
    const later = (fn, ms) => heroTimers.push(setTimeout(fn, ms));
    // wave for a couple of seconds, then stand and blink, then wave again
    const wave = (n) => {
      if (n <= 0) { img.src = F('idle'); return later(() => blink(4), 1800); }
      img.src = F(n % 2 ? 'wave1' : 'wave0'); later(() => wave(n - 1), 300);
    };
    const blink = (n) => {
      if (n <= 0) return wave(8);
      img.src = F('blink');
      later(() => { img.src = F('idle'); later(() => blink(n - 1), 2000 + Math.random() * 1600); }, 140);
    };
    later(() => wave(9), 600);
    // a terminal line that types out real numbers from the resume
    const type = (k, n) => {
      const str = TERM[k % TERM.length];
      term.textContent = str.slice(0, n);
      if (n < str.length) later(() => type(k, n + 1), 38);
      else later(() => type(k + 1, 0), 2600);
    };
    later(() => type(0, 0), 1000);
  }
  // stop the home-page timers once the game starts
  function helloStop() { heroTimers.forEach(clearTimeout); heroTimers = []; }

  // ---------- victory ----------
  function victory(stats, content, on, express) {
    const p = content.profile || {}, el = $('#victory');
    const commas = stats.commas.size, url = p.siteUrl || (location.origin + location.pathname.replace(/index\.html$/, ''));
    el.innerHTML = `
      <div class="v-box">
        <img class="v-ekta" alt="" src="${Art.spriteURL('cheer')}">
        <h1>${express ? "That's my story in a minute!" : 'You escaped Silk Board!'}</h1>
        <div class="v-stats"${express ? ' hidden' : ''}>
          <div><b>${stats.chai}</b><span>Chai collected</span></div>
          <div><b>${stats.bugs}</b><span>Bugs fixed</span></div>
          <div><b>${commas}/4</b><span>Commas found</span></div>
          <div><b>${stats.xp}/4</b><span>Experience</span></div>
        </div>
        <div class="v-badges">${!express && commas >= 4 ? '<span class="badge gold">, Punctuation Pro — all 4 commas</span>' : ''}</div>
        <p class="v-line">${esc(p.oneLiner || 'Software engineer. Builder. Poet. Stuck at Silk Board, still shipping.')}</p>
        <div class="v-menu">
          <button class="btn" data-again>${express ? '▶ Play the full game' : '↻ Play again'}</button>
          <button class="btn" data-watch>🎬 Watch it play</button>
          <button class="btn" data-map>🗺 Chapter map</button>
          <button class="btn" data-resume>📄 Boring resume (PDF)</button>
        </div>
        <div class="v-btns">
          <a class="btn primary" href="mailto:${esc(p.email || '')}">✉ Email Ekta</a>
          ${p.linkedin ? linkOrChip(p.linkedin, 'LinkedIn') : ''}
          ${p.poetryPage ? linkOrChip(p.poetryPage, 'Poetry page') : ''}
          ${p.instagram ? linkOrChip(p.instagram, 'Instagram') : ''}
          ${p.medium ? linkOrChip(p.medium, 'Technical blogs') : ''}
          ${p.github ? linkOrChip(p.github, 'GitHub') : ''}
          ${p.leetcode ? linkOrChip(p.leetcode, 'LeetCode') : ''}
        </div>
        <button class="btn share" data-share>Share my score</button><span class="copied" aria-live="polite"></span>
      </div>`;
    show(el);
    el.querySelector('[data-again]').onclick = () => on.again();
    el.querySelector('[data-watch]').onclick = () => on.watch();
    el.querySelector('[data-map]').onclick = () => on.map();
    el.querySelector('[data-resume]').onclick = () => on.resume();
    el.querySelector('[data-share]').onclick = async () => {
      const tpl = (content.share && content.share.template) || 'I fixed {bugs} bugs and drank {chai} chai escaping Silk Board with Ekta 🛵 {url}';
      const text = tpl.replace('{bugs}', stats.bugs).replace('{chai}', stats.chai).replace('{url}', url);
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
      }
      el.querySelector('.copied').textContent = ok ? 'Copied!' : text;
      AudioSys.sfx('collect');
    };
    setTimeout(() => el.querySelector('.btn.primary').focus({ preventScroll: true }), 300);
  }
  function hideVictory() { hide($('#victory')); }

  return { esc, rich, isOpen, isAuto, tap, closeAll, hud, hudVisible, bump, scooter, setMute, toast, banner, dialog, titleCard, commaCard, showcase, gallery, lessonCard, xpBanner, resume, titleLinks, hello, helloStop, chapterMap, caption, setCC, ccOn: () => ccOn, autoPill, setAuto, victory, hideVictory, show, hide };
})();
