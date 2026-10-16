// Demo data shown on the landing page. In the product this comes from agents via MCP.

export const AGENTS = {
  // app: turns a web chat link into one that opens the desktop app, where the app has a link scheme.
  claude: { name: 'Claude', color: '#D97757', chat: 'https://claude.ai', app: url => url.replace(/^https:\/\/claude\.ai/, 'claude://claude.ai') },
  // The ChatGPT desktop app opens on codex:// links (it has no chatgpt:// scheme).
  chatgpt: { name: 'ChatGPT', color: '#10A37F', chat: 'https://chatgpt.com', app: () => 'codex://' },
  grok: { name: 'Grok', color: '#1A1A1A', chat: 'https://grok.com' },
  gemini: { name: 'Gemini', color: '#4285F4', chat: 'https://gemini.google.com' },
  deepseek: { name: 'DeepSeek', color: '#4D6BFE', chat: 'https://chat.deepseek.com' },
  kimi: { name: 'Kimi', color: '#16161A', chat: 'https://kimi.com' },
  qwen: { name: 'Qwen', color: '#615CED', chat: 'https://chat.qwen.ai' },
  mistral: { name: 'Mistral', color: '#FA520F', chat: 'https://chat.mistral.ai' },
  perplexity: { name: 'Perplexity', color: '#20808D', chat: 'https://www.perplexity.ai' },
  hermes: { name: 'Hermes', color: '#8A6E3A', chat: 'https://nousresearch.com' },
};

// Several agents of one kind tell themselves apart with a suffix: "claude-search" is a Claude,
// shown as "Claude · search". Any other name gets a plain grey shirt without a logo.
export function agentInfo(id) {
  if (AGENTS[id]) return AGENTS[id];
  const [kind, ...rest] = id.split(/[-_]/), base = AGENTS[kind];
  if (base && rest.length) return { ...base, name: `${base.name} · ${rest.join(' ')}` };
  return { name: id, color: '#8A8F98', chat: '' };
}

// Where "Open" and "Reply" go: the agent's desktop app when it has a link scheme (Claude,
// ChatGPT), otherwise its chat in the browser. App links fall back to the web chat (dashboard.js).
export const chatLink = (info, url) => (url && info.app ? info.app(url) : url);

// A button in the agent's own colour, with text that stays readable on it.
export function agentButton(info) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(info.color.slice(i, i + 2), 16));
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  const dark = 0.299 * r + 0.587 * g + 0.114 * b < 50;
  return `background:${info.color};border-color:${dark ? '#6B6B70' : info.color};color:${light ? '#1B1714' : '#FFFFFF'}`;
}

