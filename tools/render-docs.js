// Renders the README pictures (agents sheet, theme samples, the board) and the link preview card from the same drawing code as
// the dashboard and saves them through serve.py: open http://localhost:5173/tools/render-docs.html
// (always in English: the page adds ?lang=en to itself).
import { AGENTS, FUNNELS } from '../src/data.js?v=8dc61f91';
import { Scene, CW, H } from '../src/scene.js?v=8dc61f91';
import { THEMES } from '../src/themes.js?v=8dc61f91';
import { drawStanding, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp } from '../src/sprites.js?v=8dc61f91';

const FONT = 'Rubik, system-ui, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function save(c, name) {
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const res = await fetch(`/docs/img/${name}`, { method: 'PUT', body: blob });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
}

// All agents standing in a row, name under each.
function agentsSheet() {
  const ids = Object.keys(AGENTS), K = 6, cellW = 40, cellH = 46, cols = 5;
  const [c, g] = canvas(cols * cellW * K, Math.ceil(ids.length / cols) * cellH * K);
  g.fillStyle = '#1E1A17'; g.fillRect(0, 0, c.width, c.height);
  ids.forEach((id, i) => {
    const ox = (i % cols) * cellW, oy = Math.floor(i / cols) * cellH;
    g.setTransform(K, 0, 0, K, ox * K, oy * K);
    g.fillStyle = '#2A2420'; g.fillRect(4, 34, 32, 2);
    drawStanding(g, 10, 6, id, AGENTS[id].color);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `500 ${4.2 * K}px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#F4EDE1';
    g.fillText(AGENTS[id].name, (ox + cellW / 2) * K, (oy + 42) * K);
  });
  return c;
}

// One tile per theme: a working agent on the tank's top edge by its work piece, the tank, results.
function themesSheet() {
  const names = Object.keys(THEMES), K = 4, W = 180, Hh = 112, cols = 3;
  const [c, g] = canvas(cols * W * K, Math.ceil(names.length / cols) * Hh * K);
  const agentsFor = ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'mistral'];
  names.forEach((name, i) => {
    const th = THEMES[name], ox = (i % cols) * W, oy = Math.floor(i / cols) * Hh, r = rng(7 + i);
    g.setTransform(K, 0, 0, K, ox * K, oy * K);
    th.backdrop(g, 0, W, Hh, r);
    const [pe, pb, ps, pband] = th.pipe;
    g.fillStyle = pe; g.fillRect(86, 6, 9, 48);
    g.fillStyle = pb; g.fillRect(88, 6, 5, 48);
    g.fillStyle = ps; g.fillRect(88, 6, 2, 48);
    if (pband) for (let y = 14; y < 51; y += 14) { g.fillStyle = pband; g.fillRect(86, y, 9, th.bandH || 2); }
    th.plate(g, 77, 43, 26, 11);
    const id = agentsFor[i % agentsFor.length], ax = 57, ay = 26, hx = ax + 16.5, hy = ay + 15;
    drawStanding(g, ax, ay, id, AGENTS[id].color, -1, false, true, th.outfit);
    if (th.tool === 'pickaxe') drawPickaxe(g, hx, hy - 1, -0.9);
    else if (th.tool === 'shears') drawShears(g, hx, hy + 1, 0.6);
    else if (th.tool === 'beaker') drawBeaker(g, hx, hy, 0.9, '#B585F2');
    else if (th.tool === 'laptop') drawLaptop(g, hx - 3, hy + 2, 0.3);
    else if (th.tool === 'stamp') drawStamp(g, hx - 1, hy + 4, 0.5);
    else { drawBow(g, hx, hy, 0.6); drawArrow(g, hx + 1, hy); }
    // A funnel tank as on the board: a thin trapezoid, its pieces piled from the bottom middle
    // (a liquid in the lab), about half full.
    // The sides slope as gently as on the board (7 units each over the tank's height).
    const tx = 90, ty = 54, TH = 26, half = row => Math.round(74 - 7 * row / (TH - 1));
    // Which stage's pieces each sample shows: gold for the mine, blue floppies for code, banknotes
    // for money, the middle stage elsewhere.
    const [sj, sn] = { mine: [3, 5], code: [0, 5], money: [1, 5] }[name] || [1, 3];
    for (let row = 0; row < TH; row++) {
      const h = half(row);
      g.fillStyle = th.frame;
      if (row === 0 || row === TH - 1) g.fillRect(tx - h, ty + row, h * 2, 1);
      else { g.fillRect(tx - h, ty + row, 1, 1); g.fillRect(tx + h - 1, ty + row, 1, 1); g.fillStyle = th.tankBg; g.fillRect(tx - h + 1, ty + row, h * 2 - 2, 1); }
    }
    if (th.piece) {
      const P = th.piece, cells = [];
      for (let row = 0; row < Math.floor((TH - 3) / P.h); row++) {
        const top = ty + TH - 2 - (row + 1) * P.h, hw = half(Math.round(top - ty)) - 1.5, k = Math.floor(hw * 2 / P.w);
        for (let m = 0; m < k; m++) {
          const px = tx - k * P.w / 2 + m * P.w + (row % 2 ? P.w / 4 : 0);
          if (px + P.w <= tx + hw) cells.push({ x: px, y: top, score: row * 1.6 + Math.abs(px + P.w / 2 - tx) / P.w * 0.7 });
        }
      }
      cells.sort((a, b) => a.score - b.score).slice(0, Math.round(cells.length * 0.5)).forEach((cell, m) => P.draw(g, cell.x, cell.y, sj, sn, m));
    } else {
      g.save(); g.beginPath();
      for (let row = 12; row < TH - 1; row++) { const h = half(row) - 1; g.rect(tx - h, ty + row, h * 2, 1); }
      g.clip(); th.tank(g, 10, ty, 160, TH, 1, 3, 0, 11 + i); g.restore();
    }
    for (let k = 0; k < 3; k++) th.result(g, 64 + k * 18, 86, false);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `700 ${6 * K}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#F4EDE1';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = K * 1.5;
    g.fillText(name, (ox + 12) * K, (oy + 100) * K);
    g.shadowColor = 'transparent'; g.shadowBlur = 0;
  });
  return c;
}

