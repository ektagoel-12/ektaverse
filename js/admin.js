'use strict';
/* Content admin: renders data/content.json as a form, saves it back through server.py. */
(() => {
  const $ = s => document.querySelector(s);
  let pw = '', data = null, rawMode = false;
  try { pw = sessionStorage.getItem('sbe-admin') || ''; } catch (e) { /* ignore */ }

  const SECTIONS = {
    dialogs: 'Voice script & subtitles',
    profile: 'Profile, links, resume & gameplay video',
    levels: 'Level names, taglines, experience (mushroom) & gate names',
    projects: 'Project billboard',
    gallery: 'Studio (poem, videos)',
    sfx: 'Short sound clips (honk, "let\'s go", "oh no", silk board)',
    intro: 'Opening scene: graduation (college name, degree)',
    chat: 'Ask Ekta — greeting, topic buttons, written answers (topic, keywords, answer) and the fallback; {email} and {linkedin} are filled in for you',
    captions: 'Captions for short voice effects (shown when CC is on)',
    comma: 'Comma pickup fun fact',
    lessons: 'Hurdle lessons — shown when a bug hits Ekta (problem, what I learnt, voice clip)',
    share: 'Share-my-score text',
  };
  const LONG = /^(text|story|dictation|desc|template|oneLiner|built|problem|learnt|solved|persona|facts|greeting|answer|fallback)$/;
  const UPLOAD = /^(audio|image|screenshot|thumb|honk|chalo|arreBhai|silkboard|resume)$/;
  const AUDIO = /^(audio|honk|chalo|arreBhai|silkboard)$/;

  async function api(method, url, body, headers = {}) {
    const r = await fetch(url, { method, body, headers: Object.assign({ 'X-Admin-Password': pw }, headers) });
    let j = {};
    try { j = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok) throw new Error(j.error || r.status + ' ' + r.statusText);
    return j;
  }
  function status(msg, ok) { const s = $('#status'); s.textContent = msg; s.className = 'status ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); }

  // ---------- login ----------
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    pw = $('#pw').value;
    try { await api('POST', 'api/login'); } catch (err) { $('#login-status').textContent = 'That password did not work.'; $('#login-status').className = 'status bad'; return; }
    try { sessionStorage.setItem('sbe-admin', pw); } catch (err) { /* ignore */ }
    open();
  });
  async function open() {
    $('#login').hidden = true; $('#app').hidden = false;
    const r = await fetch('api/content', { cache: 'no-store' });
    data = await r.json();
    render();
  }

  // ---------- form rendering ----------
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    [].concat(kids).forEach(k => k && n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return n;
  };
  const human = k => String(k).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

  function field(obj, key, path) {
    const id = 'f-' + path.join('-');
    const val = obj[key] == null ? '' : obj[key];
    const wrap = el('div');
    wrap.appendChild(el('label', { for: id, text: human(key) }));
    if (key === 'portrait') {
      const s = el('select', { id, onchange: e => { obj[key] = e.target.value; } });
      [['smile', 'Smiling'], ['think', 'Thinking'], ['laugh', 'Laughing']].forEach(([v, t]) => { const o = el('option', { value: v, text: t }); if (v === val) o.selected = true; s.appendChild(o); });
      wrap.appendChild(s);
      return wrap;
    }
    if (key === 'icon') {
      const s = el('select', { id, onchange: e => { obj[key] = e.target.value; } });
      ['mic', 'mail', 'rocket', 'check', 'bank', 'lock', 'trophy', 'code'].forEach(v => { const o = el('option', { value: v, text: v }); if (v === val) o.selected = true; s.appendChild(o); });
      wrap.appendChild(s);
      return wrap;
    }
    if (key === 'tags' && Array.isArray(val)) {
      const i = el('input', { type: 'text', id, value: val.join(', '), oninput: e => { obj[key] = e.target.value.split(',').map(s => s.trim()).filter(Boolean); } });
      wrap.appendChild(i); wrap.appendChild(el('div', { class: 'hint', text: 'Comma-separated' }));
      return wrap;
    }
    const long = LONG.test(key) || String(val).length > 90 || String(val).includes('\n') || (key === 'text' || path.includes('poem'));
    const input = long ? el('textarea', { id }) : el('input', { type: 'text', id });
    input.value = val;
    input.addEventListener('input', () => { obj[key] = input.value; });
    if (UPLOAD.test(key)) {
      const preview = el('div');
      const showPreview = () => {
        preview.innerHTML = '';
        if (!obj[key]) return;
        if (AUDIO.test(key)) preview.appendChild(el('audio', { class: 'preview', controls: '', preload: 'none', src: obj[key] }));
        else if (key === 'resume') preview.appendChild(el('a', { href: obj[key], target: '_blank', rel: 'noopener', text: 'Open ↗' }));
        else preview.appendChild(el('img', { class: 'preview', src: obj[key], alt: '' }));
      };
      input.addEventListener('change', showPreview);
      const file = el('input', { type: 'file', accept: AUDIO.test(key) ? 'audio/*' : key === 'resume' ? 'application/pdf' : 'image/*', hidden: '' });
      file.addEventListener('change', async () => {
        const f = file.files[0]; if (!f) return;
        status('Uploading ' + f.name + '…');
        try {
          const j = await api('PUT', 'api/upload?name=' + encodeURIComponent(f.name), f, { 'Content-Type': 'application/octet-stream' });
          obj[key] = input.value = j.url; showPreview(); status('Uploaded — remember to Save', true);
        } catch (err) { status('Upload failed: ' + err.message, false); }
        file.value = '';
      });
      wrap.appendChild(el('div', { class: 'row' }, [input, el('button', { type: 'button', text: 'Upload…', onclick: () => file.click() }), file]));
      wrap.appendChild(preview);
      showPreview();
    } else wrap.appendChild(input);
    return wrap;
  }

  function node(obj, key, path) {
    const v = obj[key];
    if (Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object')) return list(obj, key, path);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const fs = el('fieldset', {}, [el('legend', { text: path.length === 1 ? '' : (obj === data.dialogs ? 'Clip ' + key : human(key)) })]);
      Object.keys(v).forEach(k => fs.appendChild(node(v, k, path.concat(k))));
      return fs;
    }
    return field(obj, key, path);
  }
  function list(obj, key, path) {
    const arr = obj[key];
    const fs = el('fieldset', {}, [el('legend', { text: human(key) })]);
    arr.forEach((item, i) => {
      const inner = el('fieldset', {}, [el('legend', { text: '#' + (i + 1) })]);
      Object.keys(item).forEach(k => inner.appendChild(node(item, k, path.concat(i, k))));
      inner.appendChild(el('div', { class: 'actions' }, [
        el('button', { type: 'button', text: '↑', title: 'Move up', onclick: () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; render(); } } }),
        el('button', { type: 'button', text: '↓', title: 'Move down', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; render(); } } }),
        el('button', { type: 'button', class: 'danger', text: 'Remove', onclick: () => { if (confirm('Remove this item?')) { arr.splice(i, 1); render(); } } }),
      ]));
      fs.appendChild(inner);
    });
    if (key !== 'levels') {
      fs.appendChild(el('button', { type: 'button', text: '+ Add', onclick: () => {
        const tpl = arr[0] ? JSON.parse(JSON.stringify(arr[0])) : { title: '', url: '' };
        Object.keys(tpl).forEach(k => { tpl[k] = Array.isArray(tpl[k]) ? [] : ''; });
        arr.push(tpl); render();
      } }));
    }
    return fs;
  }

  function render() {
    const form = $('#form'); form.innerHTML = '';
    const keys = Object.keys(SECTIONS).filter(k => k in data).concat(Object.keys(data).filter(k => !(k in SECTIONS)));
    keys.forEach((k, i) => {
      const d = el('details', { class: 'section' }, [el('summary', { text: SECTIONS[k] || human(k) })]);
      if (i === 0) d.open = true;
      const body = el('div', { class: 'section-body' });
      const v = data[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(kk => body.appendChild(node(v, kk, [k, kk])));
      else body.appendChild(node(data, k, [k]));
      d.appendChild(body); form.appendChild(d);
    });
  }

  // ---------- toolbar ----------
  $('#toggle-raw').addEventListener('click', () => {
    if (!rawMode) { $('#raw').value = JSON.stringify(data, null, 2); }
    else {
      try { data = JSON.parse($('#raw').value); render(); } catch (e) { status('Raw JSON has an error: ' + e.message, false); return; }
    }
    rawMode = !rawMode;
    $('#raw').hidden = !rawMode; $('#form').hidden = rawMode;
    $('#toggle-raw').textContent = rawMode ? 'Back to form' : 'Raw JSON';
  });
  $('#save').addEventListener('click', async () => {
    if (rawMode) { try { data = JSON.parse($('#raw').value); } catch (e) { status('Raw JSON has an error: ' + e.message, false); return; } }
    status('Saving…');
    try { await api('POST', 'api/content', JSON.stringify(data), { 'Content-Type': 'application/json' }); status('Saved ✓ — reload the game to see it', true); }
    catch (e) { status('Save failed: ' + e.message + ' (use Download JSON on a static host)', false); }
  });
  $('#download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'content.json' });
    document.body.appendChild(a); a.click(); a.remove();
  });
  window.addEventListener('beforeunload', () => { /* nothing persisted locally */ });

  if (pw) api('POST', 'api/login').then(open).catch(() => { pw = ''; });
})();
