import { agentInfo, plural } from './data.js';
import { drawStanding, drawLying, drawPickaxe, drawHammer, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, drawBubble, line, P, MINER_H } from './sprites.js';
import { themeOf } from './themes.js';

// Logical (pixel-art) layout of one funnel column. Funnels have 2-5 tanks with a mining zone above
// each tank and one more below the last (the output zone, where results come out into flasks).
// The scene is tall enough for 5 tanks; shorter funnels end higher up. Titles live in the page header.
export const CW = 200;
const ZW = 164, TOP = 6, ZH = 40, LH = 30, MAX_STAGES = 5;
// The pixel layer is drawn at RES× the logical grid: scenery stays blocky, gauges get finer pixels.
const RES = 2;
const tankTop = j => TOP + ZH + j * (LH + ZH);
const zoneTop = k => (k < 0 ? TOP : tankTop(k) + LH);
const flasksY = n => zoneTop(n - 1) + ZH + 4;
export const H = flasksY(MAX_STAGES) + 50;
const tankW = (j, n) => Math.round((156 - (n > 1 ? j * 60 / (n - 1) : 0)) / 2) * 2;
const GAUGE_R = 9;
export const DAY_SECONDS = 2;
const PER_ROW = 9;  // result items per row under a funnel
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
      this.agents.push(a);
    }));
  }

  fi(f) { return this.funnels.indexOf(f); }
  cx(fi) { return fi * CW + CW / 2; }
  spot(a, kind) {
    const cx = this.cx(this.fi(a.f)), floor = zoneTop(a.zone) + ZH - 3, R = a.side === 'R';
    if (kind === 'work') return { x: R ? cx + 18 : cx - 38, y: floor - MINER_H };
    if (kind === 'ask') return { x: R ? cx + 32 : cx - 52, y: floor - MINER_H };
    return { x: R ? cx + 46 : cx - 74, y: floor - 10 * P };
  }

  resize(scale, dpr) {
    this.scale = scale; this.dpr = dpr; this.S = scale * dpr;
    const w = this.funnels.length * CW;
    this.lo.width = this.bg.width = w * RES; this.lo.height = this.bg.height = H * RES;
    this.canvas.style.width = w * scale + 'px';
    this.canvas.style.height = H * scale + 'px';
    this.canvas.width = Math.round(w * this.S); this.canvas.height = Math.round(H * this.S);
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
    c.fillStyle = '#1B1714'; c.fillRect(0, 0, w, H);
    this.funnels.forEach((f, fi) => {
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f);
      theme.backdrop(c, fi * CW, CW, H, r);
      for (let k = -1; k < n; k++) {
        const y = zoneTop(k);
        theme.zone(c, cx - ZW / 2, y, ZW, ZH, r);
        this.pipe(c, cx, y + 4, y + ZH);
        gaugeRim(c, cx, y + 4 + GAUGE_R + 2);
      }
      f.stages.forEach((s, j) => {
        const lw = tankW(j, n), x = cx - lw / 2, y = tankTop(j);
        c.fillStyle = theme.frame; c.fillRect(x, y, lw, LH);
        c.fillStyle = '#16314F'; c.fillRect(x + 2, y + 2, lw - 4, LH - 4);
      });
      c.fillStyle = '#7D828C'; c.fillRect(cx - 4, flasksY(n) - 4, 9, 3);
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
          if (a.to === 'work') { a.state = 'work'; a.workUntil = t + 20 + a.rand() * 20; a.hitAt = t + 1; }
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
        if (i === n) k = Math.min(k, Math.max(0, f.goal.total - f.cubes));
        if (!k) continue;
        if (i === n) f.cubes += k; else f.stages[i].count += k;
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
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f);
      for (let k = -1; k < n; k++) {
        const y = zoneTop(k), fl = f.flows[k + 1], gy = y + 4 + GAUGE_R + 2;
        this.drops(c, cx, y + 4, y + ZH, fl, fi * 3 + k);
        gaugeFace(c, cx, gy, project(f).zones[k + 1], Math.sin(t * 3 + fi + k) * 0.015);
        theme.plate(c, cx - 18, gy + GAUGE_R + 1, 36, 11);
        this.hits.push({ x: cx - 16, y: y + 4, w: 32, h: ZH - 4, type: 'gauge' });
      }
      const pr = project(f);
      f.stages.forEach((s, j) => {
        const lw = tankW(j, n), x = cx - lw / 2, y = tankTop(j), inner = lw - 4;
        const fill = pr.fill[j];
        if (fill == null) {
          // Unknown how much is needed: murky diagonal streaks instead of a water level.
          c.save(); c.beginPath(); c.rect(x + 2, y + 2, inner, LH - 4); c.clip();
          c.fillStyle = '#24476E';
          for (let d = -LH; d < inner; d += 6) for (let i = 0; i < LH; i += 2) c.fillRect(x + 2 + d + i, y + 2 + i, 2, 2);
          c.restore();
        } else {
          // The tank fills left to right (ore, liquid, coins or hearts, by theme): how much of
          // what is needed here for the whole goal.
          const w = Math.max(fill > 0 ? 2 : 0, Math.round(inner * fill / 2) * 2);
          if (w > 0) {
            c.save(); c.beginPath(); c.rect(x + 2, y + 2, w, LH - 4); c.clip();
            theme.tank(c, x + 2, y + 2, w, LH - 4, j, n, t, fi * 97 + j * 13 + 5);
            c.restore();
          }
        }
        c.fillStyle = 'rgba(205,235,255,0.5)'; c.fillRect(x + 4, y + 4, 1, LH - 8);
        this.hits.push({ x, y, w: lw, h: LH, type: 'stage', fi, j });
      });
      // One result item per result the goal needs (carts, flasks, chests…): filled ones are done,
      // empty ones are still to come.
      const total = f.goal.total;
      for (let i = 0; i < total; i++) {
        const row = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, total - row * PER_ROW), col = i % PER_ROW;
        const empty = i >= f.cubes;
        // Empty carts, flasks, chests and chips are faded so done results stand out.
        if (empty) c.globalAlpha = theme.emptyAlpha ?? 1;
        theme.result(c, Math.round(cx - (inRow * 18 - 2) / 2 + col * 18), flasksY(n) + row * 22, empty);
        c.globalAlpha = 1;
      }
    });
    for (const a of this.agents) this.drawAgent(c, a);
    for (const s of this.sparks) { c.fillStyle = s.col; c.fillRect(s.x, s.y, 2, 2); }
    if (this.dropAt !== null) {
      c.fillStyle = '#F2C14E'; c.fillRect(this.dropAt * CW - 2, 2, 4, H - 4);
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
      c.fillStyle = '#4A3A2A'; c.fillRect(p.x - 2, p.y + 10 * P, 15 * P, 2);
      drawLying(c, p.x, p.y, a.agent, info.color, a.side === 'R', outfit);
      this.hits.push({ x: p.x - 4, y: p.y - 14, w: 34, h: 36, type: 'agent', a });
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
    if (theme.tool === 'pickaxe' || theme.tool === 'hammer') {
      const cyc = ((t + a.phase) % 0.8) / 0.8;
      const ang = cyc < 0.7 ? 0.35 - (cyc / 0.7) * 2.3 : -1.95 + ((cyc - 0.7) / 0.3) * 2.3;
      (theme.tool === 'pickaxe' ? drawPickaxe : drawHammer)(c, hx, hy - 1, ang);
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
        const num = fmtCount(s.count), lab = ' ' + plural(s.count, s.forms);
        let size = 11;
        const maxW = (tankW(j, n) - 12) * S;
        const measure = sz => {
          g.font = `700 ${sz * S}px ${FONT}`; const a = g.measureText(num).width;
          g.font = `500 ${sz * 0.78 * S}px ${FONT}`; return [a, g.measureText(lab).width];
        };
        let [wn, wl] = measure(size);
        while (wn + wl > maxW && size > 7) { size -= 0.25;[wn, wl] = measure(size); }
        const x0 = cx * S - (wn + wl) / 2, y = (tankTop(j) + LH / 2 + 2) * S;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = S * 1.2;
        g.fillStyle = '#FFFFFF'; g.font = `700 ${size * S}px ${FONT}`; g.fillText(num, x0, y);
        g.fillStyle = '#EAF3FF'; g.font = `500 ${size * 0.78 * S}px ${FONT}`; g.fillText(lab, x0 + wn, y);
        g.shadowColor = 'transparent'; g.shadowBlur = 0;
      });
      const pr = project(f);
      for (let k = -1; k < n; k++) {
        const plateY = zoneTop(k) + 4 + 2 * GAUGE_R + 8.5;
        // The output zone's plate shows when the next result is due, coloured by pace vs goal.
        g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = S * 1.5;
        if (k === n - 1) T(fmtEta(pr.eta), cx, plateY, 7.5, pr.out == null ? '#B8AE9F' : statusColor(pr.out), 'center', 700);
        else T(fmtFlow(f.flows[k + 1], unit), cx, plateY, 7.5, '#FFFFFF', 'center', 700);
        g.shadowColor = 'transparent'; g.shadowBlur = 0;
        if (pr.zones[k + 1] == null) T('?', cx, zoneTop(k) + 4 + GAUGE_R + 2.5, 7.5, '#2B2B2B', 'center', 700);
      }
      const ry = flasksY(n) + Math.ceil(f.goal.total / PER_ROW) * 22 + 8;
      T(`${f.cubes} ${plural(f.cubes, f.result)}`, cx, ry, 9, f.cubes ? themeOf(f).accent : '#8C8276', 'center', 600);
      if (f.cubes >= f.goal.total) T('goal reached ✓', cx, ry + 11, 8, '#3CF27A', 'center', 700);
      else T(`goal: ${f.goal.total}, 1 per ${fmtEta(f.goal.every).slice(1)}`, cx, ry + 11, 7.5, '#B8AE9F', 'center', 500);
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
  cyclePeriod() { this.period = (this.period + 1) % PERIODS.length; }
  waitingFor(f) { return this.agents.filter(a => a.f === f && a.state === 'ask').length; }
  zoneName(a) {
    const st = a.f.stages, out = a.zone === st.length - 1;
    const from = a.zone < 0 ? 'new' : plural(5, st[a.zone].forms);
    return `${from} → ${plural(5, out ? a.f.result : st[a.zone + 1].forms)}`;
  }
}

