'use strict';
/* "Ask Ekta" — a chat in the corner that answers from Ekta's own pre-written answers
   (content.chat.answers), matched by keywords, and hands anything else to her email and
   LinkedIn. Free, and works on static hosting. If content.chat.mode is "ai" and server.py has
   an API key, replies come from chat.py instead, with these answers as the fallback. */
const Chat = (() => {
  const $ = s => document.querySelector(s);
  const history = [];   // [{ role: 'user' | 'assistant', content }]
  let open = false, busy = false, greeted = false, pausedGame = null;
  // while the chat is open the game must not swallow Space and the arrow keys
  const gameKeys = on => { if (window.__game && __game.input && __game.input.keyboard) __game.input.keyboard.enabled = on; };

  function profile() { return (G.content && G.content.profile) || {}; }
  function cfg() { return (G.content && G.content.chat) || {}; }

  // links in replies become clickable; everything else is escaped text
  function linkify(text) {
    return UI.esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/([\w.+-]+@[\w-]+\.[\w.]+[\w])/g, '<a href="mailto:$1">$1</a>')
      .replace(/(^|\s)(resume\/[\w.-]+\.pdf)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  }
  function add(role, text, cls = '') {
    const el = document.createElement('div');
    el.className = `msg ${role === 'user' ? 'me' : 'bot'} ${cls}`;
    el.innerHTML = linkify(text);
    $('#chat-log').appendChild(el);
    $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
    return el;
  }
  function chips() {
    const box = $('#chat-chips');
    box.innerHTML = '';
    (cfg().suggestions || []).forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = q;
      b.onclick = () => send(q, q);
      box.appendChild(b);
    });
  }
  // fill {email} and {linkedin} in an answer
  function fill(text) {
    const p = profile(), link = p.linkedin && !/\[FILL/.test(p.linkedin) ? p.linkedin : '';
    return String(text || '').replace(/\{email\}/g, p.email || '').replace(/\{linkedin\}/g, link);
  }
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // a keyword matches at the start of a word; short ones (ai, hi, cv) must be the whole word
  function hits(text, kw) {
    kw = String(kw).toLowerCase().trim();
    if (!kw) return false;
    return new RegExp('(^|[^a-z0-9])' + escRe(kw) + (kw.length <= 3 ? '($|[^a-z0-9])' : ''), 'i').test(text);
  }
  const SMALL_TALK = /^(hello|thanks)$/i;
  function scripted(text, topic) {
    const answers = cfg().answers || [];
    if (topic) { const a = answers.find(x => x.topic === topic); if (a) return fill(a.answer); }
    const q = ' ' + text.toLowerCase() + ' ';
    let best = null, bestScore = 0;
    answers.forEach(a => {
      let score = 0;
      (a.keywords || []).forEach(k => { if (hits(q, k)) score += 1 + String(k).length / 20; });
      if (SMALL_TALK.test(a.topic || '')) score *= 0.4; // a "hi" inside a real question shouldn't win
      if (score > bestScore) { bestScore = score; best = a; }
    });
    return fill(best ? best.answer : (cfg().fallback || "That's one for the real me — email me at {email} or find me on LinkedIn: {linkedin}"));
  }
  async function aiReply() {
    try {
      const r = await fetch('api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12) }) });
      if (r.ok) return (await r.json()).reply;
    } catch (e) { /* fall through to the written answers */ }
    return null;
  }

  async function send(text, topic) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true;
    $('#chat-input').value = '';
    history.push({ role: 'user', content: text });
    add('user', text);
    const typing = add('assistant', 'typing…', 'typing');
    let reply = cfg().mode === 'ai' && !topic ? await aiReply() : null;
    if (!reply) { await new Promise(r => setTimeout(r, 450)); reply = scripted(text, topic); }
    typing.remove();
    history.push({ role: 'assistant', content: reply });
    add('assistant', reply);
    busy = false;
    $('#chat-input').focus();
  }

  function show() {
    if (open) return;
    open = true;
    $('#chat').classList.remove('hidden');
    $('#chat-fab').classList.add('open'); $('#chat-fab').setAttribute('aria-expanded', 'true');
    gameKeys(false);
    // pause the road while chatting
    const s = G.scene;
    if (s && s.state === 'play') { s.freeze(); pausedGame = s; }
    if (!greeted) {
      greeted = true;
      const hello = cfg().greeting || "Hi! I'm Ekta's AI twin. Ask me anything about my work.";
      history.push({ role: 'assistant', content: hello });
      add('assistant', hello);
      chips();
    }
    setTimeout(() => $('#chat-input').focus(), 50);
  }
  function hide() {
    if (!open) return;
    open = false;
    $('#chat').classList.add('hidden');
    $('#chat-fab').classList.remove('open'); $('#chat-fab').setAttribute('aria-expanded', 'false');
    $('#chat-input').blur();
    gameKeys(true);
    if (pausedGame && pausedGame === G.scene && pausedGame.state === 'frozen' && !UI.isOpen()) pausedGame.unfreeze();
    pausedGame = null;
  }

  function init() {
    const img = Art.portraitURL('smile');
    $('#chat-fab-img').src = img; $('#chat-img').src = img;
    $('#chat-mail').href = 'mailto:' + (profile().email || '');
    const li = profile().linkedin;
    if (li && !/\[FILL/.test(li)) $('#chat-li').href = li; else $('#chat-li').remove();
    $('#chat-fab').addEventListener('click', show);
    $('#chat-close').addEventListener('click', hide);
    $('#chat-form').addEventListener('submit', e => { e.preventDefault(); send($('#chat-input').value); });
    $('#chat').addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Escape') hide(); });
  }

  return { init, show, hide, isOpen: () => open };
})();