// The dashboard itself: the first four funnels (without Dating) after a short run of the demo, so tanks have
// moved and agents are mid-action.
// The first columns of the demo as the dashboard shows them: titles on their column's backdrop
// (with the red badge of agents waiting), then the scene after 12 seconds of simulated time.
function overview() {
  const scale = 2, dpr = 2, cols = 4, K = scale * dpr, TH = 22;
  // The Dating funnel stays in the live demo but out of the pictures.
  const scene = new Scene(document.createElement('canvas'), FUNNELS.filter(f => f.theme !== 'love'));
  scene.resize(scale, dpr);
  for (let i = 0; i < 12 * 30; i++) { scene.update(1 / 30); scene.render(); }
  scene.render();
  const src = scene.canvas, w = Math.round(src.width * cols / scene.funnels.length);
  const [c, g] = canvas(w, TH * K + src.height);
  g.drawImage(src, 0, 0, w, src.height, 0, TH * K, w, src.height);
  for (let fi = 0; fi < cols; fi++) {
    const f = scene.funnels[fi], x = fi * CW * K, cx = x + CW * K / 2, cy = TH * K / 2;
    g.drawImage(scene.titleStrip(fi, TH), x, 0, CW * K, TH * K);
    g.font = `600 ${19 * dpr}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const waiting = scene.waitingFor(f), tw = g.measureText(f.title).width, bw = waiting ? 28 * dpr : 0;
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 6 * dpr; g.shadowOffsetY = dpr;
    g.fillStyle = '#F4EDE1'; g.fillText(f.title, cx - bw / 2, cy);
    g.shadowColor = 'transparent';
    if (waiting) {
      const bx = cx - bw / 2 + tw / 2 + 8 * dpr + 10 * dpr;
      g.fillStyle = '#FF6B5E'; g.beginPath(); g.arc(bx, cy, 10 * dpr, 0, Math.PI * 2); g.fill();
      g.font = `600 ${13 * dpr}px ${FONT}`; g.fillStyle = '#FFFFFF'; g.fillText(String(waiting), bx, cy + dpr / 2);
    }
  }
  return c;
}

// The link preview card (Open Graph, 1200×630): name and tagline on the left, three funnels of the
// board on the right.
async function ogCard(board) {
  const [c, g] = canvas(1200, 630);
  g.fillStyle = '#1B1714'; g.fillRect(0, 0, 1200, 630);
  // Three whole funnels, top to bottom, on the right.
  const sw = board.width * 3 / 4, sh = board.height, dh = 630, dw = Math.round(sw * dh / sh);
  g.drawImage(board, 0, 0, sw, sh, 1200 - dw, 0, dw, dh);
  g.fillStyle = '#4A3F35'; g.fillRect(1200 - dw - 4, 0, 4, 630);
  const logo = new Image();
  await new Promise(r => { logo.onload = r; logo.src = '/favicon.svg'; });
  g.imageSmoothingEnabled = false;
  g.drawImage(logo, 46, 210, 62, 62);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = `700 60px ${FONT}`;
  g.fillStyle = '#F4EDE1'; g.fillText('Goal', 120, 264);
  g.fillStyle = '#F2C14E'; g.fillText('Agents', 120 + g.measureText('Goal').width, 264);
  g.font = `500 28px ${FONT}`; g.fillStyle = '#F4EDE1';
  g.fillText('AI agents work your long goals.', 48, 336);
  g.fillText('You see the whole funnel.', 48, 374);
  g.font = `600 26px ${FONT}`; g.fillStyle = '#F2C14E';
  g.fillText('goalagents.run', 48, 446);
  return c;
}

// One funnel with labels on its right, each with a line to the part it explains: the README's guide
// to reading the board. The Job Search demo funnel after a few seconds, while Grok still sleeps.
function funnelGuide({ labels = true } = {}) {
  const scale = 2, dpr = 2, K = scale * dpr, TH = 22, side = 440, f0 = FUNNELS[0];
  // The agents the arrows point at stand on the left, by the labels, so no arrow crosses anything
  // on its way; the agent sharing a zone with them goes right.
  const sides = new Map([['claude', 'L'], ['gemini', 'R'], ['grok', 'L'], ['deepseek', 'R'], ['mistral', 'L'], ['qwen', 'R']]
    .map(([id, sd]) => [`${f0.title}|${id}`, sd]));
  const scene = new Scene(document.createElement('canvas'), [f0], { sides });
  scene.resize(scale, dpr);
  for (let i = 0; i < 5 * 30; i++) { scene.update(1 / 30); scene.render(); }
  scene.render();
  const src = scene.canvas, fw = CW * K;
  // Without labels (the landing page writes them as text, in the page's language) the picture is
  // just the funnel.
  const left = labels ? side : 0;
  const [c, g] = canvas(left + fw, TH * K + src.height);
  g.fillStyle = '#1B1714'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, fw, src.height, left, TH * K, fw, src.height);
  g.drawImage(scene.titleStrip(0, TH), left, 0, fw, TH * K);
  g.font = `600 ${19 * dpr}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#F4EDE1'; g.fillText(f0.title, left + fw / 2, TH * K / 2);

  // Points in the scene's logical coordinates → picture pixels.
  const P = (x, y) => [left + x * K, TH * K + y * K];
  const f = scene.funnels[0], n = f.stages.length, cx = scene.cx(0);
  const stage = j => scene.hits.find(h => h.type === 'stage' && h.j === j);
  const agent = (id, state) => scene.agents.find(a => a.agent === id && a.state === state);
  const s0 = stage(0), last = stage(n - 1);
  const ask = agent('claude', 'ask'), sleep = scene.spot(agent('grok', 'sleep'), 'rest'), work = scene.spot(agent('mistral', 'work'), 'work');
  const src0 = scene.hits.find(h => h.type === 'source');
  const resultsY = last.y + last.h + 40 + 9;
  // Each arrow ends on the left edge of what it explains.
  const notes = [
    [P(src0.x + 3, src0.y + 14), 'Sheet', 'The table where the agents keep track of everything.'],
    [P(s0.x + 1, s0.y + 6), 'Tank', 'Items at this stage so far, and +N a day.'],
    [P(ask.bubble.x, ask.bubble.y + 11), 'Question', 'An agent waits for your answer. Click it to reply.'],
    [P(sleep.x - 1, sleep.y + 1), 'Asleep', 'Resting until its next run; the timer counts down.'],
    [P(work.x + 1, work.y + 20), 'Agent at work', '+N is what its current run added.'],
    [P(cx - 45, resultsY + 8), 'Results', 'One per result the goal needs; filled ones are done.'],
    [P(cx - 23, resultsY + 54), 'Prediction', 'When the next result is due at the current pace.'],
  ];
  // The landing page's labels point at the same places: each as a fraction of the picture.
  if (!labels) {
    const points = notes.map(([[x, y], head]) => `${head}: x ${(x / c.width).toFixed(3)}, y ${(y / c.height).toFixed(3)}`);
    return Object.assign(c, { points });
  }
  const wrap = (text, w) => {
    const lines = [''];
    for (const word of text.split(' ')) {
      const tryLine = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + word : word;
      if (g.measureText(tryLine).width > w && lines[lines.length - 1]) lines.push(word); else lines[lines.length - 1] = tryLine;
    }
    return lines;
  };
  // A label beside its arrow: the heading on the arrow's level, the text under it. The arrow runs
  // straight across from the label column to the point.
  let bottom = 0;
  notes.sort((a, b) => a[0][1] - b[0][1]).forEach(([[tx, ty], head, text]) => {
    g.font = `500 22px ${FONT}`;
    const lines = wrap(text, side - 130), lh = 28, h = 36 + lines.length * lh, x = 70;
    const top = Math.max(bottom + 16, ty - 16);
    bottom = top + h;
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = `700 28px ${FONT}`; g.fillStyle = '#F2C14E'; g.fillText(head, x, top);
    const hw = g.measureText(head).width;
    g.font = `500 22px ${FONT}`; g.fillStyle = '#D8CFC2';
    lines.forEach((l, i) => g.fillText(l, x, top + 36 + i * lh));
    const y = ty, x0 = x + hw + 14, x1 = tx - 4, head2 = 14;
    g.strokeStyle = '#F2C14E'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1 - head2 + 2, y); g.stroke();
    g.fillStyle = '#F2C14E';
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 - head2, y - 8); g.lineTo(x1 - head2, y + 8); g.closePath(); g.fill();
  });
  return c;
}

const status = document.getElementById('status');
try {
  await document.fonts.ready;
  // ?only=funnel renders just the funnel guide, leaving the other pictures as they are.
  if (new URLSearchParams(location.search).get('only') === 'funnel') {
    await save(funnelGuide(), 'funnel.png');
    const plain = funnelGuide({ labels: false });
    await save(plain, 'funnel-plain.png');
    throw Object.assign(new Error(), { done: 'Saved docs/img/funnel.png and funnel-plain.png. Points: ' + plain.points.join('; ') });
  }
  await save(agentsSheet(), 'agents.png');
  await save(themesSheet(), 'themes.png');
  const board = overview();
  await save(board, 'overview.png');
  await save(await ogCard(board), 'og.png');
  await save(funnelGuide(), 'funnel.png');
  await save(funnelGuide({ labels: false }), 'funnel-plain.png');
  status.textContent = 'Saved docs/img/agents.png, themes.png, overview.png, og.png and funnel.png';
} catch (e) {
  status.textContent = e.done || 'Failed: ' + e.message;
}
