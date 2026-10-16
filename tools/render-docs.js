// Renders the README pictures (agents sheet, theme samples, the board) and the link preview card from the same drawing code as
// the dashboard and saves them through serve.py: open http://localhost:5173/tools/render-docs.html
import { AGENTS, FUNNELS } from '../src/data.js';
import { Scene, CW, H } from '../src/scene.js';
import { THEMES } from '../src/themes.js';
import { drawStanding, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp } from '../src/sprites.js';

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
    g.fillStyle = '#5E626B'; g.fillRect(86, 6, 9, 48);
    g.fillStyle = '#8E939D'; g.fillRect(88, 6, 5, 48);
    th.plate(g, 77, 43, 26, 11);
    const id = agentsFor[i % agentsFor.length], ax = 57, ay = 26, hx = ax + 16.5, hy = ay + 15;
    drawStanding(g, ax, ay, id, AGENTS[id].color, -1, false, true, th.outfit);
    if (th.tool === 'pickaxe') drawPickaxe(g, hx, hy - 1, -0.9);
    else if (th.tool === 'shears') drawShears(g, hx, hy + 1, 0.6);
    else if (th.tool === 'beaker') drawBeaker(g, hx, hy, 0.9, '#B585F2');
    else if (th.tool === 'laptop') drawLaptop(g, hx - 3, hy + 2, 0.3);
    else if (th.tool === 'stamp') drawStamp(g, hx - 1, hy + 4, 0.5);
    else { drawBow(g, hx, hy, 0.6); drawArrow(g, hx + 1, hy); }
    g.fillStyle = th.frame; g.fillRect(16, 54, 148, 24);
    g.fillStyle = th.tankBg; g.fillRect(18, 56, 144, 20);
    g.save(); g.beginPath(); g.rect(18, 56, 92, 20); g.clip();
    th.tank(g, 18, 56, 92, 20, 1, 3, 0, 11 + i);
    g.restore();
    for (let k = 0; k < 3; k++) th.result(g, 64 + k * 18, 84, false);
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
  for (let i = 0; i < 12 * 30; i++) scene.update(1 / 30);
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

const status = document.getElementById('status');
try {
  await document.fonts.ready;
  await save(agentsSheet(), 'agents.png');
  await save(themesSheet(), 'themes.png');
  const board = overview();
  await save(board, 'overview.png');
  await save(await ogCard(board), 'og.png');
  status.textContent = 'Saved docs/img/agents.png, themes.png, overview.png and og.png';
} catch (e) {
  status.textContent = 'Failed: ' + e.message;
}
