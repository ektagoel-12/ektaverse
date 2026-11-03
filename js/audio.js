'use strict';
/* Sound: 8-bit effects and chiptune loops synthesised with the Web Audio API,
   plus Ekta's recorded voice clips (HTML audio) with music ducking.
   Nothing plays until init() is called from a user gesture. */
const AudioSys = (() => {
  const MUSIC_VOL = 0.1, SFX_VOL = 0.45;
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  let muted = false, seq = null, voice = null;
  const failed = new Set();       // audio URLs that 404'd — don't retry them
  const shortClips = new Set();   // short sfx clips currently playing
  try { muted = localStorage.getItem('sbe-muted') === '1'; } catch (e) { /* private mode */ }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_VOL; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOL; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function osc(t, type, f0, dur, vol, bus, f1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(t, dur, vol, freq, bus, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const now = () => ctx.currentTime;

  const SFX = {
    jump() { osc(now(), 'square', 280, 0.14, 0.16, null, 640); },
    collect() { osc(now(), 'square', 988, 0.07, 0.13); osc(now() + 0.07, 'square', 1480, 0.12, 0.13); },
    stomp() { noise(now(), 0.12, 0.35, 900); osc(now(), 'square', 240, 0.14, 0.18, null, 70); },
    hurt() { osc(now(), 'sawtooth', 520, 0.32, 0.16, null, 110); },
    power() { [523, 659, 784, 1047, 1319].forEach((f, i) => osc(now() + i * 0.06, 'square', f, 0.1, 0.13)); },
    clear() { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]].forEach(([f, t]) => { osc(now() + t, 'square', f, 0.16, 0.14); osc(now() + t, 'triangle', f / 2, 0.16, 0.18); }); },
    chime() { osc(now(), 'triangle', 1318, 0.25, 0.18); osc(now() + 0.1, 'triangle', 1760, 0.35, 0.16); },
    honk() { osc(now(), 'square', 392, 0.24, 0.12); osc(now(), 'square', 466, 0.24, 0.1); osc(now() + 0.28, 'square', 392, 0.2, 0.12); osc(now() + 0.28, 'square', 466, 0.2, 0.1); },
    blip() { osc(now(), 'square', 1200 + Math.random() * 200, 0.025, 0.035); },
    whoosh() { noise(now(), 0.35, 0.25, 600, null, 'lowpass'); },
    secret() { [659, 831, 988, 1319].forEach((f, i) => osc(now() + i * 0.09, 'triangle', f, 0.2, 0.16)); },
  };
  function sfx(name) { if (!ctx || !SFX[name]) return; try { SFX[name](); } catch (e) { /* ignore */ } }

  // ---------- chiptune ----------
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    title: { bpm: 112, lead: 'square', prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], scale: [0, 2, 4, 5, 7, 9, 11], key: 60, seed: 11, density: 0.55 },
    intel: { bpm: 132, lead: 'square', prog: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]], scale: [0, 2, 4, 5, 7, 9, 11], key: 60, seed: 3, density: 0.6 },
    zeta: { bpm: 140, lead: 'square', prog: [[50, 54, 57], [57, 61, 64], [59, 62, 66], [55, 59, 62]], scale: [0, 2, 4, 5, 7, 9, 11], key: 62, seed: 7, density: 0.65 },
    kora: { bpm: 84, lead: 'triangle', prog: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], scale: [0, 2, 4, 5, 7, 9, 11], key: 60, seed: 5, density: 0.4, soft: true },
    silk: { bpm: 152, lead: 'square', prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], scale: [0, 2, 3, 5, 7, 8, 10], key: 57, seed: 13, density: 0.7, drive: true },
    victory: { bpm: 124, lead: 'square', prog: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], scale: [0, 2, 4, 5, 7, 9, 11], key: 60, seed: 21, density: 0.6 },
  };
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function compose(T) {
    const r = rng(T.seed * 9973), bars = 8, steps = bars * 16, mel = new Array(steps).fill(null);
    let last = T.key + 12;
    for (let s = 0; s < steps; s++) {
      const bar = Math.floor(s / 16) % 4, pos = s % 16;
      const strong = pos % 4 === 0, p = strong ? T.density + 0.25 : (pos % 2 === 0 ? T.density - 0.1 : T.density - 0.45);
      const src = Math.floor(s / 16) >= 4 && Math.floor(s / 16) < 7 ? s - 64 : -1;
      if (src >= 0 && r() < 0.75) { mel[s] = mel[src]; continue; }
      if (r() > p) continue;
      const chord = T.prog[bar];
      let n;
      if (strong || r() < 0.55) {
        n = chord[Math.floor(r() * chord.length)] + 12;
        while (n < T.key + 7) n += 12; while (n > T.key + 21) n -= 12;
      } else {
        const deg = T.scale.map(x => T.key + 12 + x).concat(T.scale.map(x => T.key + 24 + x));
        let i = deg.findIndex(x => x >= last); if (i < 0) i = deg.length - 1;
        i = Math.max(0, Math.min(deg.length - 1, i + (r() < 0.5 ? -1 : 1)));
        n = deg[i];
      }
      mel[s] = n; last = n;
    }
    mel[steps - 16] = T.prog[0][0] + 24; // resolve to the root at the turnaround
    return { mel, steps };
  }
  function playStep(T, M, step, t, sd) {
    const pos = step % 16, bar = Math.floor(step / 16) % 4, chord = T.prog[bar];
    const soft = !!T.soft;
    // bass
    if (T.drive ? pos % 2 === 0 : pos % 4 === 0) {
      const n = chord[0] - 12 + (T.drive && pos % 4 === 2 ? 12 : 0);
      osc(t, 'triangle', midi(n), sd * (T.drive ? 1.8 : 3.4), soft ? 0.32 : 0.42, musicBus);
    }
    // arpeggio
    if (pos % 2 === 1 || soft) {
      const n = chord[(pos >> 1) % chord.length] + (soft ? 12 : 0);
      osc(t, soft ? 'sine' : 'square', midi(n), sd * 0.9, soft ? 0.07 : 0.035, musicBus);
    }
    // lead
    const m = M.mel[step % M.steps];
    if (m) osc(t, T.lead, midi(m), sd * (soft ? 3 : 1.6), soft ? 0.13 : 0.08, musicBus);
    // drums
    if (!soft) {
      if (pos === 0 || pos === 8 || (T.drive && pos === 10)) osc(t, 'sine', 140, 0.12, 0.5, musicBus, 45);
      if (pos === 4 || pos === 12) noise(t, 0.1, 0.18, 1800, musicBus);
      if (pos % 2 === 0) noise(t, 0.03, 0.06, 8000, musicBus, 'highpass');
    } else if (pos === 0) {
      noise(t, 0.2, 0.03, 6000, musicBus, 'highpass');
    }
  }
  function music(name) {
    init(); stopMusic();
    if (!ctx || !TRACKS[name]) return;
    const T = TRACKS[name], M = compose(T), sd = 60 / T.bpm / 4;
    let step = 0, next = ctx.currentTime + 0.08;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.15) { playStep(T, M, step, next, sd); step++; next += sd; }
    }, 30);
    seq = { timer, name };
  }
  function stopMusic() { if (seq) { clearInterval(seq.timer); seq = null; } }
  function currentTrack() { return seq && seq.name; }

  // ---------- recorded clips ----------
  function duck(on) {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(MUSIC_VOL * (on ? 0.2 : 1), ctx.currentTime, 0.08);
  }
  function playVoice(url, onMeta) {
    stopVoice();
    if (!url || failed.has(url)) { if (onMeta) onMeta(null); return null; }
    const a = new Audio();
    a.preload = 'auto'; a.muted = muted;
    const h = {
      el: a, playing: false, alive: true, onend: null,
      stop() {
        if (!h.alive) return;
        h.alive = false; h.playing = false;
        a.pause(); duck(false);
        if (voice === h) voice = null;
      },
    };
    a.addEventListener('loadedmetadata', () => { if (h.alive && onMeta) onMeta(a.duration); });
    a.addEventListener('playing', () => { if (!h.alive) return; h.playing = true; duck(true); });
    a.addEventListener('ended', () => { h.playing = false; duck(false); if (h.onend) h.onend(); });
    a.addEventListener('error', () => {
      if (!h.alive) return;
      failed.add(url); h.playing = false; h.failed = true; duck(false);
      if (onMeta) onMeta(null);
    });
    a.src = url;
    const p = a.play();
    if (p && p.catch) p.catch(() => { h.playing = false; duck(false); });
    voice = h;
    return h;
  }
  function stopVoice() { if (voice) voice.stop(); voice = null; }
  function isVoicePlaying() { return !!(voice && voice.playing); }

  /** Ekta's recorded voice effect if one is configured, else the synthesised fallback. */
  function clip(url, fallback) {
    if (!url || failed.has(url)) { if (fallback) sfx(fallback); return; }
    const a = new Audio(url);
    a.muted = muted;
    shortClips.add(a);
    let done = false;
    a.addEventListener('ended', () => shortClips.delete(a));
    a.addEventListener('error', () => { shortClips.delete(a); failed.add(url); if (!done && fallback) { done = true; sfx(fallback); } });
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (!done && fallback) { done = true; sfx(fallback); } });
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('sbe-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    if (voice) voice.el.muted = muted;
    shortClips.forEach(a => { a.muted = muted; });
  }
  function toggleMute() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  return { init, sfx, music, stopMusic, currentTrack, playVoice, stopVoice, isVoicePlaying, clip, toggleMute, setMuted, isMuted };
})();
