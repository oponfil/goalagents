// GoalAgents MCP server: agents create goal funnels and report progress; the person watches it on
// goalagents.run. Streamable HTTP, OAuth 2.1 through Supabase Auth. Every query runs as the
// signed-in person, so row-level security keeps each person's data their own.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.2.0'
import { pipeline } from 'npm:@supabase/middleware@1.0.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.9.0'
import { z } from 'npm:zod@4.6.5'

type Db = any // the Supabase client scoped to the caller

const THEMES = ['mine', 'lab', 'garden', 'love', 'code', 'money'] as const
const forms = z.array(z.string().min(1).max(40)).min(2).max(3)
const funnelId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).describe('Funnel id, e.g. "job-search"')
const agent = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)
  .describe('Who you are: claude, chatgpt, grok, gemini, deepseek, kimi, qwen, mistral, perplexity, hermes, or another lowercase name. Several agents of one kind in a funnel add a suffix: claude-search, claude-apply (shown as Claude with its logo)')

const INSTRUCTIONS = `GoalAgents shows the person their goals as funnels and the agents working them.
A funnel is one goal (e.g. "Job Search") with 2-5 stages top to bottom (jobs found → applied → interview → final round) and a result at the bottom (offer).
Zones: 0 is the inflow above the first stage, zone k moves stage k-1 into stage k, zone n (below the last stage) turns the last stage into results. At most two agents per zone on Pro, one on the free plan.
On every run: set_agent_state(work) in your zone (this starts the run's counter, shown by you on the dashboard); after progress report_counts (and add_result when a result appears); if you need the person, set_agent_state(ask, question) and poll get_answer; at the end set_agent_state(sleep, next_run_at) or clear_agent.
Plans: free has up to 3 funnels with up to 3 stages each and one agent per zone; Pro has up to 10 funnels with up to 5 stages each and two agents per zone. list_funnels tells which plan the person has.
Report only counts, dates and links: the items themselves stay in the person's own sources.
Link to the list: whenever the funnel's items are kept in a table or list that opens by a URL (Google Sheets, Notion, Airtable, a GitHub file…), give that URL as the funnel's source_url (in upsert_funnel or report_counts) — the dashboard shows it as a sheet on top of the funnel and opens it on click. One link per funnel. Keep the list where a link can open it when you can. If it only exists on your machine or you have no such place, leave source_url empty and say so to the person; it is optional.`

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

// The count an agent in this zone works into: the stage its zone feeds, or the results below the last stage.
async function zoneTargets(db: Db, funnelId: string) {
  const stages = check(await db.from('stages').select('position, count').eq('funnel_id', funnelId).order('position')) as { count: number }[]
  const { results } = check(await db.from('funnels').select('results').eq('id', funnelId).single()) as { results: number }
  return (zone: number) => Number(zone < stages.length ? stages[zone].count : results)
}

// After counts change: each agent at work (or asking) has added what its count grew since its run began.
async function updateRuns(db: Db, funnelId: string) {
  const target = await zoneTargets(db, funnelId)
  const agents = check(await db.from('presence').select('agent, zone, state, run_base, run_added, run_manual')
    .eq('funnel_id', funnelId)) as any[]
  for (const p of agents) {
    if (p.state === 'sleep' || p.run_manual || p.run_base == null) continue
    const added = Math.max(0, Math.round(target(p.zone) - Number(p.run_base)))
    if (added !== p.run_added) check(await db.from('presence').update({ run_added: added }).eq('funnel_id', funnelId).eq('agent', p.agent))
  }
}