// Label forms: [singular, plural]. A funnel has n = 2-5 stages; flows (per day) has n + 1 entries:
// flows[0] is the inflow above the first tank, flows[k + 1] the zone below stage k, and
// flows[n] (the output zone below the last tank) is results per day;
// null means not reported yet (the gauge shows as unknown).
// goal: total — how many results the goal needs; every — the pace, one result per N days.
// These are the only targets an agent sets. theme: look of the column (src/themes.js).
// Workers: state work | sleep | ask; at most two per zone (left and right of the pipe).
// zone -1 is the inflow above the first tank (zone 0 in docs/MCP.md), zone k sits below stage k;
// zone n - 1 is the output zone, where agents turn the last stage into results.
// The demo runs DAY_SECONDS (src/scene.js) per day: zones move items at their flow, slower
// where no agent is working. wakeIn is seconds until a sleeping agent starts. result: forms of what comes out at the bottom.
export const FUNNELS = [
  {
    title: 'Job Search',
    source_url: 'https://docs.google.com/spreadsheets',
    theme: 'mine',
    result: ['offer', 'offers'],
    stages: [
      { count: 240, forms: ['job found', 'jobs found'] },
      { count: 96, forms: ['applied', 'applied'] },
      { count: 30, forms: ['screening call', 'screening calls'] },
      { count: 14, forms: ['interview', 'interviews'] },
      { count: 4, forms: ['final round', 'final rounds'] },
    ],
    flows: [8, 4, 1.6, 0.8, 0.2, 1 / 21],
    cubes: 1,
    goal: { total: 5, every: 21 },
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work' },
      { agent: 'perplexity', zone: -1, state: 'work' },
      {
        agent: 'claude', zone: 0, state: 'ask',
        question: 'The form asks for a salary expectation. Send the application with $120k?',
      },
      { agent: 'gemini', zone: 0, state: 'work' },
      { agent: 'grok', zone: 1, state: 'sleep', wakeIn: 12 },
      { agent: 'deepseek', zone: 1, state: 'work' },
      { agent: 'mistral', zone: 2, state: 'work' },
      { agent: 'qwen', zone: 3, state: 'work' },
      { agent: 'claude', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Creator',
    theme: 'garden',
    result: ['paying member', 'paying members'],
    stages: [
      { count: 52000, forms: ['view', 'views'] },
      { count: 3100, forms: ['profile visit', 'profile visits'] },
      { count: 1240, forms: ['follower', 'followers'] },
      { count: 400, forms: ['subscriber', 'subscribers'] },
      { count: 90, forms: ['trial member', 'trial members'] },
    ],
    flows: [300, 20, 8, 3, 1.2, 0.5],
    cubes: 8,
    goal: { total: 30, every: 2 },
    workers: [
      { agent: 'claude', zone: -1, state: 'work' },
      { agent: 'mistral', zone: -1, state: 'work' },
      { agent: 'chatgpt', zone: 0, state: 'work' },
      { agent: 'gemini', zone: 1, state: 'work' },
      { agent: 'kimi', zone: 1, state: 'sleep', wakeIn: 10 },
      { agent: 'hermes', zone: 2, state: 'work' },
      { agent: 'claude', zone: 2, state: 'sleep', wakeIn: 18 },
      { agent: 'perplexity', zone: 3, state: 'work' },
      { agent: 'deepseek', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Bug Bounty',
    theme: 'code',
    result: ['paid bounty', 'paid bounties'],
    stages: [
      { count: 30, forms: ['target', 'targets'] },
      { count: 11, forms: ['finding', 'findings'] },
      { count: 6, forms: ['report', 'reports'] },
      { count: 4, forms: ['triaged', 'triaged'] },
      { count: 3, forms: ['accepted', 'accepted'] },
    ],
    flows: [2, 0.6, 0.3, 0.2, 0.15, 1 / 10],
    cubes: 2,
    goal: { total: 12, every: 7 },
    workers: [
      { agent: 'deepseek', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'hermes', zone: 0, state: 'work' },
      {
        agent: 'chatgpt', zone: 1, state: 'ask',
        question: 'This finding looks close to a public report from March. Submit it anyway?',
      },
      { agent: 'qwen', zone: 1, state: 'work' },
      { agent: 'grok', zone: 2, state: 'work' },
      { agent: 'gemini', zone: 3, state: 'sleep', wakeIn: 14 },
      { agent: 'kimi', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Fundraising',
    source_url: 'https://airtable.com',
    theme: 'money',
    result: ['term sheet', 'term sheets'],
    stages: [
      { count: 120, forms: ['investor', 'investors'] },
      { count: 35, forms: ['intro', 'intros'] },
      { count: 12, forms: ['meeting', 'meetings'] },
      { count: 5, forms: ['partner meeting', 'partner meetings'] },
      { count: 2, forms: ['in due diligence', 'in due diligence'] },
    ],
    flows: [5, 1.5, 0.4, 0.2, 0.1, 1 / 14],
    cubes: 0,
    goal: { total: 10, every: 14 },
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work' },
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'gemini', zone: 0, state: 'work' },
      {
        agent: 'claude', zone: 1, state: 'ask',
        question: 'Northwind Ventures asks for the cap table before Thursday. Share it from the data room?',
      },
      { agent: 'grok', zone: 2, state: 'sleep', wakeIn: 2 * 3600 },
      { agent: 'mistral', zone: 2, state: 'work' },
      { agent: 'deepseek', zone: 3, state: 'work' },
      { agent: 'qwen', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Dating',
    theme: 'love',
    result: ['relationship', 'relationships'],
    stages: [
      { count: 180, forms: ['match', 'matches'] },
      { count: 64, forms: ['conversation', 'conversations'] },
      { count: 9, forms: ['first date', 'first dates'] },
      { count: 3, forms: ['second date', 'second dates'] },
      { count: 1, forms: ['sleepover', 'sleepovers'] },
    ],
    flows: [8, 3, 0.5, 0.2, 0.08, 1 / 60],
    cubes: 0,
    goal: { total: 1, every: 30 },
    workers: [
      { agent: 'kimi', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 0, state: 'sleep', wakeIn: 15 },
      {
        agent: 'grok', zone: 1, state: 'ask',
        question: 'Alex suggested Saturday at 7pm at the rooftop bar. Confirm the date?',
      },
      { agent: 'chatgpt', zone: 2, state: 'sleep', wakeIn: 9 * 3600 },
      { agent: 'gemini', zone: 2, state: 'work' },
      { agent: 'deepseek', zone: 3, state: 'work' },
      { agent: 'mistral', zone: 4, state: 'work' },
    ],
  },
  {
    title: 'Research',
    source_url: 'https://www.notion.so',
    theme: 'lab',
    result: ['published paper', 'published papers'],
    stages: [
      { count: 12, forms: ['idea', 'ideas'] },
      { count: 7, forms: ['draft', 'drafts'] },
      { count: 4, forms: ['preprint', 'preprints'] },
      { count: 3, forms: ['submitted', 'submitted'] },
      { count: 2, forms: ['under review', 'under review'] },
    ],
    flows: [1 / 2, 1 / 3, 1 / 5, 1 / 7, 1 / 10, 1 / 14],
    cubes: 1,
    goal: { total: 6, every: 21 },
    workers: [
      { agent: 'perplexity', zone: -1, state: 'work' },
      { agent: 'claude', zone: 0, state: 'work' },
      { agent: 'deepseek', zone: 0, state: 'work' },
      { agent: 'qwen', zone: 1, state: 'work' },
      { agent: 'chatgpt', zone: 2, state: 'work' },
      { agent: 'grok', zone: 3, state: 'sleep', wakeIn: 20 },
      { agent: 'hermes', zone: 4, state: 'work' },
    ],
  },
];

// Demo only: start each stage with a count that matches the funnel's conversion, so the tanks
// are consistent with the results so far. A stage holds enough for the results already out plus
// a lead of 15% of the remaining goal per stage below it (work in progress). Funnels with an unknown flow keep
// their written counts.
for (const f of FUNNELS) {
  const n = f.stages.length, fl = f.flows;
  if (fl.some(v => v == null)) continue;
  let yieldFrom = 1;
  for (let j = n - 1; j >= 0; j--) {
    yieldFrom *= Math.min(1, fl[j + 1] / fl[j]);
    f.stages[j].count = Math.round((f.cubes + 0.15 * (f.goal.total - f.cubes) * (n - j)) / yieldFrom);
  }
}

// forms: [singular, plural] (English) or [1, 2-4, 5+] (Russian).
export function plural(n, forms) {
  if (forms.length === 2) return n === 1 ? forms[0] : forms[1];
  const [one, few, many] = forms;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
