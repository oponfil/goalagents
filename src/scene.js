import { agentInfo, plural } from './data.js?v=c80912cf';
import { drawStanding, drawLying, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, drawBubble, BUBBLE_STEP, line, P, MINER_H } from './sprites.js?v=c80912cf';
import { themeOf } from './themes.js?v=c80912cf';
import { t as tr, lang, fmtDuration } from './i18n.js?v=c80912cf';

// Logical (pixel-art) layout of one funnel column. Funnels have 2-5 tanks with a mining zone above
// each tank and one more below the last (the output zone, where results come out into flasks).
// The scene is tall enough for 5 tanks; shorter funnels end higher up. Titles live in the page header.
export const CW = 200;
const ZW = 164, TOP = 27, ZH = 40, LH = 46, MAX_STAGES = 5;
// The pixel layer is drawn at RES× the logical grid: scenery stays blocky, small pieces get finer pixels.
const RES = 2;
const tankTop = j => TOP + ZH + j * (LH + ZH);
const zoneTop = k => (k < 0 ? TOP : tankTop(k) + LH);
// Result items sit a little below the end of the last pipe.
const flasksY = n => zoneTop(n - 1) + ZH + 9;
export const H = flasksY(MAX_STAGES) + 50;
// Tall enough for the longest column: its tanks, the rows of result items and the four lines under them.
export const sceneHeight = funnels => Math.max(H, ...funnels.map(f =>
  flasksY(f.stages.length) + Math.ceil(slots(f) / PER_ROW) * 22 + 52));
// Result items under a funnel: one per result the goal needs, and more once agents go past it.
const slots = f => Math.max(f.goal?.total || 0, f.cubes || 0);
// The tanks make one funnel: each is a trapezoid from its own width at the top to the next one's
// at the bottom, 184 wide at the top of the funnel and 72 at the last tank, whatever their number.
// The last one narrows to 34, a little wider than the work piece under it.
const tankW = (j, n) => Math.round((184 - (n > 1 ? j * 112 / (n - 1) : 0)) / 2) * 2;
const tankHalf = (j, n, r) => {
  const top = tankW(j, n) / 2, bot = j + 1 < n ? tankW(j + 1, n) / 2 : 17;
  return Math.round(top + (bot - top) * r / (LH - 1));
};
// The work piece in each zone (ore rock, flower bed…) sits on the pipe right above the tank below;
// agents stand on the tank's top edge as on a floor.
const PLATE_H = 11;
const plateTop = k => zoneTop(k) + ZH - PLATE_H;
const outPlateTop = k => plateTop(k) - OUT_LIFT;
// Below the last tank there is no tank to sit on: the plate moves up so the pipe runs on past it
// to where results drip out.
const OUT_LIFT = 5;
export const DAY_SECONDS = 2;
const PER_ROW = 10;  // result items per row under a funnel, the same for every theme
// As on the page: Vietnamese needs Be Vietnam Pro (Rubik has no Vietnamese letters), Japanese takes
// Noto Sans JP before the Chinese font.
const FONT = lang === 'vi' ? '"Be Vietnam Pro", system-ui, sans-serif'
  : lang === 'ja' ? '"Rubik", "Noto Sans JP", system-ui, sans-serif'
    : '"Rubik", "Noto Sans Thai", "Noto Sans SC", system-ui, sans-serif';