// What the person sees, in the shape the tools take.
async function funnels(db: Db, key?: string) {
  let q = db.from('funnels')
    .select(`key, title, theme, source_url, result, goal_total, goal_every_days, results, output_pace, output_flow_per_day, updated_at,
      stages (key, position, label, count, fill_percent, pace, flow_per_day),
      presence (agent, zone, state, next_run_at, chat_url, question_id, run_added, updated_at),
      questions (id, agent, question, answer, asked_at, answered_at)`)
    .order('created_at')
  if (key) q = q.eq('key', key)
  const rows = check(await q) as any[]
  return rows.map(f => ({
    id: f.key,
    title: f.title,
    theme: f.theme,
    source_url: f.source_url,
    result: f.result,
    goal: { total: f.goal_total, every_days: f.goal_every_days },
    results: f.results,
    stages: f.stages.sort((a: any, b: any) => a.position - b.position)
      .map(({ key, label, count, fill_percent, pace, flow_per_day }: any) => ({ key, label, count, fill_percent, pace, flow_per_day })),
    output_pace: f.output_pace,
    output_flow_per_day: f.output_flow_per_day,
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
  const s = new McpServer({
    name: 'goalagents',
    title: 'GoalAgents',
    version: '0.1.0',
    websiteUrl: 'https://goalagents.run',
    icons: [
      { src: 'https://goalagents.run/favicon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
      { src: 'https://goalagents.run/apple-touch-icon.png', mimeType: 'image/png', sizes: ['180x180'] },
    ],
  }, { instructions: INSTRUCTIONS })

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
      source_url: z.string().url().regex(/^https?:\/\//).nullable().optional().describe('Link to the table or list with this funnel\'s items (Google Sheet, Notion, Airtable…). Give it whenever the list opens by a URL; null removes it, leaving it out keeps it'),
      theme: z.enum(THEMES).optional().describe('Look: mine (miners, ore), lab (chemists, flasks), garden (gardeners, flowers), love (cupids, hearts), code (hackers, chips), money (bankers, coins, banknotes, gold bars, bitcoins). Default mine'),
      stages: z.array(z.object({
        key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).describe('Stable key, e.g. "applied"'),
        label: forms.describe('[singular, plural], e.g. ["interview", "interviews"]'),
        // Older clients still send a link per stage; the first one becomes the funnel's link.
        source_url: z.string().url().optional().describe('Deprecated: give the funnel\'s source_url instead'),
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
      ...(a.source_url !== undefined
        ? { source_url: a.source_url }
        : a.stages.some(st => st.source_url) && { source_url: a.stages.find(st => st.source_url)!.source_url }),
    }, { onConflict: 'user_id,key' }).select('id').single()) as { id: string }
    check(await db.from('stages').delete().eq('funnel_id', f.id).not('key', 'in', `(${keys.join(',')})`))
    check(await db.from('stages').upsert(a.stages.map((st, i) => ({
      funnel_id: f.id, key: st.key, position: i, label: st.label,
    })), { onConflict: 'funnel_id,key' }))
    return text(await one(db, a.id))
  })

  s.registerTool('report_counts', {
    title: 'Report counts',
    description: 'Current counts after your work: how many items are at each stage (cumulative is fine), and optionally the results so far. ' +
      'The dashboard computes flows, tank fill and gauges from these reports (automatic). Optionally set them yourself (manual): ' +
      'fill_percent per stage, pace and flow_per_day per zone; null switches that one back to automatic.',
    inputSchema: z.object({
      funnel_id: funnelId,
      counts: z.record(z.string(), z.number().int().nonnegative()).default({}).describe('{ stage_key: count }'),
      results: z.number().int().nonnegative().optional().describe('Results so far'),
      fill_percent: z.record(z.string(), z.number().min(0).max(100).nullable()).optional()
        .describe('Manual tank fill, { stage_key: 0-100 }: how much of what this stage needs for the whole goal is there. null = automatic'),
      pace: z.record(z.string(), z.number().min(0).max(1000).nullable()).optional()
        .describe('Manual gauge, { zone: pace } with zones as in set_agent_state ("0" above the first stage … "n" below the last). Pace against the goal: 1 = just in time (red mark), 0.5 = half the pace needed, 2 = twice. null = automatic'),
      flow_per_day: z.record(z.string(), z.number().min(0).max(1e9).nullable()).optional()
        .describe('Manual flow, { zone: items per day } shown under the gauge (zone "n": results per day). null = automatic, from the count reports'),
      // Older clients send { stage_key: url }; the first link is taken as the funnel's.
      source_url: z.union([z.string().url().regex(/^https?:\/\//), z.record(z.string(), z.string().url().nullable())]).nullable().optional()
        .describe('Link to the table or list with this funnel\'s items: give it whenever it opens by a URL (Google Sheet, Notion…); null removes it'),
    }),
  }, async ({ funnel_id, counts, results, fill_percent, pace, flow_per_day, source_url: link }) => {
    const source_url = link && typeof link === 'object' ? Object.values(link).find(Boolean) : link
    const f = await funnelRow(db, funnel_id)
    const stages = check(await db.from('stages').select('key, position').eq('funnel_id', f.id).order('position')) as { key: string, position: number }[]
    const known = stages.map(s => s.key), n = stages.length
    const unknown = [...Object.keys(counts), ...Object.keys(fill_percent ?? {})].filter(k => !known.includes(k))
    if (unknown.length) fail(`Unknown stage keys: ${unknown.join(', ')}. Stages: ${known.join(', ')}`)
    const badZones = [...Object.keys(pace ?? {}), ...Object.keys(flow_per_day ?? {})].filter(z => !/^\d+$/.test(z) || +z > n)
    if (badZones.length) fail(`Unknown zones: ${badZones.join(', ')}. This funnel has zones 0-${n}`)
    for (const key of known) {
      const patch: Record<string, unknown> = {}
      if (key in counts) patch.count = counts[key]
      if (fill_percent && key in fill_percent) patch.fill_percent = fill_percent[key]
      const zone = String(stages.find(s => s.key === key)!.position)
      if (pace && zone in pace) patch.pace = pace[zone]
      if (flow_per_day && zone in flow_per_day) patch.flow_per_day = flow_per_day[zone]
      if (Object.keys(patch).length) check(await db.from('stages').update(patch).eq('funnel_id', f.id).eq('key', key))
    }
    const funnelPatch: Record<string, unknown> = {}
    if (results != null) funnelPatch.results = results
    if (source_url !== undefined) funnelPatch.source_url = source_url
    if (pace && String(n) in pace) funnelPatch.output_pace = pace[String(n)]
    if (flow_per_day && String(n) in flow_per_day) funnelPatch.output_flow_per_day = flow_per_day[String(n)]
    if (Object.keys(funnelPatch).length) check(await db.from('funnels').update(funnelPatch).eq('id', f.id))
    const rows = Object.entries(counts).map(([stage_key, value]) => ({ funnel_id: f.id, stage_key, value }))
    if (results != null) rows.push({ funnel_id: f.id, stage_key: null as unknown as string, value: results })
    if (rows.length) check(await db.from('count_reports').insert(rows))
    await updateRuns(db, f.id)
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
    await updateRuns(db, f.id)
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
      added: z.number().int().min(0).max(1e9).optional().describe('How many items you added this run, when you know it better than the counts show (e.g. when items also left your stage). Leave it out and the dashboard counts it from report_counts'),
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
    // A run starts when the agent comes to work from sleep (or to another zone): its counter starts at 0
    // and is kept through the next sleep, so the person sees what the last run added.
    const prev = check(await db.from('presence').select('zone, state').eq('funnel_id', f.id).eq('agent', a.agent).maybeSingle()) as any
    const newRun = a.state === 'work' && (!prev || prev.state === 'sleep' || prev.zone !== a.zone)
    const run = newRun ? { run_base: (await zoneTargets(db, f.id))(a.zone), run_added: 0, run_manual: false } : {}
    check(await db.from('presence').upsert({
      funnel_id: f.id, agent: a.agent, zone: a.zone, state: a.state,
      next_run_at: a.state === 'sleep' ? a.next_run_at ?? null : null,
      question_id, chat_url: a.chat_url ?? null,
      ...run,
      ...(a.added != null && { run_added: a.added, run_manual: true }),
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
