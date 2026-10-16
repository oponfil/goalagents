// Visual themes a funnel can use. The data and behaviour are the same; only the look changes:
// the zone walls, what fills the tanks, the result items, and the agents' outfit and tool.
//   mine  — miners with pickaxes striking ore, tanks of ore and gems, ore carts
//   lab   — chemists pouring into a Petri dish, tanks of liquid, flasks
//   forge — smiths hammering an anvil, tanks of coins, chests
//   love  — cupids shooting at a bed, tanks of hearts, big hearts
//   code  — hackers in hoodies typing on laptops over a keyboard, tanks of code, chips
//   money — bankers stamping a contract, tanks of banknotes, money bags

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
// Pick a colour by stage depth: the first stage gets the plainest, the last the richest.
const byDepth = (list, j, n) => list[Math.round((n > 1 ? j / (n - 1) : 1) * (list.length - 1))];

function heart(c, x, y, s, col) {
  // 7×6 pixel heart scaled by s.
  pixmap(c, x, y, s, ['.II.II.', 'IIIIIII', 'IIIIIII', '.IIIII.', '..III..', '...I...'], { I: col });
}

// Small pixel pictures: one string per row, one letter per pixel, colours by letter; '.' is empty.
function pixmap(c, x, y, s, rows, colors) {
  rows.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      const col = colors[row[i]];
      if (col) { c.fillStyle = col; c.fillRect(x + i * s, y + r * s, s, s); }
    }
  });
}
// Romance from light to close, top stages to bottom: a flower, a love letter, a heart, a kiss, a ring.
// The flower is seen from above: five round petals around a pale centre, on half-unit pixels.
function flower(c, x, y, s, col) {
  const cx = x + 2.75, cy = y + 2.5;
  const disc = (px, py, r, colour) => {
    c.fillStyle = colour;
    for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) {
      if (dx * dx + dy * dy <= r * r) c.fillRect(Math.round((px + dx) * 2) / 2, Math.round((py + dy) * 2) / 2, 0.5, 0.5);
    }
  };
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
    disc(cx + Math.cos(a) * 1.8, cy + Math.sin(a) * 1.8, 1.05, col);
  }
  disc(cx, cy, 0.6, '#FFF0F6');
}
const letter = (c, x, y, s, col) => pixmap(c, x, y + 0.5, s,
  ['EEEEEEE', 'EDEEEDE', 'EEDEDEE', 'EEEDEEE', 'EEEEEEE'], { E: col, D: '#7A2A48' });
const ring = (c, x, y, s) => pixmap(c, x, y, s,
  ['...D...', '..DDD..', '..GGG..', '.G...G.', '.G...G.', '..GGG..'], { G: '#F2C14E', D: '#DFF6FF' });
const lips = (c, x, y, s, col) => pixmap(c, x, y, s,
  ['.......', '.LL.LL.', 'LLLLLLL', 'DDDDDDD', '.LLLLL.', '..LLL..'], { L: col, D: '#5A0A1E' });


// --- Column backdrops: (c, x, w, h, r) behind everything in the funnel's column ---

function backMine(c, x, w, h, r) {
  rect(c, x, 0, w, h, '#2A2521');
  for (let i = 0; i < w * h / 10; i++) {
    const v = r();
    c.fillStyle = v < 0.5 ? '#241F1B' : v < 0.85 ? '#322C26' : '#3B342C';
    c.fillRect(x + (Math.floor(r() * w) & ~1), Math.floor(r() * h) & ~1, v < 0.7 ? 4 : 2, 2);
  }
}
function backLab(c, x, w, h) {
  rect(c, x, 0, w, h, '#1C262E');
  for (let ty = 0; ty < h; ty += 10) for (let tx = x; tx < x + w; tx += 10) rect(c, tx, ty, 9.5, 9.5, '#212D37');
}
function backForge(c, x, w, h) {
  rect(c, x, 0, w, h, '#22120E');
  for (let by = 0, row = 0; by < h; by += 7, row++) {
    for (let bx = x + (row % 2 ? -7 : 0); bx < x + w; bx += 14) rect(c, Math.max(x, bx), by, Math.min(13, x + w - Math.max(x, bx)), 6, '#2E1812');
  }
}
function backLove(c, x, w, h, r) {
  rect(c, x, 0, w, h, '#1E1028');
  for (let i = 0; i < w * h / 120; i++) rect(c, x + Math.floor(r() * w), Math.floor(r() * h), 1, 1, r() < 0.7 ? '#6A4A80' : '#E8B8E0');
  for (let i = 0; i < 8; i++) heart(c, x + Math.floor(r() * (w - 6)), Math.floor(r() * (h - 6)), 0.6, '#3A1E48');
}
function backCode(c, x, w, h) {
  rect(c, x, 0, w, h, '#0A0F14');
  for (let gx = x; gx < x + w; gx += 8) rect(c, gx, 0, 0.5, h, '#0F1A16');
  for (let gy = 0; gy < h; gy += 8) rect(c, x, gy, w, 0.5, '#0F1A16');
}
function backMoney(c, x, w, h) {
  rect(c, x, 0, w, h, '#14201A');
  for (let px = x + 4; px < x + w; px += 18) { rect(c, px, 0, 14, h, '#182820'); rect(c, px, 0, 0.5, h, '#22362A'); }
}

