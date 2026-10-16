import { agentInfo, plural } from './data.js';
import { drawStanding, drawLying, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, drawBubble, line, P, MINER_H } from './sprites.js';
import { themeOf } from './themes.js';

// Logical (pixel-art) layout of one funnel column. Funnels have 2-5 tanks with a mining zone above
// each tank and one more below the last (the output zone, where results come out into flasks).
// The scene is tall enough for 5 tanks; shorter funnels end higher up. Titles live in the page header.
export const CW = 200;
const ZW = 164, TOP = 27, ZH = 40, LH = 30, MAX_STAGES = 5;
// The pixel layer is drawn at RES× the logical grid: scenery stays blocky, gauges get finer pixels.
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
// Tanks narrow from 156 at the top to 76 at the bottom whatever their number, so every funnel
// is the same pyramid; stages in between are spaced evenly.
const tankW = (j, n) => Math.round((156 - (n > 1 ? j * 80 / (n - 1) : 0)) / 2) * 2;
const GAUGE_R = 9;
// The work piece under each gauge (anvil, flower bed…) sits right on the tank below, with a bit of
// pipe between it and the gauge; agents stand on the tank's top edge as on a floor.
const PLATE_H = 11;
const plateTop = k => zoneTop(k) + ZH - PLATE_H;
const outPlateTop = k => plateTop(k) - OUT_LIFT;
// Below the last tank there is no tank to sit on: gauge and plate move up together (the same gap
// between them as everywhere) so the pipe runs on past the plate to where results drip out.
const OUT_LIFT = 5;
const gaugeY = (k, out) => zoneTop(k) + 4 + GAUGE_R + 2 - (out ? OUT_LIFT : 0);
export const DAY_SECONDS = 2;
const PER_ROW = 10;  // result items per row under a funnel, the same for every theme
const FONT = '"Rubik", system-ui, sans-serif';

