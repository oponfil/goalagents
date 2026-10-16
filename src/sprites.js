// Agent miners, drawn from simple shapes on the scene's fine grid (half-unit pixels).
// A miner fits a 20×28 box (units), faces right, and is mirrored or rotated for other poses.

// 13x13 brand marks printed on the shirt in half-unit pixels, simplified so they stay
// recognisable at this size.
const LOGOS = {
  // Claude: the spark, a starburst of rays.
  claude: [
    '......I......',
    '...I..I..I...',
    '....I.I.I....',
    '.I...III...I.',
    '..II.III.II..',
    '....IIIII....',
    'IIIIIIIIIIIII',
    '....IIIII....',
    '..II.III.II..',
    '.I...III...I.',
    '....I.I.I....',
    '...I..I..I...',
    '......I......',
  ],
  // OpenAI: the blossom, six lobes around a hexagonal centre.
  chatgpt: [
    '....II.II....',
    '...I..I..I...',
    '.II...I...II.',
    'I.....I.....I',
    'I.I..III..I.I',
    '.I.II...II.I.',
    '.I..I...I..I.',
    '.I.II...II.I.',
    'I.I..III..I.I',
    'I.....I.....I',
    '.II...I...II.',
    '...I..I..I...',
    '....II.II....',
  ],
  // Gemini: a four-pointed sparkle.
  gemini: [
    '......I......',
    '......I......',
    '.....III.....',
    '.....III.....',
    '....IIIII....',
    '..IIIIIIIII..',
    'IIIIIIIIIIIII',
    '..IIIIIIIII..',
    '....IIIII....',
    '.....III.....',
    '.....III.....',
    '......I......',
    '......I......',
  ],
  // DeepSeek: a whale with its tail up.
  deepseek: [
    '.............',
    '..........I.I',
    '...........I.',
    '...IIIII...I.',
    '..IIIIIIIIII.',
    '.IIIIIIIIII..',
    'IIIIIIIIIII..',
    'II.IIIIIIII..',
    'IIIIIIIIII...',
    '.IIIIIIII....',
    '..IIIIII.....',
    '.............',
    '.............',
  ],
  // Kimi (Moonshot): a crescent moon.
  kimi: [
    '....IIII.....',
    '..IIII.......',
    '.III.........',
    '.II..........',
    'III..........',
    'II...........',
    'II...........',
    'II...........',
    'III..........',
    '.II.........I',
    '.IIII.....II.',
    '..IIIIIIIII..',
    '....IIIII....',
  ],
  // Qwen: a hexagonal knot.
  qwen: [
    '....IIIII....',
    '...I.....I...',
    '..I..III..I..',
    '.I..I...I..I.',
    'I..I.....I..I',
    'I..I.....I..I',
    'I..I..I..I..I',
    'I..I.....I..I',
    'I..I.....I..I',
    '.I..I...I..I.',
    '..I..III..I..',
    '...I.....I...',
    '....IIIII....',
  ],
  // Mistral: the blocky pixel M.
  mistral: [
    '.............',
    'II.........II',
    'II.........II',
    'III.......III',
    'IIII.....IIII',
    'II.II...II.II',
    'II..II.II..II',
    'II...III...II',
    'II....I....II',
    'II.........II',
    'II.........II',
    'II.........II',
    '.............',
  ],
  // Perplexity: an open book with a centre line.
  perplexity: [
    '......I......',
    'I....III....I',
    'II..I.I.I..II',
    'I.II..I..II.I',
    'I...I.I.I...I',
    'IIIIIIIIIIIII',
    'I...I.I.I...I',
    'I..I..I..I..I',
    'I.I...I...I.I',
    'II....I....II',
    'I.....I.....I',
    '......I......',
    '......I......',
  ],
  // Hermes (Nous Research): a winged H.
  hermes: [
    '.............',
    'I...........I',
    'II..I...I..II',
    '.II.I...I.II.',
    '..IIII.IIII..',
    '....I...I....',
    '....IIIII....',
    '....I...I....',
    '....I...I....',
    '....I...I....',
    '...II...II...',
    '.............',
    '.............',
  ],
  // Grok: a ring cut by a diagonal slash.
  grok: [
    '............I',
    '....IIII...I.',
    '..II....I.I..',
    '.I.......I...',
    '.I......I.I..',
    'I......I...I.',
    'I.....I....I.',
    'I....I.....I.',
    '.I..I.....I..',
    '.I.I......I..',
    '..I....III...',
    '.I.IIII......',
    'I............',
  ],
};

// Kept for layout math in the scene: P is the old sprite pixel, the box is 10P × 14P.
export const P = 2;
export const MINER_W = 20, MINER_H = 28;

