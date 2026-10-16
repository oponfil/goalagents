// The dashboard page around the scene: sticky funnel titles, drag to reorder, popups.
// Shared by the demo (src/main.js) and the person's own funnels (src/live.js).
import { agentInfo, agentButton, chatLink, plural } from './data.js';
import { Scene, CW } from './scene.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Web chats open in a new tab; app links (claude://, codex://) hand over to the app without an
// empty tab and remember the web chat to fall back to.
const opens = (url, web) => (/^https?:/.test(url) ? 'target="_blank" rel="noopener"' : `data-web="${esc(web)}"`);

// No app on this computer: the app link does nothing and the page keeps the focus, so after a
// moment the web chat opens instead.
function openApp(e) {
  const link = e.target.closest('a[data-web]');
  if (!link) return;
  e.preventDefault();
  let left = false;
  const away = () => { left = true; };
  window.addEventListener('blur', away, { once: true });
  document.addEventListener('visibilitychange', away, { once: true });
  location.href = link.href;
  setTimeout(() => {
    window.removeEventListener('blur', away);
    if (!left && link.dataset.web) window.open(link.dataset.web, '_blank', 'noopener');
  }, 1500);
}

// opts.live: counts come from the agents, not the demo simulation.
// opts.clock(scene): text for the right corner of the header.
// opts.onAnswer(agent, text): the person answered an agent's question (live only).
export function mountDashboard(funnels, opts = {}) {
  const canvas = document.getElementById('scene');
  const scroller = document.getElementById('scroller');
  const track = document.getElementById('titles-track');
  const clock = document.getElementById('day');
  const pop = document.getElementById('pop');
  pop.addEventListener('click', openApp);
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true; document.body.append(tip);
  let scene = new Scene(canvas, funnels, { live: opts.live });

  // Funnel order is the viewer's own arrangement, kept in this browser only.
  const ORDER_KEY = opts.orderKey || 'goalagents-order';
  const loadOrder = () => {
    try { const saved = JSON.parse(localStorage.getItem(ORDER_KEY)); if (Array.isArray(saved)) scene.applyOrder(saved); } catch {}
  };
  const saveOrder = () => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(scene.order())); } catch {} };
  loadOrder();

  // Scene size is fixed at load: about four funnels across the screen, but not much taller than
  // the screen (a little vertical scroll is fine for the tallest funnel). Resizing the window
  // only changes how many funnels are visible; the rest are reached with horizontal scroll.
  const byH = (scroller.clientHeight - 20) / scene.H;
  // On a phone the pixel scene would be too small at 1:1, so it starts 30% larger there.
  const minScale = scroller.clientWidth < 600 ? 1.3 : 1;
  const scale = Math.max(minScale, Math.min(scroller.clientWidth / (4.2 * CW), byH * 1.35));
  function layout() {
    if (scene.dpr !== (window.devicePixelRatio || 1)) scene.resize(scale, window.devicePixelRatio || 1);
    scroller.classList.toggle('fits', scene.funnels.length * CW * scale <= scroller.clientWidth);
  }
  window.addEventListener('resize', layout);
  document.fonts?.ready.then(() => scene.resize(scale, window.devicePixelRatio || 1));
  layout();

  // Sticky header: one title per funnel column, kept aligned with the scene while it scrolls.
  // A red badge shows how many agents in that funnel are waiting for you.
  function buildTitles() {
    track.innerHTML = scene.funnels.map((f, fi) =>
      `<div class="col-title" data-fi="${fi}" style="left:${fi * CW * scale}px;width:${CW * scale}px">
        <span class="name">${esc(f.title)}</span><span class="badge" hidden></span></div>`).join('');
    const h = track.parentElement.clientHeight / scale;
    track.querySelectorAll('.col-title').forEach(el => {
      el.style.backgroundImage = `url(${scene.titleStrip(+el.dataset.fi, h).toDataURL()})`;
    });
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
    if (opts.clock) clock.textContent = opts.clock(scene);
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
    const h = scene.hitTest(...toLogical(e));
    canvas.style.cursor = h && h.type !== 'stage' ? 'pointer' : 'default';
    // A tank shows only its number and flow; what it holds pops up on hover.
    if (h?.type !== 'stage' || e.pointerType === 'touch') return (tip.hidden = true);
    showTip(e, h);
  });
  let tipTimer;
  function showTip(e, h) {
    const s = scene.funnels[h.fi].stages[h.j], label = plural(s.count, s.forms);
    tip.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + 'px';
    tip.style.top = e.clientY + 18 + 'px';
  }
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });

  canvas.addEventListener('click', e => {
    const h = scene.hitTest(...toLogical(e));
    if (!h) return hidePop();
    // On a phone there is no hover: a tap on a tank shows what it holds for a moment.
    if (h.type === 'stage') {
      hidePop(); showTip(e, h);
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2000);
      return;
    }
    // The sheets on top open the funnel's list straight away.
    if (h.type === 'source') { hidePop(); return window.open(h.url, '_blank', 'noopener'); }
    showPop(e, content(h));
    if (h.type === 'ask' && opts.onAnswer) bindAnswer(h.a);
  });

  function content(h) {
    const a = h.a, info = agentInfo(a.agent), f = a.f;
    const web = a.chat || info.chat, chat = chatLink(info, web), paint = agentButton(info);
    const who = esc(info.name);
    const where = `${esc(f.title)}: ${esc(scene.zoneName(a))}`;
    if (h.type === 'ask') {
      const reply = opts.onAnswer
        ? `<textarea class="answer" rows="3" maxlength="2000" placeholder="Your answer"></textarea>
          <button class="btn primary send" style="${paint}">Send answer</button>
          ${chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>Open ${esc(info.name)}</a>` : ''}
          <div class="pop-msg"></div>`
        : `<a class="btn primary" style="${paint}" href="${esc(chat)}" ${opens(chat, web)}>Reply in ${esc(info.name)}</a>`;
      return `<div class="pop-title">${who} is waiting for you</div>
        <div class="pop-sub">${where}</div>
        <p>${esc(a.question)}</p>${reply}`;
    }
    const state = a.state === 'sleep' ? 'is resting until the next run'
      : a.state === 'walk' ? (a.to === 'work' ? 'is starting a shift' : 'finished a shift')
        : 'is working';
    return `<div class="pop-title">${who} ${state}</div>
      <div class="pop-sub">${where}</div>
      ${chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>Open ${esc(info.name)}</a>` : ''}`;
  }

  function bindAnswer(a) {
    const box = pop.querySelector('.answer'), send = pop.querySelector('.send'), msg = pop.querySelector('.pop-msg');
    box.focus();
    send.addEventListener('click', async () => {
      const text = box.value.trim();
      if (!text) return box.focus();
      send.disabled = true;
      const error = await opts.onAnswer(a, text);
      if (error) { msg.textContent = error; send.disabled = false; return; }
      a.state = 'work'; // the agent picks the answer up on its next check
      hidePop();
    });
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

  return {
    // New data from the agents: rebuild the scene, keep the viewer's order and scroll.
    setFunnels(next) {
      if (!pop.hidden && pop.contains(document.activeElement)) return false; // typing an answer
      scene = new Scene(canvas, next, { live: opts.live });
      loadOrder();
      scene.resize(scale, window.devicePixelRatio || 1);
      layout();
      buildTitles();
      return true;
    },
  };
}