const PERIODS = ['d', 'w', 'h'];

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class Scene {
  // live: the agents report counts and states; nothing is simulated, agents keep their state.
  constructor(canvas, funnels, { live = false, sides = null, heaps = null } = {}) {
    this.live = live;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.funnels = funnels.map(f => ({ ...f, stages: f.stages.map(s => ({ ...s })) }));
    this.H = sceneHeight(this.funnels);
    this.lo = document.createElement('canvas');
    this.lctx = this.lo.getContext('2d');
    this.bg = document.createElement('canvas');
    this.period = 0;
    this.floaters = [];
    // What each tank already holds is kept when the data refreshes (a new scene), so only new pieces
    // drop in; pieces still in the air land at once. A page load starts from empty and fills up.
    this.heaps = new Map();
    for (const [key, h] of heaps || []) this.heaps.set(key, { ...h, shown: h.shown + h.falling.length, falling: [], next: 0 });
    this.sparks = [];
    this.hits = [];
    this.dropAt = null;
    this.t = 0;
    this.days = 0;
    const r = rng(7);
    this.agents = [];
    // Two places per zone: left and right of the pipe; extra agents are not shown. An agent keeps
    // the side it had in the previous scene (sides: its map), so redraws don't swap agents around;
    // newcomers take the free side, in name order.
    const before = sides || new Map();
    this.sides = new Map();
    const place = [];
    this.funnels.forEach(f => {
      const zones = new Map();
      for (const w of f.workers) zones.set(w.zone, [...(zones.get(w.zone) || []), w]);
      for (const ws of zones.values()) {
        const sorted = [...ws].sort((p, q) => p.agent.localeCompare(q.agent)), used = new Set();
        const sideOf = new Map();
        for (const w of sorted) {
          const was = before.get(`${f.id ?? f.title}|${w.agent}`);
          if (was && !used.has(was)) { sideOf.set(w, was); used.add(was); }
        }
        for (const w of sorted) {
          if (sideOf.has(w)) continue;
          const free = ['L', 'R'].find(x => !used.has(x));
          if (!free) continue;
          sideOf.set(w, free); used.add(free);
        }
        for (const w of ws) if (sideOf.has(w)) place.push([f, w, sideOf.get(w)]);
      }
    });
    place.forEach(([f, w, side]) => {
      this.sides.set(`${f.id ?? f.title}|${w.agent}`, side);
      const a = { ...w, f, side, rand: r, hitAt: 1 + r() * 3, phase: r() };
      // Open questions, oldest first (the demo gives one as a plain string).
      a.questions = w.questions ?? (w.question ? [{ id: w.question_id ?? `demo-${w.agent}-${w.zone}`, question: w.question }] : []);
      a.replies = w.replies ?? [];
      if (w.state === 'sleep') a.wakeAt = w.wakeIn;
      if (w.state === 'work' && !live) a.workUntil = 20 + r() * 25;
      // The demo makes up what each agent's last run added; it then counts the items it adds.
      if (!live && a.added == null) a.added = w.state === 'sleep' ? 1 + Math.floor(r() * 6) : 0;
      this.agents.push(a);
    });
  }

  fi(f) { return this.funnels.indexOf(f); }
  cx(fi) { return fi * CW + CW / 2; }
  spot(a, kind) {
        // Agents stand level with the bottom of the plate, also in the output zone where it is lifted.
    const out = a.zone === a.f.stages.length - 1;
    const cx = this.cx(this.fi(a.f)), floor = zoneTop(a.zone) + ZH - (out ? OUT_LIFT : 0), R = a.side === 'R';
    if (kind === 'work') return { x: R ? cx + 18 : cx - 38, y: floor - MINER_H };
    if (kind === 'ask') return { x: R ? cx + 26 : cx - 46, y: floor - MINER_H };
    return { x: R ? cx + 52 : cx - 80, y: floor - 10 * P };
  }

  resize(scale, dpr) {
    this.scale = scale; this.dpr = dpr; this.S = scale * dpr;
    const w = this.funnels.length * CW;
    this.lo.width = this.bg.width = w * RES; this.lo.height = this.bg.height = this.H * RES;
    this.canvas.style.width = w * scale + 'px';
    this.canvas.style.height = this.H * scale + 'px';
    this.canvas.width = Math.round(w * this.S); this.canvas.height = Math.round(this.H * this.S);
    this.drawBackground();
  }

  // Reorder funnels (a view setting, not data). Agents keep their funnel, walkers shift with it.
  moveFunnel(from, to) {
    if (to === from || to === from + 1) return;
    const oldCx = this.funnels.map((f, i) => [f, this.cx(i)]);
    const [f] = this.funnels.splice(from, 1);
    this.funnels.splice(to > from ? to - 1 : to, 0, f);
    for (const a of this.agents) {
      if (a.state === 'walk') a.x += this.cx(this.fi(a.f)) - oldCx.find(([g]) => g === a.f)[1];
    }
    this.floaters = [];
    this.drawBackground();
  }
  order() { return this.funnels.map(f => f.title); }
  applyOrder(titles) {
    const rank = t => { const i = titles.indexOf(t); return i < 0 ? 1e9 : i; };
    this.funnels.sort((a, b) => rank(a.title) - rank(b.title));
    this.drawBackground();
  }

  // Static layer: backdrop, pipes, the hopper, tanks' outlines.
  drawBackground() {
    const c = this.bg.getContext('2d'), r = rng(42);
    const w = this.funnels.length * CW;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.fillStyle = '#1B1714'; c.fillRect(0, 0, w, this.H);
    this.funnels.forEach((f, fi) => {
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f);
      theme.backdrop(c, fi * CW, CW, this.H, r);
      for (let k = -1; k < n; k++) {
        // No room around a zone: agents work in the open, on top of the tank below.
        const y = zoneTop(k);
        // The pipe runs from the tank above (or the hopper on top) down to the tank below.
        this.pipe(c, cx, k < 0 ? y + 4 : y, y + ZH, theme);
        // On top: a small funnel at the very top of the column and a short pipe down from it.
        if (k < 0) {
          this.pipe(c, cx, y + 1, y + 4, theme);
          if (f.source_url) this.sheets(c, cx, y - 26);
          this.hopper(c, cx, y - 8, y + 1, theme);
        }
      }
      f.stages.forEach((s, j) => {
        // A thin outline: full top and bottom rows, one pixel down each side; inside, the theme's
        // dark ground.
        const y = tankTop(j);
        for (let r = 0; r < LH; r++) {
          const h = tankHalf(j, n, r);
          c.fillStyle = theme.frame;
          if (r === 0 || r === LH - 1) c.fillRect(cx - h, y + r, h * 2, 1);
          else {
            c.fillRect(cx - h, y + r, 1, 1); c.fillRect(cx + h - 1, y + r, 1, 1);
            c.fillStyle = theme.tankBg; c.fillRect(cx - h + 1, y + r, h * 2 - 2, 1);
          }
        }
      });
      // Below the last tank the pipe just ends; results drip out of it.
      c.fillStyle = theme.pipe[0]; c.fillRect(cx - 4, zoneTop(n - 1) + ZH, 9, 3);
      c.fillStyle = theme.pipe[1]; c.fillRect(cx - 2, zoneTop(n - 1) + ZH, 5, 2);
    });
  }

  // The column's backdrop for a strip h logical units tall: the funnel's title sits on it in the
  // page header, so the column's look reaches up behind its name.
  titleStrip(fi, h) {
    const strip = document.createElement('canvas');
    strip.width = CW * RES; strip.height = Math.ceil(h * RES);
    const c = strip.getContext('2d');
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.fillStyle = '#1B1714'; c.fillRect(0, 0, CW, h);
    themeOf(this.funnels[fi]).backdrop(c, 0, CW, h, rng(42 + fi));
    return strip;
  }

  // A small funnel on top of the first pipe, where new items pour in.
  // The small funnel on top, in the same material as the theme's pipe.
  hopper(c, cx, y0, y1, theme) {
    const [edge, body, shine] = theme?.pipe || ['#5E626B', '#8E939D', '#B9BEC7'];
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0 - 1), half = Math.round(9 - t * 4.5);
      c.fillStyle = edge; c.fillRect(cx - half, y, half * 2 + 1, 1);
      c.fillStyle = body; c.fillRect(cx - half + 1, y, half * 2 - 1, 1);
      c.fillStyle = shine; c.fillRect(cx - half + 1, y, 2, 1);
    }
    c.fillStyle = shine; c.fillRect(cx - 10, y0 - 1, 21, 1);
    c.fillStyle = edge; c.fillRect(cx - 10, y0, 21, 1);
  }

  // A funnel whose agent keeps its list behind a link: a spreadsheet file (folded corner, white
  // table) stands in the hopper. Clicking it opens the list.
  sheets(c, cx, y) {
    const x = cx - 8, R = (col, ...r) => { c.fillStyle = col; c.fillRect(...r); };
    R('#0F5130', x - 1, y - 1, 13, 23); R('#0F5130', x - 1, y + 4, 18, 18);
    R('#1E9E58', x, y, 11, 21); R('#1E9E58', x, y + 5, 16, 16);
    // The folded corner: a light triangle with its diagonal edge.
    for (let i = 0; i < 5; i++) { R('#7FD3A4', x + 11, y + i, i + 1, 1); R('#0F5130', x + 12 + i, y + i, 1, 1); }
    R('#FFFFFF', x + 3, y + 6, 10, 10);
    R('#1E9E58', x + 4, y + 7, 8, 1); R('#1E9E58', x + 4, y + 10, 8, 1); R('#1E9E58', x + 4, y + 13, 8, 1);
    R('#1E9E58', x + 7, y + 7, 1, 8);
  }
  sourceHit(fi) {
    const cx = this.cx(fi), y = TOP - 26;
    return { x: cx - 12, y, w: 26, h: 34, type: 'source', url: this.funnels[fi].source_url };
  }

  // The pipe in the theme's own material (iron, glass, hose, cable…), with its joints or lights.
  pipe(c, cx, y0, y1, theme) {
    const [edge, body, shine, band] = theme?.pipe || ['#5E626B', '#8E939D', '#B9BEC7', null];
    c.fillStyle = edge; c.fillRect(cx - 4, y0, 9, y1 - y0);
    c.fillStyle = body; c.fillRect(cx - 2, y0, 5, y1 - y0);
    c.fillStyle = shine; c.fillRect(cx - 2, y0, 2, y1 - y0);
    if (band) for (let y = y0 + 8; y < y1 - 3; y += 14) { c.fillStyle = band; c.fillRect(cx - 4, y, 9, theme.bandH || 2); }
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const a of this.agents) {
      if (a.state === 'sleep' && t >= a.wakeAt && !this.live) { a.state = 'walk'; a.to = 'work'; a.x = this.spot(a, 'rest').x; }
      if (a.state === 'work' && a.workUntil && t >= a.workUntil) { a.state = 'walk'; a.to = 'rest'; a.x = this.spot(a, 'work').x; }
      if (a.state === 'walk') {
        const target = this.spot(a, a.to).x;
        const step = 20 * dt * Math.sign(target - a.x);
        if (Math.abs(target - a.x) <= Math.abs(step)) {
          a.x = target;
          if (a.to === 'work') { a.state = 'work'; a.added = 0; a.workUntil = t + 20 + a.rand() * 20; a.hitAt = t + 1; }
          else { a.state = 'sleep'; a.wakeAt = t + 8 + a.rand() * 10; }
        } else a.x += step;
      }
    }
    this.flow(dt);
    this.floaters = this.floaters.filter(f => t - f.born < 1.4);
    this.sparks = this.sparks.filter(s => t - s.born < 0.25);
  }

  // Demo simulation: time runs DAY_SECONDS per day, and each zone moves items at its flow
  // (per day). A zone where nobody is working runs at a third of its flow. Results stop at the
  // goal. Increments are batched into one "+N" label per zone about once a second.
  flow(dt) {
    const t = this.t;
    this.days += dt / DAY_SECONDS;
    if (this.live) return;
    this.funnels.forEach(f => {
      const n = f.stages.length, cx = this.cx(this.fi(f));
      f.acc ??= new Array(n + 1).fill(0);
      f.pending ??= new Array(n + 1).fill(0);
      f.lastShown ??= new Array(n + 1).fill(0);
      for (let i = 0; i <= n; i++) {
        const fl = f.flows[i];
        if (!fl) continue;
        const busy = this.agents.some(a => a.f === f && a.zone === i - 1 && a.state === 'work');
        f.acc[i] += fl * (busy ? 1 : 1 / 3) * dt / DAY_SECONDS;
        let k = Math.floor(f.acc[i]);
        if (!k) continue;
        f.acc[i] -= k;
        if (i === n) f.cubes += k; else f.stages[i].count += k;
        // Results past the goal add rows: the scene grows down to fit them.
        if (i === n && this.scale && sceneHeight(this.funnels) > this.H) { this.H = sceneHeight(this.funnels); this.resize(this.scale, this.dpr); }
        // Credit the items to an agent at work in the zone that feeds this stage.
        const crew = this.agents.filter(a => a.f === f && a.zone === i - 1 && a.state === 'work');
        if (crew.length) crew[Math.floor(Math.random() * crew.length)].added += k;
        f.pending[i] += k;
      }
      for (let i = 0; i <= n; i++) {
        if (!f.pending[i] || t - f.lastShown[i] < 1) continue;
        const pos = i === n ? { x: cx + 86, y: flasksY(n) + 8 } : { x: cx + tankW(i, n) / 2 - 12, y: tankTop(i) + 10 };
        this.floaters.push({ ...pos, born: t, text: '+' + fmtCount(f.pending[i]) });
        f.pending[i] = 0; f.lastShown[i] = t;
      }
    });
  }

  render() {
    const c = this.lctx, t = this.t;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(RES, 0, 0, RES, 0, 0);
    this.hits = [];
    this.funnels.forEach((f, fi) => {
      if (f.source_url) this.hits.push(this.sourceHit(fi));
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f);
      for (let k = -1; k < n; k++) {
        const y = zoneTop(k), fl = f.flows[k + 1];
        // Below the last tank the drops run a little past the pipe's end, dripping out of it.
        this.drops(c, cx, y + 4, y + ZH + (k === n - 1 ? 9 : 0), fl, fi * 3 + k);
        // The plate in each zone is what the agents work on; only the output zone's has text
        // on it: when the next result is due.
        theme.plate(c, cx - 13, k === n - 1 ? outPlateTop(k) : plateTop(k), 26, PLATE_H);
      }
      const pr = project(f);
      f.stages.forEach((s, j) => {
        const lw = tankW(j, n), x = cx - lw / 2, y = tankTop(j);
        // What the tank holds rises with the share of what is needed here for the whole goal: a heap
        // of pieces (ore, flowers, coins, hearts, bits) dropped in one by one, or in the lab a liquid
        // that lies flat. A stage with items always shows a little.
        const rows = LH - 2, share = s.count > 0 ? Math.min(1, Math.max(pr.fill[j] ?? 0, 0.02)) : 0;
        if (theme.piece) this.drawHeap(c, f, fi, j, cx, y, share, theme);
        else this.drawLiquid(c, f, fi, j, cx, x, lw, y, share, theme);
        this.hits.push({ x, y, w: lw, h: LH, type: 'stage', fi, j });
      });
      // One result item per result the goal needs (chests, flasks, pots…): filled ones are done,
      // empty ones are still to come. Past the goal, new results keep adding rows.
      const total = slots(f);
      for (let i = 0; i < total; i++) {
        const row = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, total - row * PER_ROW), col = i % PER_ROW;
        const empty = i >= f.cubes;
        // Empty chests, flasks, pots and chips are faded so done results stand out.
        if (empty) c.globalAlpha = theme.emptyAlpha ?? 1;
        theme.result(c, Math.round(cx - (inRow * 18 - 2) / 2 + col * 18), flasksY(n) + row * 22, empty);
        c.globalAlpha = 1;
      }
    });
    for (const a of this.agents) this.drawAgent(c, a);
    for (const s of this.sparks) { c.fillStyle = s.col; c.fillRect(s.x, s.y, 2, 2); }
    if (this.dropAt !== null) {
      c.fillStyle = '#F2C14E'; c.fillRect(this.dropAt * CW - 2, 2, 4, this.H - 4);
    }

    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.lo, 0, 0, this.canvas.width, this.canvas.height);
    this.drawText(g);
  }

  drops(c, cx, y0, y1, fl, seed) {
    if (!fl) return;  // also null: flow not reported yet
    const speed = 8 + 22 * Math.min(1, Math.log10(1 + fl) / 1.5);
    const gap = 14;
    const off = (this.t * speed + seed * 5) % gap;
    c.fillStyle = '#CDEBFF';
    for (let y = y0 + off; y < y1 - 3; y += gap) c.fillRect(cx, Math.round(y), 2, 3);
  }

  drawAgent(c, a) {
    const t = this.t, info = agentInfo(a.agent), theme = themeOf(a.f), outfit = theme.outfit;
    if (a.state === 'sleep') {
      const p = this.spot(a, 'rest');
      drawLying(c, p.x, p.y, a.agent, info.color, a.side === 'R', outfit);
      // Asleep with a question still open: its bubble stays, on the side toward the pipe.
      if (a.questions.length) {
        const extra = (Math.min(4, a.questions.length) - 1) * BUBBLE_STEP;
        const bx = a.side === 'R' ? p.x - 16 - extra : p.x + 30;
        drawBubble(c, bx, p.y - 14, a.questions.length);
        a.bubble = { x: bx, y: p.y - 14 };
        this.hits.push({ x: Math.min(p.x, bx) - 4, y: p.y - 16, w: 52 + extra, h: 38, type: 'ask', a });
      } else this.hits.push({ x: p.x - 4, y: p.y - 14, w: 34, h: 36, type: 'agent', a });
      // Where the page pins the agent's reply note: just above its head.
      a.noteAt = { x: p.x + 14, y: p.y - 6 };
      return;
    }
    if (a.state === 'walk') {
      const p = this.spot(a, 'work');
      drawStanding(c, Math.round(a.x / P) * P, p.y, a.agent, info.color, Math.floor(t * 7), a.to === 'rest' ? a.side === 'L' : a.side === 'R', false, outfit);
      this.hits.push({ x: a.x - 2, y: p.y - 2, w: 24, h: 32, type: 'agent', a });
      return;
    }
    if (a.state === 'ask') {
      const p = this.spot(a, 'ask');
      const R = a.side === 'R';
      drawStanding(c, p.x, p.y, a.agent, info.color, -1, R, false, outfit);
      const extra = (Math.min(4, a.questions.length) - 1) * BUBBLE_STEP;
      a.bubble = { x: R ? p.x + 11 * P : p.x - 9 * P - extra, y: p.y - 2 - Math.round(Math.abs(Math.sin(t * 4)) * 2) * P };
      drawBubble(c, a.bubble.x, a.bubble.y, a.questions.length);
      this.hits.push({ x: R ? p.x - 2 : p.x - 20 - extra, y: p.y - 6, w: 44 + extra, h: 36, type: 'ask', a });
      return;
    }
    // Working agents face the pipe. The tool is drawn as for the left side (facing right) and
    // mirrored for the right side.
    const p = this.spot(a, 'work'), R = a.side === 'R', cx = this.cx(this.fi(a.f));
    drawStanding(c, p.x, p.y, a.agent, info.color, -1, R, true, outfit);
    const hx = p.x + 16.5, hy = p.y + 15, pipeX = R ? 2 * (p.x + 10) - (cx + 5) : cx - 5;
    c.save();
    if (R) { c.translate(2 * (p.x + 10), 0); c.scale(-1, 1); }
    let hit = false;
    if (theme.tool === 'pickaxe') {
      const cyc = ((t + a.phase) % 0.8) / 0.8;
      const ang = cyc < 0.7 ? 0.35 - (cyc / 0.7) * 2.3 : -1.95 + ((cyc - 0.7) / 0.3) * 2.3;
      drawPickaxe(c, hx, hy - 1, ang);
      hit = cyc > 0.95;
    } else if (theme.tool === 'shears') {
      // Gardener snips the bush: the blades open slowly and shut fast; leaves fly off.
      const cyc = ((t + a.phase) % 0.9) / 0.9;
      drawShears(c, hx, hy + 1, cyc < 0.75 ? cyc / 0.75 : 1 - (cyc - 0.75) / 0.25);
      hit = cyc > 0.95;
    } else if (theme.tool === 'beaker') {
      // Chemist pours: the beaker tips toward the pipe and drops fall in.
      const tip = 0.5 + 0.5 * Math.sin(t * 2.2 + a.phase * 6);
      drawBeaker(c, hx, hy, 0.2 + tip * 1.1, '#B585F2');
      if (tip > 0.75) for (let k = 0; k < 3; k++) {
        const q = (t * 2 + k / 3) % 1;
        c.fillStyle = '#B585F2'; c.fillRect(hx + 5 + q * (pipeX - hx - 5), hy - 4 + q * q * 10, 1.5, 1.5);
      }
      hit = tip > 0.97;
    } else if (theme.tool === 'laptop') {
      // Hacker types; bits fly from the laptop into the pipe.
      const q = (t * 1.5 + a.phase) % 1;
      drawLaptop(c, hx - 3, hy + 2, (t * 6 + a.phase) % 1);
      for (let k = 0; k < 3; k++) {
        const u = (q + k / 3) % 1;
        c.fillStyle = '#3CF27A'; c.fillRect(hx + 5 + u * (pipeX - hx - 5), hy - 3 - Math.sin(u * Math.PI) * 4, 1, 1.5);
      }
      hit = q > 0.95;
    } else if (theme.tool === 'stamp') {
      // Banker stamps the contract: lift, then press down hard.
      const cyc = ((t + a.phase) % 1.1) / 1.1;
      drawStamp(c, hx - 1, hy + 4, cyc < 0.75 ? cyc / 0.75 : 1 - (cyc - 0.75) / 0.25);
      hit = cyc > 0.97;
    } else {
      // Cupid draws the bow, then the arrow flies into the pipe.
      const cyc = ((t + a.phase) % 1.2) / 1.2;
      drawBow(c, hx, hy, cyc < 0.5 ? cyc * 2 : 0);
      if (cyc < 0.5) drawArrow(c, hx + 3 - cyc * 6, hy);
      else drawArrow(c, hx + 3 + (cyc - 0.5) / 0.5 * (pipeX - hx - 3), hy);
      hit = cyc > 0.96;
    }
    c.restore();
    if (hit && !this.sparks.some(s => s.a === a)) {
      for (let i = 0; i < 4; i++) {
        const dx = Math.floor(a.rand() * 6);
        this.sparks.push({ a, col: theme.spark, x: R ? cx + 6 + dx : cx - 6 - dx, y: p.y + 10 + Math.floor(a.rand() * 8), born: t });
      }
    }
    this.hits.push({ x: R ? p.x - 14 : p.x - 2, y: p.y - 4, w: 36, h: 34, type: 'agent', a });
    a.noteAt = { x: p.x + 10, y: p.y - 4 };
  }

  // Crisp text on the full-resolution canvas, over the pixel layer.
  drawText(g) {
    const S = this.S, t = this.t;
    const T = (s, x, y, size, color, align = 'center', weight = 400) => {
      g.font = `${weight} ${size * S}px ${FONT}`;
      g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
      g.fillText(s, x * S, y * S);
    };
    const shadowed = fn => { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowOffsetY = S * 0.6; fn(); g.shadowColor = 'transparent'; g.shadowOffsetY = 0; };
    const unit = PERIODS[this.period];
    this.funnels.forEach((f, fi) => {
      const cx = this.cx(fi), n = f.stages.length;
      f.stages.forEach((s, j) => {
        // The number is the same size in every tank; under it, how fast the tank fills (the flow of
        // the zone above it). What the tank holds shows on hover.
        const num = fmtCount(s.count), flow = fmtFlow(f.flows[j] ?? 0, unit);
        // The count, and under it the flow, both in the middle of the tank.
        shadowed(() => {
          T(num, cx, tankTop(j) + LH / 2 - 5, 15, '#FFFFFF', 'center', 700);
          if (flow) T(flow, cx, tankTop(j) + LH / 2 + 9, 8.5, f.flows[j] ? '#9FE870' : STALLED, 'center', 700);
        });
      });
      const pr = project(f);
      const ry = flasksY(n) + Math.ceil(slots(f) / PER_ROW) * 22 + 8;
      // Under the results, one thing per line: what they are, how many and how fast (as on a tank),
      // when the next one is due (coloured by pace against the goal), and the goal.
      const name = plural(5, f.result), num = String(f.cubes), outFlow = f.flows[n];
      T(name.charAt(0).toUpperCase() + name.slice(1), cx, ry, 8, '#D8CFC2', 'center', 600);
      g.font = `700 ${12 * S}px ${FONT}`; const wNum = g.measureText(num).width;
      const flowText = fmtFlow(outFlow ?? 0, unit);
      g.font = `700 ${8.5 * S}px ${FONT}`; const wFlow = flowText ? g.measureText(flowText).width + 3 * S : 0;
      const x0 = cx * S - (wNum + wFlow) / 2;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `700 ${12 * S}px ${FONT}`; g.fillStyle = f.cubes ? themeOf(f).accent : '#8C8276'; g.fillText(num, x0, (ry + 12) * S);
      if (flowText) { g.font = `700 ${8.5 * S}px ${FONT}`; g.fillStyle = outFlow ? '#9FE870' : STALLED; g.fillText(flowText, x0 + wNum + 3 * S, (ry + 12) * S); }
      if (f.cubes >= f.goal.total) T(tr('board.goalReached'), cx, ry + 24, 8, '#3CF27A', 'center', 700);
      else T(tr('board.next', fmtEta(pr.eta)), cx, ry + 24, 7.5, pr.out == null ? '#B8AE9F' : statusColor(pr.out), 'center', 700);
      // Once the goal is reached, "goal reached ✓" replaces the goal line.
      if (f.cubes < f.goal.total) T(tr('board.goal', f.goal.total, fmtEta(f.goal.every).slice(1)), cx, ry + 35, 7.5, '#B8AE9F', 'center', 500);
    });
    for (const a of this.agents) {
      if (a.state !== 'sleep') continue;
      const p = this.spot(a, 'rest');
      // Past its next run and still no word from it: how late it is, in an amber warning triangle,
      // instead of the timer.
      if (this.overdue(a)) {
        const late = fmtDuration(t - a.wakeAt);
        g.font = `700 ${7 * S}px ${FONT}`;
        const tw = g.measureText(late).width / S, cx = p.x + 14, base = p.y - 3, h = 17, half = Math.max(12, tw / 2 + 7);
        g.beginPath();
        g.moveTo(cx * S, (base - h) * S); g.lineTo((cx + half) * S, base * S); g.lineTo((cx - half) * S, base * S);
        g.closePath();
        g.lineJoin = 'round'; g.lineWidth = 1.6 * S; g.strokeStyle = '#1B1714'; g.fillStyle = '#F2A33C';
        g.fill(); g.stroke();
        T(late, cx, base - 4.2, 7, '#1B1714', 'center', 700);
      } else if (a.wakeAt != null) shadowed(() => T(fmtTimer(a.wakeAt - t), p.x + 14, p.y - 8, 8.5, '#F4EDE1', 'center', 700));
      for (let i = 0; i < 2; i++) {
        const q = ((t * 0.6 + i * 0.5) % 1);
        g.globalAlpha = 1 - q;
        const hx = a.side === 'R' ? p.x + 30 + q * 4 : p.x - 2 - q * 4;
        T('z', hx, p.y - 2 - q * 12, 7 + q * 3, '#BFD7FF', 'center', 700);
        g.globalAlpha = 1;
      }
    }
    // Five questions or more: the number before the bubble's single "!".
    for (const a of this.agents) {
      if (a.questions.length > 4 && a.bubble && (a.state === 'ask' || a.state === 'sleep')) T(String(a.questions.length), a.bubble.x + 9, a.bubble.y + 8.5, 9, '#FFFFFF', 'center', 700);
    }
    // What each agent added this run (the last run's while it sleeps), next to it.
    for (const a of this.agents) {
      if (!a.added || a.state === 'walk') continue;
      const R = a.side === 'R', p = this.spot(a, a.state === 'sleep' ? 'rest' : a.state);
      const x = a.state === 'sleep' ? (R ? p.x + 33 : p.x - 5) : R ? p.x + 26 : p.x - 6;
      const y = a.state === 'sleep' ? p.y + 8 : p.y + 4;
      shadowed(() => T('+' + fmtCount(a.added), x, y, 8, '#9FE870', 'center', 700));
    }
    for (const f of this.floaters) {
      const q = (t - f.born) / 1.4;
      g.globalAlpha = 1 - q * q;
      shadowed(() => T(f.text, f.x, f.y - q * 14, 9, '#9FE870', 'center', 700));
      g.globalAlpha = 1;
    }
  }

  hitTest(lx, ly) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (lx >= h.x && lx < h.x + h.w && ly >= h.y && ly < h.y + h.h) return h;
    }
    return null;
  }

  // The lab's tanks hold a liquid: its level rises a row per drop, each drop falling from the pipe
  // in the colour of the stage's liquid; kept across refreshes like the heaps.
  drawLiquid(c, f, fi, j, cx, x, lw, y, share, theme) {
    const n = f.stages.length, rows = LH - 2, key = `${f.id ?? f.title}|${j}`, t = this.t;
    let h = this.heaps.get(key);
    if (!h) { h = { shown: 0, falling: [], next: 0 }; this.heaps.set(key, h); }
    const want = Math.round(rows * share) || (share > 0 ? 1 : 0);
    if (h.shown > want) { h.shown = want; h.falling = []; }
    if (h.shown + h.falling.length < want && t >= h.next) { h.falling.push({ born: t }); h.next = t + 0.08; }
    h.falling = h.falling.filter(d => { if (t - d.born < 0.4) return true; h.shown++; return false; });
    if (h.shown > 0) {
      c.save(); c.beginPath();
      for (let r = rows - h.shown; r < rows; r++) { const hw = tankHalf(j, n, r + 1) - 1; c.rect(cx - hw, y + 1 + r, hw * 2, 1); }
      c.clip(); theme.tank(c, x - 20, y + 1, lw + 40, rows, j, n, t, fi * 97 + j * 13 + 5); c.restore();
    }
    const surface = y + 1 + rows - h.shown;
    c.fillStyle = theme.drop(j, n);
    for (const d of h.falling) { const q = (t - d.born) / 0.4; c.fillRect(cx - 0.5, Math.round((y - 2 + (surface - y + 1) * q * q) * 2) / 2, 1.5, 2); }
  }

  // The tank holds discrete pieces in cells, filled middle-first and low-first so they
  // pile up into a mound; as many cells are taken as the share of what the goal needs. Pieces join
  // one at a time, each falling from the pipe to its cell (also on load, so the heap builds up).
  drawHeap(c, f, fi, j, cx, y, share, theme) {
    const n = f.stages.length, P = theme.piece, key = `${f.id ?? f.title}|${j}`;
    let h = this.heaps.get(key);
    if (!h) {
      const cells = [], rows = Math.floor((LH - 3) / P.h);
      for (let r = 0; r < rows; r++) {
        const top = y + LH - 2 - (r + 1) * P.h, hw = tankHalf(j, n, Math.max(1, Math.round(top - y))) - 1.5;
        const k = Math.floor((hw * 2) / P.w);
        for (let i = 0; i < k; i++) {
          const px = cx - (k * P.w) / 2 + i * P.w + (r % 2 ? P.w / 4 : 0), off = Math.abs(px + P.w / 2 - cx) / P.w;
          if (px + P.w > cx + hw) continue;
          cells.push({ x: px, y: top, score: r * 1.6 + off * 0.7 + ((i * 7 + r * 3) % 5) * 0.05 });
        }
      }
      cells.sort((a, b) => a.score - b.score);
      h = { cells, shown: 0, falling: [], next: 0 };
      this.heaps.set(key, h);
    }
    const t = this.t, want = Math.min(h.cells.length, Math.round(h.cells.length * share)) || (share > 0 ? 1 : 0);
    if (h.shown > want) { h.shown = want; h.falling = []; }
    if (h.shown + h.falling.length < want && t >= h.next) {
      h.falling.push({ cell: h.cells[h.shown + h.falling.length], born: t });
      h.next = t + 0.05;
    }
    h.falling = h.falling.filter(d => {
      if (t - d.born < 0.45) return true;
      h.shown++; return false;
    });
    for (let i = 0; i < h.shown; i++) P.draw(c, Math.round(h.cells[i].x * 2) / 2, Math.round(h.cells[i].y * 2) / 2, j, n, i);
    for (const d of h.falling) {
      const q = (t - d.born) / 0.45, sx = cx - P.w / 2, sy = y - 2;
      P.draw(c, Math.round((sx + (d.cell.x - sx) * q) * 2) / 2, Math.round((sy + (d.cell.y - sy) * q * q) * 2) / 2, j, n, h.cells.indexOf(d.cell));
    }
  }

  stageNeed(fi, j) { return project(this.funnels[fi]).need[j]; }
  // A sleeping agent that should have run more than 5 minutes ago and has not reported since (an
  // agent says set_agent_state(work) first thing in a run). Only a sign to check on it: its
  // schedule may have slipped, or it may have stopped.
  overdue(a) { return this.live && a.state === 'sleep' && a.wakeAt != null && this.t - a.wakeAt > OVERDUE; }
  // Seconds until a sleeping agent's next run, or null.
  sleepLeft(a) { return a.state === 'sleep' && a.wakeAt != null ? a.wakeAt - this.t : null; }
  // Open questions in a funnel: from agents asking and agents that asked and went to sleep.
  waitingFor(f) {
    return this.agents.filter(a => a.f === f && (a.state === 'ask' || a.state === 'sleep')).reduce((n, a) => n + a.questions.length, 0);
  }
}