// --- Zone backgrounds: (c, x0, y, w, h, r) with r a seeded random ---

function zoneMine(c, x0, y, w, h, r) {
  rect(c, x0, y, w, h, '#17130F');
  c.fillStyle = '#1F1913';
  for (let i = 0; i < 60; i++) c.fillRect(x0 + (Math.floor(r() * w) & ~1), y + (Math.floor(r() * h) & ~1), 4, 2);
  rect(c, x0 - 2, y, w + 4, 4, '#5A3D22'); rect(c, x0 - 2, y, w + 4, 2, '#7A5530');
  rect(c, x0 - 2, y, 4, h, '#5A3D22'); rect(c, x0 + w - 2, y, 4, h, '#5A3D22');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#3B2B1A');
}

function zoneLab(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#18222A');
  c.fillStyle = '#1F2C36';
  for (let ty = y + 4; ty < y + h; ty += 8) for (let tx = x0 + ((ty / 8) % 2 ? 0 : 4); tx < x0 + w; tx += 8) c.fillRect(tx, ty, 7, 7);
  rect(c, x0 - 2, y, w + 4, 4, '#7D8794'); rect(c, x0 - 2, y, w + 4, 1, '#B9C2CC');
  rect(c, x0 - 2, y, 3, h, '#5E6670'); rect(c, x0 + w - 1, y, 3, h, '#5E6670');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#4A525C');
}

function zoneForge(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#2A1510');
  c.fillStyle = '#3A1E16';
  for (let by = y + 4, row = 0; by < y + h - 2; by += 6, row++) {
    for (let bx = x0 + (row % 2 ? -6 : 0); bx < x0 + w; bx += 12) c.fillRect(Math.max(x0, bx), by, Math.min(11, x0 + w - Math.max(x0, bx)), 5);
  }
  c.fillStyle = 'rgba(255,120,40,0.18)'; c.fillRect(x0, y + h - 10, w, 8);
  rect(c, x0 - 2, y, w + 4, 4, '#3A3A3E'); rect(c, x0 - 2, y, w + 4, 1, '#6A6A70');
  rect(c, x0 - 2, y, 4, h, '#3A3A3E'); rect(c, x0 + w - 2, y, 4, h, '#3A3A3E');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#1E1E22');
}

function zoneLove(c, x0, y, w, h, r) {
  rect(c, x0, y, w, h, '#2A1530');
  for (let i = 0; i < 18; i++) rect(c, x0 + Math.floor(r() * w), y + 5 + Math.floor(r() * (h - 8)), 1, 1, r() < 0.5 ? '#E8B8E0' : '#7A4A8A');
  rect(c, x0 - 2, y, w + 4, 4, '#2E6B3A'); rect(c, x0 - 2, y + 1, w + 4, 1, '#4E9B5A');
  for (let fx = x0 + 4; fx < x0 + w; fx += 14) { rect(c, fx, y, 3, 3, '#F28AB8'); rect(c, fx + 1, y + 1, 1, 1, '#FFE0F0'); }
  rect(c, x0 - 2, y, 3, h, '#2E6B3A'); rect(c, x0 + w - 1, y, 3, h, '#2E6B3A');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#1E4A28');
}

