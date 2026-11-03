'use strict';
/* EktaVerse — Phaser scenes and game flow. */
const W = 480, H = 270, GY = 240;
const BUG_NAMES = { null: 'NULLPOINTER', crash: 'CRASH', merge: 'MERGE CONFLICT', flaky: 'FLAKY TEST' };

/* mode: 'play' (you drive), 'auto' (the game plays itself) or 'express' (just the story, about a minute) */
const G = { content: null, stats: null, level: 0, mistakeShown: false, scene: null, mode: 'play' };
/* xp: mushrooms eaten (Ekta grows 10% per mushroom); lessons: hurdle lessons shown so far */
function resetStats() { G.stats = { chai: 0, bugs: 0, commas: new Set(), xp: 0, xpFrom: new Set(), lessons: 0 }; G.mistakeShown = false; }
const ektaSize = () => 1 + 0.1 * G.stats.xp;
resetStats();

const wait = ms => new Promise(r => setTimeout(r, ms));
function dlg(id, extra) {
  const d = (G.content.dialogs || {})[id] || {};
  return Object.assign({ title: d.title || '', text: d.text || '', portrait: d.portrait || 'smile', audio: d.audio || '' }, extra || {});
}
function sfxUrl(k) { return (G.content.sfx || {})[k] || ''; }
/** Play one of Ekta's short voice effects and caption it for people watching with the sound off. */
function say(key, fallback) {
  AudioSys.clip(sfxUrl(key), fallback);
  const t = (G.content.captions || {})[key];
  if (t) UI.caption(t, key === 'honk' ? '' : 'Ekta');
}

/* Touch buttons feed this alongside the keyboard. */
const Touch = {
  left: false, right: false, jump: false, _jump: false, _honk: false,
  consumeJump() { const j = this._jump; this._jump = false; return j; },
  consumeHonk() { const h = this._honk; this._honk = false; return h; },
};

// Backdrops are toned down (less colour, a soft wash) so the eye stays on Ekta and the road.
const WASH = { intel: 0xe6edf2, zeta: 0xf0e8de, kora: 0x2a2238, silk: 0xeadacb, dusk: 0x2a2238 };
function addParallax(scene, theme) {
  const layers = ['far', 'mid', 'near'].map((l, i) => scene.add.tileSprite(0, 0, W, H, `bg-${theme}-${l}`).setOrigin(0).setScrollFactor(0).setDepth(-10 + i));
  layers.forEach(l => { if (l.preFX) l.preFX.addColorMatrix().saturate(-0.6); });
  scene.add.rectangle(0, 0, W, H, WASH[theme], 0.3).setOrigin(0).setScrollFactor(0).setDepth(-7);
  return layers;
}

function makeAnims(scene) {
  const A = scene.anims, f = (key, names) => names.map(n => ({ key, frame: n }));
  A.create({ key: 'ekta-idle', frames: f('ekta', ['idle0', 'idle1']), frameRate: 2.5, repeat: -1 });
  A.create({ key: 'ekta-run', frames: f('ekta', ['run0', 'run1', 'run2', 'run3', 'run4', 'run5']), frameRate: 13, repeat: -1 });
  A.create({ key: 'ekta-jump', frames: f('ekta', ['jump']) });
  A.create({ key: 'ekta-fall', frames: f('ekta', ['fall']) });
  A.create({ key: 'ekta-hurt', frames: f('ekta', ['hurt']) });
  A.create({ key: 'ekta-cheer', frames: f('ekta', ['cheer0', 'cheer1']), frameRate: 4, repeat: -1 });
  A.create({ key: 'scoot', frames: f('scooter', ['s0', 's1']), frameRate: 10, repeat: -1 });
  ['null', 'crash', 'merge', 'flaky'].forEach(t => A.create({ key: t + '-walk', frames: f('bugs', [t + '0', t + '1']), frameRate: t === 'crash' ? 6 : 4, repeat: -1 }));
  A.create({ key: 'chai-steam', frames: f('chai', ['c0', 'c1']), frameRate: 3, repeat: -1 });
  A.create({ key: 'auto-run', frames: f('auto', ['a0', 'a1']), frameRate: 6, repeat: -1 });
}

// ======================================================================
class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    Art.build(this);
    makeAnims(this);
    const fonts = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('16px "Press Start 2P"'), document.fonts.load('20px VT323')]).catch(() => {})
      : Promise.resolve();
    Promise.all([fonts, Content.load().then(c => { G.content = c; })]).then(() => this.scene.start('Title'));
  }
}

// ======================================================================
class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    G.scene = null;
    // the home page is a plain portfolio card (the DOM overlay); the canvas stays an empty backdrop
    this.cameras.main.setBackgroundColor('#141021');
    document.body.classList.add('booted');
    UI.titleLinks(G.content.profile || {});
    UI.hello();
    $start.disabled = false; $start.textContent = '▶ PLAY THE GAME';
  }
}

// ======================================================================
class Level extends Phaser.Scene {
  constructor() { super('Level'); }
  init(data) { this.index = data.index || 0; }