// Rough projection for the tanks and the next result, from the funnel's own numbers (visual only, not a
// forecast model).
// Tank fill: items at a stage so far ÷ items needed there for the whole goal (goal.total results).
// "Needed" uses the conversion between the tanks' counts, which agents keep cumulative: of the
// items that reached a stage, the share that reached the next one (the results for the last
// stage). Where a stage or the next one is still at 0 the conversion is unknown and a default of
// 30% stands in, so every tank shows a level from the first report.
// Pace of a zone: what its flow brings by the goal's date (when the remaining results are due at
// one per goal.every days) ÷ what the tank still misses; 1 is just in time. Only the output zone's
// is shown, as the colour of the "next" line. A flow nobody reported counts as 0.
const DEFAULT_CONVERSION = 0.3;
function project(f) {
  const st = f.stages, n = st.length, every = f.goal?.every, total = f.goal?.total, fl = f.flows.map(v => v ?? 0);
  const next = j => (j + 1 < n ? st[j + 1].count : f.cubes);
  const conv = st.map((s, j) => (s.count > 0 && next(j) > 0 ? Math.min(1, next(j) / s.count) : DEFAULT_CONVERSION));
  const need = st.map((s, j) => {
    const c = conv.slice(j);
    if (!(total > 0) || c.includes(null)) return null;
    const y = c.reduce((p, v) => p * v, 1);
    return y > 0 ? total / y : null;
  });
  // A reading an agent set by hand wins over the computed one.
  const fill = st.map((s, j) => f.manualFill?.[j] ?? (need[j] ? Math.min(1, s.count / need[j]) : null));
  const days = total > 0 && every > 0 ? Math.max(0, total - f.cubes) * every : null;
  const reading = (flow, i) => {
    const want = i < n ? need[i] : total, have = i < n ? st[i].count : f.cubes;
    if (days == null || !want) return 0;
    if (have >= want || days === 0) return 1e3; // already enough: the needle rests far right
    return flow * days / (want - have);
  };
  const zones = fl.map((flow, i) => reading(flow, i));
  return { zones, out: zones[n], eta: fl[n] > 0 ? 1 / fl[n] : null, fill, need };
}
// Pace vs goal, for the "next" line: red — far behind, yellow — close, green — on pace, bright
// green — well ahead.
// Nothing moving (+0): the same red as a "next" line far behind.
const STALLED = '#FF5A4E';
function statusColor(r) {
  return r >= 1.5 ? '#3CF27A' : r >= 0.9 ? '#7BD88F' : r >= 0.5 ? '#F2C14E' : '#FF5A4E';
}

function circle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r + r * 0.6) c.fillRect(cx + x, cy + y, 1, 1);
  }
}

// Per-day flow shown in the chosen unit; slow flows step up to a longer unit (up to a week) so the
// number stays ≥ 1 where it can.
const UNITS = [['h', 1 / 24], ['d', 1], ['w', 7]];
export const fmtCount = n => n.toLocaleString('en-US');

function fmtFlow(perDay, key) {
  const u = tr('units');
  if (perDay == null) return '—';
  if (!perDay) return `+0/${u[key]}`;
  let i = UNITS.findIndex(x => x[0] === key);
  while (i < UNITS.length - 1 && perDay * UNITS[i][1] < 0.95) i++;
  const v = perDay * UNITS[i][1];
  return `+${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}/${u[UNITS[i][0]]}`;
}

const fmtEta = days => (days == null || !isFinite(days) ? '—' : '≈' + fmtDuration(days * 86400));

const OVERDUE = 5 * 60;

export { fmtDuration };

// A sleeping agent's countdown: 0:45 in its last minute, then as a duration (15m, 8h).
function fmtTimer(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return sec >= 60 ? fmtDuration(sec) : `0:${String(sec).padStart(2, '0')}`;
}
