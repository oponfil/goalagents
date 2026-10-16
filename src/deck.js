// The pitch deck: each slide's backdrop is one of the dashboard themes, with an agent of that theme
// working in the corner. Arrow keys, Page Up/Down and Space move between slides.
import { THEMES } from './themes.js';
import { AGENTS } from './data.js';
import { drawStanding } from './sprites.js';

const K = 4;  // screen pixels per logical pixel, as blocky as the dashboard

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paint(slide, i) {
  const theme = THEMES[slide.dataset.theme], id = slide.dataset.agent;
  let canvas = slide.querySelector('canvas.bg');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'bg'; slide.prepend(canvas); }
  const w = Math.ceil(slide.clientWidth / K), h = Math.ceil(slide.clientHeight / K), res = 2;
  canvas.width = w * res; canvas.height = h * res;
  const c = canvas.getContext('2d');
  c.setTransform(res, 0, 0, res, 0, 0);
  theme.backdrop(c, 0, w, h, rng(11 + i));
  // An agent of this theme standing on a strip of the theme's tank frame, bottom right.
  const x = w - 34, y = h - 36;
  c.fillStyle = theme.frame; c.fillRect(x - 8, y + 28, 36, 2);
  drawStanding(c, x, y, id, AGENTS[id].color, -1, true, false, theme.outfit);
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