const PERIODS = ['d', 'w', 'h'];

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class Scene {
  // live: the agents report counts and states; nothing is simulated, agents keep their state.
  constructor(canvas, funnels, { live = false } = {}) {
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
    this.sparks = [];
    this.hits = [];
    this.dropAt = null;
    this.t = 0;
    this.days = 0;
    const r = rng(7);
    this.agents = [];
    const taken = new Map();
    this.funnels.forEach(f => f.workers.forEach(w => {
      // Two places per zone: left and right of the pipe. Extra agents are not shown.
      const key = f.title + '|' + w.zone, n = taken.get(key) || 0;
      if (n >= 2) return;
      taken.set(key, n + 1);
      const a = { ...w, f, side: n ? 'R' : 'L', rand: r, hitAt: 1 + r() * 3, phase: r() };
      if (w.state === 'sleep') a.wakeAt = w.wakeIn;
      if (w.state === 'work' && !live) a.workUntil = 20 + r() * 25;
      // The demo makes up what each agent's last run added; it then counts the items it adds.
      if (!live && a.added == null) a.added = w.state === 'sleep' ? 1 + Math.floor(r() * 6) : 0;
      this.agents.push(a);
    }));
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

  // Static layer: rock, tunnels, beams, pipes, gauge rims, tanks' glass.
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
        this.pipe(c, cx, k < 0 ? y + 4 : y, y + ZH);
        // On top: a small funnel at the very top of the column and a short pipe down to the gauge.
        if (k < 0) {
          this.pipe(c, cx, y + 1, y + 4);
          if (f.source_url) this.sheets(c, cx, y - 26);
          this.hopper(c, cx, y - 8, y + 1);
        }
        gaugeRim(c, cx, gaugeY(k, k === n - 1));
      }
      f.stages.forEach((s, j) => {
        const lw = tankW(j, n), x = cx - lw / 2, y = tankTop(j);
        c.fillStyle = theme.frame; c.fillRect(x, y, lw, LH);
        // The empty part of a tank is the theme's own dark ground, without items.
        c.fillStyle = theme.tankBg; c.fillRect(x + 2, y + 2, lw - 4, LH - 4);
      });
      // Below the last tank the pipe just ends; results drip out of it.
      c.fillStyle = '#7D828C'; c.fillRect(cx - 4, zoneTop(n - 1) + ZH, 9, 3);
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
  hopper(c, cx, y0, y1) {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0 - 1), half = Math.round(9 - t * 4.5);
      c.fillStyle = '#5E626B'; c.fillRect(cx - half, y, half * 2 + 1, 1);
      c.fillStyle = '#8E939D'; c.fillRect(cx - half + 1, y, half * 2 - 1, 1);
      c.fillStyle = '#B9BEC7'; c.fillRect(cx - half + 1, y, 2, 1);
    }
    c.fillStyle = '#B9BEC7'; c.fillRect(cx - 10, y0 - 1, 21, 1);
    c.fillStyle = '#5E626B'; c.fillRect(cx - 10, y0, 21, 1);
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

  pipe(c, cx, y0, y1) {
    c.fillStyle = '#5E626B'; c.fillRect(cx - 4, y0, 9, y1 - y0);
    c.fillStyle = '#8E939D'; c.fillRect(cx - 2, y0, 5, y1 - y0);
    c.fillStyle = '#B9BEC7'; c.fillRect(cx - 2, y0, 2, y1 - y0);
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
        const y = zoneTop(k), fl = f.flows[k + 1], gy = gaugeY(k, k === n - 1);
        // Below the last tank the drops run a little past the pipe's end, dripping out of it.
        this.drops(c, cx, y + 4, y + ZH + (k === n - 1 ? 9 : 0), fl, fi * 3 + k);
        gaugeFace(c, cx, gy, project(f).zones[k + 1], Math.sin(t * 3 + fi + k) * 0.015);
        // The plate under each gauge is what the agents work on; only the output zone's has text
        // on it: when the next result is due.
        theme.plate(c, cx - 13, k === n - 1 ? outPlateTop(k) : plateTop(k), 26, PLATE_H);
      }
      const pr = project(f);
      f.stages.forEach((s, j) => {
        const lw = tankW(j, n), x = cx - lw / 2, y = tankTop(j), inner = lw - 4;
        const fill = pr.fill[j];
        if (fill == null) {
          // Unknown how much is needed: light diagonal streaks over the empty tank instead of a level.
          c.save(); c.beginPath(); c.rect(x + 2, y + 2, inner, LH - 4); c.clip();
          c.fillStyle = 'rgba(255,255,255,0.13)';
          for (let d = -LH; d < inner; d += 6) for (let i = 0; i < LH; i += 2) c.fillRect(x + 2 + d + i, y + 2 + i, 2, 2);
          c.restore();
        } else {
          // The tank fills left to right (ore, liquid, coins or hearts, by theme): how much of
          // what is needed here for the whole goal.
          // The filling is drawn over the whole tank and a little past it, then cut at the level,
          // so a full tank is filled to its right wall and the pattern stays put as it rises.
          const w = Math.max(fill > 0 ? 2 : 0, Math.round(inner * fill / 2) * 2);
          if (w > 0) {
            c.save(); c.beginPath(); c.rect(x + 2, y + 2, w, LH - 4); c.clip();
            theme.tank(c, x + 2, y + 2, inner + 8, LH - 4, j, n, t, fi * 97 + j * 13 + 5);
            c.restore();
          }
        }
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
      if (a.question) {
        const bx = a.side === 'R' ? p.x - 16 : p.x + 30;
        drawBubble(c, bx, p.y - 14);
        this.hits.push({ x: Math.min(p.x, bx) - 4, y: p.y - 16, w: 52, h: 38, type: 'ask', a });
      } else this.hits.push({ x: p.x - 4, y: p.y - 14, w: 34, h: 36, type: 'agent', a });
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
      drawBubble(c, R ? p.x + 11 * P : p.x - 9 * P, p.y - 2 - Math.round(Math.abs(Math.sin(t * 4)) * 2) * P);
      this.hits.push({ x: R ? p.x - 2 : p.x - 20, y: p.y - 6, w: 44, h: 36, type: 'ask', a });
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
        // The number is the same size in every tank; next to it, how fast the tank fills (the flow of
        // the zone above it). What the tank holds shows on hover.
        const num = fmtCount(s.count), flow = f.flows[j] == null ? '' : fmtFlow(f.flows[j], unit);
        const maxW = (tankW(j, n) - 12) * S, y = (tankTop(j) + LH / 2 + 2) * S;
        const width = (text, size) => { g.font = `700 ${size * S}px ${FONT}`; return g.measureText(text).width; };
        const bigN = 15, gap = flow ? 4 * S : 0, wN = width(num, bigN);
        let fs = 9;
        while (flow && wN + gap + width(flow, fs) > maxW && fs > 6) fs -= 0.25;
        const x0 = cx * S - (wN + gap + (flow ? width(flow, fs) : 0)) / 2;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = S * 1.2;
        g.fillStyle = '#FFFFFF'; g.font = `700 ${bigN * S}px ${FONT}`; g.fillText(num, x0, y);
        if (flow) { g.fillStyle = '#9FE870'; g.font = `700 ${fs * S}px ${FONT}`; g.fillText(flow, x0 + wN + gap, y); }
        g.shadowColor = 'transparent'; g.shadowBlur = 0;
      });
      const pr = project(f);
      for (let k = -1; k < n; k++) {
        if (pr.zones[k + 1] == null) T('?', cx, gaugeY(k, k === n - 1) + 0.5, 7.5, '#2B2B2B', 'center', 700);
      }
      const ry = flasksY(n) + Math.ceil(slots(f) / PER_ROW) * 22 + 8;
      // Under the results, one thing per line: what they are, how many and how fast (as on a tank),
      // when the next one is due (coloured by pace against the goal), and the goal.
      const name = plural(5, f.result), num = String(f.cubes), outFlow = f.flows[n];
      T(name.charAt(0).toUpperCase() + name.slice(1), cx, ry, 8, '#D8CFC2', 'center', 600);
      g.font = `700 ${12 * S}px ${FONT}`; const wNum = g.measureText(num).width;
      const flowText = outFlow == null ? '' : fmtFlow(outFlow, unit);
      g.font = `700 ${8.5 * S}px ${FONT}`; const wFlow = flowText ? g.measureText(flowText).width + 3 * S : 0;
      const x0 = cx * S - (wNum + wFlow) / 2;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `700 ${12 * S}px ${FONT}`; g.fillStyle = f.cubes ? themeOf(f).accent : '#8C8276'; g.fillText(num, x0, (ry + 12) * S);
      if (flowText) { g.font = `700 ${8.5 * S}px ${FONT}`; g.fillStyle = '#9FE870'; g.fillText(flowText, x0 + wNum + 3 * S, (ry + 12) * S); }
      if (f.cubes >= f.goal.total) T('goal reached ✓', cx, ry + 24, 8, '#3CF27A', 'center', 700);
      else T(`next ${fmtEta(pr.eta)}`, cx, ry + 24, 7.5, pr.out == null ? '#B8AE9F' : statusColor(pr.out), 'center', 700);
      // Once the goal is reached, "goal reached ✓" replaces the goal line.
      if (f.cubes < f.goal.total) T(`goal: ${f.goal.total}, 1 per ${fmtEta(f.goal.every).slice(1)}`, cx, ry + 35, 7.5, '#B8AE9F', 'center', 500);
    });
    for (const a of this.agents) {
      if (a.state !== 'sleep') continue;
      const p = this.spot(a, 'rest');
      if (a.wakeAt != null) shadowed(() => T(fmtTimer(a.wakeAt - t), p.x + 14, p.y - 8, 8.5, '#F4EDE1', 'center', 700));
      for (let i = 0; i < 2; i++) {
        const q = ((t * 0.6 + i * 0.5) % 1);
        g.globalAlpha = 1 - q;
        const hx = a.side === 'R' ? p.x + 30 + q * 4 : p.x - 2 - q * 4;
        T('z', hx, p.y - 2 - q * 12, 7 + q * 3, '#BFD7FF', 'center', 700);
        g.globalAlpha = 1;
      }
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

  stageNeed(fi, j) { return project(this.funnels[fi]).need[j]; }
  // Seconds until a sleeping agent's next run, or null.
  sleepLeft(a) { return a.state === 'sleep' && a.wakeAt != null ? a.wakeAt - this.t : null; }
  waitingFor(f) { return this.agents.filter(a => a.f === f && (a.state === 'ask' || (a.state === 'sleep' && a.question))).length; }
}