const SKIN = '#F3C7A0', SKIN_SHADE = '#D9A57E', HELMET = '#F2C14E', HELMET_SHADE = '#C9952B';
const PANTS = '#3B4252', BOOTS = '#1E1E22', BELT = '#5A3D22';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255) < 50;
}

function ellipse(c, cx, cy, rx, ry, col, topOnly = false) {
  c.fillStyle = col;
  for (let y = -ry; y <= (topOnly ? 0 : ry); y += 0.5) {
    for (let x = -rx; x <= rx; x += 0.5) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) c.fillRect(cx + x, cy + y, 0.5, 0.5);
    }
  }
}

// The agent body at (0, 0), facing right. walk: -1 standing, else the walk frame.
// reach: the front hand is raised to (16, 14) to hold a tool.
// outfit: helmet (miner), goggles (chemist in a lab coat), straw (gardener: straw hat, apron), wings (cupid),
// hoodie (hacker), suit (banker).
function body(c, agent, color, walk, reach, outfit = 'helmet') {
  const shirt = color, shirtDark = shade(color, 0.72), shirtLight = shade(color, 1.25);
  const step = walk < 0 ? 0 : (walk % 2 ? 1 : -1);
  const COAT = '#ECEDE6', COAT_SHADE = '#C9CBC2';
  const SUIT = '#2B3140', SUIT_SHADE = '#1E2330';
  const sleeve = outfit === 'goggles' ? COAT : outfit === 'suit' ? SUIT : shirt;
  const sleeveBack = outfit === 'goggles' ? COAT_SHADE : outfit === 'suit' ? SUIT_SHADE : shirtDark;
  if (outfit === 'hoodie') ellipse(c, 10, 8.5, 6, 5.5, shirtDark);
  if (outfit === 'wings') {
    ellipse(c, 2.5, 15, 3, 4.5, '#FFFFFF'); ellipse(c, 2, 16.5, 2, 3, '#DCE6F0');
    rect(c, 0, 13, 1.5, 1, '#FFFFFF');
  }
  // boots and legs
  rect(c, 4 + step, 26, 5.5, 2, BOOTS); rect(c, 10.5 - step, 26, 5.5, 2, BOOTS);
  rect(c, 5 + step, 22, 4.5, 4, PANTS); rect(c, 10.5 - step, 22, 4.5, 4, PANTS);
  rect(c, 9 + step, 22, 0.5, 4, shade(PANTS, 0.7));
  // back arm
  rect(c, 2.5, 14, 2.5, 6, sleeveBack); rect(c, 2.5, 20, 2.5, 2, SKIN_SHADE);
  // torso with light top edge and shaded right side; very dark shirts get a grey rim
  if (isDark(color)) rect(c, 4, 13, 12, 9, '#8A8A90');
  rect(c, 4.5, 13.5, 11, 8, shirt);
  rect(c, 4.5, 13.5, 11, 0.5, shirtLight);
  rect(c, 14, 14, 1.5, 7.5, shirtDark);
  // lab coat panels over the shirt, keeping the logo area free
  if (outfit === 'goggles') {
    rect(c, 4.5, 13.5, 2.5, 9, COAT); rect(c, 13, 13.5, 2.5, 9, COAT_SHADE);
    rect(c, 4.5, 21, 11, 2, COAT);
  } else {
    rect(c, 4.5, 21, 11, 1.5, BELT); rect(c, 9.5, 21, 1.5, 1.5, '#D9B44A');
  }
  // gardener's apron: a green bib with a pocket, below the logo
  if (outfit === 'straw') { rect(c, 5.5, 20, 9, 4.5, '#4E7A3A'); rect(c, 5.5, 20, 9, 0.5, '#6BA34A'); rect(c, 8.5, 21.5, 3, 1.5, '#3E6A2E'); }
  if (outfit === 'suit') {
    rect(c, 4.5, 13.5, 2.5, 9, SUIT); rect(c, 13, 13.5, 2.5, 9, SUIT_SHADE);
    rect(c, 7, 13.5, 1, 2, '#FFFFFF'); rect(c, 12, 13.5, 1, 2, '#FFFFFF');
    rect(c, 9.5, 13.5, 1, 1.5, '#B23A2E');
  }
  if (outfit === 'hoodie') { rect(c, 7.5, 13.5, 0.5, 3, '#DDDDDD'); rect(c, 12, 13.5, 0.5, 3, '#DDDDDD'); }
  // front arm
  if (reach) { rect(c, 13, 14, 3.5, 3, sleeve); ellipse(c, 16.5, 15, 1.5, 1.5, SKIN); }
  else { rect(c, 15, 14, 2.5, 6, sleeve); rect(c, 15, 20, 2.5, 2, SKIN); }
  // neck and head
  rect(c, 8.5, 12, 3, 1.5, SKIN_SHADE);
  ellipse(c, 10, 8.5, 4.5, 4, SKIN);
  rect(c, 6, 8, 1.5, 2, SKIN_SHADE);
  rect(c, 10.5, 7.5, 1, 1.5, '#2B1D14'); rect(c, 13, 7.5, 1, 1.5, '#2B1D14');
  rect(c, 14.5, 9, 1, 1, SKIN_SHADE);
  rect(c, 11.5, 10.5, 2, 0.5, '#B0705A');
  if (outfit === 'helmet') {
    // helmet: dome, highlight, brim, lamp
    ellipse(c, 10, 5.5, 5.5, 4.5, HELMET, true);
    rect(c, 7.5, 2, 3, 1, '#FFE08A');
    rect(c, 4, 5, 13, 1.5, HELMET_SHADE);
    rect(c, 14.5, 2.5, 2.5, 2.5, '#A88A3A'); rect(c, 15, 3, 1.5, 1.5, '#FFF6C9');
  } else if (outfit === 'goggles') {
    ellipse(c, 10, 6.5, 4.8, 3.5, '#4A3326', true);
    rect(c, 5.5, 7, 10, 1, '#2B2B2B');
    rect(c, 10, 6.5, 2.5, 2, '#2B2B2B'); rect(c, 10.5, 7, 1.5, 1, '#9FE3FF');
    rect(c, 12.8, 6.5, 2.5, 2, '#2B2B2B'); rect(c, 13.3, 7, 1.5, 1, '#9FE3FF');
  } else if (outfit === 'straw') {
    // straw hat: low crown with a green band and a wide brim
    ellipse(c, 10, 4.5, 3.8, 2.5, '#E8C872', true);
    rect(c, 6.5, 4.5, 7, 1, '#6BA34A');
    rect(c, 3, 5.5, 14, 1.5, '#D9B45A'); rect(c, 3, 5.5, 14, 0.5, '#F2DC90');
  } else if (outfit === 'hoodie') {
    // hood pulled up around the face
    ellipse(c, 10, 6, 5.5, 4, shirtDark, true);
    rect(c, 4.5, 6, 1.5, 6, shirtDark); rect(c, 14.5, 6, 1, 5, shirtDark);
  } else if (outfit === 'suit') {
    ellipse(c, 10, 6.5, 4.8, 3.5, '#3A2A1E', true);
    rect(c, 6, 5, 5, 1, '#3A2A1E');
  } else if (outfit === 'wings') {
    ellipse(c, 10, 6, 5, 3.5, '#F2D06B', true);
    rect(c, 5, 5.5, 1.5, 1.5, '#F2D06B'); rect(c, 14, 5.5, 1.5, 1.5, '#F2D06B');
    rect(c, 8, 3, 1.5, 1.5, '#FFE89A');
  }
}