// --- Tank fillings: (c, x, y, w, h, j, n, t, seed) fill the box from the left, w wide ---

function tankMine(c, x, y, w, h, j, n, t, seed) {
  const ore = byDepth([['#4A4A4A', '#6B6B6B'], ['#9C5A2E', '#C47A45'], ['#A9B0B8', '#DDE3EA'], ['#D9A520', '#FFD866'], ['#3FC7DA', '#B8F4FF']], j, n);
  rect(c, x, y, w, h, '#2A2420');
  const r = rng(seed);
  for (let gy = y; gy < y + h - 1; gy += 4) for (let gx = x + (r() * 3 | 0); gx < x + w - 2; gx += 5 + (r() * 3 | 0)) {
    rect(c, gx, gy + (r() * 2 | 0) * 0.5, 3.5, 3, ore[0]);
    rect(c, gx + 0.5, gy + 0.5, 1.5, 1, ore[1]);
  }
  // an occasional glint
  const g = Math.floor((t * 1.3 + seed) % 7);
  if (w > 8) rect(c, x + ((g * 23 + seed) % Math.max(1, w - 2)), y + 2 + (g % 3) * 6, 1, 1, '#FFFFFF');
}

function tankLab(c, x, y, w, h, j, n, t, seed) {
  const [base, top] = byDepth([['#4FA3C8', '#8FD3F0'], ['#3D7FD0', '#79B4F0'], ['#5B5BD8', '#9A9AF0'], ['#7A3BD0', '#B585F2'], ['#9B2BC0', '#D58AF0']], j, n);
  rect(c, x, y, w, h, base); rect(c, x, y, w, 2, top);
  for (let b = 0; b < 4 && w > 10; b++) {
    const p = ((t * 0.5 + b / 4 + seed * 0.013) % 1);
    rect(c, x + 2 + ((b * 37 + seed) % (w - 6)), Math.round(y + h - 4 - p * (h - 8)), 1.5, 1.5, 'rgba(230,240,255,0.7)');
  }
}

function tankForge(c, x, y, w, h, j, n) {
  const [face, rim] = byDepth([['#7D828C', '#4A4E56'], ['#B87333', '#7A4A20'], ['#C9CED6', '#7F858F'], ['#F2C14E', '#A87A18'], ['#E6F4FF', '#8FB8D0']], j, n);
  rect(c, x, y, w, h, '#2A1A12');
  // Bars laid like bricks: every other row shifted by half a bar, in every tank alike.
  for (let cy = y + h - 4, row = 0; cy >= y; cy -= 3, row++) {
    for (let cx = x + (row % 2 ? 3 : 0); cx < x + w - 5; cx += 6) {
      rect(c, cx, cy, 5.5, 2.5, rim); rect(c, cx + 0.5, cy, 4.5, 1.5, face);
    }
  }
}

function tankLove(c, x, y, w, h, j, n) {
  const col = byDepth(['#F7B8D0', '#F28AB8', '#E85A8C', '#D9345E', '#B8123E'], j, n);
  rect(c, x, y, w, h, '#3A1A30');
  const draw = byDepth([flower, letter, heart, lips, ring], j, n);
  for (let hy = y + 1, row = 0; hy < y + h - 3; hy += 5, row++) {
    for (let hx = x + (row % 2 ? 4 : 1); hx < x + w - 6; hx += 8) draw(c, hx, hy, 0.75, col);
  }
}

// --- Work pieces under the gauge, where agents strike and the flow is written: (c, x, y, w, h).
// Flat, about 36×11 units centred on the pipe, drawn in half-unit pixels.

// Fill a rounded blob row by row: halfWidth(t) for t in 0..1 from top to bottom.
function blob(c, cx, y, h, halfWidth, col) {
  c.fillStyle = col;
  for (let yy = 0; yy < h; yy += 0.5) {
    const hw = Math.round(halfWidth(yy / h) * 2) / 2;
    c.fillRect(cx - hw, y + yy, hw * 2, 0.5);
  }
}