// Rough projection for the gauges and tanks, from the funnel's own numbers (visual only, not a
// forecast model).
// Tank fill: items at a stage so far ÷ items needed there for the whole goal (goal.total results).
// "Needed" uses the conversion along the flows (out of a stage ÷ into it).
// Gauge of a zone: will the tank it feeds be full by the goal's date at this zone's flow? The date
// is when the remaining results are due at the goal pace (one per goal.every days). The reading is
// what the flow brings by then ÷ what the tank still misses: 1 is on the red mark, so the needle and
// the tank's level tell the same story. The output zone's "tank" is the results row.
// A reading is null (empty gauge) when it can't be estimated: no goal, or a flow not reported yet.
function project(f) {
  const st = f.stages, n = st.length, every = f.goal?.every, total = f.goal?.total, fl = f.flows;
  const conv = st.map((s, j) => (fl[j] > 0 && fl[j + 1] != null ? Math.min(1, fl[j + 1] / fl[j]) : null));
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
    if (days == null || flow == null || !want) return null;
    if (have >= want || days === 0) return 1e3; // already enough: the needle rests far right
    return flow * days / (want - have);
  };
  const zones = fl.map((flow, i) => f.manualPace?.[i] ?? reading(flow, i));
  return { zones, out: zones[n], eta: fl[n] > 0 ? 1 / fl[n] : null, fill, need };
}
const SWEEP0 = 0.75 * Math.PI, SWEEP = 1.5 * Math.PI;
// Pace vs goal: red — far behind, yellow — close, green — on pace, bright green — well ahead.
function statusColor(r) {
  return r >= 1.5 ? '#3CF27A' : r >= 0.9 ? '#7BD88F' : r >= 0.5 ? '#F2C14E' : '#FF5A4E';
}