// Logo centred at (cx, cy) in half-unit pixels; never mirrored.
function drawLogo(ctx, cx, cy, agent) {
  // "claude-search" wears the Claude logo.
  const rows = LOGOS[agent] || LOGOS[String(agent).split(/[-_]/)[0]];
  if (!rows) return;
  const x = Math.round((cx - rows[0].length / 4) * 2) / 2, y = Math.round((cy - rows.length / 4) * 2) / 2;
  ctx.fillStyle = '#FFFFFF';
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === 'I') ctx.fillRect(x + c / 2, y + r / 2, 0.5, 0.5);
  });
}

export function drawStanding(ctx, x, y, agent, color, walkFrame = -1, flip = false, reach = false, outfit = 'helmet') {
  ctx.save();
  if (flip) { ctx.translate(x + MINER_W, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
  body(ctx, agent, color, walkFrame, reach, outfit);
  ctx.restore();
  drawLogo(ctx, x + 10, y + 17.5, agent);
}

// Lying on the back in a 28×20 box: head to the left, or to the right when flipped.
export function drawLying(ctx, x, y, agent, color, flip = false, outfit = 'helmet') {
  ctx.save();
  if (flip) { ctx.translate(x + 28, y + 20); ctx.scale(-1, 1); } else ctx.translate(x, y + 20);
  ctx.rotate(-Math.PI / 2);
  body(ctx, agent, color, -1, false, outfit);
  ctx.restore();
  drawLogo(ctx, flip ? x + 10.5 : x + 17.5, y + 10, agent);
}

export function line(ctx, x0, y0, x1, y1, col, size = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  ctx.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const px = Math.round((x0 + (x1 - x0) * i / steps) * 2) / 2, py = Math.round((y0 + (y1 - y0) * i / steps) * 2) / 2;
    ctx.fillRect(px - size / 2 + 0.25, py - size / 2 + 0.25, size, size);
  }
}

// Pickaxe held at (hx, hy), angle in radians (0 = right, positive = down).
export function drawPickaxe(ctx, hx, hy, angle) {
  const len = 15;
  const ex = hx + Math.cos(angle) * len, ey = hy + Math.sin(angle) * len;
  line(ctx, hx, hy, ex, ey, '#8A5A2B', 1);
  const px = -Math.sin(angle), py = Math.cos(angle);
  line(ctx, ex - px * 5, ey - py * 5, ex + px * 4, ey + py * 4, '#9EA3AD', 1.5);
  line(ctx, ex - px * 5, ey - py * 5, ex - px * 3, ey - py * 3, '#E6E9EF', 1);
  line(ctx, ex + px * 3, ey + py * 3, ex + px * 4, ey + py * 4, '#E6E9EF', 1);
}

// Gardener's shears held at (hx, hy), facing right; open: 0 closed .. 1 wide open.
export function drawShears(ctx, hx, hy, open) {
  const px = hx + 4, a = 0.08 + open * 0.4;
  for (const sgn of [-1, 1]) {
    line(ctx, hx, hy + sgn * 1, px, hy, '#C8263B', 1);
    line(ctx, px, hy, px + Math.cos(a) * 8, hy + sgn * Math.sin(a) * 8, '#C9CED6', 1);
  }
  rect(ctx, px - 0.5, hy - 0.5, 1, 1, '#5E636D');
}

// Chemist's beaker, tilted by angle (0 = upright, positive = pouring forward).
export function drawBeaker(ctx, hx, hy, angle, liquid) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(angle);
  rect(ctx, -2, -7, 5, 8, '#CDEBFF'); rect(ctx, -1.5, -6.5, 4, 7, '#1B2B3A');
  rect(ctx, -1.5, -3, 4, 3.5, liquid); rect(ctx, -1.5, -3, 4, 0.5, '#FFFFFF');
  rect(ctx, 2.5, -7.5, 1.5, 1, '#CDEBFF');
  ctx.restore();
}