function plateMine(c, x, y, w, h) {
  // A lump of rock with veins of gold and a crystal.
  const cx = x + w / 2;
  blob(c, cx, y, h, t => w / 2 * Math.sqrt(Math.max(0, 1 - (2 * t - 1.1) ** 2)) + (t > 0.3 ? 1 : 0), '#3E352E');
  blob(c, cx - 0.5, y + 0.5, h - 1.5, t => (w / 2 - 1.5) * Math.sqrt(Math.max(0, 1 - (2 * t - 1.1) ** 2)), '#5C5047');
  rect(c, cx - 9, y + 1.5, 10, 1, '#7A6C60'); rect(c, cx + 3, y + 2.5, 5, 0.5, '#7A6C60');
  [[-12, 5, 3], [-5, 7, 2], [2, 4.5, 2.5], [9, 6.5, 3]].forEach(([dx, dy, l]) => {
    rect(c, cx + dx, y + dy, l, 1, '#D9A520'); rect(c, cx + dx, y + dy, 1, 0.5, '#FFE38A');
  });
  rect(c, cx + 13, y + 3, 2, 3, '#3FC7DA'); rect(c, cx + 13.5, y + 3, 1, 1, '#B8F4FF');
}

function plateLab(c, x, y, w, h) {
  // An empty Petri dish seen from the side: lid line, glass walls, flat bottom, reflections.
  const cx = x + w / 2;
  blob(c, cx, y + 1, h - 1, t => w / 2 - (t > 0.85 ? (t - 0.85) * 12 : 0), '#9FD3FF');
  blob(c, cx, y + 2.5, h - 4, t => w / 2 - 1.5, '#1B2836');
  rect(c, x + 1, y + 1, w - 2, 1, '#CDEBFF');
  rect(c, x + 3, y + 3.5, 8, 0.5, '#E6F6FF'); rect(c, x + w - 8, y + 6, 4, 0.5, '#7FB8E0');
  rect(c, x + 2, y + h - 2, w - 4, 0.5, '#CDEBFF');
}

function plateForge(c, x, y, w, h) {
  // An anvil: pointed horn on the left, flat face, narrow waist, wide foot.
  const face = '#4A4E56', light = '#A9AEB8', dark = '#2E3036';
  const hx = x + 9;
  rect(c, hx, y, w - 9, 5, face); rect(c, hx, y, w - 9, 0.5, light);
  for (let i = 0; i < 9; i += 0.5) rect(c, x + i, y + 0.5 + (9 - i) * 0.12, 0.5, 3.5 - (9 - i) * 0.3 + 1, face);
  rect(c, x + 2, y + 0.5, 7, 0.5, light);
  rect(c, x + w - 4, y + 1.5, 2, 1, dark);
  rect(c, x + 14, y + 5, w - 22, 2.5, dark);
  rect(c, x + 11, y + 7.5, w - 16, h - 7.5, face); rect(c, x + 11, y + 7.5, w - 16, 0.5, light);
  rect(c, x + 9, y + h - 1, w - 12, 1, dark);
}

function plateLove(c, x, y, w, h) {
  // A small bed: headboard with a heart, pillow, red blanket, footboard.
  rect(c, x, y - 3, 4, h + 3, '#9C4A66'); rect(c, x + 0.5, y - 2.5, 3, 0.5, '#E8A0B8');
  heart(c, x + 0.5, y - 1, 0.45, '#FFB8CC');
  rect(c, x + w - 2.5, y + 2, 2.5, h - 2, '#9C4A66');
  rect(c, x + 4, y + 3, w - 6.5, h - 5, '#F4EDE1');
  rect(c, x + 4.5, y + 1.5, 7, 4, '#FFFFFF'); rect(c, x + 4.5, y + 4.5, 7, 1, '#DCD3CC');
  rect(c, x + 12, y + 2.5, w - 14.5, h - 5, '#C8345E'); rect(c, x + 12, y + 2.5, w - 14.5, 1, '#E85A8C');
  rect(c, x + 12, y + 5, w - 14.5, 0.5, '#A82A50');
  rect(c, x + 1, y + h - 2, w - 1, 2, '#6E3046');
}