export function gaugeRim(c, cx, gy) {
  fcircle(c, cx, gy, GAUGE_R + 1.5, '#2E3036');
  fcircle(c, cx, gy, GAUGE_R + 0.5, '#8E939D');
}

// r === null: reading unknown — a dimmed dial with no needle (a "?" is printed over it).
export function gaugeFace(c, cx, gy, r, wobble) {
  const known = r != null;
  fcircle(c, cx, gy, GAUGE_R - 0.5, known ? '#F1ECDD' : '#9C968A');
  c.fillStyle = known ? '#D0362B' : '#7A5650';
  // The red zone ends where the needle stops at its highest (1.06), so a maxed needle sits on its edge.
  for (let a = 0.95; a <= 1.0601; a += 0.01) {
    const ang = SWEEP0 + SWEEP * a;
    for (let d = GAUGE_R - 3; d <= GAUGE_R - 1; d += 0.5) {
      c.fillRect(snap(cx + Math.cos(ang) * d), snap(gy + Math.sin(ang) * d), 0.5, 0.5);
    }
  }
  for (let i = 0; i < 5; i++) {
    const ang = SWEEP0 + SWEEP * i / 5;
    fline(c, cx + Math.cos(ang) * (GAUGE_R - 3.5), gy + Math.sin(ang) * (GAUGE_R - 3.5), cx + Math.cos(ang) * (GAUGE_R - 1.5), gy + Math.sin(ang) * (GAUGE_R - 1.5), '#6B6D74');
  }
  if (!known) return;
  const pos = r > 0 ? 1 + Math.log10(r) / 1.5 : 0;
  const ang = SWEEP0 + SWEEP * Math.max(0, Math.min(1.06, pos + wobble));
  fline(c, cx, gy, cx + Math.cos(ang) * (GAUGE_R - 2.5), gy + Math.sin(ang) * (GAUGE_R - 2.5), '#1E2A44', 1);
  c.fillStyle = '#1E2A44'; c.fillRect(cx - 1, gy - 1, 2, 2);
}

// Fine-pixel helpers: half-unit pixels on the RES=2 layer.
const snap = v => Math.round(v * 2) / 2;
function fcircle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y += 0.5) for (let x = -r; x <= r; x += 0.5) {
    if (x * x + y * y <= r * r) c.fillRect(snap(cx + x), snap(cy + y), 0.5, 0.5);
  }
}
function fline(c, x0, y0, x1, y1, col, size = 0.5) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  c.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    c.fillRect(snap(x0 + (x1 - x0) * i / steps), snap(y0 + (y1 - y0) * i / steps), size, size);
  }
}

function circle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r + r * 0.6) c.fillRect(cx + x, cy + y, 1, 1);
  }
}

// Per-day flow shown in the chosen unit; slow flows step up to a longer unit so the number stays ≥ 1.
const UNITS = [['h', 1 / 24], ['d', 1], ['w', 7], ['mo', 30]];
export const fmtCount = n => n.toLocaleString('en-US');

function fmtFlow(perDay, key) {
  if (perDay == null) return '—';
  if (!perDay) return `+0/${key}`;
  let i = UNITS.findIndex(u => u[0] === key);
  while (i < UNITS.length - 1 && perDay * UNITS[i][1] < 0.95) i++;
  const v = perDay * UNITS[i][1];
  return `+${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}/${UNITS[i][0]}`;
}

function fmtEta(days) {
  if (days == null || !isFinite(days)) return '—';
  if (days < 1) return `≈${Math.round(days * 24)} h`;
  if (days < 60) return `≈${Math.round(days)} d`;
  return `≈${Math.round(days / 30)} mo`;
}

function fmtTimer(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 3600) return `${Math.round(sec / 3600)} h`;
  if (sec >= 60) return `${Math.round(sec / 60)} min`;
  return `0:${String(sec).padStart(2, '0')}`;
}
