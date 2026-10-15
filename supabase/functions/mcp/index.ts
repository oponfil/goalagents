// GoalAgents MCP server: agents create goal funnels and report progress; the person watches it on
// goalagents.run. Streamable HTTP, OAuth 2.1 through Supabase Auth. Every query runs as the
// signed-in person, so row-level security keeps each person's data their own.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.2.0'
import { pipeline } from 'npm:@supabase/middleware@1.0.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.9.0'
import { z } from 'npm:zod@4.6.5'

type Db = any // the Supabase client scoped to the caller

const THEMES = ['mine', 'lab', 'forge', 'love', 'code', 'money'] as const
const forms = z.array(z.string().min(1).max(40)).min(2).max(3)
const funnelId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).describe('Funnel id, e.g. "job-search"')
const agent = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)
  .describe('Who you are: claude, chatgpt, grok, gemini, deepseek, kimi, qwen, mistral, perplexity, hermes, or another lowercase name')

const INSTRUCTIONS = `GoalAgents shows the person their goals as funnels and the agents working them.
A funnel is one goal (e.g. "Job Search") with 2-5 stages top to bottom (jobs found → applied → interview → final round) and a result at the bottom (offer).
Zones: 0 is the inflow above the first stage, zone k moves stage k-1 into stage k, zone n (below the last stage) turns the last stage into results. At most two agents per zone on Pro, one on the free plan.
On every run: set_agent_state(work) in your zone; after progress report_counts (and add_result when a result appears); if you need the person, set_agent_state(ask, question) and poll get_answer; at the end set_agent_state(sleep, next_run_at) or clear_agent.
Plans: free has up to 3 funnels with up to 3 stages each and one agent per zone; Pro has up to 10 funnels with up to 5 stages each and two agents per zone. list_funnels tells which plan the person has.
Report only counts, dates and links. Item lists stay in the person's own sources (e.g. a Google Sheet, linked as source_url).`

const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 1) }] })
const fail = (msg: string) => { throw new Error(msg) }
const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) fail(error.message)
  return data
}

async function funnelRow(db: Db, key: string) {
  const row = check(await db.from('funnels').select('id, key').eq('key', key).maybeSingle())
  return row ?? fail(`No funnel "${key}". Call list_funnels to see the ids, or upsert_funnel to create it.`)
}

// What the person sees, in the shape the tools take.
async function funnels(db: Db, key?: string) {
  let q = db.from('funnels')
    .select(`key, title, theme, result, goal_total, goal_every_days, results, updated_at,
      stages (key, position, label, count, source_url),
      presence (agent, zone, state, next_run_at, chat_url, question_id, updated_at),
      questions (id, agent, question, answer, asked_at, answered_at)`)
    .order('created_at')
  if (key) q = q.eq('key', key)
  const rows = check(await q) as any[]
  return rows.map(f => ({
    id: f.key,
    title: f.title,
    theme: f.theme,
    result: f.result,
    goal: { total: f.goal_total, every_days: f.goal_every_days },
    results: f.results,
    stages: f.stages.sort((a: any, b: any) => a.position - b.position)
      .map(({ key, label, count, source_url }: any) => ({ key, label, count, source_url })),
    agents: f.presence,
    open_questions: f.questions.filter((q: any) => !q.answered_at),
  }))
}
const one = async (db: Db, key: string) => (await funnels(db, key))[0]

// Free: 3 funnels of up to 3 stages, one agent per zone. Pro: 10 funnels of up to 5 stages, two agents per zone
// (everyone is on Pro during the launch).
async function plan(db: Db) {
  const row = check(await db.from('accounts').select('plan').maybeSingle()) as { plan: string } | null
  const name = row?.plan ?? 'pro'
  return { plan: name, max_funnels: name === 'pro' ? 10 : 3, max_stages: name === 'pro' ? 5 : 3, max_agents_per_zone: name === 'pro' ? 2 : 1 }
}