function plateCode(c, x, y, w, h, seed = 0) {
  // A keyboard: dark case, three rows of keycaps, a space bar; a few keys glow here and there
  // (still, like every plate).
  rect(c, x, y + 1, w, h - 1, '#1E2228'); rect(c, x, y + 1, w, 0.5, '#4A525C');
  const keys = Math.floor((w - 4) / 3);  // as many keys as the case holds
  for (let r = 0; r < 3; r++) for (let k = 0; k < keys; k++) {
    const lit = frac(Math.sin((seed * 101 + r * 31 + k) * 12.9898) * 43758.5453) < 0.18;
    rect(c, x + 1.5 + k * 3 + r * 0.5, y + 2.5 + r * 2.3, 2.5, 1.8, lit ? '#3CF27A' : '#5E6670');
    rect(c, x + 1.5 + k * 3 + r * 0.5, y + 2.5 + r * 2.3, 2.5, 0.5, lit ? '#B8FFD0' : '#8A929C');
  }
  rect(c, x + w / 2 - 5, y + 9.5, 10, 1, '#5E6670');
}
const frac = v => v - Math.floor(v);

function plateMoney(c, x, y, w, h) {
  // A contract on a desk: paper with lines, a signature and a red seal.
  rect(c, x, y + h - 2, w, 2, '#5A2A1A'); rect(c, x, y + h - 2, w, 0.5, '#8A4A2A');
  rect(c, x + 3, y, w - 6, h - 2, '#F4EDE1'); rect(c, x + 3, y, w - 6, 0.5, '#FFFFFF');
  for (let r = 0; r < 3; r++) rect(c, x + 5, y + 1.5 + r * 1.5, w - 16, 0.5, '#9C948A');
  line2(c, x + 6, y + 7, x + 14, y + 6, '#2B3A6B');
  rect(c, x + w - 10, y + 4, 5, 4, '#C8263B'); rect(c, x + w - 10.5, y + 4.5, 6, 3, '#C8263B');
  rect(c, x + w - 9, y + 5, 3, 2, '#E85A6A');
}
function line2(c, x0, y0, x1, y1, col) {
  for (let i = 0; i <= 16; i++) rect(c, Math.round((x0 + (x1 - x0) * i / 16) * 2) / 2, Math.round((y0 + (y1 - y0) * i / 16 + Math.sin(i) * 0.6) * 2) / 2, 0.5, 0.5, col);
}

// --- Result items: (c, x, y, empty) in a 16×20 box ---

function resultFlask(c, x, y, empty) {
  const mx = x + 8;
  rect(c, mx - 2, y, 4, 2, '#8A5A2B');
  rect(c, mx - 3, y + 2, 6, 6, '#CDEBFF'); rect(c, mx - 1, y + 2, 2, 6, '#1B2B3A');
  for (let r = 0; r < 12; r++) {
    const hw = Math.round(3 + r * 5 / 11), yy = y + 8 + r;
    rect(c, mx - hw, yy, hw * 2, 1, '#CDEBFF');
    if (r === 11) continue;
    rect(c, mx - hw + 1, yy, hw * 2 - 2, 1, r < 4 || empty ? '#1B2B3A' : r === 4 ? '#C4A3F5' : '#8E5BD8');
  }
  rect(c, mx - 3, y + 15, 1, 2, '#FFFFFF');
}

function resultCart(c, x, y, empty) {
  if (!empty) {
    const gems = ['#FFD866', '#B8F4FF', '#DDE3EA', '#FFD866', '#C47A45'];
    gems.forEach((g, i) => rect(c, x + 1.5 + i * 2.6, y + 6 - (i % 2) * 2, 3, 3, g));
  }
  rect(c, x, y + 8, 16, 7, '#6E737D'); rect(c, x + 1, y + 9, 14, 5, '#4A4E56');
  rect(c, x, y + 8, 16, 1, '#9EA3AD');
  rect(c, x + 2, y + 15, 4, 4, '#2B2B2B'); rect(c, x + 10, y + 15, 4, 4, '#2B2B2B');
  rect(c, x + 3, y + 16, 2, 2, '#8E939D'); rect(c, x + 11, y + 16, 2, 2, '#8E939D');
}