// Rough projection for the gauges, from the funnel's own numbers (visual only, not a forecast model).
// Pass-through rate of each stage is next count / this count; the last stage's rate is results
// over its count, smoothed so an empty start does not read as zero. A zone's reading is how many
// results per day its current flow would yield, against the goal rate of one per goal.every days;
// the output zone's flow is already results per day.
// A reading is null (empty gauge) when it can't be estimated: no goal, flow not reported yet,
// or a stage further down is empty so its pass-through rate is unknown.
function project(f) {
  const st = f.stages, n = st.length, every = f.goal?.every;
  const pass = st.map((s, j) => (j < n - 1
    ? (s.count > 0 ? Math.min(1, st[j + 1].count / s.count) : null)
    : (f.cubes + 0.5) / (s.count + 1)));
  const yieldFrom = i => (pass.slice(i).includes(null) ? null : pass.slice(i).reduce((p, c) => p * c, 1));
  const reading = (fl, i) => {
    const y = yieldFrom(i);
    return every > 0 && fl != null && y != null ? fl * y * every : null;
  };
  const zones = f.flows.map(reading);
  const outFlow = f.flows[n];
  // Tank fill: items at this stage so far ÷ items needed here for the whole goal (goal.total
  // results). "Needed" uses the conversion along the flows (out of a stage ÷ into it).
  const fl = f.flows;
  const conv = st.map((s, j) => (fl[j] > 0 && fl[j + 1] != null ? Math.min(1, fl[j + 1] / fl[j]) : null));
  const total = f.goal?.total;
  const need = st.map((s, j) => {
    const c = conv.slice(j);
    if (!(total > 0) || c.includes(null)) return null;
    const y = c.reduce((p, v) => p * v, 1);
    return y > 0 ? total / y : null;
  });
  const fill = st.map((s, j) => (need[j] ? Math.min(1, s.count / need[j]) : null));
  return { zones, out: zones[n], eta: outFlow > 0 ? 1 / outFlow : null, fill, need };
}
const SWEEP0 = 0.75 * Math.PI, SWEEP = 1.5 * Math.PI;
// Pace vs goal: red — far behind, yellow — close, green — on pace, bright green — well ahead.
function statusColor(r) {
  return r >= 1.5 ? '#3CF27A' : r >= 0.9 ? '#7BD88F' : r >= 0.5 ? '#F2C14E' : '#FF5A4E';
}

function gaugeRim(c, cx, gy) {
  fcircle(c, cx, gy, GAUGE_R + 1.5, '#2E3036');
  fcircle(c, cx, gy, GAUGE_R + 0.5, '#8E939D');
}

// r === null: reading unknown — a dimmed dial with no needle (a "?" is printed over it).
function gaugeFace(c, cx, gy, r, wobble) {
  const known = r != null;
  fcircle(c, cx, gy, GAUGE_R - 0.5, known ? '#F1ECDD' : '#9C968A');
  c.fillStyle = known ? '#D0362B' : '#7A5650';
  for (let a = 0.89; a <= 1.0001; a += 0.01) {
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
  if (!perDay) return '0';
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
