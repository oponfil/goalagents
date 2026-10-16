// The person's own funnels, written by their agents through MCP, redrawn when the agents write.
import { supabase } from './auth.js?v=3d2eac2a';

const DAY = 86400e3;
const WINDOW_DAYS = 7;

// Flow of one reported value (a stage count or the results), per day: how much it grew over the
// last 7 days, an average per day. Only increases count, so a stage that items leave does not read
// as negative. With less than a day of history the growth so far counts as one day's: +1 in the
// first hour is +1/d, not +24/d. Until there are two reports to compare it is 0: "+0/d" and a
// gauge at zero rather than an empty one.
function flowOf(reports, now) {
  if (reports.length < 2) return 0;
  let grew = 0;
  for (let i = 1; i < reports.length; i++) grew += Math.max(0, reports[i].value - reports[i - 1].value);
  const days = Math.max(1, (now - Date.parse(reports[0].at)) / DAY);
  return grew / days;
}

// Rows from the database → the funnels the scene draws (same shape as the demo in src/data.js).
// MCP zones start at 0 above the first stage; the scene's start at -1.
function toScene(f, reports, now) {
  const stages = [...f.stages].sort((a, b) => a.position - b.position);
  const series = key => reports.filter(r => r.funnel_id === f.id && r.stage_key === key);
  return {
    id: f.id,
    title: f.title,
    theme: f.theme,
    result: f.result,
    source_url: f.source_url,
    stages: stages.map(s => ({ key: s.key, count: Number(s.count), forms: s.label })),
    // Flow per day: set by the agent, or the growth between its reports.
    flows: [...stages.map(s => (s.flow_per_day != null ? Number(s.flow_per_day) : flowOf(series(s.key), now))),
      f.output_flow_per_day != null ? Number(f.output_flow_per_day) : flowOf(series(null), now)],
    // Other readings an agent set by hand (null = computed): tank fill 0-1 and gauge pace per zone.
    manualFill: stages.map(s => (s.fill_percent == null ? null : Number(s.fill_percent) / 100)),
    manualPace: [...stages.map(s => (s.pace == null ? null : Number(s.pace))), f.output_pace == null ? null : Number(f.output_pace)],
    cubes: f.results,
    goal: { total: f.goal_total, every: Number(f.goal_every_days) },
    workers: f.presence.map(p => {
      // The agent's unanswered questions, oldest first. An agent asking stands and waits for the
      // answers; one that went to sleep keeps them in a bubble and picks them up on its next run.
      // Once all are answered, an asking agent is shown back at work.
      const qs = f.questions.filter(q => q.agent === p.agent && !q.answered_at)
        .sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at));
      const state = p.state === 'ask' && !qs.length ? 'work' : p.state;
      return {
        agent: p.agent,
        zone: p.zone - 1,
        state,
        wakeIn: p.state === 'sleep' && p.next_run_at ? (Date.parse(p.next_run_at) - now) / 1000 : null,
        // Seconds since the agent last changed its state (its last word, for an overdue one).
        seenAgo: (now - Date.parse(p.updated_at)) / 1000,
        questions: qs.map(q => ({ id: q.id, question: q.question, chat: q.chat_url })),
        chat: p.chat_url,
        // What this run added (the last run's, while the agent sleeps); null = not known.
        added: p.run_added,
      };
    }),
  };
}

export async function loadFunnels() {
  const now = Date.now();
  const [funnels, reports] = await Promise.all([
    supabase.from('funnels')
      .select(`id, title, theme, source_url, result, goal_total, goal_every_days, results, output_pace, output_flow_per_day,
        stages (key, position, label, count, fill_percent, pace, flow_per_day),
        presence (agent, zone, state, next_run_at, question_id, chat_url, run_added, updated_at),
        questions (id, agent, question, asked_at, answered_at, chat_url)`)
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

export async function answer(questionId, text) {
  const { error } = await supabase.from('questions')
    .update({ answer: text, answered_at: new Date().toISOString() })
    .eq('id', questionId);
  return error?.message;
}

// An agent's last runs in its funnel, newest first, for its card.
export async function runs(a, limit = 10) {
  const { data, error } = await supabase.from('agent_runs')
    .select('zone, started_at, ended_at, added')
    .eq('funnel_id', a.f.id).eq('agent', a.agent)
    .order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
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