function resultChest(c, x, y, empty) {
  rect(c, x, y + 6, 16, 12, '#7A4A20'); rect(c, x + 1, y + 7, 14, 10, '#9C6230');
  if (empty) { rect(c, x, y + 2, 16, 4, '#5A3615'); rect(c, x + 1, y + 7, 14, 3, '#2A1A10'); }
  else {
    rect(c, x, y + 4, 16, 4, '#8A5426'); rect(c, x, y + 4, 16, 1, '#B07A40');
    rect(c, x + 2, y + 2, 3, 2, '#FFD866'); rect(c, x + 7, y + 1.5, 3, 2.5, '#F2C14E'); rect(c, x + 11, y + 2, 3, 2, '#FFD866');
  }
  rect(c, x, y + 11, 16, 1.5, '#D9A520'); rect(c, x + 7, y + 10, 2, 4, '#F2C14E');
}

function resultHeart(c, x, y, empty) {
  heart(c, x + 1, y + 3, 2, empty ? '#5A3A50' : '#E8345E');
  if (empty) heart(c, x + 3, y + 5, 1.4, '#2A1530');
  else rect(c, x + 4, y + 6, 2, 2, '#FFB8CC');
}


// --- Code and money themes: zones, tanks, results ---

function zoneCode(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#0E141C');
  for (let rx = x0 + 6; rx < x0 + w - 10; rx += 26) {
    rect(c, rx, y + 6, 18, h - 9, '#18212C'); rect(c, rx, y + 6, 18, 0.5, '#2A3644');
    for (let ry = y + 9; ry < y + h - 4; ry += 4) {
      rect(c, rx + 1.5, ry, 15, 2.5, '#1F2A36');
      rect(c, rx + 13, ry + 1, 1, 1, (rx + ry) % 3 ? '#3CF27A' : '#F2C14E');
    }
  }
  rect(c, x0 - 2, y, w + 4, 4, '#3A424C'); rect(c, x0 - 2, y + 1, w + 4, 0.5, '#3C8AF2');
  rect(c, x0 - 2, y + 2, w + 4, 0.5, '#F2C14E'); rect(c, x0 - 2, y + 3, w + 4, 0.5, '#3CF27A');
  rect(c, x0 - 2, y, 3, h, '#2A323C'); rect(c, x0 + w - 1, y, 3, h, '#2A323C');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#1A2028');
}

function tankCode(c, x, y, w, h, j, n, t, seed) {
  const [dim, bright] = byDepth([['#123A22', '#2E8A50'], ['#4A4A10', '#D8D83C'], ['#5A3410', '#F29A3C'], ['#107A80', '#5CF0F0'], ['#1A4A9A', '#7CB8FF']], j, n);
  rect(c, x, y, w, h, '#06100A');
  const r = rng(seed);
  for (let col = x + 1; col < x + w - 1; col += 2.5) {
    const off = (t * (3 + r() * 4) + r() * h) % h;
    for (let k = 0; k < h; k += 2) {
      const yy = y + ((k + off) % h);
      rect(c, col, yy, 1, 1.5, k < 2 ? bright : dim);
    }
  }
}

function resultChip(c, x, y, empty) {
  const body = empty ? '#3A3F48' : '#1E2228';
  for (let i = 0; i < 5; i++) {
    rect(c, x + 3 + i * 2.2, y + 2, 1, 2, empty ? '#5E6670' : '#D9A520');
    rect(c, x + 3 + i * 2.2, y + 16, 1, 2, empty ? '#5E6670' : '#D9A520');
  }
  rect(c, x + 1, y + 4, 14, 12, body); rect(c, x + 1, y + 4, 14, 0.5, '#4A525C');
  if (!empty) {
    rect(c, x + 4, y + 8, 1, 1, '#3CF27A'); rect(c, x + 3, y + 9, 1, 1, '#3CF27A'); rect(c, x + 4, y + 10, 1, 1, '#3CF27A');
    rect(c, x + 7.5, y + 7.5, 1, 1, '#3CF27A'); rect(c, x + 7, y + 9, 1, 1, '#3CF27A'); rect(c, x + 6.5, y + 10.5, 1, 1, '#3CF27A');
    rect(c, x + 11, y + 8, 1, 1, '#3CF27A'); rect(c, x + 12, y + 9, 1, 1, '#3CF27A'); rect(c, x + 11, y + 10, 1, 1, '#3CF27A');
  }
}

function zoneMoney(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#16241C');
  for (let sx = x0 + 3; sx < x0 + w; sx += 6) rect(c, sx, y + 4, 2, h - 6, '#1B2C22');
  rect(c, x0 - 2, y, w + 4, 4, '#5A2A1A'); rect(c, x0 - 2, y + 3, w + 4, 1, '#C9A040');
  rect(c, x0 - 2, y, 3, h, '#5A2A1A'); rect(c, x0 + w - 1, y, 3, h, '#5A2A1A');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#3A1A10');
}

