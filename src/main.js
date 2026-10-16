// The demo: made-up funnels from src/data.js, with time running fast.
import { FUNNELS } from './data.js?v=ee44647d';
import { mountDashboard } from './dashboard.js?v=ee44647d';
import { t } from './i18n.js?v=ee44647d';

mountDashboard(FUNNELS, {
  clock: scene => t('demo.clock', Math.floor(scene.days) + 1),
  // Answers work as on your own dashboard; in the demo they go nowhere, the agent just carries on.
  onAnswer: async () => null,
  runs: demoRuns,
});

// Made-up last runs for an agent's card, the same each time for the same agent: a run every 6-12
// hours lasting 10-40 minutes, the newest still going while the agent works. Zones as in MCP
// (the scene's zone + 1).
function demoRuns(a) {
  let seed = [...a.f.title + a.agent].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const now = Date.now(), rows = [];
  let start = now - (a.state === 'sleep' ? 2 + r() * 4 : 0.2 + r() * 0.3) * 3600e3;
  for (let i = 0; i < 10; i++) {
    const going = i === 0 && a.state !== 'sleep';
    const ended = going ? null : start + (10 + r() * 30) * 60e3;
    const added = going ? a.added || 0 : r() < 0.2 ? 0 : 1 + Math.floor(r() * 6);
    rows.push({ zone: a.zone + 1, started_at: new Date(start).toISOString(), ended_at: ended && new Date(ended).toISOString(), added });
    start -= (6 + r() * 6) * 3600e3;
  }
  return rows;
}