// Cupid's bow held at (hx, hy), facing right; drawn: 0..1 how far the string is pulled.
export function drawBow(ctx, hx, hy, drawn) {
  for (let a = -1.2; a <= 1.2; a += 0.1) {
    rect(ctx, Math.round((hx + 2 + Math.cos(a) * 3) * 2) / 2, Math.round((hy + Math.sin(a) * 7) * 2) / 2, 1, 1, '#B07A40');
  }
  const sx = hx + 2 - drawn * 3;
  line(ctx, hx + 3, hy - 7, sx, hy, '#F4EDE1', 0.5);
  line(ctx, sx, hy, hx + 3, hy + 7, '#F4EDE1', 0.5);
}

// Hacker's laptop held open at (hx, hy); typing: 0..1 key-press phase, lights the screen lines.
export function drawLaptop(ctx, hx, hy, typing) {
  rect(ctx, hx - 1, hy + 1, 9, 1.5, '#8E939D'); rect(ctx, hx - 1, hy + 1, 9, 0.5, '#C4C9D2');
  rect(ctx, hx + 5, hy - 6, 1.5, 7.5, '#5E636D');
  rect(ctx, hx + 6.5, hy - 6, 1, 7.5, '#0B1A12');
  for (let i = 0; i < 4; i++) rect(ctx, hx + 6.5, hy - 5 + i * 1.5, 1, 0.5, (i + Math.floor(typing * 4)) % 2 ? '#3CF27A' : '#1E6B3A');
}

// Banker's rubber stamp at (hx, hy); lift: 0 down on the paper .. 1 raised.
export function drawStamp(ctx, hx, hy, lift) {
  const y = hy - lift * 6;
  rect(ctx, hx + 2, y - 4, 2, 4, '#8A5A2B'); ellipse(ctx, hx + 3, y - 4.5, 1.5, 1.2, '#A87A48');
  rect(ctx, hx, y, 6, 2, '#4A4E56'); rect(ctx, hx, y + 2, 6, 1, '#C8263B');
}

export function drawArrow(ctx, x, y) {
  line(ctx, x - 7, y, x, y, '#B07A40', 0.5);
  rect(ctx, x, y - 1, 1.5, 2.5, '#9EA3AD');
  rect(ctx, x - 8, y - 1, 1.5, 0.5, '#F28AB8'); rect(ctx, x - 8, y + 1, 1.5, 0.5, '#F28AB8');
}

export function drawBubble(ctx, x, y) {
  rect(ctx, x + 0.5, y, 13, 16, '#E24B4A');
  rect(ctx, x, y + 0.5, 14, 15, '#E24B4A');
  rect(ctx, x + 14, y + 10, 2, 2, '#E24B4A');
  rect(ctx, x + 6, y + 3, 2, 7, '#FFFFFF');
  rect(ctx, x + 6, y + 11.5, 2, 2, '#FFFFFF');
}