function tankMoney(c, x, y, w, h, j, n) {
  const [bill, mark] = byDepth([['#6E7C7C', '#C8D2D2'], ['#4E9A52', '#C6F0B0'], ['#2F8A8A', '#9FE0E0'], ['#3A62B8', '#A8C4F5'], ['#C9A040', '#FFE38A']], j, n);
  rect(c, x, y, w, h, '#14201A');
  for (let by = y + h - 3.5; by > y - 1; by -= 3) {
    for (let bx = x + ((by - y) % 6 < 3 ? 0 : 3); bx < x + w - 6; bx += 8) {
      rect(c, bx, by, 7, 2.5, bill); rect(c, bx, by, 7, 0.5, mark);
      rect(c, bx + 3, by + 1, 1, 1, mark);
    }
  }
}

function resultBag(c, x, y, empty) {
  if (empty) {
    blob(c, x + 8, y + 9, 10, t => 6 - t * 1.5, '#4A3A2A');
    rect(c, x + 6, y + 6, 4, 3, '#4A3A2A');
    return;
  }
  rect(c, x + 6, y + 2, 4, 3, '#8A6238'); rect(c, x + 5, y + 4.5, 6, 1, '#C9A040');
  blob(c, x + 8, y + 5.5, 14, t => 3 + Math.sin(Math.min(1, t * 1.4) * Math.PI / 1.4) * 4.5, '#A87A48');
  blob(c, x + 7, y + 6.5, 12, t => 2 + Math.sin(Math.min(1, t * 1.4) * Math.PI / 1.4) * 3, '#C49460');
  rect(c, x + 7.5, y + 10, 1, 7, '#2E6B3A');
  rect(c, x + 6, y + 11, 3.5, 1, '#2E6B3A'); rect(c, x + 6, y + 13, 3.5, 1, '#2E6B3A'); rect(c, x + 6, y + 15, 3.5, 1, '#2E6B3A');
  rect(c, x + 6, y + 11, 1, 2, '#2E6B3A'); rect(c, x + 8.5, y + 13, 1, 2, '#2E6B3A');
}

export const THEMES = {
  mine: { tankBg: '#2A2420', emptyAlpha: 0.3, backdrop: backMine, frame: '#8A6238', zone: zoneMine, tank: tankMine, plate: plateMine, result: resultCart, outfit: 'helmet', tool: 'pickaxe', spark: '#FFE38A', accent: '#FFD866' },
  lab: { tankBg: '#122233', emptyAlpha: 0.3, backdrop: backLab, frame: '#9FD3FF', zone: zoneLab, tank: tankLab, plate: plateLab, result: resultFlask, outfit: 'goggles', tool: 'beaker', spark: '#B585F2', accent: '#C4A3F5' },
  forge: { tankBg: '#2A1A12', emptyAlpha: 0.3, backdrop: backForge, frame: '#8E939D', zone: zoneForge, tank: tankForge, plate: plateForge, result: resultChest, outfit: 'band', tool: 'hammer', spark: '#FF9A3C', accent: '#F2C14E' },
  love: { tankBg: '#3A1A30', backdrop: backLove, frame: '#F28AB8', zone: zoneLove, tank: tankLove, plate: plateLove, result: resultHeart, outfit: 'wings', tool: 'bow', spark: '#F28AB8', accent: '#F28AB8' },
  code: { tankBg: '#06100A', emptyAlpha: 0.3, backdrop: backCode, frame: '#3CF27A', zone: zoneCode, tank: tankCode, plate: plateCode, result: resultChip, outfit: 'hoodie', tool: 'laptop', spark: '#3CF27A', accent: '#7CF0B0' },
  money: { tankBg: '#14201A', backdrop: backMoney, frame: '#D9A520', zone: zoneMoney, tank: tankMoney, plate: plateMoney, result: resultBag, outfit: 'suit', tool: 'stamp', spark: '#FFD866', accent: '#9FE870' },
};

export const themeOf = f => THEMES[f.theme] || THEMES.mine;
