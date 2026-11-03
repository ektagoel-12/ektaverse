'use strict';
/* EktaVerse — every sprite, tile and background is drawn here, in code.
   No image files: shapes are rasterised into pixel masks, outlined, then turned
   into canvas textures for Phaser (and data URLs for the DOM overlays). */
const Art = (() => {
  const OUT = '#1a1020';
  const EK = {
    hair: '#2a1712', hairHi: '#5a3426', tie: '#e23b5a', skin: '#d89b6d', skinSh: '#b0744a',
    blush: '#e98676', eye: '#1b1010', mouth: '#8c3b2e', hood: '#2a9d8f', hoodSh: '#1c6e64',
    jeans: '#3554a5', jeansSh: '#253d7d', shoe: '#f4f1ea', shoeSh: '#a39d92', bag: '#e0552d',
    bagSh: '#a63a1c', lap: '#d4dae3', lapSh: '#8a93a3',
    helmet: '#e23b3b', helmetSh: '#a82828', visor: '#34445f',
  };

  // ---------- helpers ----------
  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c, g };
  }
  function R(g, col, x, y, w = 1, h = 1) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function rngOf(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ellG(g, col, cx, cy, rx, ry) {
    g.fillStyle = col;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
      }
  }

  class Mask {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
    get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.d[y * this.w + x]; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(x, y, c);
        }
      return this;
    }
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
      add.forEach(([x, y]) => this.set(x, y, c));
      return this;
    }
    draw(g, ox = 0, oy = 0, s = 1) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        if (c) { g.fillStyle = c; g.fillRect(ox + x * s, oy + y * s, s, s); }
      }
    }
  }
  function blit(src, dst, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c) dst.set(x + ox, y + oy, c);
    }
  }
  function line(m, x0, y0, x1, y1, w, h, col) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) m.rect(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), w, h, col);
  }

  // ---------- tiny 3x5 pixel font for signs and labels ----------
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '>': '100010001010100', '<': '001010100010001', '-': '000000111000000', '!': '010010010000010',
    '?': '110001010000010', '.': '000000000000010', '%': '101001010100101', '+': '000010111010000', "'": '010010000000000',
    ':': '000010000010000', '/': '001001010100100', ' ': '000000000000000',
  };
  function textWidth(str, s = 1) { return str.length * 4 * s - s; }
  function pixText(g, str, x, y, col, s = 1) {
    g.fillStyle = col;
    str.toUpperCase().split('').forEach((ch, i) => {
      const glyph = FONT[ch] || FONT['?'];
      for (let k = 0; k < 15; k++) if (glyph[k] === '1') g.fillRect(x + (i * 4 + (k % 3)) * s, y + Math.floor(k / 3) * s, s, s);
    });
  }
  function labelCanvas(str, fg = '#ffffff', bg = 'rgba(26,16,32,0.85)', s = 1, shadow = null) {
    const w = textWidth(str, s) + 4 * s, h = 9 * s;
    const { c, g } = cv(w, h);
    if (bg) { R(g, bg, s, 0, w - 2 * s, h); R(g, bg, 0, s, w, h - 2 * s); }
    if (shadow) pixText(g, str, 2 * s + s, 2 * s + s, shadow, s);
    pixText(g, str, 2 * s, 2 * s, fg, s);
    return c;
  }

  // ---------- Ekta ----------
  function leg(m, hx, fx, fy, col) {
    for (let y = 23; y <= fy; y++) {
      const t = (y - 23) / Math.max(1, fy - 23);
      m.rect(Math.round(hx + (fx - hx) * t), y, 3, 1, col);
    }
    m.rect(fx, fy + 1, 4, 1, EK.shoe); m.rect(fx, fy + 2, 4, 1, EK.shoeSh);
  }
  function ekta(p) {
    const m = new Mask(32, 32), b = p.bob || 0, C = EK;
    if (!p.seated) leg(m, 14, p.back[0], 29 - p.back[1], C.jeansSh);
    // back arm
    { const hx = 14 + p.barm[0], hy = 15 + b + p.barm[1]; line(m, 14, 15 + b, hx, hy, 2, 2, C.hoodSh); m.rect(hx, hy, 2, 2, C.skinSh); }
    // backpack with the laptop poking out
    m.rect(7, 12 + b, 4, 1, C.lap); m.rect(7, 13 + b, 4, 1, C.lapSh);
    m.rect(7, 14 + b, 5, 8, C.bag); m.rect(7, 20 + b, 5, 2, C.bagSh); m.rect(8, 16 + b, 3, 2, C.bagSh);
    // ponytail
    const pw = p.pony || 0;
    m.rect(10, 5 + b, 2, 3, C.hair);
    m.rect(9 + pw, 7 + b, 2, 3, C.hair); m.rect(8 + pw * 2, 9 + b, 2, 3, C.hair); m.set(8 + pw * 2, 12 + b, C.hair);
    m.set(11, 6 + b, C.tie);
    // hoodie
    m.rect(12, 14 + b, 8, 9, C.hood); m.rect(12, 21 + b, 8, 2, C.hoodSh); m.rect(14, 18 + b, 5, 2, C.hoodSh);
    m.rect(11, 13 + b, 3, 3, C.hoodSh);
    m.rect(13, 14 + b, 1, 7, C.bagSh);
    m.rect(17, 15 + b, 1, 2, '#f4f1ea'); m.rect(19, 15 + b, 1, 2, '#f4f1ea');
    // head
    m.rect(15, 13 + b, 3, 1, C.skinSh);
    m.rect(13, 5 + b, 8, 8, C.skin); m.rect(21, 8 + b, 1, 2, C.skin); m.rect(14, 12 + b, 6, 1, C.skinSh);
    m.rect(12, 3 + b, 9, 2, C.hair); m.rect(12, 5 + b, 4, 6, C.hair); m.rect(16, 5 + b, 5, 1, C.hair); m.rect(19, 6 + b, 2, 1, C.hair);
    m.rect(14, 3 + b, 4, 1, C.hairHi);
    m.rect(15, 8 + b, 1, 2, C.skinSh);
    if (p.eyes === 'closed') m.rect(18, 9 + b, 2, 1, C.eye); else m.rect(19, 8 + b, 1, 2, C.eye);
    m.set(17, 10 + b, C.blush);
    if (p.mouth === 'open') m.rect(19, 11 + b, 2, 1, '#5a1a1a'); else m.set(19, 11 + b, C.mouth);
    if (p.helmet) {
      m.rect(12, 1 + b, 10, 6, C.helmet); m.rect(11, 3 + b, 1, 6, C.helmet); m.rect(13, 1 + b, 4, 1, '#ff8a80');
      m.rect(18, 6 + b, 4, 2, C.visor); m.rect(12, 7 + b, 1, 4, C.helmetSh);
    }
    if (!p.seated) leg(m, 16, p.front[0], 29 - p.front[1], C.jeans);
    if (!p.noFrontArm) {
      const sx = 16, sy = 15 + b, hx = sx + p.farm[0], hy = sy + p.farm[1];
      line(m, sx, sy, hx, hy, 2, 2, C.hood); m.rect(hx, hy, 2, 2, C.skin);
    }
    return m;
  }
  const EKTA_FRAMES = (() => {
    const f = {};
    f.idle0 = { back: [13, 0], front: [17, 0], barm: [-1, 6], farm: [1, 6], bob: 0 };
    f.idle1 = { back: [13, 0], front: [17, 0], barm: [-1, 6], farm: [1, 6], bob: 1, pony: -1 };
    const ff = [[20, 0], [18, 0], [15, 0], [12, 1], [14, 3], [17, 2]];
    const bf = [[12, 1], [14, 3], [17, 2], [20, 0], [18, 0], [15, 0]];
    const fa = [[-3, 5], [-2, 6], [0, 6], [3, 5], [2, 6], [0, 6]];
    const bob = [0, 1, 1, 0, 1, 1], pony = [0, -1, -1, 0, -1, -1];
    for (let i = 0; i < 6; i++) f['run' + i] = { front: ff[i], back: bf[i], farm: fa[i], barm: [-fa[i][0], fa[i][1]], bob: bob[i], pony: pony[i] };
    f.jump = { front: [19, 3], back: [12, 1], farm: [3, -3], barm: [-3, 3], bob: 0, pony: 1 };
    f.fall = { front: [18, 0], back: [13, 1], farm: [4, 1], barm: [-4, 1], bob: 0, mouth: 'open', pony: -1 };
    f.hurt = { front: [15, 0], back: [12, 0], farm: [-3, 2], barm: [-4, 2], bob: 0, eyes: 'closed', mouth: 'open', pony: 1 };
    f.cheer0 = { front: [19, 0], back: [12, 0], farm: [2, -9], barm: [-1, -9], bob: 0, eyes: 'closed', mouth: 'open' };
    f.cheer1 = { front: [19, 0], back: [12, 0], farm: [3, -8], barm: [-2, -8], bob: 1, eyes: 'closed', mouth: 'open', pony: -1 };
    // home-page hello: one hand up, swinging side to side
    f.wave0 = { back: [13, 0], front: [17, 0], barm: [-1, 6], farm: [3, -9], bob: 0, mouth: 'open' };
    f.wave1 = { back: [13, 0], front: [17, 0], barm: [-1, 6], farm: [7, -7], bob: 0, mouth: 'open', pony: -1 };
    return f;
  })();

  function wheel(m, cx, cy, f) {
    m.ell(cx, cy, 4.5, 4.5, '#262626'); m.rect(cx - 1, cy - 1, 2, 2, '#a0a0a0');
    if (f) m.set(cx - 3, cy, '#5a5a5a'); else m.set(cx, cy - 3, '#5a5a5a');
  }
  function scooter(rider, f) {
    const m = new Mask(48, 36), Y = '#ffc21a', Ys = '#d99a00';
    wheel(m, 10, 31, f); wheel(m, 39, 31, f);
    m.ell(14, 25, 9, 5, Y); m.rect(6, 26, 16, 3, Ys);
    m.rect(14, 27, 20, 3, Y); m.rect(14, 29, 20, 1, Ys);
    m.rect(31, 15, 4, 14, Y); m.rect(33, 15, 2, 14, Ys);
    m.rect(34, 24, 8, 3, Y);
    m.rect(29, 13, 7, 2, '#333333');
    m.rect(35, 16, 2, 3, '#fff6b0');
    m.rect(5, 27, 2, 1, '#ff3b30');
    m.rect(7, 21, 14, 2, '#2b2b2b');
    if (rider) {
      const e = ekta({ seated: true, helmet: true, noFrontArm: true, back: [0, 0], front: [0, 0], barm: [3, 5], bob: 0, pony: f ? -1 : 0 });
      blit(e, m, 2, -1);
      m.rect(18, 20, 8, 3, EK.jeans); m.rect(24, 22, 3, 3, EK.jeans); m.rect(24, 25, 5, 2, EK.shoe);
      line(m, 18, 14, 29, 13, 2, 2, EK.hood); m.rect(30, 12, 2, 2, EK.skin);
    } else {
      m.rect(18, 32, 1, 4, '#555555');
    }
    return m.outline(OUT);
  }

  function portrait(expr) {
    const m = new Mask(32, 32), C = EK;
    m.ell(16, 32, 14, 9, C.hood);
    m.rect(7, 25, 2, 7, C.bag); m.rect(23, 25, 2, 7, C.bag);
    m.rect(11, 23, 10, 3, C.hoodSh);
    m.rect(13, 25, 1, 4, '#f4f1ea'); m.rect(18, 25, 1, 4, '#f4f1ea');
    m.rect(13, 20, 6, 4, C.skinSh);
    m.ell(16, 12, 10, 10.5, C.hair);
    m.rect(24, 3, 3, 3, C.tie); m.rect(25, 0, 4, 4, C.hair);
    m.ell(16, 14, 7.5, 8.5, C.skin);
    m.rect(8, 4, 16, 4, C.hair); m.rect(9, 8, 5, 2, C.hair); m.rect(14, 8, 3, 1, C.hair); m.rect(19, 8, 5, 1, C.hair); m.rect(22, 9, 2, 1, C.hair);
    m.rect(7, 8, 2, 11, C.hair); m.rect(23, 8, 2, 11, C.hair);
    m.rect(11, 5, 6, 1, C.hairHi);
    m.set(16, 16, C.skinSh); m.set(15, 17, C.skinSh);
    m.set(11, 17, C.blush); m.set(21, 17, C.blush);
    if (expr === 'laugh') {
      [[11, 13], [12, 12], [13, 13], [19, 13], [20, 12], [21, 13]].forEach(([x, y]) => m.set(x, y, C.eye));
      m.rect(13, 18, 6, 3, '#6b1f1f'); m.rect(14, 18, 4, 1, '#ffffff'); m.rect(15, 20, 2, 1, '#e46a6a');
      m.rect(11, 10, 3, 1, C.hair); m.rect(19, 10, 3, 1, C.hair);
    } else if (expr === 'think') {
      m.rect(12, 12, 2, 2, C.eye); m.rect(12, 14, 2, 1, '#ffffff'); m.rect(19, 12, 2, 2, C.eye); m.rect(19, 14, 2, 1, '#ffffff');
      m.rect(11, 10, 3, 1, C.hair); m.rect(19, 9, 3, 1, C.hair);
      m.rect(15, 19, 3, 1, C.mouth);
      m.rect(18, 21, 5, 3, C.skin); m.rect(18, 24, 6, 8, C.hood);
    } else {
      m.rect(12, 12, 2, 3, C.eye); m.set(12, 12, '#ffffff'); m.rect(19, 12, 2, 3, C.eye); m.set(19, 12, '#ffffff');
      m.rect(11, 10, 3, 1, C.hair); m.rect(19, 10, 3, 1, C.hair);
      m.set(13, 18, C.mouth); m.rect(14, 19, 4, 1, C.mouth); m.set(18, 18, C.mouth);
    }
    return m.outline(OUT);
  }

  // ---------- home-page Ekta: a bigger, waist-up portrait drawn from her photo ----------
  // long wavy dark hair with burgundy streaks, black glasses, black sleeveless turtleneck, dark jeans
  const HE = {
    hair: '#2b1015', hairMid: '#561c26', hairHi: '#83303d', skin: '#b97a57', skinSh: '#955c3e', skinHi: '#cf9572',
    blush: '#c86a5c', eye: '#140c0c', mouth: '#6e2424', teeth: '#fbf6f0', frame: '#121014',
    top: '#1d1b22', topHi: '#34303d', topSh: '#0f0e13', jeans: '#28334d', jeansHi: '#3a4868', silver: '#dcdde6',
  };
  function hairStrand(m, y0, y1, x, w, dir, sway, phase) {
    // a wavy lock of hair hanging from y0 to y1; dir -1 flares left, +1 flares right
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const off = Math.round(Math.sin((y + phase) / 2.6) * 1.2 + dir * t * 2 + sway * t * 1.5);
      const ww = Math.max(2, Math.round(w * (1 - t * 0.35)));
      for (let i = 0; i < ww; i++) {
        // dark edges, burgundy middle, and a highlight on the crest of each wave
        const crest = Math.sin((y + phase) / 2.6) > 0.75;
        const col = i === 0 || i === ww - 1 ? HE.hair : (crest && i === 1 + (y % 2)) ? HE.hairHi : (i % 3 === 1 ? HE.hairMid : HE.hair);
        m.set(x + off + i, y, col);
      }
    }
  }
  function heroEkta({ arm = 'down', blink = false, sway = 0 } = {}) {
    const m = new Mask(52, 66), C = HE, cx = 26;
    // hair behind the body
    m.ell(cx, 20, 13, 13, C.hair);
    hairStrand(m, 22, 54, 11, 8, -1, sway, 0);
    hairStrand(m, 22, 54, 33, 8, 1, sway, 2);
    // torso: black sleeveless turtleneck
    m.ell(cx, 41, 11, 6, C.top);
    m.rect(cx - 10, 41, 20, 17, C.top);
    m.rect(cx - 10, 41, 2, 17, C.topSh); m.rect(cx + 8, 41, 2, 17, C.topSh);
    m.rect(cx - 4, 33, 8, 6, C.top); m.rect(cx - 4, 33, 8, 1, C.topHi); m.rect(cx - 4, 36, 8, 1, C.topSh);
    m.rect(cx - 6, 43, 3, 1, C.topHi); m.rect(cx + 3, 46, 2, 1, C.topHi);
    // jeans
    m.rect(cx - 10, 58, 20, 8, C.jeans); m.rect(cx - 10, 58, 20, 1, C.jeansHi);
    m.rect(cx - 1, 59, 1, 7, C.jeansHi); m.rect(cx - 7, 60, 4, 1, C.jeansHi);
    // bare shoulders and the arm that stays down (her right, viewer's left)
    m.ell(cx - 11, 40, 3.5, 3, C.skin); m.ell(cx + 11, 40, 3.5, 3, C.skin);
    line(m, cx - 13, 41, cx - 13, 51, 3, 1, C.skin); m.rect(cx - 13, 41, 1, 10, C.skinSh);
    line(m, cx - 12, 52, cx - 3, 56, 3, 3, C.skin);
    m.rect(cx - 11, 51, 3, 1, C.silver); // bracelet
    if (arm === 'down') {
      // hands clasped at the waist, like the photo
      line(m, cx + 13, 41, cx + 13, 51, 3, 1, C.skin); m.rect(cx + 15, 41, 1, 10, C.skinSh);
      line(m, cx + 12, 52, cx + 2, 56, 3, 3, C.skin);
      m.rect(cx - 3, 55, 6, 3, C.skin); m.rect(cx - 1, 55, 1, 3, C.skinSh);
    } else {
      const hand = arm === 'up0' ? [cx + 18, 20] : [cx + 21, 23];
      const elbow = [cx + 17, 33];
      line(m, cx + 12, 40, elbow[0], elbow[1], 3, 3, C.skin);
      line(m, elbow[0], elbow[1], hand[0], hand[1] + 2, 3, 3, C.skin);
      m.rect(hand[0] - 1, hand[1] - 2, 5, 5, C.skin);                        // palm
      m.rect(hand[0] - 1, hand[1] - 4, 1, 2, C.skin); m.rect(hand[0] + 1, hand[1] - 5, 1, 3, C.skin);
      m.rect(hand[0] + 3, hand[1] - 4, 1, 2, C.skin);                         // fingers
      m.rect(hand[0] + 3, hand[1] - 1, 2, 2, C.skin);                         // thumb
      m.rect(hand[0] - 1, hand[1] + 2, 5, 1, C.skinSh);
      // the other hand rests at the waist
      m.rect(cx - 3, 55, 4, 3, C.skin);
    }
    // face
    m.rect(cx - 2, 30, 4, 3, C.skinSh);
    m.ell(cx, 21, 8, 9.5, C.skin);
    m.rect(cx + 6, 22, 1, 5, C.skinSh);
    m.set(cx - 9, 21, C.skin); m.set(cx + 8, 21, C.skinSh); // ears
    // hair on top: centre parting, sweeping down both sides of the face
    m.ell(cx, 13, 9.5, 5.5, C.hair);
    m.rect(cx - 9, 13, 4, 15, C.hair); m.rect(cx + 6, 13, 4, 15, C.hair);
    m.rect(cx - 7, 14, 3, 3, C.hair); m.rect(cx + 4, 14, 3, 3, C.hair);
    // waves on the crown, swept away from the parting
    [[-7, 11], [-5, 9], [-3, 8], [2, 8], [4, 9], [6, 11]].forEach(([dx, y]) => m.rect(cx + dx, y, 2, 1, C.hairMid));
    m.rect(cx - 6, 10, 1, 1, C.hairHi); m.rect(cx + 5, 10, 1, 1, C.hairHi);
    m.rect(cx - 8, 16, 1, 10, C.hairMid); m.rect(cx + 8, 16, 1, 10, C.hairMid); m.set(cx - 8, 19, C.hairHi); m.set(cx + 8, 22, C.hairHi);
    // front locks falling over the shoulders
    hairStrand(m, 26, 50, cx - 12, 4, -1, sway, 1);
    hairStrand(m, 26, 48, cx + 8, 4, 1, sway, 3);
    // brows, glasses, eyes
    m.rect(cx - 6, 16, 4, 1, C.hair); m.rect(cx + 2, 16, 4, 1, C.hair);
    [[cx - 7, 18], [cx + 1, 18]].forEach(([x, y]) => {
      m.rect(x, y, 6, 1, C.frame); m.rect(x, y + 3, 6, 1, C.frame);
      m.rect(x, y, 1, 4, C.frame); m.rect(x + 5, y, 1, 4, C.frame); m.rect(x + 1, y, 4, 1, C.frame);
      if (blink) m.rect(x + 2, y + 2, 2, 1, C.eye);
      else { m.rect(x + 2, y + 1, 2, 2, C.eye); m.set(x + 2, y + 1, '#ffffff'); }
    });
    m.rect(cx - 1, 19, 2, 1, C.frame);
    m.set(cx - 8, 18, C.frame); m.set(cx + 7, 18, C.frame);
    // nose, blush, big smile
    m.set(cx, 23, C.skinSh); m.set(cx - 1, 24, C.skinSh);
    m.rect(cx - 6, 24, 2, 1, C.blush); m.rect(cx + 4, 24, 2, 1, C.blush);
    m.rect(cx - 3, 26, 6, 1, C.mouth); m.rect(cx - 2, 26, 4, 1, C.teeth); m.rect(cx - 2, 27, 4, 1, C.mouth);
    m.set(cx - 4, 25, C.mouth); m.set(cx + 3, 25, C.mouth);
    return m.outline(OUT);
  }

  // ---------- bugs (enemies) ----------
  function eyes(m, x1, y1, x2, y2) {
    [[x1, y1], [x2, y2]].forEach(([x, y]) => { m.rect(x, y, 2, 3, '#ffffff'); m.rect(x, y + 1, 1, 2, '#111111'); });
  }
  function feet(m, f, col) { const o = f ? 1 : 0; m.rect(4 + o, 15, 3, 1, col); m.rect(11 - o, 15, 3, 1, col); }
  function bug(type, f) {
    const m = new Mask(18, 16);
    if (type === 'null') {
      const s = f ? 0.6 : 0;
      m.ell(9, 10 + s / 2, 7 + s, 5.5 - s / 2, '#9b5de5'); m.rect(5, 7, 3, 1, '#c99bff'); m.set(4, 8, '#c99bff');
      eyes(m, 6, 8, 11, 8); m.rect(8, 13, 3, 1, '#5a2a8a');
      feet(m, f, '#6a3aa8');
    } else if (type === 'crash') {
      const o = f ? 1 : 0;
      m.ell(9, 10, 6, 5, '#e2453c');
      [[4, 4 + o], [9, 2 + o], [14, 4 + o], [2, 9], [15, 9]].forEach(([x, y]) => { m.rect(x, y, 2, 2, '#ff8c7a'); m.set(x, y - 1, '#ffd0c8'); });
      m.rect(5, 7, 3, 1, OUT); m.rect(11, 7, 3, 1, OUT);
      eyes(m, 6, 8, 11, 8);
      m.set(7, 13, OUT); m.set(8, 12, OUT); m.set(9, 13, OUT); m.set(10, 12, OUT); m.set(11, 13, OUT);
      feet(m, f, '#a8261e');
    } else if (type === 'merge') {
      const o = f ? 1 : 0;
      m.ell(5.5, 7 - o, 4, 4, '#3fbf5f'); m.ell(12.5, 7 + o - 1, 4, 4, '#ff8c42');
      m.rect(3, 10, 6, 5, '#3fbf5f'); m.rect(9, 10, 6, 5, '#ff8c42');
      m.set(9, 11, '#ffffff'); m.set(8, 12, '#ffffff'); m.set(9, 13, '#ffffff');
      m.rect(4, 6 - o, 2, 2, '#ffffff'); m.set(4, 7 - o, '#111111');
      m.rect(12, 6 + o - 1, 2, 2, '#ffffff'); m.set(13, 6 + o, '#111111');
      feet(m, f, '#2a8a40');
    } else {
      m.ell(9, 8, 6, 6, '#7fd6e0'); m.rect(3, 8, 13, 6, '#7fd6e0'); m.rect(5, 5, 2, 1, '#c8f5fa');
      for (let x = 3; x < 16; x += 3) m.set(x + (f ? 1 : 0), 13, null);
      [[6, 7], [11, 7]].forEach(([x, y]) => { m.set(x, y, '#1b3a40'); m.set(x + 1, y + 1, '#1b3a40'); m.set(x + 1, y, '#1b3a40'); m.set(x, y + 1, '#1b3a40'); });
      m.rect(8, 10, 3, 1, '#1b3a40');
      if (f) for (let y = 5; y <= 7; y++) { for (let x = 17; x > 0; x--) m.set(x, y, m.get(x - 1, y)); m.set(0, y, null); }
    }
    return m.outline(OUT);
  }

  // ---------- items & props ----------
  function chai(f) {
    const m = new Mask(12, 16);
    for (let y = 5; y <= 14; y++) { const inset = Math.floor((y - 5) / 4); m.rect(2 + inset, y, 8 - inset * 2, 1, '#e3f1f6'); }
    for (let y = 7; y <= 13; y++) { const inset = Math.floor((y - 5) / 4); m.rect(3 + inset, y, 6 - inset * 2, 1, '#b8682f'); }
    m.rect(3, 6, 6, 1, '#e8b97c'); m.rect(4, 8, 1, 4, '#d48a4a');
    const st = f ? [[4, 3], [5, 2], [4, 1], [7, 4], [8, 3], [7, 2]] : [[5, 4], [4, 3], [5, 2], [8, 3], [7, 2], [8, 1]];
    st.forEach(([x, y]) => m.set(x, y, '#ffffff'));
    m.outline(OUT);
    st.forEach(([x, y]) => m.set(x, y, '#ffffff'));
    return m;
  }
  function comma() {
    const m = new Mask(12, 16), Y = '#ffe14d';
    m.ell(6, 5, 3.6, 3.6, Y); m.rect(7, 8, 2, 2, Y); m.rect(6, 10, 2, 2, Y); m.rect(4, 12, 2, 1, Y);
    m.set(5, 3, '#ffffff'); m.set(4, 4, '#fff6b0');
    return m.outline('#8a5a00');
  }
  function helmet() {
    const m = new Mask(16, 14);
    m.ell(8, 9, 7, 7, EK.helmet);
    for (let y = 11; y < 14; y++) m.rect(0, y, 16, 1, null);
    m.rect(1, 9, 14, 2, EK.helmetSh); m.rect(9, 6, 5, 3, EK.visor); m.rect(4, 4, 3, 1, '#ff9a90');
    return m.outline(OUT);
  }
  function signal(state) {
    const m = new Mask(16, 48);
    m.rect(7, 20, 2, 28, '#5e626d');
    for (let y = 26; y < 46; y += 6) m.rect(7, y, 2, 3, '#ffcc1f');
    m.rect(5, 46, 6, 2, '#3a3d45');
    m.rect(3, 0, 10, 22, '#2a2a2e'); m.rect(2, 2, 1, 18, '#2a2a2e'); m.rect(13, 2, 1, 18, '#2a2a2e');
    m.ell(8, 4.5, 2.6, 2.6, state === 'red' ? '#ff3b30' : '#5a1a18');
    m.ell(8, 11, 2.6, 2.6, '#5a4a10');
    m.ell(8, 17.5, 2.6, 2.6, state === 'green' ? '#3dff6e' : '#163a20');
    if (state === 'red') m.set(7, 3, '#ffb3ad'); else m.set(7, 16, '#c8ffd6');
    return m.outline(OUT);
  }
  function car(col, sh) {
    const m = new Mask(32, 18);
    m.rect(1, 8, 30, 6, col); m.rect(1, 12, 30, 2, sh);
    m.rect(7, 2, 17, 7, col);
    m.rect(9, 3, 6, 5, '#9fd3ff'); m.rect(16, 3, 6, 5, '#9fd3ff'); m.set(10, 3, '#e6f6ff'); m.set(17, 3, '#e6f6ff');
    m.rect(30, 9, 1, 2, '#fff6b0'); m.rect(1, 9, 1, 2, '#ff3b30');
    m.ell(8, 15, 3, 3, '#222222'); m.ell(24, 15, 3, 3, '#222222'); m.set(8, 15, '#999999'); m.set(24, 15, '#999999');
    return m.outline(OUT);
  }
  function auto(f) {
    const m = new Mask(34, 28), Gr = '#2a9d4b', Y = '#ffcc1f';
    m.rect(4, 2, 22, 4, '#1f1f1f'); m.rect(3, 3, 1, 3, '#1f1f1f');
    m.rect(4, 6, 3, 12, Y); m.rect(7, 6, 15, 2, Y);
    m.rect(22, 6, 5, 9, '#9fd3ff'); m.set(23, 7, '#e6f6ff');
    m.rect(14, 9, 5, 6, '#5a3a2a'); m.rect(15, 7, 3, 3, '#3a2418');
    m.rect(3, 16, 26, 6, Gr); m.rect(26, 8, 5, 14, Gr); m.rect(29, 15, 2, 2, '#fff6b0');
    m.rect(3, 19, 26, 1, Y);
    wheel(m, 8, 23, f); wheel(m, 27, 23, f);
    return m.outline(OUT);
  }
  function bus() {
    const m = new Mask(96, 42), Rd = '#d6322b', Bl = '#2b4fa8';
    m.rect(1, 3, 94, 32, Rd); m.rect(3, 1, 90, 3, '#e8e8e8');
    m.rect(1, 23, 94, 4, Bl);
    for (let i = 0; i < 7; i++) { m.rect(6 + i * 11, 8, 9, 11, '#9fd3ff'); m.set(7 + i * 11, 9, '#e6f6ff'); }
    m.rect(84, 8, 9, 22, '#9fd3ff'); m.rect(86, 4, 7, 3, '#ffcc1f');
    m.rect(93, 28, 2, 3, '#fff6b0'); m.rect(1, 28, 2, 3, '#ff3b30');
    m.ell(18, 36, 5, 5, '#222222'); m.ell(76, 36, 5, 5, '#222222'); m.rect(17, 35, 2, 2, '#999999'); m.rect(75, 35, 2, 2, '#999999');
    return m.outline(OUT);
  }
  function stopSign() {
    const { c, g } = cv(40, 48);
    R(g, OUT, 18, 16, 4, 32); R(g, '#6b6f7a', 19, 16, 2, 32);
    R(g, OUT, 0, 0, 40, 18); R(g, '#2fb36b', 1, 1, 38, 16); R(g, '#ffffff', 2, 2, 36, 1); R(g, '#ffffff', 2, 14, 36, 1);
    pixText(g, 'NEXT STOP', 3, 4, '#ffffff'); pixText(g, '--->', 13, 9 + 0, '#ffe14d');
    return c;
  }


  // Experience mushroom: teal cap, cream spots, no face.
  function mushroom() {
    const m = new Mask(14, 14), CAP = '#3fb6a8', SH = '#257a70', SP = '#fff1d0';
    m.ell(7, 6, 6.5, 5.5, CAP);
    for (let y = 8; y < 14; y++) m.rect(0, y, 14, 1, null);
    m.rect(1, 7, 12, 1, SH);
    m.rect(3, 2, 2, 2, SP); m.rect(8, 1, 2, 2, SP); m.rect(10, 4, 2, 2, SP); m.set(6, 5, SP);
    m.rect(4, 8, 6, 5, '#f4e6c8'); m.rect(8, 8, 2, 5, '#d8c4a0'); m.rect(5, 9, 1, 2, '#c9a77a');
    return m.outline(OUT);
  }
  // End-of-level gate: a sandstone gateway with domed towers and a name board over the arch.
  function gate(name) {
    const W = 112, H = 96, { c, g } = cv(W, H);
    const ST = '#cdb68a', SH = '#a8916a', DK = '#7d6a4c', DOME = '#d9774a', DOMEH = '#f09a6a', GOLD = '#ffcc1f';
    const tower = x => {
      R(g, OUT, x - 1, 27, 22, 69); R(g, ST, x, 28, 20, 68); R(g, SH, x + 15, 28, 5, 68);
      for (let y = 40; y < 90; y += 18) { R(g, OUT, x + 6, y - 1, 8, 12); R(g, '#3a2a30', x + 7, y, 6, 10); R(g, '#ffcf6b', x + 8, y + 4, 4, 5); ellG(g, ST, x + 10, y, 3, 2); }
      ellG(g, OUT, x + 10, 22, 10, 9); ellG(g, DOME, x + 10, 22, 9, 8); ellG(g, DOMEH, x + 7, 19, 3, 3);
      R(g, OUT, x - 1, 27, 22, 2); R(g, DK, x, 27, 20, 1);
      R(g, GOLD, x + 9, 8, 2, 6); R(g, GOLD, x + 8, 12, 4, 1);
    };
    // central block
    R(g, OUT, 23, 37, 66, 59); R(g, ST, 24, 38, 64, 58); R(g, SH, 80, 38, 8, 58);
    for (let y = 46; y < 96; y += 8) for (let x = (y % 16 === 6 ? 24 : 30); x < 80; x += 12) R(g, SH, x, y, 5, 1);
    // scalloped parapet
    for (let x = 24; x < 88; x += 8) { ellG(g, OUT, x + 4, 37, 4, 3); ellG(g, ST, x + 4, 37, 3, 2); }
    // arched doorway
    ellG(g, OUT, 56, 74, 14, 14); R(g, OUT, 42, 74, 28, 22);
    ellG(g, '#2a1a24', 56, 74, 12, 12); R(g, '#2a1a24', 44, 74, 24, 22);
    R(g, '#3d2733', 46, 78, 2, 18); R(g, '#3d2733', 64, 78, 2, 18);
    // central dome and flag
    ellG(g, OUT, 56, 30, 12, 9); ellG(g, DOME, 56, 30, 11, 8); ellG(g, DOMEH, 52, 27, 3, 3);
    R(g, GOLD, 55, 8, 2, 14); R(g, '#e23b5a', 57, 8, 9, 5); R(g, '#ff8aa0', 57, 8, 9, 1);
    tower(4); tower(88);
    // name board
    const s = gateScale(name), bw = Math.max(textWidth(name, s) + 8, 30), bx = 56 - bw / 2;
    R(g, OUT, bx - 1, 41, bw + 2, 12 + (s - 1) * 5); R(g, '#1f5f6a', bx, 42, bw, 10 + (s - 1) * 5); R(g, '#2c7f8c', bx, 42, bw, 1);
    pixText(g, name, bx + 4, 44, '#fff1dc', s);
    return c;
  }
  function gateScale(name) { return textWidth(name, 2) + 8 <= 56 ? 2 : 1; }


  // Opening scene: Ekta's college — red brick, white columns, a clock tower and her college's name on the frieze.
  function college(name) {
    const W = 128, H = 112, { c, g } = cv(W, H);
    const BR = '#a8473a', BRD = '#8a362c', CR = '#efe2c4', CRD = '#cdbf9e', COL = '#f4ecd8', COLD = '#cfc5ae';
    // clock tower
    R(g, OUT, 49, 5, 30, 42); R(g, BR, 50, 6, 28, 41); R(g, BRD, 72, 6, 6, 41);
    for (let y = 0; y < 7; y++) R(g, OUT, 48 + y * 2, 6 - y, 32 - y * 4, 1);
    for (let y = 1; y < 7; y++) R(g, '#4a4f63', 49 + y * 2, 6 - y, 30 - y * 4, 1);
    R(g, '#ffcc1f', 63, 0, 2, 2);
    ellG(g, OUT, 64, 20, 8, 8); ellG(g, '#fff8e6', 64, 20, 7, 7);
    R(g, OUT, 63, 15, 2, 6); R(g, OUT, 64, 19, 5, 2);
    // main hall
    R(g, OUT, 3, 51, 122, 61); R(g, BR, 4, 52, 120, 60);
    for (let y = 56; y < 106; y += 5) for (let x = (y % 10 === 1 ? 4 : 9); x < 124; x += 10) R(g, BRD, x, y, 6, 1);
    // pediment and frieze with the name
    for (let y = 0; y < 14; y++) { R(g, OUT, 34 + y * 2 - 1, 30 + y, 62 - y * 4 + 2, 1); }
    for (let y = 1; y < 14; y++) R(g, CR, 34 + y * 2, 30 + y, 62 - y * 4, 1);
    R(g, OUT, 0, 43, 128, 12); R(g, CR, 1, 44, 126, 10); R(g, CRD, 1, 52, 126, 2);
    const tw = textWidth(name);
    pixText(g, name, Math.round(64 - tw / 2), 46, '#6a2a20');
    // windows on the wings
    [10, 22, 94, 106].forEach(x => [60, 80].forEach(y => { R(g, OUT, x - 1, y - 1, 10, 15); R(g, '#ffd98a', x, y, 8, 13); R(g, '#e8a640', x, y + 6, 8, 1); R(g, '#e8a640', x + 4, y, 1, 13); }));
    // columns and the doorway
    [38, 48, 76, 86].forEach(x => { R(g, OUT, x - 1, 55, 6, 52); R(g, COL, x, 56, 4, 50); R(g, COLD, x + 3, 56, 1, 50); R(g, COL, x - 1, 55, 6, 2); });
    ellG(g, OUT, 64, 82, 10, 10); R(g, OUT, 54, 82, 20, 24);
    ellG(g, '#2a1a24', 64, 82, 8, 8); R(g, '#2a1a24', 56, 82, 16, 24);
    // steps
    for (let i = 0; i < 3; i++) { R(g, OUT, 28 - i * 4, 105 + i * 2, 72 + i * 8, 1); R(g, '#bdb5a5', 28 - i * 4, 106 + i * 2, 72 + i * 8, 1); }
    return c;
  }
  // Graduation cap (mortarboard with a gold tassel) and the rolled-up degree.
  function gradCap() {
    const m = new Mask(16, 9), K = '#1d1a24', KH = '#3a3448';
    m.rect(1, 1, 14, 2, K); m.rect(2, 0, 12, 1, KH); m.rect(0, 2, 16, 1, K);
    m.rect(4, 3, 8, 4, K); m.rect(5, 3, 6, 1, KH);
    m.set(8, 1, '#ffcc1f'); m.rect(13, 3, 1, 4, '#ffcc1f'); m.rect(12, 7, 3, 1, '#ffcc1f');
    return m.outline(OUT);
  }
  function degree() {
    const m = new Mask(12, 6);
    m.rect(1, 1, 10, 4, '#fff8e6'); m.rect(0, 1, 1, 4, '#e8d8b0'); m.rect(11, 1, 1, 4, '#e8d8b0');
    m.rect(5, 0, 2, 6, '#e23b3b');
    return m.outline(OUT);
  }

  // ---------- tiles ----------
  function groundTex(theme) {
    const { c, g } = cv(32, 32), r = rngOf(theme.length * 977);
    if (theme === 'intel') {
      R(g, '#c2bbad', 0, 0, 32, 32);
      for (let y = 4; y < 32; y += 7) { R(g, '#a39b8c', 0, y, 32, 1); for (let x = (y % 14 === 4 ? 0 : 8); x < 32; x += 16) R(g, '#a39b8c', x, y, 1, 7); }
      R(g, '#4cb35e', 0, 0, 32, 4); R(g, '#82dc8c', 0, 0, 32, 1); R(g, '#358a45', 0, 4, 32, 1);
      for (let i = 0; i < 6; i++) R(g, '#358a45', Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1, 2);
    } else if (theme === 'zeta') {
      R(g, '#4a4a55', 0, 0, 32, 32);
      R(g, '#d9d9d9', 0, 0, 32, 3); R(g, '#a6a6a6', 0, 3, 32, 2);
      for (let i = 0; i < 18; i++) R(g, r() < 0.5 ? '#5a5a66' : '#3c3c46', Math.floor(r() * 32), 6 + Math.floor(r() * 26));
      R(g, '#ffcc1f', 6, 18, 14, 2);
    } else if (theme === 'kora') {
      R(g, '#8a4430', 0, 0, 32, 32);
      for (let y = 4; y < 32; y += 7) for (let x = (y % 14 === 4 ? 0 : 4); x < 32; x += 8) R(g, ['#c86b4a', '#d4805e', '#b85e40'][Math.floor(r() * 3)], x, y, 7, 6);
      R(g, '#e8a07a', 0, 0, 32, 3); R(g, '#f5c39f', 0, 0, 32, 1); R(g, '#8a4430', 0, 3, 32, 1);
    } else {
      R(g, '#5a5048', 0, 0, 32, 32);
      for (let x = 0; x < 32; x += 8) R(g, (x / 8) % 2 ? '#222222' : '#ffcc1f', x, 0, 8, 4);
      R(g, '#3a332e', 0, 4, 32, 1);
      for (let i = 0; i < 26; i++) R(g, r() < 0.5 ? '#8a7a68' : '#463e37', Math.floor(r() * 32), 6 + Math.floor(r() * 26));
      R(g, '#3a332e', 20, 12, 1, 3); R(g, '#3a332e', 21, 15, 1, 2); R(g, '#3a332e', 19, 15, 1, 1);
    }
    return c;
  }
  function pitTex() {
    const { c, g } = cv(16, 32), r = rngOf(7);
    R(g, '#1a0f14', 0, 0, 16, 32);
    for (let x = 0; x < 16; x++) R(g, '#3a2a22', x, 0, 1, 2 + Math.floor(r() * 3));
    for (let i = 0; i < 6; i++) R(g, '#2c1d1a', Math.floor(r() * 16), 6 + Math.floor(r() * 24));
    return c;
  }
  function platTex(type) {
    const { c, g } = cv(16, 8);
    if (type === 'glass') {
      R(g, '#7fd8f5', 0, 0, 16, 8); R(g, '#c9f2ff', 0, 0, 16, 1); R(g, '#4aa8c9', 0, 6, 16, 2); R(g, '#5a6b7a', 15, 0, 1, 8);
      R(g, '#e6fbff', 3, 2, 1, 1); R(g, '#e6fbff', 4, 3, 1, 1);
    } else if (type === 'crate') {
      R(g, '#b5773a', 0, 0, 16, 8); R(g, '#7a4a1f', 0, 0, 16, 1); R(g, '#7a4a1f', 0, 4, 16, 1); R(g, '#7a4a1f', 0, 7, 16, 1);
      R(g, '#7a4a1f', 15, 0, 1, 8); R(g, '#d99a5a', 0, 1, 15, 1); R(g, '#e2453c', 5, 5, 5, 2);
    } else if (type === 'awning') {
      for (let x = 0; x < 16; x += 4) R(g, (x / 4) % 2 ? '#fff1dc' : '#e2453c', x, 1, 4, 6);
      R(g, '#6b4a2a', 0, 0, 16, 1);
      for (let x = 0; x < 16; x += 4) R(g, (x / 4) % 2 ? '#fff1dc' : '#e2453c', x + 1, 7, 2, 1);
    } else if (type === 'flyover') {
      R(g, '#a39686', 0, 0, 16, 8); R(g, '#6f6458', 0, 0, 16, 2); R(g, '#c2b6a6', 0, 2, 16, 1);
      for (let x = 0; x < 16; x += 4) R(g, (x / 4) % 2 ? '#222222' : '#ffcc1f', x, 6, 4, 2);
    } else {
      R(g, '#b9b2a6', 0, 0, 16, 8); R(g, '#d6d0c6', 0, 0, 16, 1); R(g, '#8f877b', 0, 6, 16, 2);
      R(g, '#6f685e', 3, 3, 1, 1); R(g, '#6f685e', 12, 3, 1, 1);
    }
    return c;
  }
  function pillarTex() {
    const { c, g } = cv(16, 16);
    R(g, '#8f877b', 0, 0, 16, 16); R(g, '#6f685e', 0, 0, 2, 16); R(g, '#b0a89c', 13, 0, 3, 16); R(g, '#6f685e', 0, 15, 16, 1);
    return c;
  }

  // ---------- background painters ----------
  const BW = 512;
  function sky(g, cols, y0 = 0, y1 = 270) {
    const n = cols.length, h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) R(g, cols[i], 0, Math.round(y0 + i * h), BW, Math.ceil(h) + 1);
    for (let i = 1; i < n; i++) {
      const yb = Math.round(y0 + i * h);
      g.fillStyle = cols[i];
      for (let x = 0; x < BW; x += 2) g.fillRect(x + ((yb - 1) & 1), yb - 1, 1, 1);
      for (let x = 0; x < BW; x += 4) g.fillRect(x + ((yb - 2) & 2), yb - 2, 1, 1);
    }
  }
  function sun(g, x, y, r, col, glow) {
    if (glow) ellG(g, glow, x, y, r + 5, r + 5);
    ellG(g, col, x, y, r, r);
  }
  function clouds(g, r, col, n, yMax = 90) {
    for (let i = 0; i < n; i++) {
      const x = 20 + r() * 440, y = 15 + r() * yMax, w = 18 + r() * 26;
      ellG(g, col, x, y, w, 5); ellG(g, col, x - w / 3, y - 3, w / 2.5, 5); ellG(g, col, x + w / 4, y - 4, w / 3, 5);
    }
  }
  function stars(g, r, n, col) { for (let i = 0; i < n; i++) R(g, col, Math.floor(r() * BW), Math.floor(r() * 110)); }
  function skyline(g, r, base, o) {
    let x = -4;
    while (x < BW) {
      const w = o.minW + Math.floor(r() * (o.maxW - o.minW)), h = o.minH + Math.floor(r() * (o.maxH - o.minH));
      R(g, o.col, x, base - h, w, h);
      if (o.tank && r() < 0.4) { R(g, o.col, x + 4, base - h - 6, 6, 6); R(g, o.col, x + 3, base - h - 7, 8, 1); }
      if (o.antenna && r() < 0.3) R(g, o.col, x + Math.floor(w / 2), base - h - 8, 1, 8);
      if (o.win) for (let wy = base - h + 4; wy < base - 4; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r() < (o.lit || 0.3)) R(g, o.win, wx, wy, 2, 3);
      x += w + Math.floor(r() * 5);
    }
  }
  function glassTower(g, x, base, w, h, col, hi, dark) {
    R(g, col, x, base - h, w, h);
    for (let i = x + 5; i < x + w; i += 6) R(g, dark, i, base - h, 1, h);
    for (let y = base - h + 6; y < base; y += 8) R(g, dark, x, y, w, 1);
    for (let i = 0; i < Math.min(w, h); i++) if (x + w - 6 - i > x) R(g, hi, x + w - 6 - i, base - h + 4 + i * 2, 2, 2);
    R(g, dark, x - 1, base - h - 2, w + 2, 2); R(g, dark, x + Math.floor(w / 3), base - h - 10, 1, 8);
  }
  function palm(g, x, base, h) {
    for (let i = 0; i < h; i++) { const xx = x + Math.round(Math.sin(i / h * 1.3) * 4); R(g, i % 4 ? '#8a6a44' : '#5e4429', xx, base - i, 3, 1); }
    const tx = x + Math.round(Math.sin(1.3) * 4) + 1, ty = base - h;
    [-2.7, -2.2, -1.6, -1.0, -0.4, 0.15].forEach((a, k) => {
      for (let t = 0; t < 16; t++) R(g, t > 11 ? '#1f6b2e' : (k % 2 ? '#2f8f3f' : '#3aa64b'), tx + Math.cos(a) * t, ty + Math.sin(a) * t + t * t / 26, 2, 2);
    });
    R(g, '#5a3a1a', tx - 1, ty + 1, 2, 2); R(g, '#5a3a1a', tx + 2, ty + 2, 2, 2);
  }
  function gulmohar(g, r, x, base, s = 1) {
    R(g, '#5a3a28', x - 2, base - 30 * s, 4, 30 * s); R(g, '#5a3a28', x - 7, base - 26 * s, 6, 2); R(g, '#5a3a28', x + 2, base - 24 * s, 7, 2);
    [[0, -36, 18, 10], [-14, -30, 12, 8], [14, -30, 12, 8], [-6, -44, 12, 7], [8, -42, 11, 7]].forEach(([dx, dy, rx, ry]) => ellG(g, '#2f7d32', x + dx * s, base + dy * s, rx * s, ry * s));
    for (let i = 0; i < 70 * s; i++) {
      const a = r() * Math.PI * 2, d = r();
      R(g, r() < 0.5 ? '#e8352c' : '#ff6a3c', x + Math.cos(a) * d * 24 * s, base - 36 * s + Math.sin(a) * d * 12 * s, r() < 0.3 ? 2 : 1, 1);
    }
  }
  function lamp(g, x, base, h, glow) {
    R(g, '#2e2e38', x, base - h, 2, h); R(g, '#2e2e38', x, base - h, 9, 2); R(g, '#2e2e38', x - 2, base - 2, 6, 2);
    if (glow) ellG(g, 'rgba(255,233,160,0.25)', x + 8, base - h + 6, 9, 9);
    R(g, '#ffe9a0', x + 6, base - h + 2, 4, 2);
  }
  function hedge(g, x, base, w, col = '#3f9e4f', hi = '#5cc46a') {
    for (let i = 0; i < w; i += 10) ellG(g, col, x + i + 5, base - 6, 7, 7);
    for (let i = 0; i < w; i += 10) R(g, hi, x + i + 3, base - 11, 3, 1);
    R(g, col, x, base - 6, w, 6);
  }
  function chaiStall(g, x, base) {
    R(g, '#2a6fb5', x, base - 22, 44, 16); R(g, '#1f5590', x, base - 8, 44, 2);
    ellG(g, '#222', x + 8, base - 3, 3, 3); ellG(g, '#222', x + 36, base - 3, 3, 3);
    for (let i = 0; i < 48; i += 6) R(g, (i / 6) % 2 ? '#ffcc1f' : '#e2453c', x - 2 + i, base - 36, 6, 6);
    for (let i = 0; i < 48; i += 6) R(g, (i / 6) % 2 ? '#ffcc1f' : '#e2453c', x - 1 + i, base - 30, 4, 2);
    R(g, '#5e4429', x, base - 30, 2, 8); R(g, '#5e4429', x + 42, base - 30, 2, 8);
    R(g, '#c0c6cf', x + 30, base - 27, 7, 5); R(g, '#c0c6cf', x + 37, base - 26, 3, 1);
    for (let i = 0; i < 4; i++) R(g, '#e3f1f6', x + 6 + i * 4, base - 26, 2, 4);
    R(g, '#fff1dc', x + 6, base - 18, 22, 8); pixText(g, 'CHAI', x + 9, base - 17, '#e2453c');
  }
  function office(g, r, x, base, w, h) {
    R(g, '#e8e1d5', x, base - h, w, h); R(g, '#c9c0b0', x, base - h, w, 2);
    for (let fy = base - h + 6; fy < base - 18; fy += 22) {
      R(g, '#7fc7e8', x + 4, fy, w - 8, 15); R(g, '#a9dcf0', x + 4, fy, w - 8, 2);
      for (let px = x + 8; px < x + w - 12; px += 14) {
        R(g, '#6b4a2a', px, fy + 8, 9, 1); R(g, '#6b4a2a', px + 1, fy + 9, 1, 6); R(g, '#6b4a2a', px + 7, fy + 9, 1, 6);
        R(g, '#222', px + 3, fy + 4, 4, 3);
        if (r() < 0.7) { R(g, ['#e2453c', '#2a9d8f', '#ffcc1f', '#7a3fb0'][Math.floor(r() * 4)], px + 9, fy + 6, 3, 6); R(g, '#3a2a2a', px + 9, fy + 3, 3, 3); }
      }
    }
    R(g, '#5e626d', x + w / 2 - 6, base - 16, 12, 16); R(g, '#9fd3ff', x + w / 2 - 5, base - 15, 4, 14); R(g, '#9fd3ff', x + w / 2 + 1, base - 15, 4, 14);
  }
  function serverHall(g, r, x, base, w, h) {
    R(g, '#5b6b7d', x, base - h, w, h); R(g, '#7b8b9d', x, base - h, w, 2);
    R(g, '#14171d', x + 6, base - h + 10, w - 12, h - 22);
    for (let rx = x + 10; rx < x + w - 14; rx += 12) {
      R(g, '#2a2f38', rx, base - h + 14, 9, h - 30);
      for (let ly = base - h + 17; ly < base - 18; ly += 3) { R(g, '#3a404b', rx + 1, ly, 7, 1); if (r() < 0.6) R(g, r() < 0.6 ? '#3dff6e' : '#4fc3ff', rx + 6, ly, 1, 1); }
    }
    R(g, '#ffffff', x + 8, base - h + 3, 30, 5); pixText(g, 'DATA LAB', x + 9, base - h + 3, '#5b6b7d');
  }
  function umbrellas(g, x, base) {
    ['#e2453c', '#ffcc1f', '#2a9d8f', '#ff6fa6'].forEach((col, i) => {
      const ux = x + i * 26;
      R(g, '#6b6f7a', ux + 9, base - 22, 1, 22);
      for (let k = 0; k < 6; k++) { const w = 4 + k * 3; R(g, col, ux + 10 - w / 2, base - 28 + k, w, 1); }
      R(g, '#8a5a3a', ux + 3, base - 9, 13, 2); R(g, '#8a5a3a', ux + 9, base - 7, 1, 7);
    });
    R(g, '#ffffff', x + 20, base - 50, 52, 9); pixText(g, 'FOOD COURT', x + 22, base - 48, '#e2453c');
  }
  function cafe(g, r, x, base, w, h, col, awn, name) {
    R(g, col, x, base - h, w, h); R(g, 'rgba(0,0,0,0.15)', x, base - h, w, 2);
    for (let wy = base - h + 6; wy < base - 34; wy += 16) for (let wx = x + 5; wx < x + w - 10; wx += 14) { R(g, '#ffcf6b', wx, wy, 8, 9); R(g, '#e8a640', wx, wy + 8, 8, 1); }
    for (let i = 0; i < w; i += 6) R(g, (i / 6) % 2 ? '#fff1dc' : awn, x + i, base - 32, 6, 6);
    R(g, '#ffcf6b', x + 6, base - 24, w - 22, 14); R(g, '#5e4429', x + w - 13, base - 24, 9, 24);
    if (name) { R(g, '#2a1f3a', x + 4, base - 42, textWidth(name) + 4, 8); pixText(g, name, x + 6, base - 41, '#ffe14d'); }
  }
  function fairyLights(g, x0, y0, x1, y1, sag) {
    const cols = ['#fff2a8', '#ff9ad1', '#9ae6ff', '#ffcf6b'];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
      R(g, '#3a2a3a', x, y, 1, 1);
      if (i % 3 === 0) R(g, cols[(i / 3) % 4], x, y + 1, 2, 2);
    }
  }
  function metroLine(g, y, train) {
    for (let x = 30; x < BW; x += 128) { R(g, '#8a8278', x, y + 8, 12, 270 - y); R(g, '#8a8278', x - 6, y + 6, 24, 4); R(g, '#6f685e', x, y + 10, 2, 270 - y); }
    R(g, '#b0a89c', 0, y, BW, 7); R(g, '#d0c8bc', 0, y, BW, 1); R(g, '#6f685e', 0, y + 7, BW, 1);
    if (train) {
      R(g, '#7a3fb0', train, y - 12, 120, 12); R(g, '#9a5fd0', train, y - 12, 120, 2);
      for (let i = 0; i < 10; i++) R(g, '#cfe8ff', train + 5 + i * 11, y - 9, 7, 4);
      R(g, '#3dbb6b', train, y - 3, 120, 2);
    }
  }
  function flyover(g, r, y) {
    for (let x = 60; x < BW; x += 160) { R(g, '#8f8170', x, y + 8, 18, 270 - y); R(g, '#6f6458', x, y + 8, 3, 270 - y); }
    R(g, '#a39686', 0, y, BW, 9); R(g, '#6f6458', 0, y - 3, BW, 3); R(g, '#c2b6a6', 0, y + 9, BW, 1);
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(r() * (BW - 14)), col = ['#e2453c', '#f4f4f4', '#2b4fa8', '#ffcc1f', '#3a3a3a'][Math.floor(r() * 5)];
      R(g, col, cx, y - 9, 12, 5); R(g, col, cx + 3, y - 12, 6, 3); R(g, '#222', cx + 2, y - 4, 2, 1); R(g, '#222', cx + 8, y - 4, 2, 1);
    }
  }
  function billboard(g, x, base, text, col) {
    R(g, '#3a3a44', x + 8, base - 50, 2, 50); R(g, '#3a3a44', x + 40, base - 50, 2, 50);
    R(g, '#1f1f28', x, base - 72, 52, 24); R(g, col, x + 2, base - 70, 48, 20);
    const lines = text.split('|');
    lines.forEach((l, i) => pixText(g, l, x + 26 - textWidth(l) / 2, base - 67 + i * 7, '#ffffff'));
  }
  function cone(g, x, base) { R(g, '#ff7a1a', x + 2, base - 9, 3, 9); R(g, '#ffffff', x + 2, base - 6, 3, 2); R(g, '#ff7a1a', x, base - 2, 7, 2); }
  function barricade(g, x, base) {
    R(g, '#3a3a44', x + 2, base - 14, 2, 14); R(g, '#3a3a44', x + 26, base - 14, 2, 14);
    for (let i = 0; i < 30; i += 5) R(g, (i / 5) % 2 ? '#ffffff' : '#e2453c', x + i, base - 14, 5, 5);
  }
  function scooterSil(g, x, base, col) {
    ellG(g, '#222', x + 4, base - 3, 3, 3); ellG(g, '#222', x + 18, base - 3, 3, 3);
    R(g, col, x + 2, base - 10, 10, 5); R(g, col, x + 8, base - 7, 10, 2); R(g, col, x + 15, base - 14, 3, 9); R(g, '#2b2b2b', x + 3, base - 12, 8, 2);
  }
  function dust(g, r, col, n, y0, y1) { for (let i = 0; i < n; i++) R(g, col, Math.floor(r() * BW), y0 + Math.floor(r() * (y1 - y0))); }

  const THEMES = {
    intel: {
      far(g, r) {
        sky(g, ['#6ec0f5', '#86cdf9', '#a2dbfc', '#c0e8ff', '#ddf4ff']);
        sun(g, 420, 46, 13, '#fff6c8', 'rgba(255,250,220,0.5)'); clouds(g, r, '#ffffff', 5);
        skyline(g, r, 214, { minW: 22, maxW: 44, minH: 40, maxH: 95, col: '#a8c3da', win: '#d6ebf7', lit: 0.35, antenna: true });
      },
      mid(g, r) {
        glassTower(g, 14, 240, 58, 128, '#5d93c2', '#bfe6ff', '#3f6f99');
        serverHall(g, r, 100, 240, 112, 86);
        glassTower(g, 238, 240, 48, 150, '#6aa4cf', '#d4f1ff', '#3f6f99');
        palm(g, 300, 240, 64);
        glassTower(g, 344, 240, 78, 104, '#4f86b8', '#bfe6ff', '#335d85');
        palm(g, 448, 240, 52); palm(g, 484, 240, 44);
      },
      near(g, r) {
        hedge(g, 0, 240, 120); lamp(g, 140, 240, 46); hedge(g, 200, 240, 90);
        R(g, '#8a5a3a', 310, 228, 26, 3); R(g, '#5e4429', 312, 231, 2, 9); R(g, '#5e4429', 332, 231, 2, 9);
        lamp(g, 380, 240, 46); hedge(g, 420, 240, 80);
      },
    },
    zeta: {
      far(g, r) {
        sky(g, ['#5fb8ff', '#7cc6ff', '#a6d9ff', '#ffe6b0', '#ffd08a']);
        sun(g, 90, 60, 14, '#fff2b0', 'rgba(255,240,180,0.45)'); clouds(g, r, '#fff8ec', 4);
        skyline(g, r, 212, { minW: 20, maxW: 40, minH: 50, maxH: 120, col: '#b9a7c9', win: '#e4d9ee', lit: 0.3, antenna: true });
      },
      mid(g, r) {
        office(g, r, 4, 240, 120, 118);
        umbrellas(g, 140, 240);
        glassTower(g, 260, 240, 46, 160, '#7a6fae', '#d9d2ff', '#544a85');
        office(g, r, 316, 240, 100, 92);
        palm(g, 432, 240, 58); palm(g, 476, 240, 66);
      },
      near(g, r) {
        R(g, '#b5773a', 10, 226, 30, 14); hedge(g, 10, 226, 30, '#3f9e4f', '#5cc46a');
        chaiStall(g, 90, 240);
        scooterSil(g, 180, 240, '#e2453c'); scooterSil(g, 206, 240, '#2b4fa8'); scooterSil(g, 232, 240, '#ffcc1f');
        lamp(g, 300, 240, 50); R(g, '#b5773a', 360, 226, 30, 14); hedge(g, 360, 226, 30); lamp(g, 450, 240, 50);
      },
    },
    kora: {
      far(g, r) {
        sky(g, ['#2a2050', '#4a2a70', '#7a3384', '#b84a7e', '#e8667a', '#ff9a6a']);
        stars(g, r, 50, '#fff2d0'); ellG(g, '#fff2d0', 400, 40, 7, 7); ellG(g, '#4a2a70', 403, 38, 6, 6);
        skyline(g, r, 216, { minW: 26, maxW: 52, minH: 24, maxH: 60, col: '#3a2550', win: '#ffcf6b', lit: 0.25, tank: true });
      },
      mid(g, r) {
        cafe(g, r, 6, 240, 84, 92, '#ff9fb8', '#e2453c', 'CAFE');
        gulmohar(g, r, 118, 240);
        cafe(g, r, 146, 240, 96, 76, '#8fe0c0', '#2a9d8f', 'BOOKS');
        cafe(g, r, 254, 240, 90, 104, '#ffd27a', '#e2453c', 'CHAI');
        cafe(g, r, 356, 240, 88, 84, '#c9a7ff', '#7a3fb0', 'POEMS');
        gulmohar(g, r, 470, 240, 0.9);
        fairyLights(g, 6, 150, 146, 166, 16); fairyLights(g, 146, 166, 254, 138, 14); fairyLights(g, 344, 138, 444, 158, 14); fairyLights(g, 444, 158, 512, 150, 10);
      },
      near(g, r) {
        [20, 120, 300, 420].forEach(x => { R(g, '#c86b4a', x, 230, 10, 10); ellG(g, '#2f8f3f', x + 5, 226, 8, 6); R(g, '#ff6fa6', x + 3, 222, 2, 2); });
        scooterSil(g, 180, 240, '#ff6fa6'); scooterSil(g, 210, 240, '#8fe0c0');
        fairyLights(g, 0, 196, 512, 196, 8);
      },
    },
    silk: {
      far(g, r) {
        sky(g, ['#ff7a3d', '#ff8f4f', '#ffa666', '#f2a882', '#d99a88']);
        sun(g, 360, 120, 16, '#ffe0a0', 'rgba(255,200,140,0.5)');
        dust(g, r, 'rgba(255,230,190,0.35)', 400, 0, 220);
        skyline(g, r, 212, { minW: 20, maxW: 44, minH: 40, maxH: 100, col: '#a8644a', win: '#ffcf8a', lit: 0.2, antenna: true });
        metroLine(g, 150, 160);
      },
      mid(g, r) {
        flyover(g, r, 176);
        billboard(g, 30, 176, 'SILK|BOARD', '#2b4fa8');
        billboard(g, 300, 176, '404 LANE|NOT FOUND', '#e2453c');
        R(g, '#6f6458', 200, 196, 16, 44); R(g, '#8f8170', 202, 196, 12, 44);
      },
      near(g, r) {
        barricade(g, 20, 240); cone(g, 70, 240); cone(g, 84, 240);
        scooterSil(g, 140, 240, '#2b4fa8'); scooterSil(g, 166, 240, '#e2453c'); scooterSil(g, 192, 240, '#3a3a3a');
        barricade(g, 280, 240); cone(g, 330, 240); lamp(g, 380, 240, 54); cone(g, 440, 240); cone(g, 452, 240);
        dust(g, r, 'rgba(210,170,130,0.5)', 160, 200, 240);
      },
    },
    dusk: {
      far(g, r) {
        sky(g, ['#24184a', '#3e2263', '#6a2c74', '#a83f72', '#e0606a', '#ff9a5a']);
        stars(g, r, 40, '#ffe8c8');
        sun(g, 250, 196, 22, '#ffb36b', 'rgba(255,170,110,0.4)');
        skyline(g, r, 214, { minW: 20, maxW: 46, minH: 40, maxH: 110, col: '#2e2048', win: '#ffcf6b', lit: 0.3, antenna: true });
        metroLine(g, 156, 300);
      },
      mid(g, r) {
        gulmohar(g, r, 40, 240); palm(g, 120, 240, 70);
        billboard(g, 170, 200, 'SILK|BOARD JN', '#2b4fa8');
        palm(g, 300, 240, 60); gulmohar(g, r, 380, 240, 1.1); palm(g, 470, 240, 66);
      },
      near(g, r) { chaiStall(g, 20, 240); lamp(g, 90, 240, 56, true); lamp(g, 330, 240, 56, true); hedge(g, 400, 240, 100, '#24603a', '#2f7d45'); },
    },
  };

  function bgLayer(theme, layer) {
    const { c, g } = cv(BW, 270);
    THEMES[theme][layer](g, rngOf(theme.length * 131 + layer.length * 17));
    return c;
  }

  // ---------- small DOM icons ----------
  function icon(name) {
    const m = new Mask(16, 16);
    if (name === 'mic') { m.rect(6, 1, 4, 8, '#ff6fa6'); m.rect(7, 2, 1, 5, '#ffc2da'); m.rect(4, 6, 1, 4, '#e8e8e8'); m.rect(11, 6, 1, 4, '#e8e8e8'); m.rect(5, 10, 6, 1, '#e8e8e8'); m.rect(7, 11, 2, 3, '#e8e8e8'); m.rect(5, 14, 6, 1, '#e8e8e8'); m.rect(12, 2, 2, 2, '#ffe14d'); m.set(13, 4, '#ffe14d'); }
    else if (name === 'mail') { m.rect(1, 4, 14, 9, '#fff1dc'); for (let i = 0; i < 7; i++) { m.set(1 + i, 4 + i * 0.7, '#e2453c'); m.set(14 - i, 4 + i * 0.7, '#e2453c'); } m.rect(10, 1, 5, 4, '#ffe14d'); m.set(12, 2, '#ff6fa6'); }
    else if (name === 'rocket') { m.ell(8, 6, 3, 6, '#e8e8e8'); m.rect(7, 4, 2, 2, '#4fc3ff'); m.rect(4, 9, 2, 3, '#e2453c'); m.rect(10, 9, 2, 3, '#e2453c'); m.rect(7, 12, 2, 3, '#ffcc1f'); m.set(8, 15, '#ff7a1a'); }
    else if (name === 'check') { m.rect(2, 2, 12, 12, '#2a9d8f'); [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]].forEach(([x, y]) => m.rect(x, y, 1, 2, '#ffffff')); }
    else if (name === 'bank') { m.rect(2, 13, 12, 2, '#ffcc1f'); m.rect(2, 5, 12, 2, '#ffcc1f'); m.set(8, 2, '#ffcc1f'); m.rect(6, 3, 5, 2, '#ffcc1f'); m.rect(4, 3, 8, 1, '#ffcc1f'); [3, 7, 11].forEach(x => m.rect(x, 7, 2, 6, '#fff1dc')); }
    else if (name === 'lock') { m.rect(4, 7, 8, 7, '#ffcc1f'); m.rect(5, 3, 1, 4, '#e8e8e8'); m.rect(10, 3, 1, 4, '#e8e8e8'); m.rect(6, 2, 4, 1, '#e8e8e8'); m.rect(7, 9, 2, 3, '#1a1020'); m.rect(4, 12, 8, 1, '#d99a00'); }
    else if (name === 'trophy') { m.rect(4, 2, 8, 6, '#ffcc1f'); m.rect(2, 3, 2, 3, '#ffcc1f'); m.rect(12, 3, 2, 3, '#ffcc1f'); m.rect(5, 8, 6, 1, '#d99a00'); m.rect(7, 9, 2, 3, '#ffcc1f'); m.rect(5, 12, 6, 2, '#8a5a3a'); m.rect(6, 3, 1, 3, '#fff3a0'); }
    else if (name === 'code') { [[5, 4], [4, 5], [3, 6], [2, 7], [3, 8], [4, 9], [5, 10]].forEach(([x, y]) => m.rect(x, y, 2, 1, '#4fc3ff')); [[10, 4], [11, 5], [12, 6], [13, 7], [12, 8], [11, 9], [10, 10]].forEach(([x, y]) => m.rect(x - 1, y, 2, 1, '#4fc3ff')); [[9, 3], [9, 4], [8, 5], [8, 6], [8, 7], [7, 8], [7, 9], [7, 10], [6, 11]].forEach(([x, y]) => m.set(x, y, '#7cff6b')); }
    else if (name === 'bug') { const b = bug('null', 0); return toURL(b, 2); }
    else if (name === 'chai') { return toURL(chai(0), 2); }
    else if (name === 'mushroom') { return toURL(mushroom(), 2); }
    else { m.rect(3, 3, 10, 10, '#ffcc1f'); }
    return toURL(m.outline(OUT), 2);
  }
  function toURL(mask, s) { const { c, g } = cv(mask.w * s, mask.h * s); mask.draw(g, 0, 0, s); return c.toDataURL(); }

  // ---------- public: register with Phaser ----------
  function sheet(scene, key, w, h, frames) {
    const names = Object.keys(frames);
    const { c, g } = cv(w * names.length, h);
    names.forEach((n, i) => frames[n].draw(g, i * w, 0));
    const tex = scene.textures.addCanvas(key, c);
    names.forEach((n, i) => tex.add(n, 0, i * w, 0, w, h));
  }
  function addCanvas(scene, key, c) { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c); }
  function maskTex(scene, key, m) { const { c, g } = cv(m.w, m.h); m.draw(g); addCanvas(scene, key, c); }

  function build(scene) {
    const ek = {};
    Object.entries(EKTA_FRAMES).forEach(([n, p]) => { ek[n] = ekta(p).outline(OUT); });
    sheet(scene, 'ekta', 32, 32, ek);
    sheet(scene, 'scooter', 48, 36, { s0: scooter(true, 0), s1: scooter(true, 1) });
    maskTex(scene, 'scooterParked', scooter(false, 0));
    const bugs = {};
    ['null', 'crash', 'merge', 'flaky'].forEach(t => { bugs[t + '0'] = bug(t, 0); bugs[t + '1'] = bug(t, 1); });
    sheet(scene, 'bugs', 18, 16, bugs);
    sheet(scene, 'chai', 12, 16, { c0: chai(0), c1: chai(1) });
    sheet(scene, 'signal', 16, 48, { red: signal('red'), green: signal('green') });
    sheet(scene, 'auto', 34, 28, { a0: auto(0), a1: auto(1) });
    maskTex(scene, 'comma', comma());
    maskTex(scene, 'mushroom', mushroom());
    maskTex(scene, 'gradcap', gradCap());
    maskTex(scene, 'degree', degree());
    maskTex(scene, 'helmet', helmet());
    maskTex(scene, 'bus', bus());
    [['white', '#f0f0f0', '#b8b8c0'], ['red', '#e2453c', '#a82820'], ['blue', '#2b6bd9', '#1d4a9c'], ['silver', '#b8c0cc', '#8a929e'], ['yellow', '#ffcc1f', '#d99a00']]
      .forEach(([n, a, b]) => maskTex(scene, 'car-' + n, car(a, b)));
    addCanvas(scene, 'stopsign', stopSign());
    ['intel', 'zeta', 'kora', 'silk', 'dusk'].forEach(t => {
      addCanvas(scene, 'ground-' + t, groundTex(t === 'dusk' ? 'silk' : t));
      ['far', 'mid', 'near'].forEach(l => addCanvas(scene, `bg-${t}-${l}`, bgLayer(t, l)));
    });
    addCanvas(scene, 'pit', pitTex());
    ['glass', 'crate', 'awning', 'flyover', 'metro'].forEach(t => addCanvas(scene, 'plat-' + t, platTex(t)));
    addCanvas(scene, 'pillar', pillarTex());
    { const { c, g } = cv(8, 12); R(g, OUT, 1, 1, 5, 10); R(g, OUT, 0, 9, 8, 3); cone(g, 0, 12); R(g, '#ff7a1a', 3, 1, 1, 2); addCanvas(scene, 'cone', c); }
    { const { c, g } = cv(2, 2); R(g, '#ffffff', 0, 0, 2, 2); addCanvas(scene, 'px', c); }
    { const { c, g } = cv(6, 6); ellG(g, '#ffffff', 3, 3, 3, 3); addCanvas(scene, 'puff', c); }
    { const { c, g } = cv(32, 32); [[15, 'rgba(255,240,150,0.12)'], [11, 'rgba(255,240,150,0.2)'], [7, 'rgba(255,245,180,0.3)']].forEach(([r, col]) => ellG(g, col, 16, 16, r, r)); addCanvas(scene, 'glow', c); }
    [['txt-fixed', 'FIXED!', '#7cff6b'], ['txt-ouch', 'OUCH!', '#ffd23f'], ['txt-honk', 'HONK!', '#ffffff'], ['txt-chai', '+1 CHAI', '#ffe14d'], ['txt-xp', 'EXPERIENCE +1', '#8ff0e2']]
      .forEach(([k, s, col]) => addCanvas(scene, k, labelCanvas(s, col, null, 2, '#1a1020')));
  }
  function collegeTex(scene, key, name) { addCanvas(scene, key, college(String(name || '').toUpperCase().slice(0, 28))); return key; }
  function gateTex(scene, key, name) { addCanvas(scene, key, gate(String(name || '').toUpperCase().slice(0, 12))); return key; }
  function label(scene, key, str, fg = '#ffffff', bg) { addCanvas(scene, key, labelCanvas(str, fg, bg === undefined ? 'rgba(26,16,32,0.85)' : bg)); return key; }

  const urlCache = {};
  function portraitURL(expr) {
    expr = ['smile', 'think', 'laugh'].includes(expr) ? expr : 'smile';
    if (!urlCache['p-' + expr]) urlCache['p-' + expr] = toURL(portrait(expr), 4);
    return urlCache['p-' + expr];
  }
  function heroURL(frame) {
    const opts = { idle: {}, blink: { blink: true }, wave0: { arm: 'up0', sway: -1 }, wave1: { arm: 'up1', sway: 1 } }[frame] || {};
    if (!urlCache['h-' + frame]) urlCache['h-' + frame] = toURL(heroEkta(opts), 5);
    return urlCache['h-' + frame];
  }
  function iconURL(name) {
    if (!urlCache['i-' + name]) urlCache['i-' + name] = icon(name);
    return urlCache['i-' + name];
  }
  function spriteURL(which) {
    if (urlCache['s-' + which]) return urlCache['s-' + which];
    let m;
    if (which === 'cheer') m = ekta(EKTA_FRAMES.cheer0).outline(OUT);
    else if (EKTA_FRAMES[which]) m = ekta(EKTA_FRAMES[which]).outline(OUT);
    else if (which === 'scooter') m = scooter(true, 0);
    else m = ekta(EKTA_FRAMES.idle0).outline(OUT);
    return (urlCache['s-' + which] = toURL(m, 4));
  }

  return { build, label, gate: gateTex, college: collegeTex, portraitURL, heroURL, iconURL, spriteURL };
})();