function server(db: Db) {
  const s = new McpServer({ name: 'goalagents', version: '0.1.0' }, { instructions: INSTRUCTIONS })

  s.registerTool('list_funnels', {
    title: 'List funnels',
    description: 'The person\'s plan with its limits, and their goal funnels: stages with counts, results, goal, agents present and open questions.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => text({ ...(await plan(db)), funnels: await funnels(db) }))

  s.registerTool('upsert_funnel', {
    title: 'Create or update a funnel',
    description: 'Create a goal funnel or change its title, result name, goal, theme or stages. Stages keep their counts by key; stages left out are removed. Free plan: up to 3 funnels of up to 3 stages; Pro: up to 10 funnels of up to 5 stages.',
    inputSchema: z.object({
      id: funnelId,
      title: z.string().min(1).max(60).describe('Column title, e.g. "Job Search"'),
      result: forms.describe('Name of one result: [singular, plural], e.g. ["offer", "offers"]; Russian: [1, 2-4, 5+]'),
      goal_total: z.number().int().min(1).max(100).describe('How many results the goal needs (1-100)'),
      goal_every_days: z.number().positive().max(3650).describe('Pace: one result every N days'),
      theme: z.enum(THEMES).optional().describe('Look: mine (miners, ore), lab (chemists, flasks), forge (smiths, coins), love (cupids, hearts), code (hackers, chips), money (bankers, banknotes). Default mine'),
      stages: z.array(z.object({
        key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).describe('Stable key, e.g. "applied"'),
        label: forms.describe('[singular, plural], e.g. ["interview", "interviews"]'),
        source_url: z.string().url().optional().describe('Where the list lives, usually a Google Sheet'),
      })).min(2).max(5).describe('Stages top to bottom'),
    }),
    annotations: { idempotentHint: true },
  }, async (a) => {
    const keys = a.stages.map(st => st.key)
    if (new Set(keys).size !== keys.length) fail('Stage keys must be unique')
    const p = await plan(db)
    if (a.stages.length > p.max_stages) fail(`The ${p.plan} plan has up to ${p.max_stages} stages per funnel. Merge some stages, or the person can upgrade to Pro for up to 5.`)
    const f = check(await db.from('funnels').upsert({
      key: a.id, title: a.title, result: a.result, theme: a.theme ?? 'mine',
      goal_total: a.goal_total, goal_every_days: a.goal_every_days,
    }, { onConflict: 'user_id,key' }).select('id').single()) as { id: string }
    check(await db.from('stages').delete().eq('funnel_id', f.id).not('key', 'in', `(${keys.join(',')})`))
    check(await db.from('stages').upsert(a.stages.map((st, i) => ({
      funnel_id: f.id, key: st.key, position: i, label: st.label, source_url: st.source_url ?? null,
    })), { onConflict: 'funnel_id,key' }))
    return text(await one(db, a.id))
  })

  s.registerTool('report_counts', {
    title: 'Report counts',
    description: 'Current counts after your work: how many items are at each stage (cumulative is fine), and optionally the results so far. Flows on the dashboard are computed from these reports.',
    inputSchema: z.object({
      funnel_id: funnelId,
      counts: z.record(z.string(), z.number().int().nonnegative()).describe('{ stage_key: count }'),
      results: z.number().int().nonnegative().optional().describe('Results so far'),
    }),
  }, async ({ funnel_id, counts, results }) => {
    const f = await funnelRow(db, funnel_id)
    const known = (check(await db.from('stages').select('key').eq('funnel_id', f.id)) as { key: string }[]).map(s => s.key)
    const unknown = Object.keys(counts).filter(k => !known.includes(k))
    if (unknown.length) fail(`Unknown stage keys: ${unknown.join(', ')}. Stages: ${known.join(', ')}`)
    for (const [key, count] of Object.entries(counts)) {
      check(await db.from('stages').update({ count }).eq('funnel_id', f.id).eq('key', key))
    }
    if (results != null) check(await db.from('funnels').update({ results }).eq('id', f.id))
    const rows = Object.entries(counts).map(([stage_key, value]) => ({ funnel_id: f.id, stage_key, value }))
    if (results != null) rows.push({ funnel_id: f.id, stage_key: null as unknown as string, value: results })
    if (rows.length) check(await db.from('count_reports').insert(rows))
    return text(await one(db, funnel_id))
  })

  s.registerTool('add_result', {
    title: 'Add a result',
    description: 'One more result came out of the funnel (an offer, a paper, a term sheet…).',
    inputSchema: z.object({ funnel_id: funnelId }),
  }, async ({ funnel_id }) => {
    const f = await funnelRow(db, funnel_id)
    const { results } = check(await db.from('funnels').select('results').eq('id', f.id).single()) as { results: number }
    check(await db.from('funnels').update({ results: results + 1 }).eq('id', f.id))
    check(await db.from('count_reports').insert({ funnel_id: f.id, stage_key: null, value: results + 1 }))
    return text(await one(db, funnel_id))
  })

  s.registerTool('set_agent_state', {
    title: 'Set your state',
    description: 'Show where you are and what you are doing: work (working now), sleep (until next_run_at), ask (waiting for the person; give a question, then poll get_answer with the returned question_id).',
    inputSchema: z.object({
      funnel_id: funnelId,
      agent,
      zone: z.number().int().min(0).max(5).describe('0 = inflow above the first stage, k = into stage k, n = output below the last stage'),
      state: z.enum(['work', 'sleep', 'ask']),
      next_run_at: z.string().datetime({ offset: true }).optional().describe('For sleep: ISO time of your next run'),
      question: z.string().min(1).max(1000).optional().describe('For ask: what you need from the person'),
      chat_url: z.string().url().optional().describe('Link to your chat or session'),
    }),
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    const n = (check(await db.from('stages').select('key').eq('funnel_id', f.id)) as unknown[]).length
    if (a.zone > n) fail(`This funnel has ${n} stages, so zones are 0-${n}`)
    if (a.state === 'ask' && !a.question) fail('state "ask" needs a question')
    let question_id: string | null = null
    if (a.state === 'ask') {
      const q = check(await db.from('questions').insert({ funnel_id: f.id, agent: a.agent, question: a.question })
        .select('id').single()) as { id: string }
      question_id = q.id
    }
    check(await db.from('presence').upsert({
      funnel_id: f.id, agent: a.agent, zone: a.zone, state: a.state,
      next_run_at: a.state === 'sleep' ? a.next_run_at ?? null : null,
      question_id, chat_url: a.chat_url ?? null,
    }, { onConflict: 'funnel_id,agent' }))
    return text({ question_id, funnel: await one(db, a.funnel_id) })
  })

  s.registerTool('get_answer', {
    title: 'Get the answer',
    description: 'The person\'s answer to your question, or null if not answered yet. wait_seconds (up to 50) waits for it.',
    inputSchema: z.object({
      question_id: z.string().uuid(),
      wait_seconds: z.number().int().min(0).max(50).default(0),
    }),
    annotations: { readOnlyHint: true },
  }, async ({ question_id, wait_seconds }) => {
    const until = Date.now() + wait_seconds * 1000
    for (;;) {
      const q = check(await db.from('questions').select('question, answer, answered_at').eq('id', question_id).maybeSingle())
      if (!q) fail('No such question')
      if ((q as any).answered_at || Date.now() >= until) return text(q)
      await new Promise(r => setTimeout(r, 3000))
    }
  })

  s.registerTool('clear_agent', {
    title: 'Leave the funnel',
    description: 'You leave the funnel (no scheduled next run).',
    inputSchema: z.object({ funnel_id: funnelId, agent }),
    annotations: { idempotentHint: true },
  }, async ({ funnel_id, agent }) => {
    const f = await funnelRow(db, funnel_id)
    check(await db.from('presence').delete().eq('funnel_id', f.id).eq('agent', agent))
    return text(await one(db, funnel_id))
  })

  s.registerTool('delete_funnel', {
    title: 'Delete a funnel',
    description: 'Delete a funnel with its stages, history, agents and questions. Only when the person asks for it.',
    inputSchema: z.object({ funnel_id: funnelId }),
    annotations: { destructiveHint: true },
  }, async ({ funnel_id }) => {
    const f = await funnelRow(db, funnel_id)
    check(await db.from('funnels').delete().eq('id', f.id))
    return text({ deleted: funnel_id })
  })

  return s
}

Deno.serve(
  pipeline(
    [
      // The project's Auth issuer, not the goalagents.supabase.co name the request came in on.
      withOAuthProtectedResource({ authorizationServer: Deno.env.get('MCP_AUTH_ISSUER') }),
      withSupabase({ auth: 'user' }),
    ],
    (req: Request, { supabase }: { supabase: Db }) => createMcpHandler(() => server(supabase)).fetch(req),
  ),
)
