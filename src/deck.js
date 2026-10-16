// The pitch deck: each slide's backdrop is one of the dashboard themes, with an agent of that theme
// at work under the text. Arrow keys, Page Up/Down and Space move between slides.
import { THEMES } from './themes.js';
import { AGENTS } from './data.js';
import { drawStanding, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, MINER_H } from './sprites.js';

const K = 4;  // screen pixels per logical pixel, as blocky as the dashboard

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paint(slide, i) {
  const theme = THEMES[slide.dataset.theme];
  let canvas = slide.querySelector('canvas.bg');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'bg'; slide.prepend(canvas); }
  const w = Math.ceil(slide.clientWidth / K), h = Math.ceil(slide.clientHeight / K), res = 2;
  canvas.width = w * res; canvas.height = h * res;
  const c = canvas.getContext('2d');
  c.setTransform(res, 0, 0, res, 0, 0);
  theme.backdrop(c, 0, w, h, rng(11 + i));
  vignette(slide);
}

// Under each slide's text, an agent of the slide's theme at work, as on the board: its work piece
// on a strip of tank, the pipe coming down into it, the tool mid-stroke.
const VW = 76, VH = 42, VK = 3;
function vignette(slide) {
  const theme = THEMES[slide.dataset.theme], id = slide.dataset.agent;
  let canvas = slide.querySelector('canvas.work');
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.className = 'work';
    canvas.style.width = VW * VK + 'px'; canvas.style.height = VH * VK + 'px';
    slide.querySelector('.body').after(canvas);
  }
  const res = VK * 2;
  canvas.width = VW * res; canvas.height = VH * res;
  const c = canvas.getContext('2d');
  c.setTransform(res, 0, 0, res, 0, 0);
  const cx = 46, floor = VH - 3;
  c.fillStyle = '#5E626B'; c.fillRect(cx - 4, 0, 9, floor);
  c.fillStyle = '#8E939D'; c.fillRect(cx - 2, 0, 5, floor);
  c.fillStyle = '#B9BEC7'; c.fillRect(cx - 2, 0, 2, floor);
  theme.plate(c, cx - 13, floor - 11, 26, 11);
  c.fillStyle = theme.frame; c.fillRect(2, floor, VW - 4, 3);
  const x = cx - 38, y = floor - MINER_H, hx = x + 16.5, hy = y + 15, pipeX = cx - 5;
  drawStanding(c, x, y, id, AGENTS[id].color, -1, false, true, theme.outfit);
  if (theme.tool === 'pickaxe') drawPickaxe(c, hx, hy - 1, -0.9);
  else if (theme.tool === 'shears') drawShears(c, hx, hy + 1, 0.6);
  else if (theme.tool === 'beaker') {
    drawBeaker(c, hx, hy, 1.1, '#B585F2');
    for (let k = 0; k < 3; k++) { const q = k / 3 + 0.15; c.fillStyle = '#B585F2'; c.fillRect(hx + 5 + q * (pipeX - hx - 5), hy - 4 + q * q * 10, 1.5, 1.5); }
  } else if (theme.tool === 'laptop') {
    // Bits fly from the laptop into the pipe.
    drawLaptop(c, hx - 3, hy + 2, 0.3);
    c.fillStyle = '#3CF27A';
    for (const u of [0.2, 0.5, 0.8]) c.fillRect(hx + 5 + u * (pipeX - hx - 5), hy - 3 - Math.sin(u * Math.PI) * 4, 1, 1.5);
  }
  else if (theme.tool === 'stamp') drawStamp(c, hx - 1, hy + 4, 0.4);
  // The arrow is on its way from the bow into the pipe.
  else { drawBow(c, hx, hy, 0); drawArrow(c, hx + 3 + 0.6 * (pipeX - hx - 3), hy); }
}

const slides = [...document.querySelectorAll('.slide')];
const paintAll = () => slides.forEach(paint);
document.fonts.ready.then(paintAll);
let t;
addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paintAll, 150); });

const counter = document.getElementById('counter');
const current = () => {
  const mid = scrollY + innerHeight / 2;
  return Math.max(0, slides.findIndex(s => s.offsetTop <= mid && s.offsetTop + s.offsetHeight > mid));
};
const show = () => { counter.textContent = `${current() + 1} / ${slides.length}`; };
addEventListener('scroll', show, { passive: true });
show();

addEventListener('keydown', e => {
  const next = ['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key), prev = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key);
  if (!next && !prev) return;
  e.preventDefault();
  const i = Math.min(slides.length - 1, Math.max(0, current() + (next ? 1 : -1)));
  slides[i].scrollIntoView({ behavior: 'smooth' });
});
