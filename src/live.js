// The person's own funnels, written by their agents through MCP, redrawn when the agents write.
import { supabase } from './auth.js';

const DAY = 86400e3;
const WINDOW_DAYS = 14;

// Flow of one reported value (a stage count or the results), per day: how much it grew over the
// recent window. Only increases count, so a stage that items leave does not read as negative.
// Unknown (null) until there are two reports to compare.
function flowOf(reports, now) {
  if (reports.length < 2) return null;
  let grew = 0;
  for (let i = 1; i < reports.length; i++) grew += Math.max(0, reports[i].value - reports[i - 1].value);
  const days = Math.max(1 / 24, (now - Date.parse(reports[0].at)) / DAY);
  return grew / days;
}

// Rows from the database → the funnels the scene draws (same shape as the demo in src/data.js).
// MCP zones start at 0 above the first stage; the scene's start at -1.
function toScene(f, reports, now) {
  const stages = [...f.stages].sort((a, b) => a.position - b.position);
  const series = key => reports.filter(r => r.funnel_id === f.id && r.stage_key === key);
  const answered = new Set(f.questions.filter(q => q.answered_at).map(q => q.id));
  return {
    id: f.id,
    title: f.title,
    theme: f.theme,
    result: f.result,
    stages: stages.map(s => ({ key: s.key, count: Number(s.count), forms: s.label, source_url: s.source_url })),
    flows: [...stages.map(s => flowOf(series(s.key), now)), flowOf(series(null), now)],
    cubes: f.results,
    goal: { total: f.goal_total, every: Number(f.goal_every_days) },
    workers: f.presence.map(p => {
      const q = f.questions.find(q => q.id === p.question_id);
      // Once the person answered, the agent is shown back at work until it reports again.
      const state = p.state === 'ask' && (!q || answered.has(q.id)) ? 'work' : p.state;
      return {
        agent: p.agent,
        zone: p.zone - 1,
        state,
        wakeIn: p.state === 'sleep' && p.next_run_at ? (Date.parse(p.next_run_at) - now) / 1000 : null,
        question: q?.question,
        question_id: q?.id,
        chat: p.chat_url,
      };
    }),
  };
}

export async function loadFunnels() {
  const now = Date.now();
  const [funnels, reports] = await Promise.all([
    supabase.from('funnels')
      .select(`id, title, theme, result, goal_total, goal_every_days, results,
        stages (key, position, label, count, source_url),
        presence (agent, zone, state, next_run_at, question_id, chat_url),
        questions (id, question, answered_at)`)
      .order('created_at'),
    supabase.from('count_reports')
      .select('funnel_id, stage_key, value, at')
      .gte('at', new Date(now - WINDOW_DAYS * DAY).toISOString())
      .order('at'),
  ]);
  if (funnels.error) throw funnels.error;
  if (reports.error) throw reports.error;
  return funnels.data.map(f => toScene(f, reports.data, now));
}

export async function answer(agent, text) {
  const { error } = await supabase.from('questions')
    .update({ answer: text, answered_at: new Date().toISOString() })
    .eq('id', agent.question_id);
  return error?.message;
}

// Calls onChange (debounced) whenever an agent writes to this person's funnels.
export function watch(onChange) {
  let timer;
  const kick = () => { clearTimeout(timer); timer = setTimeout(onChange, 400); };
  const channel = supabase.channel('my-funnels');
  for (const table of ['funnels', 'stages', 'presence', 'questions']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
  }
  channel.subscribe();
  return channel;
}