  create() {
    const L = this.L = LEVELS[this.index], meta = (G.content.levels || [])[this.index] || {};
    this.levelName = meta.name || L.name; this.tagline = meta.tagline || L.tagline;
    this.experience = meta.experience || L.experience || '';
    G.scene = this;
    Object.assign(this, { state: 'frozen', invulnUntil: 0, lockUntil: 0, hurtUntil: 0, scooterUntil: 0, lastGround: -1e9, jumpAt: -1e9, jumpLock: 0, lastHonk: 0, cutOK: false, falling: false });
    // Phaser reuses this scene object for every level, so clear anything a previous level set up
    Object.assign(this, { gateX: null, gateName: '', doorGlow: null, finished: false, finishSig: null, finishGlow: null, riding: null, wasRiding: false, wasOnGround: false, fallSpeed: 0 });
    this.respawn = { x: 48, y: GY };
    this.safe = null;

    this.physics.world.setBounds(0, 0, L.width, H + 200);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.layers = addParallax(this, L.theme);

    // road with potholes
    this.solids = [];
    L.ground.forEach(([a, b], i) => {
      const next = L.ground[i + 1];
      if (next) {
        this.add.tileSprite(b, GY, next[0] - b, 32, 'pit').setOrigin(0).setDepth(-2);
        this.add.image(b - 6, GY, 'cone').setOrigin(0.5, 1).setDepth(1);
        this.add.image(next[0] + 6, GY, 'cone').setOrigin(0.5, 1).setDepth(1);
      }
      const t = this.add.tileSprite(a, GY, b - a, 32, 'ground-' + L.theme).setOrigin(0).setDepth(0);
      this.physics.add.existing(t, true);
      this.solids.push(t);
    });

    // one-way platforms
    L.platforms.forEach(([x, y, w, type]) => {
      if (type === 'pillar') this.add.tileSprite(x + w / 2 - 8, y + 8, 16, GY - y - 8, 'pillar').setOrigin(0).setDepth(-1);
      const p = this.add.tileSprite(x, y, w, 8, 'plat-' + (type === 'pillar' ? 'metro' : type)).setOrigin(0).setDepth(0);
      this.add.rectangle(x, y + 8, w, 3, 0x1a1020, 0.35).setOrigin(0).setDepth(0);
      this.add.rectangle(x - 1, y, 1, 8, 0x1a1020, 0.8).setOrigin(0).setDepth(0);
      this.add.rectangle(x + w, y, 1, 8, 0x1a1020, 0.8).setOrigin(0).setDepth(0);
      this.physics.add.existing(p, true);
      this.oneWay(p.body);
      this.solids.push(p);
    });

    // buses and autos you can ride
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });
    (L.movers || []).forEach(([x, type, range, speed]) => {
      const m = this.movers.create(x, GY, type, type === 'auto' ? 'a0' : undefined).setOrigin(0, 1).setDepth(1);
      if (type === 'bus') m.body.setSize(92, 8).setOffset(2, 1);
      else { m.body.setSize(24, 6).setOffset(4, 2); m.play('auto-run'); }
      this.oneWay(m.body);
      Object.assign(m, { minX: x, maxX: x + range, speed });
      m.setVelocityX(speed);
    });

    // honkable traffic
    this.jamCars = this.physics.add.staticGroup();
    (L.jamCars || []).forEach(([x, col]) => {
      const c = this.jamCars.create(x, GY, 'car-' + col).setOrigin(0.5, 1).setDepth(1);
      c.refreshBody();
    });

    // collectibles
    this.items = this.physics.add.group({ allowGravity: false });
    L.chai.forEach(([x, y]) => {
      const c = this.items.create(x, y, 'chai', 'c0').setDepth(2);
      c.kind = 'chai'; c.play({ key: 'chai-steam', startFrame: (x / 16 | 0) % 2 });
      c.body.setSize(10, 12);
      this.tweens.add({ targets: c, y: y - 3, duration: 650 + (x * 7) % 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    if (L.helmet) {
      const [x, y] = L.helmet, h = this.items.create(x, y, 'helmet').setDepth(2);
      h.kind = 'helmet';
      this.tweens.add({ targets: h, y: y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    if (L.mushroom && !G.stats.xpFrom.has(this.index)) {
      const x = L.mushroom, y = GY - 8;
      const glow = this.add.image(x, y, 'glow').setTint(0x8ff0e2).setDepth(1);
      this.tweens.add({ targets: glow, scale: 1.5, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
      const m = this.items.create(x, y, 'mushroom').setDepth(2);
      m.kind = 'mushroom'; m.glow = glow;
      m.lbl = this.add.image(x, y - 14, Art.label(this, 'lbl-xp', '+ EXPERIENCE', '#8ff0e2')).setOrigin(0.5, 1).setDepth(6);
      this.tweens.add({ targets: [m, m.lbl], y: '-=3', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    if (L.comma && !G.stats.commas.has(this.index)) {
      const [x, y] = L.comma;
      const glow = this.add.image(x, y, 'glow').setDepth(1);
      this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      const c = this.items.create(x, y, 'comma').setDepth(2);
      c.kind = 'comma'; c.glow = glow;
      this.tweens.add({ targets: c, y: y - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // bugs
    this.enemies = this.physics.add.group({ allowGravity: false, immovable: true });
    L.enemies.forEach(([x, type, range, y = GY]) => {
      const e = this.enemies.create(x, y, 'bugs', type + '0').setOrigin(0.5, 1).setDepth(3);
      e.play({ key: type + '-walk', startFrame: x % 2 });
      e.body.setSize(12, 11).setOffset(3, 5);
      Object.assign(e, { type, minX: x - range, maxX: x + range, speed: type === 'crash' ? 42 : type === 'merge' ? 28 : 32, solid: true, flick: (x * 13) % 2600 });
      e.setVelocityX(-e.speed);
      e.label = this.add.image(x, y - 18, Art.label(this, 'lbl-' + type, BUG_NAMES[type], '#ffffff')).setOrigin(0.5, 1).setDepth(6);
    });

    // checkpoints (traffic signals)
    this.cps = (L.checkpoints || []).map(([x, clip, name]) => {
      const s = this.add.image(x, GY, 'signal', 'red').setOrigin(0.5, 1).setDepth(1);
      this.add.image(x, GY - 52, Art.label(this, 'sign-' + clip, name.toUpperCase(), '#ffe14d')).setOrigin(0.5, 1).setDepth(1);
      return { x, clip, name, s, done: false };
    });

    if (L.gate) {
      const [x, fallback] = L.gate;
      this.gateX = x; this.gateName = meta.gate || fallback;
      this.add.image(x, GY, Art.gate(this, `gate-${this.index}-${this.gateName}`, this.gateName)).setOrigin(0.5, 1).setDepth(1);
      this.doorGlow = this.add.image(x, GY - 14, 'glow').setScale(1.3).setTint(0xffcf6b).setAlpha(0).setDepth(1);
    }
    if (L.finish) {
      this.finishGlow = this.add.image(L.finish, GY - 60, 'glow').setScale(1.2).setTint(0xff3b30).setDepth(0).setAlpha(0.6);
      this.finishSig = this.add.image(L.finish, GY, 'signal', 'red').setOrigin(0.5, 1).setScale(1.6).setDepth(1);
      this.add.image(L.finish, GY - 82, Art.label(this, 'sign-finish', 'FINISH LINE', '#ffe14d')).setOrigin(0.5, 1).setDepth(1);
      this.finished = false;
    }

    // Ekta
    this.player = this.physics.add.sprite(this.respawn.x, GY, 'ekta', 'idle0').setOrigin(0.5, 1).setDepth(5);
    this.size = ektaSize();
    this.player.setScale(this.size);
    this.setEktaBody();
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocityY(560);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.movers, (p, m) => { if (p.body.touching.down) this.riding = m; });
    this.physics.add.collider(this.player, this.jamCars);
    this.physics.add.overlap(this.player, this.items, (p, it) => this.pickup(it));
    this.physics.add.overlap(this.player, this.enemies, (p, e) => this.touchEnemy(e));

    this.sparkle = this.add.particles(0, 0, 'px', { lifespan: 450, speed: { min: 30, max: 90 }, scale: { start: 1, end: 0 }, tint: [0xffe14d, 0xffffff, 0xff9ad1], emitting: false }).setDepth(8);
    this.dust = this.add.particles(0, 0, 'puff', { lifespan: 400, speedX: { min: -20, max: 20 }, speedY: { min: -20, max: -5 }, scale: { start: 0.5, end: 0 }, tint: 0xcfc4b0, emitting: false }).setDepth(4);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width, H);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setFollowOffset(-50, 0);
    cam.setRoundPixels(true);

    this.keys = this.input.keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D', up: 'UP', w: 'W', space: 'SPACE', h: 'H' });

    UI.hud({ chai: G.stats.chai, bugs: G.stats.bugs, xp: G.stats.xp, level: this.levelName });
    UI.hudVisible(true);
    UI.scooter(null);
    UI.banner.hide();

    this.physics.pause();
    this.events.once('shutdown', () => { if (G.scene === this) G.scene = null; });
    if (this.index === 3) say('silkboard', null);
    // Level 1 opens with Ekta graduating and leaving college, then the road begins
    const opening = this.index === 0 ? this.graduation() : Promise.resolve();
    // the visitor may head back home mid-intro; then this level is gone and must not start
    const live = () => this.sys.isActive() && G.scene === this;
    opening.then(() => live() && UI.titleCard(this.index + 1, this.levelName, this.tagline)).then(() => {
      if (!live()) return;
      AudioSys.music(L.music);
      say('chalo', 'power');
      this.unfreeze();
    });
  }

  oneWay(body) { body.checkCollision.down = false; body.checkCollision.left = false; body.checkCollision.right = false; }
  isScooter() { return this.scooterUntil > this.time.now; }
  setEktaBody() { this.player.body.setSize(12, 26).setOffset(10, 6); }

  freeze() { this.state = 'frozen'; this.physics.pause(); }
  unfreeze() {
    this.physics.resume();
    this.state = 'play';
    this.jumpLock = this.time.now + 220;
    this.jumpAt = -1e9;
  }
  /** Pause the world, run an overlay flow, then resume. */
  async pauseFor(fn) {
    this.freeze();
    try { await fn(); } finally { if (this.scene.isActive()) this.unfreeze(); }
  }

  queueJump() { this.jumpAt = this.time.now; }

  update(time, delta) {
    const k = this.keys, JD = Phaser.Input.Keyboard.JustDown;
    const jd = [JD(k.space), JD(k.up), JD(k.w)].some(Boolean), hd = JD(k.h);
    const tj = Touch.consumeJump(), th = Touch.consumeHonk();
    this.parallax();
    if (this.state !== 'play') return;

    const now = time, dt = delta / 1000, p = this.player, b = p.body;
    this.wasRiding = !!this.riding;
    if (this.riding) { p.x += this.riding.body.deltaX(); this.riding = null; } // carried by the bus / auto
    const onGround = b.blocked.down || b.touching.down;
    const bot = G.mode === 'auto' ? this.autopilot(onGround, now) : null;
    if (jd || tj || (bot && bot.jump)) this.queueJump();
    if (hd || th) this.honk();

    const left = !bot && (k.left.isDown || k.a.isDown || Touch.left), right = bot ? true : (k.right.isDown || k.d.isDown || Touch.right);
    const jumpHeld = bot ? bot.hold : (k.space.isDown || k.up.isDown || k.w.isDown || Touch.jump);
    if (onGround) {
      this.lastGround = now;
      if (!this.riding && !this.wasRiding) this.safe = { x: p.x, y: p.y, dir: p.flipX ? -1 : 1 };
      if (!this.wasOnGround && this.fallSpeed > 260) {
        this.dust.explode(5, p.x, p.y);
        this.tweens.add({ targets: p, scaleY: this.size * 0.86, scaleX: this.size * 1.1, duration: 70, yoyo: true });
      }
    }
    this.wasOnGround = onGround;
    this.fallSpeed = b.velocity.y;

    let dir = 0;
    if (now > this.lockUntil) dir = (right ? 1 : 0) - (left ? 1 : 0);
    const scoot = this.isScooter(), max = scoot ? 240 : 150;
    if (now > this.lockUntil) {
      const target = dir * max, acc = (onGround ? 1500 : 950) * dt;
      let vx = b.velocity.x;
      vx = vx < target ? Math.min(target, vx + acc) : Math.max(target, vx - acc);
      p.setVelocityX(vx);
      if (dir) p.setFlipX(dir < 0);
    }

    if (now - this.jumpAt < 140 && now - this.lastGround < 110 && now > this.jumpLock) {
      p.setVelocityY(scoot ? -420 : -400);
      this.jumpAt = -1e9; this.lastGround = -1e9;
      this.cutOK = true;
      AudioSys.sfx('jump');
      this.dust.explode(4, p.x, p.y);
    }
    if (this.cutOK && !jumpHeld && b.velocity.y < -170) { p.setVelocityY(-170); this.cutOK = false; }
    if (b.velocity.y >= 0) this.cutOK = false;

    // look ahead in the direction Ekta is heading
    const cam = this.cameras.main, ahead = Math.abs(b.velocity.x) > 40 ? (b.velocity.x > 0 ? -70 : 40) : cam.followOffset.x;
    cam.followOffset.x += (ahead - cam.followOffset.x) * 0.04;

    // animation
    if (scoot) {
      if (Math.abs(b.velocity.x) > 10) p.anims.play('scoot', true); else { p.anims.stop(); p.setFrame('s0'); }
    } else if (now < this.hurtUntil) p.anims.play('ekta-hurt', true);
    else if (!onGround) p.anims.play(b.velocity.y < 0 ? 'ekta-jump' : 'ekta-fall', true);
    else if (Math.abs(b.velocity.x) > 15) p.anims.play('ekta-run', true);
    else p.anims.play('ekta-idle', true);

    if (this.scooterUntil && !scoot) this.endScooter();
    else if (scoot) UI.scooter(Math.ceil((this.scooterUntil - now) / 1000));

    this.updateEnemies(delta);
    this.movers.children.iterate(m => {
      if (m.x >= m.maxX && m.body.velocity.x > 0) m.setVelocityX(-m.speed);
      else if (m.x <= m.minX && m.body.velocity.x < 0) m.setVelocityX(m.speed);
      m.setFlipX(m.body.velocity.x < 0);
    });

    if (p.y > H + 40) { this.onFall(); return; }
    for (const cp of this.cps) if (!cp.done && p.x >= cp.x - 4) { this.hitCheckpoint(cp); return; }
    if (this.gateX && p.x >= this.gateX - 6) { this.enterGate(); return; }
    if (this.L.finish && !this.finished && p.x >= this.L.finish - 8) { this.finish(); return; }
  }

  /** Walkthrough driver: run right, hop potholes and bugs, honk traffic out of the way. */
  autopilot(onGround, now) {
    const p = this.player, ahead = p.x + 30 * this.size;
    // let the very first bug land a hit so the walkthrough shows one hurdle lesson
    const showLesson = this.index === 0 && G.stats.lessons === 0;
    if (!showLesson) this.invulnUntil = now + 500;
    const hole = x => !this.L.ground.some(([a, b]) => x > a && x < b);
    // on a platform, look further ahead so stepping off the edge never drops into a pothole
    const gap = hole(ahead) || (p.y < GY - 2 && hole(p.x + 60 * this.size));
    let car = false, bug = false;
    this.jamCars.children.iterate(c => { if (c && !c.cleared && c.x - p.x > 0 && c.x - p.x < 70) car = true; });
    if (!showLesson) this.enemies.children.iterate(e => { if (e && !e.dead && e.y >= GY - 1 && e.x - p.x > 0 && e.x - p.x < 44) bug = true; });
    if (car) this.honk();
    // hopping a bug right before a pothole would land in it; the walkthrough can't get hurt, so just run on
    let holeSoon = false;
    for (let d = 60; d <= 170; d += 10) if (hole(p.x + d * this.size)) holeSoon = true;
    const jump = onGround && (gap || (bug && !holeSoon));
    if (jump) this.botHold = true;
    else if (onGround && p.body.velocity.y >= 0) this.botHold = false;
    return { jump, hold: !!this.botHold };
  }

  parallax() {
    const sx = this.cameras.main.scrollX;
    this.layers[0].tilePositionX = sx * 0.12;
    this.layers[1].tilePositionX = sx * 0.35;
    this.layers[2].tilePositionX = sx * 0.7;
  }

  updateEnemies(delta) {
    this.enemies.children.iterate(e => {
      if (!e || e.dead) return;
      if (e.x <= e.minX && e.body.velocity.x < 0) e.setVelocityX(e.speed);
      else if (e.x >= e.maxX && e.body.velocity.x > 0) e.setVelocityX(-e.speed);
      e.setFlipX(e.body.velocity.x > 0);
      e.label.setPosition(Math.round(e.x), Math.round(e.y - 17));
      if (e.type === 'flaky') {
        e.flick = (e.flick + delta) % 2600;
        const vis = e.flick < 1700;
        if (vis !== e.solid) { e.solid = vis; e.setAlpha(vis ? 1 : 0.12); e.label.setAlpha(vis ? 1 : 0.35); }
        else if (vis && e.flick > 1400) e.setAlpha(Math.random() < 0.5 ? 0.35 : 1);
      }
    });
  }

  // ---------- interactions ----------
  pickup(it) {
    if (it.taken) return;
    it.taken = true;
    const { x, y } = it;
    if (it.kind === 'chai') {
      G.stats.chai++;
      UI.hud({ chai: G.stats.chai }); UI.bump('#hud-chai');
      AudioSys.sfx('collect');
      this.sparkle.explode(10, x, y);
      it.destroy();
    } else if (it.kind === 'mushroom') {
      it.glow.destroy(); it.lbl.destroy(); it.destroy();
      this.pauseFor(() => this.grow());
    } else if (it.kind === 'helmet') {
      it.destroy();
      this.startScooter();
    } else if (it.kind === 'comma') {
      it.glow.destroy(); it.destroy();
      this.sparkle.explode(20, x, y);
      G.stats.commas.add(this.index);
      this.pauseFor(() => UI.commaCard(G.stats.commas.size, (G.content.comma || {}).text || ''));
    }
  }

  startScooter() {
    const p = this.player;
    this.scooterUntil = this.time.now + 10000;
    p.setTexture('scooter', 's0');
    p.body.setSize(24, 24).setOffset(12, 12);
    AudioSys.sfx('power');
    say('honk', 'honk');
    this.popText(p.x, p.y - 40, 'txt-honk');
    UI.toast('🛵 Helmet on — scooter for 10 seconds!', 1800);
  }
  endScooter() {
    this.scooterUntil = 0;
    this.player.setTexture('ekta', 'idle0');
    this.setEktaBody();
    UI.scooter(null);
  }

  touchEnemy(e) {
    if (e.dead || this.state !== 'play') return;
    if (e.type === 'flaky' && !e.solid) return;
    const p = this.player, b = p.body;
    if (this.isScooter()) return this.killEnemy(e);
    if (b.velocity.y > 20 && b.bottom <= e.body.top + 8) {
      this.killEnemy(e);
      const held = this.keys.space.isDown || this.keys.up.isDown || this.keys.w.isDown || Touch.jump;
      p.setVelocityY(held ? -380 : -260);
      return;
    }
    this.hurt(e);
  }
  killEnemy(e) {
    e.dead = true;
    e.body.enable = false;
    e.anims.stop();
    G.stats.bugs++;
    UI.hud({ bugs: G.stats.bugs }); UI.bump('#hud-bugs');
    AudioSys.sfx('stomp');
    this.popText(e.x, e.y - 20, 'txt-fixed');
    this.sparkle.explode(12, e.x, e.y - 6);
    this.tweens.add({ targets: e, scaleY: 0.25, scaleX: 1.4, alpha: 0, duration: 260, onComplete: () => e.destroy() });
    this.tweens.add({ targets: e.label, alpha: 0, y: e.label.y - 8, duration: 260, onComplete: () => e.label.destroy() });
  }
  hurt(e) {
    const now = this.time.now, p = this.player;
    if (now < this.invulnUntil) return;
    this.invulnUntil = now + 1300; this.lockUntil = now + 320; this.hurtUntil = now + 320;
    const dir = p.x < e.x ? -1 : 1;
    p.setVelocity(dir * 190, -200);
    G.stats.chai = Math.max(0, G.stats.chai - 1);
    UI.hud({ chai: G.stats.chai });
    say('arreBhai', 'hurt');
    this.popText(p.x, p.y - 36, 'txt-ouch');
    this.tweens.add({ targets: p, alpha: 0.3, duration: 90, yoyo: true, repeat: 6, onComplete: () => p.setAlpha(1) });
    // each hurdle that lands a hit shows the next real problem Ekta faced and what she learnt
    const lessons = G.content.lessons || [];
    this.time.delayedCall(260, () => {
      if (this.state !== 'play' || G.stats.lessons >= lessons.length) return;
      const lesson = lessons[G.stats.lessons++];
      this.pauseFor(() => UI.lessonCard(lesson, BUG_NAMES[e.type] || 'BUG'));
    });
  }
  popText(x, y, key) {
    const t = this.add.image(Math.round(x), Math.round(y), key).setDepth(20);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  honk() {
    const now = this.time.now;
    if (now - this.lastHonk < 220) return;
    this.lastHonk = now;
    say('honk', 'honk');
    const p = this.player;
    this.popText(p.x + (p.flipX ? -10 : 10), p.y - 38, 'txt-honk');
    let best = null, bd = 170;
    this.jamCars.children.iterate(c => { if (c && !c.cleared) { const d = Math.abs(c.x - p.x); if (d < bd) { bd = d; best = c; } } });
    if (best) {
      best.cleared = true; best.body.enable = false;
      this.tweens.add({ targets: best, y: best.y - 22, x: best.x + 18, scale: 0.8, duration: 380, ease: 'Back.out', onComplete: () => { best.setDepth(-3).setTint(0xb0a8a0); } });
      UI.toast('Car cleared! 🚗💨', 900);
    }
  }

  // ---------- flows ----------
  async hitCheckpoint(cp) {
    cp.done = true;
    this.respawn = { x: cp.x, y: GY };
    const p = this.player;
    p.setVelocity(0, 0);
    await this.pauseFor(async () => {
      p.anims.play('ekta-idle', true);
      await wait(350);
      cp.s.setFrame('green'); AudioSys.sfx('chime');
      this.sparkle.explode(16, cp.x, GY - 30);
      await wait(450);
      await UI.dialog(dlg(cp.clip));
      if (cp.clip === '04') await UI.showcase(G.content.projects);
      if (cp.clip === '05') await UI.gallery(G.content.gallery, G.content.profile || {});
    });
  }

  async onFall() {
    if (this.falling) return;
    this.falling = true;
    this.freeze();
    AudioSys.sfx('hurt');
    if (!G.mistakeShown) {
      G.mistakeShown = true;
      await wait(250);
      await UI.dialog(dlg('07', { title: (dlg('07').title || 'A mistake I learned from') }));
    }
    this.cameras.main.fadeOut(160, 0, 0, 0);
    await wait(180);
    if (this.isScooter()) this.endScooter();
    const back = this.safe || { x: this.respawn.x, y: this.respawn.y, dir: 1 };
    let rx = back.x - back.dir * 20;
    if (back.y >= GY && !this.L.ground.some(([a, b]) => rx > a + 8 && rx < b - 8)) rx = back.x;
    this.player.body.reset(rx, back.y - 1);
    this.player.setFlipX(false);
    this.cameras.main.fadeIn(240, 0, 0, 0);
    this.invulnUntil = this.time.now + 1000;
    this.falling = false;
    this.unfreeze();
  }

  /** Opening scene: Ekta walks out of college with her degree and throws her cap. */
  async graduation() {
    const intro = G.content.intro || {}, p = this.player, sz = this.size;
    const college = intro.college || '', named = college && !/^\s*\[FILL/i.test(college);
    const sign = named ? (intro.collegeSign || college) : 'COLLEGE', cx = 64;
    this.add.image(cx, GY, Art.college(this, 'college-' + sign, sign)).setOrigin(0.5, 1).setDepth(1);
    p.setPosition(cx, GY).setFlipX(false).setAlpha(0).anims.play('ekta-idle', true);
    const cap = this.add.image(cx + 1, GY - 28 * sz, 'gradcap').setOrigin(0.5, 1).setDepth(6).setAlpha(0);
    const scroll = this.add.image(cx + 5, GY - 11 * sz, 'degree').setDepth(6).setAlpha(0);
    const crew = [p, cap, scroll];
    const tween = cfg => new Promise(r => this.tweens.add(Object.assign({}, cfg, { onComplete: r })));
    await wait(300);
    await tween({ targets: crew, alpha: 1, duration: 450 });
    p.anims.play('ekta-run', true);
    await tween({ targets: crew, x: '+=90', duration: 950 });
    p.anims.play('ekta-idle', true);
    UI.banner.show(`<div class="xp-title">🎓 GRADUATION DAY</div><div class="xp-what">${UI.rich(intro.degree || 'M.Tech + B.Tech in Computer Science')}</div>${college ? `<div class="grad-college">${UI.rich(college)}${intro.years ? ' · ' + UI.esc(intro.years) : ''}</div>` : ''}`, 'grad');
    await wait(1400);
    p.anims.play('ekta-cheer', true);
    AudioSys.sfx('power');
    this.sparkle.explode(30, cap.x, cap.y - 6);
    this.tweens.add({ targets: scroll, alpha: 0, duration: 300, delay: 300 });
    await tween({ targets: cap, y: cap.y - 110, angle: 540, duration: 850, ease: 'Quad.out' });
    this.sparkle.explode(24, cap.x, cap.y);
    await tween({ targets: cap, y: cap.y - 40, alpha: 0, duration: 400 });
    cap.destroy(); scroll.destroy();
    await wait(900);
    UI.banner.hide();
    p.anims.play('ekta-idle', true);
  }

  /** Mushroom: Ekta gains experience and visibly grows. Caller handles pausing. */
  async grow() {
    if (G.stats.xpFrom.has(this.index)) return;
    G.stats.xpFrom.add(this.index); G.stats.xp++;
    UI.hud({ xp: G.stats.xp }); UI.bump('#hud-xp');
    if (this.isScooter()) this.endScooter();
    const p = this.player, from = this.size, to = ektaSize(), cam = this.cameras.main;
    p.setVelocity(0, 0); p.setFlipX(false); p.anims.play('ekta-cheer', true);
    AudioSys.sfx('power');
    UI.xpBanner(this.experience, G.stats.xp, LEVELS.length);
    cam.zoomTo(1.4, 300);
    await wait(320);
    for (const sc of [to, from, to, from, to]) { p.setScale(sc); await wait(120); }
    this.size = to;
    this.sparkle.explode(24, p.x, p.y - 16 * to);
    this.popText(p.x, p.y - 34 * to - 4, 'txt-xp');
    await wait(1500);
    cam.zoomTo(1, 300);
    await wait(320);
    UI.banner.hide();
    p.anims.play('ekta-idle', true);
  }

  /** Walk into the level's gate (Intel, Zeta, ...) and on to the next level. */
  async enterGate() {
    if (this.state === 'clearing') return;
    this.state = 'clearing';
    this.physics.pause();
    if (this.isScooter()) this.endScooter();
    const p = this.player;
    if (this.L.mushroom && !G.stats.xpFrom.has(this.index)) await this.grow(); // missed it on the road: picked up at the gate
    p.setFlipX(false); p.anims.play('ekta-run', true);
    await new Promise(r => this.tweens.add({ targets: p, x: this.gateX, duration: 220, onComplete: r }));
    AudioSys.sfx('clear');
    this.tweens.add({ targets: this.doorGlow, alpha: 0.9, duration: 300 });
    await new Promise(r => this.tweens.add({ targets: p, alpha: 0, scaleX: this.size * 0.75, scaleY: this.size * 0.75, duration: 520, onComplete: r }));
    this.sparkle.explode(20, this.gateX, GY - 24);
    UI.toast(`Entered ${UI.esc(this.gateName)} ✓`, 1500);
    await wait(1300);
    G.level = this.index + 1;
    this.scene.restart({ index: G.level });
  }

  async finish() {
    this.finished = true;
    this.state = 'clearing';
    this.physics.pause();
    if (this.isScooter()) this.endScooter();
    const p = this.player;
    await wait(300);
    this.finishSig.setFrame('green');
    this.finishGlow.setTint(0x3dff6e);
    this.tweens.add({ targets: this.finishGlow, scale: 1.8, alpha: 0.9, duration: 500, yoyo: true, repeat: -1 });
    AudioSys.sfx('clear');
    p.anims.play('ekta-cheer', true);
    this.sparkle.explode(30, this.L.finish, GY - 70);
    await wait(1100);
    await UI.dialog(dlg('08'));
    AudioSys.music('victory');
    this.scene.start('Victory');
  }
}

// ======================================================================
class Victory extends Phaser.Scene {
  constructor() { super('Victory'); }
  create() {
    G.scene = null;
    UI.hudVisible(false); UI.banner.hide();
    this.bg = addParallax(this, 'dusk');
    this.add.tileSprite(0, GY, W, 32, 'ground-dusk').setOrigin(0);
    const glow = this.add.image(40, GY - 70, 'glow').setScale(1.6).setTint(0x3dff6e);
    this.tweens.add({ targets: glow, scale: 2.2, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
    this.add.image(40, GY, 'signal', 'green').setOrigin(0.5, 1).setScale(1.7);
    this.add.image(132, GY, 'scooterParked').setOrigin(0.5, 1);
    this.add.sprite(86, GY, 'ekta', 'cheer0').setOrigin(0.5, 1).setScale(ektaSize()).play('ekta-cheer');
    this.add.particles(0, -10, 'px', {
      x: { min: 0, max: W }, lifespan: 4200, speedY: { min: 40, max: 90 }, speedX: { min: -25, max: 25 },
      rotate: { min: 0, max: 360 }, scale: { min: 1, max: 2 }, frequency: 35,
      tint: [0xffcc1f, 0x2fb36b, 0xe2453c, 0x2b6bd9, 0xff6fa6, 0xffffff],
    });
    const express = G.mode === 'express';
    if (G.mode === 'auto') G.mode = 'play';
    UI.autoPill(null); UI.setAuto(false);
    UI.victory(G.stats, G.content, Menu, express);
  }
  update(t) { this.bg[0].tilePositionX = t * 0.003; this.bg[1].tilePositionX = t * 0.008; }
}

// ======================================================================
/* Express: the whole story in about a minute — each chapter's place, dialog and
   experience, no platforming. Dialogs and panels advance by themselves; Space skips ahead. */
class Express extends Phaser.Scene {
  constructor() { super('Express'); }
  create() {
    G.scene = null;
    UI.hudVisible(false); UI.banner.hide();
    this.run();
  }
  alive() { return this.sys.isActive(); }
  stage(i) {
    this.children.removeAll(true);
    const L = LEVELS[i];
    this.bg = addParallax(this, L.theme);
    this.add.tileSprite(0, GY, W, 32, 'ground-' + L.theme).setOrigin(0);
    if (i === 0) {
      const intro = G.content.intro || {}, named = intro.college && !/^\s*\[FILL/i.test(intro.college);
      const sign = named ? (intro.collegeSign || intro.college) : 'COLLEGE';
      this.add.image(64, GY, Art.college(this, 'college-' + sign, sign)).setOrigin(0.5, 1);
    }
    const meta = (G.content.levels || [])[i] || {};
    if (L.gate) this.add.image(400, GY, Art.gate(this, `gate-${i}-${meta.gate || L.gate[1]}`, meta.gate || L.gate[1])).setOrigin(0.5, 1);
    else this.add.image(400, GY, 'signal', 'green').setOrigin(0.5, 1).setScale(1.6);
    this.ekta = this.add.sprite(170, GY, 'ekta', 'idle0').setOrigin(0.5, 1).setScale(ektaSize()).play('ekta-idle');
    UI.autoPill(`EXPRESS · CHAPTER ${i + 1}/${LEVELS.length} · <i>SPACE TO SKIP AHEAD</i>`);
  }
  async chapter(i) {
    const L = LEVELS[i], meta = (G.content.levels || [])[i] || {};
    this.stage(i);
    await UI.titleCard(i + 1, meta.name || L.name, meta.tagline || L.tagline, 1500);
    if (!this.alive()) return false;
    AudioSys.music(L.music);
    const clips = { 0: ['02'], 1: ['03', '04'], 2: ['05'], 3: [] }[i];
    for (const id of clips) {
      await UI.dialog(dlg(id));
      if (!this.alive()) return false;
      if (id === '04') await UI.showcase(G.content.projects);
      if (id === '05') await UI.gallery(G.content.gallery, G.content.profile || {});
      if (!this.alive()) return false;
    }
    // experience earned here — Ekta grows, then heads for the next stop
    G.stats.xp = i + 1; G.stats.xpFrom.add(i);
    UI.xpBanner(meta.experience || L.experience || '', G.stats.xp, LEVELS.length);
    AudioSys.sfx('power');
    this.ekta.play('ekta-cheer');
    this.tweens.add({ targets: this.ekta, scale: ektaSize(), duration: 500, ease: 'Back.out' });
    await wait(1700);
    UI.banner.hide();
    if (!this.alive()) return false;
    this.ekta.play('ekta-run');
    await new Promise(r => this.tweens.add({ targets: this.ekta, x: 400, alpha: L.gate ? 0 : 1, duration: 1000, onComplete: r }));
    return this.alive();
  }
  async run() {
    for (let i = 0; i < LEVELS.length; i++) if (!(await this.chapter(i))) return;
    UI.autoPill(null);
    await UI.dialog(dlg('08'));
    if (!this.alive()) return;
    AudioSys.music('victory');
    this.scene.start('Victory');
  }
  update(t) { if (this.bg) { this.bg[0].tilePositionX = t * 0.003; this.bg[1].tilePositionX = t * 0.008; } }
}

// ======================================================================
// Boot the page
const $start = document.querySelector('#start-btn');
(function main() {
  // bouncing title letters
  document.querySelectorAll('.title span').forEach(w => {
    w.innerHTML = [...w.textContent].map((ch, i) => `<i style="animation-delay:${i * 0.07}s">${ch === ' ' ? '&nbsp;' : ch}</i>`).join('');
  });
  document.querySelector('#chai-ico').src = Art.iconURL('chai');
  document.querySelector('#bug-ico').src = Art.iconURL('bug');
  UI.setMute(AudioSys.isMuted());

  window.__game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#120c1c',
    pixelArt: true, roundPixels: true,
    physics: { default: 'arcade', arcade: { gravity: { y: 980 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    scene: [Boot, Title, Level, Express, Victory],
  });

  // ---------- the ways in: play, watch it play, 60-second version, chapter map, resume ----------
  const $title = document.querySelector('#title-screen');
  const profile = () => (G.content && G.content.profile) || {};
  let starting = false, run = 0; // run changes when the visitor goes home, cancelling an intro in progress
  async function begin(mode, index = 0) {
    if (starting || !G.content) return;
    starting = true;
    const mine = ++run;
    G.mode = mode;
    UI.setAuto(mode !== 'play');
    UI.autoPill(mode === 'auto' ? '▶ AUTOPLAY · <i>PRESS ANY KEY OR TAP TO TAKE THE WHEEL</i>' : null);
    AudioSys.init();
    Chat.hide();
    UI.hide($title); UI.helloStop(); UI.hideVictory(); UI.banner.hide();
    resetStats();
    for (let i = 0; i < index; i++) { G.stats.xp++; G.stats.xpFrom.add(i); }
    const g = window.__game;
    ['Title', 'Level', 'Express', 'Victory'].forEach(k => { if (g.scene.isActive(k) || g.scene.isPaused(k)) g.scene.stop(k); });
    if (index === 0 && mode !== 'express') {
      AudioSys.music('title');
      UI.hudVisible(false);
      document.querySelector('#hud').classList.remove('hidden');
      document.querySelector('#hud').classList.add('intro');
      await UI.dialog(dlg('01'));
      document.querySelector('#hud').classList.remove('intro');
    }
    if (mine !== run) return;
    starting = false;
    G.level = index;
    g.scene.start(mode === 'express' ? 'Express' : 'Level', { index });
  }
  async function openMap() {
    if (UI.isOpen()) return;
    const s = G.scene, wasPlaying = s && s.state === 'play';
    if (wasPlaying) s.freeze();
    const levels = LEVELS.map((L, i) => {
      const m = (G.content.levels || [])[i] || {};
      return { name: m.name || L.name, tagline: m.tagline || L.tagline, note: i === 0 ? 'starts at graduation' : '' };
    });
    const pick = await UI.chapterMap(levels, s ? s.index : -1);
    if (pick == null) { if (wasPlaying && G.scene === s) s.unfreeze(); return; }
    if (pick === 'home') goHome(); else begin('play', pick);
  }
  /** Back to the start screen with every way in. */
  function goHome() {
    G.mode = 'play'; UI.setAuto(false); UI.autoPill(null);
    run++; starting = false;
    document.querySelector('#hud').classList.remove('intro');
    UI.closeAll(); UI.hideVictory(); UI.banner.hide(); UI.hudVisible(false);
    resetStats();
    const g = window.__game;
    ['Level', 'Express', 'Victory'].forEach(k => { if (g.scene.isActive(k) || g.scene.isPaused(k)) g.scene.stop(k); });
    g.scene.start('Title');
    AudioSys.music('title');
    UI.show($title);
  }
  window.Menu = {
    again: () => begin('play'),
    watch: () => begin('auto'),
    express: () => begin('express'),
    map: openMap,
    home: goHome,
    resume: () => UI.resume(profile().resume),
  };
  $start.addEventListener('click', () => Menu.again());
  [['again', 'again'], ['watch', 'watch'], ['express', 'express'], ['map', 'map'], ['resume', 'resume']].forEach(([attr, fn]) =>
    document.querySelectorAll(`#title-screen [data-${attr}]`).forEach(b => b.addEventListener('click', () => Menu[fn]())));
  document.querySelector('#map-btn').addEventListener('click', e => { e.currentTarget.blur(); openMap(); });

  // captions on/off (C), remembered per visitor
  UI.setCC(UI.ccOn());
  document.querySelector('#cc-btn').addEventListener('click', e => { UI.setCC(!UI.ccOn()); e.currentTarget.blur(); });

  // walkthrough: any key or a tap on the road hands control to the visitor
  function takeWheel(e) {
    if (G.mode !== 'auto') return;
    if (e.target && (e.target.closest && e.target.closest('#chat, #chat-fab, #hud, #victory') || /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    G.mode = 'play'; UI.setAuto(false); UI.autoPill(null);
    if (G.scene) G.scene.botHold = false;
    UI.toast("You're driving now 🎮", 1600);
  }
  document.addEventListener('keydown', takeWheel, true);
  document.querySelector('#game').addEventListener('pointerdown', takeWheel);

  Chat.init();

  // global keys: mute, plus Enter on the title
  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyM') UI.setMute(AudioSys.toggleMute());
    if (e.code === 'KeyC') UI.setCC(!UI.ccOn());
  });
  document.querySelector('#mute').addEventListener('click', e => { UI.setMute(AudioSys.toggleMute()); e.currentTarget.blur(); });

  // tap-to-continue on dialogs
  document.querySelector('#stage').addEventListener('pointerdown', e => {
    if (!UI.isOpen()) return;
    if (e.target.closest('button, a, .panel-box, #touch, #chat')) return;
    UI.tap();
  });

  // touch controls
  document.querySelectorAll('#touch [data-k]').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => {
      e.preventDefault();
      btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
      btn.classList.add('down');
      if (UI.isOpen()) { if (k === 'jump') UI.tap(); return; }
      if (k === 'left' || k === 'right') Touch[k] = true;
      if (k === 'jump') { Touch.jump = true; Touch._jump = true; }
      if (k === 'honk') Touch._honk = true;
    };
    const up = e => { btn.classList.remove('down'); if (k === 'left' || k === 'right') Touch[k] = false; if (k === 'jump') Touch.jump = false; };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
})();
