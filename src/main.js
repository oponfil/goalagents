import { FUNNELS, agentInfo, plural } from './data.js';
import { Scene, CW, H, fmtCount } from './scene.js';

const canvas = document.getElementById('scene');
const scroller = document.getElementById('scroller');
const track = document.getElementById('titles-track');
const clock = document.getElementById('clock');
const pop = document.getElementById('pop');
const scene = new Scene(canvas, FUNNELS);

// Funnel order is the viewer's own arrangement, kept in this browser only.
const ORDER_KEY = 'goalagents-order';
try { const saved = JSON.parse(localStorage.getItem(ORDER_KEY)); if (Array.isArray(saved)) scene.applyOrder(saved); } catch {}
function saveOrder() { try { localStorage.setItem(ORDER_KEY, JSON.stringify(scene.order())); } catch {} }

// Scene size is fixed at load: about four funnels across the screen, but not much taller than
// the screen (a little vertical scroll is fine for the tallest funnel). Resizing the window
// only changes how many funnels are visible; the rest are reached with horizontal scroll.
const byH = (scroller.clientHeight - 20) / H;
const scale = Math.max(1, Math.min(scroller.clientWidth / (4.2 * CW), byH * 1.35));
function layout() {
  if (scene.dpr !== (window.devicePixelRatio || 1)) scene.resize(scale, window.devicePixelRatio || 1);
  scroller.classList.toggle('fits', FUNNELS.length * CW * scale <= scroller.clientWidth);
}
window.addEventListener('resize', layout);
document.fonts?.ready.then(() => scene.resize(scale, window.devicePixelRatio || 1));
layout();

// Sticky header: one title per funnel column, kept aligned with the scene while it scrolls.
// A red badge shows how many agents in that funnel are waiting for you.
function buildTitles() {
  track.innerHTML = scene.funnels.map((f, fi) =>
    `<div class="col-title" data-fi="${fi}" style="left:${fi * CW * scale}px;width:${CW * scale}px">
      <span class="name">${f.title}</span><span class="badge" hidden></span></div>`).join('');
}
function syncTitles() {
  track.style.transform = `translateX(${canvas.getBoundingClientRect().left - track.parentElement.getBoundingClientRect().left}px)`;
  track.querySelectorAll('.col-title').forEach(el => {
    const n = scene.waitingFor(scene.funnels[+el.dataset.fi]), badge = el.querySelector('.badge');
    badge.hidden = !n;
    badge.textContent = n;
    badge.title = n ? `${n} ${plural(n, ['agent is', 'agents are'])} waiting for you` : '';
  });
}
buildTitles();

let last = performance.now();
function frame(now) {
  scene.update(Math.min(0.1, (now - last) / 1000));
  last = now;
  scene.render();
  syncTitles();
  clock.textContent = `Demo · day ${Math.floor(scene.days) + 1}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / scene.scale, (e.clientY - r.top) / scene.scale];
}

// Drag a funnel by its title in the header to reorder.
let drag = null;
track.addEventListener('pointerdown', e => {
  const el = e.target.closest('.col-title');
  if (!el) return;
  drag = { from: +el.dataset.fi, x0: e.clientX, moved: false };
  track.setPointerCapture(e.pointerId);
});
track.addEventListener('pointermove', e => {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.x0) > 6) drag.moved = true;
  if (drag.moved) {
    scene.dropAt = Math.max(0, Math.min(scene.funnels.length, Math.round(toLogical(e)[0] / CW)));
    track.classList.add('dragging');
    hidePop();
  }
});
track.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.moved && scene.dropAt !== null) { scene.moveFunnel(drag.from, scene.dropAt); saveOrder(); buildTitles(); }
  scene.dropAt = null; drag = null;
  track.classList.remove('dragging');
});

canvas.addEventListener('pointermove', e => {
  canvas.style.cursor = scene.hitTest(...toLogical(e)) ? 'pointer' : 'default';
});

canvas.addEventListener('click', e => {
  const h = scene.hitTest(...toLogical(e));
  if (!h) return hidePop();
  if (h.type === 'gauge') { scene.cyclePeriod(); return hidePop(); }
  showPop(e, content(h));
});

function content(h) {
  if (h.type === 'stage') {
    const f = scene.funnels[h.fi], s = f.stages[h.j], need = scene.stageNeed(h.fi, h.j);
    const needText = need
      ? `The goal (${f.goal.total} ${plural(f.goal.total, f.result)}) needs about ${fmtCount(Math.ceil(need))} ${plural(Math.ceil(need), s.forms)} here; now ${fmtCount(s.count)}.`
      : 'Not enough data yet to estimate how many are needed here for the goal.';
    return `<div class="pop-title">${f.title}: ${fmtCount(s.count)} ${plural(s.count, s.forms)}</div>
      <p>${needText}</p>
      <p>The list lives in a Google Sheet the agent connected.</p>
      <a class="btn" href="https://docs.google.com/spreadsheets" target="_blank" rel="noopener">Open spreadsheet</a>`;
  }
  const a = h.a, info = agentInfo(a.agent), f = a.f;
  const who = `<span class="chip" style="background:${info.color}"></span>${info.name}`;
  const where = `${f.title}: ${scene.zoneName(a)}`;
  if (h.type === 'ask') {
    return `<div class="pop-title">${who} is waiting for you</div>
      <div class="pop-sub">${where}</div>
      <p>${a.question}</p>
      <a class="btn primary" href="${info.chat}" target="_blank" rel="noopener">Reply in ${info.name}</a>`;
  }
  const state = a.state === 'sleep' ? 'is resting until the next run'
    : a.state === 'walk' ? (a.to === 'work' ? 'is starting a shift' : 'finished a shift')
      : 'is working';
  return `<div class="pop-title">${who} ${state}</div>
    <div class="pop-sub">${where}</div>
    <a class="btn" href="${info.chat}" target="_blank" rel="noopener">Open ${info.name}</a>`;
}

function showPop(e, html) {
  pop.innerHTML = `<button class="close" aria-label="Close">×</button>` + html;
  pop.querySelector('.close').addEventListener('click', hidePop);
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, e.clientX - pw / 2)) + 'px';
  pop.style.top = Math.max(8, Math.min(window.innerHeight - ph - 8, e.clientY + 14)) + 'px';
}
function hidePop() { pop.hidden = true; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePop(); });
document.addEventListener('pointerdown', e => {
  if (!pop.hidden && !pop.contains(e.target) && e.target !== canvas) hidePop();
});
scroller.addEventListener('scroll', hidePop);
