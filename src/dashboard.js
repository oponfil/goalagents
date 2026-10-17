// The dashboard page around the scene: sticky funnel titles, drag to reorder, popups.
// Shared by the demo (src/main.js) and the person's own funnels (src/live.js).
import { agentInfo, agentButton, chatLink, plural } from './data.js?v=cd7112fa';
import { Scene, CW, fmtCount, fmtDuration } from './scene.js?v=cd7112fa';
import { t, lang } from './i18n.js?v=cd7112fa';

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
// opts.onAnswer(questionId, text): the person answered one of an agent's questions (live only).
// opts.onCloseReplies(ids): the person closed the agent's replies to their answers (live only).
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
  // only changes how many funnels are visible; the rest are reached with horizontal scroll. The
  // funnel tanks are tall, so a bit more vertical scroll is allowed than the screen's height.
  const byH = (scroller.clientHeight - 20) / scene.H;
  // On a phone the pixel scene would be too small at 1:1, so it starts 30% larger there.
  const minScale = scroller.clientWidth < 600 ? 1.3 : 1;
  const scale = Math.max(minScale, Math.min(scroller.clientWidth / (4.2 * CW), byH * 1.6));
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
      badge.title = n ? t('board.waiting', n) : '';
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
    bindRuns(h.a);
    if (h.type === 'reply') bindReplies(h.a);
    if (h.type === 'ask' && opts.onAnswer) bindAnswer(h.a);
  });

  function content(h) {
    const a = h.a, info = agentInfo(a.agent), f = a.f;
    const web = a.chat || info.chat, chat = chatLink(info, web), paint = agentButton(info);
    const who = esc(info.name);
    // The step it works on, with what this run added (the last run's while it sleeps) to the items
    // it works into: "Job Search: jobs found → +4 applied".
    const st = f.stages, n = a.added || 0, from = a.zone < 0 ? '' : `${esc(plural(5, st[a.zone].forms))} → `;
    const into = a.zone === st.length - 1 ? f.result : st[a.zone + 1].forms;
    const where = `${esc(f.title)}: ${from}<b class="run">+${fmtCount(n)}</b> ${esc(plural(n, into))}`;
    // Live only: the agent's last runs, loaded when the person opens them.
    const history = opts.runs ? `<details class="runs"><summary>${esc(t('board.runs'))}</summary><div class="runs-list"></div></details>` : '';
    // Overdue: it should have run by now and has not been heard from.
    const missed = scene.overdue(a)
      ? `<p class="pop-note warn">${esc(t('board.missed', fmtDuration(scene.t - a.wakeAt), fmtDuration(scene.t + (a.seenAgo || 0))))}</p>` : '';
    if (h.type === 'reply') {
      // The agent's short replies to the person's answers, with what was asked and answered.
      const items = a.replies.map(r => `<div class="reply-item"><p class="pop-note">${esc(r.question)}</p>
        <p class="pop-note"><b>${esc(t('board.you'))}:</b> ${esc(r.answer)}</p><p>${esc(r.reply)}</p></div>`).join('');
      return `<div class="pop-title">${t('board.replied', who)}</div>${items}
        <button class="btn primary close-replies" style="${paint}">${esc(t('board.close'))}</button>${history}`;
    }
    if (h.type === 'ask') {
      // Each open question with its own answer box and, beside Send, the chat it was asked from (or
      // the agent's chat): an agent working in several chats asks from each. The demo links to the
      // agent's chat instead.
      const openBtn = url => {
        const link = chatLink(info, url);
        return link ? `<a class="btn" href="${esc(link)}" ${opens(link, url)}>${esc(t('board.open', info.product || info.name))}</a>` : '';
      };
      const asks = a.questions.map(q => `<div class="ask" data-qid="${esc(q.id)}"><p>${esc(q.question)}</p>${opts.onAnswer
        ? `<textarea class="answer" rows="3" maxlength="2000" placeholder="${esc(t('board.answer'))}"></textarea>
          <div class="ask-buttons"><button class="btn primary send" style="${paint}">${esc(t('board.send'))}</button>${openBtn(q.chat || web)}</div>
          <div class="pop-msg"></div>` : ''}</div>`).join('');
      const reply = opts.onAnswer ? ''
        : `<a class="btn primary" style="${paint}" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.replyIn', info.product || info.name))}</a>`;
      // Standing, the agent is waiting and takes the answer at once; asleep, only on its next run.
      const asleep = a.state === 'sleep', left = scene.sleepLeft(a);
      const when = left > 0 ? t('board.inTime', fmtDuration(left)) : t('board.whenRuns');
      return `<div class="pop-title">${t(asleep ? 'board.askedAsleep' : 'board.asking', who)}</div>
        <div class="pop-sub">${where}</div>
        ${asleep && !missed ? `<p class="pop-note">${esc(t('board.nextRun', when))}</p>` : ''}${missed}${asks}${reply}${history}`;
    }
    const state = scene.overdue(a) ? 'board.overdue' : a.state === 'sleep' ? 'board.resting'
      : a.state === 'walk' ? (a.to === 'work' ? 'board.starting' : 'board.finished')
        : 'board.working';
    return `<div class="pop-title">${t(state, who)}</div>
      <div class="pop-sub">${where}</div>${missed}
      ${chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.open', info.product || info.name))}</a>` : ''}${history}`;
  }

  // The runs list: when each run started, how long it took (or that it is still going) and what it
  // added to the items its zone works into.
  function bindRuns(a) {
    const box = pop.querySelector('details.runs');
    if (!box) return;
    box.addEventListener('toggle', async () => {
      const list = box.querySelector('.runs-list');
      if (!box.open || list.dataset.loaded) return;
      list.dataset.loaded = 1;
      list.textContent = '…';
      try {
        const rows = await opts.runs(a);
        const st = a.f.stages, when = new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        list.innerHTML = rows.length ? rows.map(r => {
          const into = r.zone < st.length ? st[r.zone].forms : a.f.result;
          const took = r.ended_at ? fmtDuration((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000) : t('board.runNow');
          return `<div class="run-row"><span class="at">${esc(when.format(new Date(r.started_at)))}</span><span class="took">${esc(took)}</span>
            <span><b class="run">+${fmtCount(r.added)}</b> ${esc(plural(r.added, into))}</span></div>`;
        }).join('') : `<div class="pop-note">${esc(t('board.noRuns'))}</div>`;
        pop.style.top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, pop.offsetTop)) + 'px';
      } catch { list.textContent = t('board.runsFailed'); delete list.dataset.loaded; }
    });
  }

  function bindReplies(a) {
    pop.querySelector('.close-replies')?.addEventListener('click', async () => {
      const ids = a.replies.map(r => r.id);
      a.replies = [];
      hidePop();
      if (opts.onCloseReplies && ids[0]) await opts.onCloseReplies(ids);
    });
  }

  function bindAnswer(a) {
    pop.querySelector('.answer')?.focus();
    pop.querySelectorAll('.ask[data-qid]').forEach(block => {
      const box = block.querySelector('.answer'), send = block.querySelector('.send'), msg = block.querySelector('.pop-msg');
      send.addEventListener('click', async () => {
        const text = box.value.trim();
        if (!text) return box.focus();
        send.disabled = true;
        const error = await opts.onAnswer(block.dataset.qid, text);
        if (error) { msg.textContent = error; send.disabled = false; return; }
        // Answered: that question goes. With none left, a waiting agent takes the answers at once
        // (back at work); a sleeping one keeps sleeping, its bubble gone.
        const asked = a.questions.find(q => q.id === block.dataset.qid)?.question;
        a.questions = a.questions.filter(q => q.id !== block.dataset.qid);
        block.remove();
        // The demo has no agent to reply: a moment later it answers back as a real one would.
        if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: asked, answer: text, reply: t('demo.reply') }]; }, 1200);
        if (a.questions.length) return pop.querySelector('.answer')?.focus();
        if (a.state !== 'sleep') a.state = 'work';
        hidePop();
      });
    });
  }

  function showPop(e, html) {
    pop.innerHTML = `<button class="close" aria-label="${esc(t('board.close'))}">×</button>` + html;
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
      scene = new Scene(canvas, next, { live: opts.live, sides: scene.sides, heaps: scene.heaps });
      loadOrder();
      scene.resize(scale, window.devicePixelRatio || 1);
      layout();
      buildTitles();
      return true;
    },
  };
}
