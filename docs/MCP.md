# GoalAgents MCP protocol

GoalAgents is a dashboard of your goals as funnels, worked by your AI agents. Everything on it is written by the agents through this MCP server; the person looks, clicks for details, and answers an agent's question right on the dashboard when it asks. The server is `supabase/functions/mcp`, the tables are in `supabase/migrations`; the demo at `/demo` runs on made-up data in `src/data.js`, shaped the same way.

## Connection

- Remote MCP server, Streamable HTTP: `https://goalagents.supabase.co/functions/v1/mcp`.
- Auth: OAuth 2.1 with dynamic client registration, the same flow as other remote connectors (Claude: Connectors → Add custom connector; Claude Code: `claude mcp add --transport http goalagents https://goalagents.supabase.co/functions/v1/mcp`; ChatGPT: Developer mode → Create, OAuth). Supabase Auth is the authorization server; the person signs in on goalagents.run and allows the agent on `/oauth/consent`. No keys to copy.
- Every tool runs as that person: the server never uses a service key, and row-level security keeps each person's funnels their own.
- The person does two things only: connects the server and tells the agent which goal to work. Agents create funnels, connect sources, and report everything else. The server sends the rules below to the agent as MCP instructions.

## Model

**Funnel** — one goal, drawn as a vertical flask.

| Field | Meaning |
|---|---|
| `id` | Stable id, chosen by the agent (`job-search`) |
| `title` | Column title (`Job Search`) |
| `result` | Name of one result: `[singular, plural]` (`offer, offers`); Russian uses three forms `[1, 2–4, 5+]` |
| `theme` | Look of the column: `mine` (miners, ore, carts), `lab` (chemists, liquids, flasks), `forge` (smiths, coins, chests), `love` (cupids, hearts), `code` (hackers, code, chips), `money` (bankers, banknotes, money bags). Default `mine` |
| `goal.total` | How many results the goal needs |
| `goal.every_days` | Pace: one result every N days |
| `stages` | 2–5 stages, top to bottom |
| `results` | How many results came out so far |

**Stage** — one tank.

| Field | Meaning |
|---|---|
| `key` | Stable key inside the funnel (`applied`) |
| `label` | `[singular, plural]` (`interview, interviews`), shown next to the count; Russian uses three forms |
| `count` | How many items are at this stage now (cumulative is fine) |
| `source_url` | Where the list lives, usually a Google Sheet; opened by "Open spreadsheet" |

Only counts, dates and links are stored. Item lists (vacancies, people, papers) stay in the person's own sources.

**Zone** — the mining area around a tank where agents work. Zone `0` is the inflow above the first stage; zone `k` (1 ≤ k < n) moves items from stage `k-1` into stage `k`; zone `n`, below the last stage, is the output zone where agents turn last-stage items into results. A zone holds **at most two agents** (left and right of the pipe); the server rejects a third.

**Agent presence** — what an agent is doing right now.

| Field | Meaning |
|---|---|
| `agent` | `claude`, `chatgpt`, `grok`, `gemini`, `deepseek`, `kimi`, `qwen`, `mistral`, `perplexity`, `hermes`; sets shirt colour and logo. Any other name gets a plain grey shirt |
| `funnel_id`, `zone` | Where the agent stands |
| `state` | `work` (mining), `sleep` (waiting for its next scheduled run), `ask` (waiting for the person) |
| `next_run_at` | For `sleep`: when it starts again; shown as a countdown |
| `question` | For `ask`: what the agent needs from the person |
| `question_id` | For `ask`: the open question; the person answers it on the dashboard |
| `chat_url` | Link to the agent's chat or session |

## Tools

| Tool | Does |
|---|---|
| `list_funnels()` | Funnels, stages, counts, results, goal, agents present and open questions |
| `upsert_funnel(id, title, result, goal_total, goal_every_days, theme?, stages[])` | Create or update a funnel and its stages (`key`, `label`, `source_url`); stages keep their counts by key |
| `report_counts(funnel_id, counts{stage_key: n}, results?)` | Current counts after the agent's work; the server stores each report with a timestamp |
| `add_result(funnel_id)` | One more result came out (increments `results`) |
| `set_agent_state(funnel_id, agent, zone, state, next_run_at?, question?, chat_url?)` | Presence of an agent; one presence per agent per funnel. With `ask` it returns a `question_id` |
| `get_answer(question_id, wait_seconds?)` | The person's answer, or null; waits up to 50 s |
| `clear_agent(funnel_id, agent)` | The agent leaves the funnel |
| `delete_funnel(funnel_id)` | Delete a funnel and everything in it, only when the person asks |

Write tools return the updated funnel so the agent can check what the person sees.

## What the server computes

Agents never report flows, forecasts or gauge readings — the server derives them from the count history:

- **Flow** of a zone (`+14/d` under the gauge): how fast the count of the stage below it grew over the recent window, per hour, day, week or month (the viewer picks the unit by clicking a gauge).
- **Gauge reading** of a zone: will the tank it feeds be full by the goal's date at this zone's current flow? The date is when the remaining results are due at the goal pace (one per `goal.every_days`). The reading is what the flow brings by then ÷ what the tank still misses, on a log scale; the red mark on the right is 1, just in time. So the needle and the tank's level always agree: a tank that is behind has its needle left of the mark. It is an estimate for the picture only.
- **Output zone**: its flow is results per day (from the `results` history); its gauge compares that with the goal rate, and its plate shows the estimated days to the next result, coloured by pace (red far behind, yellow close, green on pace, bright green well ahead).
- **Tank fill** (water level, left to right): items at a stage so far ÷ items needed there for the whole goal (`goal.total` results), where "needed" comes from the conversion along the flows below it. Shown as murky streaks when it can't be estimated.
- **Unknown reading**: if there is no goal or no flow reported yet for the zone or below it, the gauge shows a dimmed dial with no needle and a `?`.

## What an agent should do on every run

1. `set_agent_state(state: "work")` in the zone it works on.
2. Do its job; after meaningful progress call `report_counts` (and `add_result` when a result appears).
3. If it needs the person — approval, a missing file, a decision — `set_agent_state(state: "ask", question)` and poll `get_answer(question_id)`; the person answers on the dashboard.
4. At the end: `set_agent_state(state: "sleep", next_run_at)` until its next scheduled run, or `clear_agent` if it has no schedule.
