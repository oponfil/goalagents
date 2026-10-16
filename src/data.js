// Demo data shown on the landing page. In the product this comes from agents via MCP.
import { lang } from './i18n.js?v=3cb24732';

export const AGENTS = {
  // app: turns a web chat link into one that opens the desktop app, where the app has a link scheme.
  claude: { name: 'Claude', color: '#D97757', chat: 'https://claude.ai', app: url => url.replace(/^https:\/\/claude\.ai/, 'claude://claude.ai') },
  // The ChatGPT desktop app opens on codex:// links (it has no chatgpt:// scheme), but only on its
  // start screen: a link to one conversation stays on the web, where it opens that conversation.
  chatgpt: { name: 'ChatGPT', color: '#10A37F', chat: 'https://chatgpt.com', app: url => (/^https:\/\/chatgpt\.com\/./.test(url) ? url : 'codex://') },
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
  // "chatgpt-search": the agent's own name for its job (several ChatGPT agents in one funnel),
  // shown after the brand; buttons that open the app use the brand alone (product).
  if (base && rest.length) return { ...base, name: `${base.name} · ${rest.join(' ')}`, product: base.name };
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

// The demo in the viewer's language: titles, stage and result names, and questions, keyed by the
// English text. Columns: Russian, Chinese, Thai, Spanish, Vietnamese, Japanese. Russian names have
// three forms [1, 2-4, 5+], Spanish two [1, many]; Chinese, Thai, Vietnamese and Japanese have one.
const DEMO = {
  'Job Search': ['Поиск работы', '找工作', 'หางาน', 'Búsqueda de empleo', 'Tìm việc', '就職活動'],
  'Creator': ['Автор', '创作者', 'ครีเอเตอร์', 'Creador', 'Nhà sáng tạo', 'クリエイター'],
  'Bug Bounty': ['Баг-баунти', '漏洞赏金', 'บั๊กบาวน์ตี้', 'Bug bounty', 'Săn lỗi', 'バグバウンティ'],
  'Fundraising': ['Привлечение инвестиций', '融资', 'ระดมทุน', 'Inversión', 'Gọi vốn', '資金調達'],
  'Dating': ['Знакомства', '约会', 'หาคู่', 'Citas', 'Hẹn hò', '婚活'],
  'Research': ['Исследования', '科研', 'งานวิจัย', 'Investigación', 'Nghiên cứu', '研究'],
  'offer': [['оффер', 'оффера', 'офферов'], '录用通知', 'ข้อเสนองาน', ['oferta', 'ofertas'], 'lời mời làm việc', '内定'],
  'job found': [['найденная вакансия', 'найденные вакансии', 'найденных вакансий'], '找到的职位', 'งานที่พบ', ['vacante encontrada', 'vacantes encontradas'], 'việc tìm thấy', '見つけた求人'],
  'applied': [['отклик', 'отклика', 'откликов'], '已投递', 'สมัครแล้ว', ['postulación', 'postulaciones'], 'đã ứng tuyển', '応募済み'],
  'screening call': [['созвон с HR', 'созвона с HR', 'созвонов с HR'], '初筛电话', 'โทรคัดกรอง', ['llamada de selección', 'llamadas de selección'], 'cuộc gọi sàng lọc', '書類選考の電話'],
  'interview': [['собеседование', 'собеседования', 'собеседований'], '面试', 'สัมภาษณ์', ['entrevista', 'entrevistas'], 'phỏng vấn', '面接'],
  'final round': [['финальный раунд', 'финальных раунда', 'финальных раундов'], '终面', 'รอบสุดท้าย', ['ronda final', 'rondas finales'], 'vòng cuối', '最終面接'],
  'paying member': [['платный подписчик', 'платных подписчика', 'платных подписчиков'], '付费会员', 'สมาชิกที่จ่ายเงิน', ['miembro de pago', 'miembros de pago'], 'thành viên trả phí', '有料会員'],
  'view': [['просмотр', 'просмотра', 'просмотров'], '浏览', 'ยอดวิว', ['visualización', 'visualizaciones'], 'lượt xem', '閲覧'],
  'profile visit': [['заход в профиль', 'захода в профиль', 'заходов в профиль'], '主页访问', 'เข้าชมโปรไฟล์', ['visita al perfil', 'visitas al perfil'], 'lượt vào hồ sơ', 'プロフィール訪問'],
  'follower': [['подписчик', 'подписчика', 'подписчиков'], '粉丝', 'ผู้ติดตาม', ['seguidor', 'seguidores'], 'người theo dõi', 'フォロワー'],
  'subscriber': [['подписчик рассылки', 'подписчика рассылки', 'подписчиков рассылки'], '订阅者', 'ผู้สมัครรับ', ['suscriptor', 'suscriptores'], 'người đăng ký', '購読者'],
  'trial member': [['пробный участник', 'пробных участника', 'пробных участников'], '试用会员', 'สมาชิกทดลอง', ['miembro de prueba', 'miembros de prueba'], 'thành viên dùng thử', 'お試し会員'],
  'paid bounty': [['оплаченная награда', 'оплаченные награды', 'оплаченных наград'], '已付赏金', 'รางวัลที่จ่ายแล้ว', ['recompensa pagada', 'recompensas pagadas'], 'tiền thưởng đã trả', '支払われた報奨金'],
  'target': [['цель', 'цели', 'целей'], '目标', 'เป้าหมาย', ['objetivo', 'objetivos'], 'mục tiêu', '対象'],
  'finding': [['находка', 'находки', 'находок'], '发现', 'สิ่งที่พบ', ['hallazgo', 'hallazgos'], 'phát hiện', '発見'],
  'report': [['отчёт', 'отчёта', 'отчётов'], '报告', 'รายงาน', ['informe', 'informes'], 'báo cáo', '報告'],
  'triaged': [['разобран', 'разобрано', 'разобрано'], '已分类', 'คัดกรองแล้ว', ['clasificado', 'clasificados'], 'đã phân loại', 'トリアージ済み'],
  'accepted': [['принят', 'принято', 'принято'], '已接受', 'ได้รับการยอมรับ', ['aceptado', 'aceptados'], 'được chấp nhận', '受理'],
  'term sheet': [['term sheet', 'term sheet', 'term sheet'], '投资意向书', 'เทิร์มชีต', ['term sheet', 'term sheets'], 'bản điều khoản', 'タームシート'],
  'investor': [['инвестор', 'инвестора', 'инвесторов'], '投资人', 'นักลงทุน', ['inversor', 'inversores'], 'nhà đầu tư', '投資家'],
  'intro': [['знакомство', 'знакомства', 'знакомств'], '引荐', 'การแนะนำ', ['presentación', 'presentaciones'], 'lời giới thiệu', '紹介'],
  'meeting': [['встреча', 'встречи', 'встреч'], '会议', 'การประชุม', ['reunión', 'reuniones'], 'cuộc gặp', '面談'],
  'partner meeting': [['встреча с партнёром', 'встречи с партнёрами', 'встреч с партнёрами'], '合伙人会议', 'ประชุมกับพาร์ทเนอร์', ['reunión con socios', 'reuniones con socios'], 'cuộc gặp đối tác', 'パートナー面談'],
  'in due diligence': [['на проверке', 'на проверке', 'на проверке'], '尽职调查中', 'อยู่ระหว่างตรวจสอบ', ['en due diligence', 'en due diligence'], 'đang thẩm định', 'デューデリジェンス中'],
  'relationship': [['отношения', 'отношений', 'отношений'], '恋爱关系', 'ความสัมพันธ์', ['relación', 'relaciones'], 'mối quan hệ', '交際'],
  'match': [['мэтч', 'мэтча', 'мэтчей'], '配对', 'แมตช์', ['match', 'matches'], 'lượt ghép đôi', 'マッチ'],
  'conversation': [['переписка', 'переписки', 'переписок'], '聊天', 'บทสนทนา', ['conversación', 'conversaciones'], 'cuộc trò chuyện', 'やり取り'],
  'first date': [['первое свидание', 'первых свидания', 'первых свиданий'], '第一次约会', 'เดทแรก', ['primera cita', 'primeras citas'], 'buổi hẹn đầu', '初デート'],
  'second date': [['второе свидание', 'вторых свидания', 'вторых свиданий'], '第二次约会', 'เดทที่สอง', ['segunda cita', 'segundas citas'], 'buổi hẹn thứ hai', '2回目のデート'],
  'sleepover': [['ночёвка', 'ночёвки', 'ночёвок'], '过夜', 'ค้างคืน', ['noche juntos', 'noches juntos'], 'ngủ lại', 'お泊まり'],
  'published paper': [['опубликованная статья', 'опубликованные статьи', 'опубликованных статей'], '已发表论文', 'บทความที่ตีพิมพ์', ['artículo publicado', 'artículos publicados'], 'bài báo đã đăng', '掲載論文'],
  'idea': [['идея', 'идеи', 'идей'], '想法', 'ไอเดีย', ['idea', 'ideas'], 'ý tưởng', 'アイデア'],
  'draft': [['черновик', 'черновика', 'черновиков'], '草稿', 'ฉบับร่าง', ['borrador', 'borradores'], 'bản nháp', '草稿'],
  'preprint': [['препринт', 'препринта', 'препринтов'], '预印本', 'พรีปรินต์', ['preprint', 'preprints'], 'bản tiền ấn phẩm', 'プレプリント'],
  'submitted': [['отправлена', 'отправлены', 'отправлено'], '已投稿', 'ส่งแล้ว', ['enviado', 'enviados'], 'đã nộp', '投稿済み'],
  'under review': [['на рецензии', 'на рецензии', 'на рецензии'], '审稿中', 'อยู่ระหว่างพิจารณา', ['en revisión', 'en revisión'], 'đang phản biện', '査読中'],
  'The form asks for a salary expectation. Send the application with $120k?': ['В форме спрашивают ожидаемую зарплату. Отправить отклик с $120k?', '表单要求填写期望薪资。用 12 万美元提交申请吗？', 'แบบฟอร์มถามเงินเดือนที่คาดหวัง ส่งใบสมัครด้วย $120k ไหม?', 'El formulario pide una expectativa salarial. ¿Envío la postulación con $120k?', 'Biểu mẫu hỏi mức lương mong muốn. Gửi hồ sơ với $120k nhé?', 'フォームで希望年収を聞かれています。12万ドルで応募しますか？'],
  'This finding looks close to a public report from March. Submit it anyway?': ['Эта находка похожа на публичный отчёт из марта. Всё равно отправить?', '这个发现和三月的一份公开报告很像。仍然提交吗？', 'สิ่งที่พบนี้คล้ายรายงานสาธารณะเมื่อเดือนมีนาคม ส่งต่อไหม?', 'Este hallazgo se parece a un informe público de marzo. ¿Lo envío igualmente?', 'Phát hiện này gần giống một báo cáo công khai hồi tháng Ba. Vẫn gửi chứ?', 'この発見は3月の公開報告に似ています。それでも提出しますか？'],
  'Northwind Ventures asks for the cap table before Thursday. Share it from the data room?': ['Northwind Ventures просит таблицу капитализации до четверга. Дать доступ из data room?', 'Northwind Ventures 要求周四前提供股权结构表。从数据室共享吗？', 'Northwind Ventures ขอตารางผู้ถือหุ้นก่อนวันพฤหัสบดี แชร์จากดาต้ารูมไหม?', 'Northwind Ventures pide la tabla de capitalización antes del jueves. ¿La comparto desde el data room?', 'Northwind Ventures cần bảng cơ cấu vốn trước thứ Năm. Chia sẻ từ data room nhé?', 'Northwind Ventures が木曜までに資本政策表を求めています。データルームから共有しますか？'],
  'Alex suggested Saturday at 7pm at the rooftop bar. Confirm the date?': ['Алекс предложил субботу в 19:00 в баре на крыше. Подтвердить свидание?', 'Alex 提议周六晚上 7 点在屋顶酒吧见面。确认约会吗？', 'Alex ชวนวันเสาร์ 1 ทุ่มที่รูฟท็อปบาร์ ยืนยันเดทไหม?', 'Alex propuso el sábado a las 19:00 en el bar de la azotea. ¿Confirmo la cita?', 'Alex hẹn thứ Bảy lúc 19:00 ở quán bar sân thượng. Xác nhận buổi hẹn nhé?', 'Alex から土曜19時に屋上バーでと提案がありました。デートを確定しますか？'],
};
const COL = { ru: 0, zh: 1, th: 2, es: 3, vi: 4, ja: 5 }[lang];
const tr = text => (COL == null ? text : DEMO[text]?.[COL] ?? text);
const trForms = forms => (COL == null ? forms : DEMO[forms[0]] ? [DEMO[forms[0]][COL]].flat() : forms);
if (COL != null) for (const f of FUNNELS) {
  f.title = tr(f.title);
  f.result = trForms(f.result);
  for (const st of f.stages) st.forms = trForms(st.forms);
  for (const w of f.workers) if (w.question) w.question = tr(w.question);
}

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

// forms: [singular, plural] (English, Spanish), [1, 2-4, 5+] (Russian) or one form (Chinese, Japanese, Thai, Vietnamese).
export function plural(n, forms) {
  if (forms.length === 1) return forms[0];
  if (forms.length === 2) return n === 1 ? forms[0] : forms[1];
  const [one, few, many] = forms;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
