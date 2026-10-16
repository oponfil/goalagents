// Interface languages. The language comes from the person's choice (kept in this browser, and in
// their account once signed in), else from the browser, else English. Every text of the interface
// lives in STRINGS, one entry per key with a version per language; a new language is a new column.
// Static pages mark text with data-i18n="key" (text), data-i18n-html="key" (text with links) and
// data-i18n-attr="placeholder:key; title:key"; scripts call t(key, …args).

export const LANGS = { en: 'English', ru: 'Русский', zh: '中文', th: 'ไทย' };
export const SHORT = { en: 'EN', ru: 'RU', zh: '中文', th: 'ไทย' };
const KEY = 'goalagents-lang';

// Whether the person picked a language in this browser (rather than it coming from the browser).
let picked = null;
try { picked = localStorage.getItem(KEY); } catch {}
export const chosen = picked in LANGS;

function detect() {
  // ?lang=xx in the address wins for that page (not remembered): for links and the picture renderer.
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked in LANGS) return asked;
  if (chosen) return picked;
  for (const l of navigator.languages || [navigator.language || '']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (code in LANGS) return code;
  }
  return 'en';
}
export const lang = detect();

// Plural category of n in this language: one, few, many or other (English: one/other; Chinese and
// Thai: always other).
const rules = new Intl.PluralRules(lang);
export const pluralOf = n => rules.select(n);

// Choose: the person picked a language. Kept in this browser; saveRemote (set by nav.js once signed
// in) also keeps it in their account. The page reloads in the new language.
let saveRemote = null;
export const onLangSaved = fn => { saveRemote = fn; };
export async function setLang(code) {
  try { localStorage.setItem(KEY, code); } catch {}
  if (saveRemote) await saveRemote(code).catch(() => {});
  location.reload();
}
// On a device where nothing was picked yet, the account's language is adopted without asking.
export function adoptLang(code) {
  if (!(code in LANGS) || code === lang) return;
  try { localStorage.setItem(KEY, code); } catch {}
  location.reload();
}

const L = (en, ru, zh, th) => ({ en, ru, zh, th });

const STRINGS = {
  // Navigation and footer
  'nav.connect': L('Connect', 'Подключить', '连接', 'เชื่อมต่อ'),
  'nav.docs': L('Docs', 'Документация', '文档', 'เอกสาร'),
  'nav.pricing': L('Pricing', 'Тарифы', '价格', 'ราคา'),
  'nav.signin': L('Sign in', 'Войти', '登录', 'เข้าสู่ระบบ'),
  'nav.goals': L('Goals', 'Цели', '目标', 'เป้าหมาย'),
  'nav.signout': L('Sign out', 'Выйти', '退出', 'ออกจากระบบ'),
  'nav.lang': L('Language', 'Язык', '语言', 'ภาษา'),
  'footer.built': L('© 2026 GoalAgents', '© 2026 GoalAgents', '© 2026 GoalAgents', '© 2026 GoalAgents'),
  'footer.deck': L('Pitch deck', 'Презентация', '路演文稿', 'พิตช์เด็ค'),
  'footer.privacy': L('Privacy', 'Конфиденциальность', '隐私', 'ความเป็นส่วนตัว'),
  'footer.contact': L('Contact', 'Контакты', '联系', 'ติดต่อ'),

  // Landing
  'home.h1': L('Watch your AI agents work your goal funnels', 'Смотрите, как AI-агенты продвигают ваши цели по воронке', '看着你的 AI 智能体推进你的目标漏斗', 'ดู AI เอเจนต์ของคุณผลักดันเป้าหมายไปตามกรวย'),
  'home.lead': L(
    'Every goal is a funnel: a job, a partner, a paper, an audience. Your agents move it stage by stage. See the flow, the next result, and who is waiting for you.',
    'Каждая цель — это воронка: работа, партнёр, статья, аудитория. Агенты двигают её этап за этапом. Видно поток, следующий результат и кто ждёт вашего ответа.',
    '每个目标都是一个漏斗：一份工作、一位伴侣、一篇论文、一批受众。你的智能体一步步推进它。看清流量、下一个成果，以及谁在等你回复。',
    'ทุกเป้าหมายคือกรวย: งาน คู่ชีวิต งานวิจัย ผู้ติดตาม เอเจนต์ของคุณขยับมันทีละขั้น เห็นการไหล ผลลัพธ์ถัดไป และใครกำลังรอคุณอยู่'),
  'home.demo': L('Open the live demo', 'Открыть живое демо', '打开实时演示', 'เปิดเดโมสด'),
  'home.connect': L('Connect your agents', 'Подключить агентов', '连接你的智能体', 'เชื่อมต่อเอเจนต์ของคุณ'),
  'home.shotAlt': L('GoalAgents dashboard: goal funnels with pixel agents working between the stages', 'Доска GoalAgents: воронки целей и пиксельные агенты между этапами', 'GoalAgents 看板：目标漏斗，像素智能体在各阶段之间工作', 'แดชบอร์ด GoalAgents: กรวยเป้าหมายและเอเจนต์พิกเซลที่ทำงานระหว่างขั้น'),
  'home.p1h': L('Goals as funnels', 'Цели как воронки', '目标即漏斗', 'เป้าหมายคือกรวย'),
  'home.p1': L('Not tasks — stages. How much is at each step, how fast it flows, when the next result is due.', 'Не задачи, а этапы. Сколько на каждом шаге, как быстро движется, когда следующий результат.', '不是任务，而是阶段。每一步有多少、流动多快、下一个成果何时到来。', 'ไม่ใช่งาน แต่เป็นขั้นตอน แต่ละขั้นมีเท่าไร ไหลเร็วแค่ไหน และผลลัพธ์ถัดไปจะมาเมื่อไร'),
  'home.p2h': L('Your agents, at work', 'Ваши агенты за работой', '你的智能体正在工作', 'เอเจนต์ของคุณกำลังทำงาน'),
  'home.p2': L('Claude, ChatGPT, Gemini and others report through MCP. You watch them mine, brew, garden and code.', 'Claude, ChatGPT, Gemini и другие отчитываются через MCP. Вы смотрите, как они добывают, варят, садовничают и пишут код.', 'Claude、ChatGPT、Gemini 等通过 MCP 汇报。你看着它们采矿、调配、园艺和写代码。', 'Claude, ChatGPT, Gemini และอื่น ๆ รายงานผ่าน MCP คุณได้ดูพวกมันขุด ผสม ทำสวน และเขียนโค้ด'),
  'home.p3h': L('Answer from anywhere', 'Отвечайте откуда угодно', '随时随地回复', 'ตอบได้จากทุกที่'),
  'home.p3': L('When an agent needs you, it raises a hand. Reply from your phone and it gets back to work.', 'Когда агенту нужны вы, он поднимает руку. Ответьте с телефона — и он вернётся к работе.', '当智能体需要你时，它会举手。用手机回复，它就继续工作。', 'เมื่อเอเจนต์ต้องการคุณ มันจะยกมือ ตอบจากมือถือแล้วมันจะกลับไปทำงานต่อ'),

  // Connecting an agent
  'connect.h1': L('Connect an agent', 'Подключите агента', '连接一个智能体', 'เชื่อมต่อเอเจนต์'),
  'connect.empty.h1': L('Connect your agents', 'Подключите своих агентов', '连接你的智能体', 'เชื่อมต่อเอเจนต์ของคุณ'),
  'connect.intro': L(
    'Paste this into your agent: Claude, ChatGPT, Cursor or any other that supports MCP. It connects GoalAgents, or tells you how.',
    'Вставьте это в своего агента: Claude, ChatGPT, Cursor или любого другого с поддержкой MCP. Он подключит GoalAgents или подскажет, как это сделать.',
    '把这段话粘贴给你的智能体：Claude、ChatGPT、Cursor 或任何支持 MCP 的智能体。它会连接 GoalAgents，或告诉你怎么做。',
    'วางข้อความนี้ในเอเจนต์ของคุณ: Claude, ChatGPT, Cursor หรือเอเจนต์อื่นที่รองรับ MCP มันจะเชื่อมต่อ GoalAgents หรือบอกวิธีให้คุณ'),
  'connect.after': L(
    'When the agent connects, a GoalAgents page asks you to sign in and allow it. Then tell the agent which goal to work on, and its funnel appears in <a href="../app/">Goals</a>. Connect as many agents as you like, one by one.',
    'Когда агент подключается, страница GoalAgents попросит войти и разрешить доступ. Потом скажите агенту, над какой целью работать, и её воронка появится в разделе <a href="../app/">Цели</a>. Подключайте сколько угодно агентов, по одному.',
    '智能体连接时，GoalAgents 页面会请你登录并授权。然后告诉它要推进哪个目标，它的漏斗就会出现在<a href="../app/">目标</a>里。可以逐个连接任意多个智能体。',
    'เมื่อเอเจนต์เชื่อมต่อ หน้า GoalAgents จะขอให้คุณเข้าสู่ระบบและอนุญาต จากนั้นบอกเอเจนต์ว่าจะทำเป้าหมายไหน แล้วกรวยของมันจะปรากฏใน<a href="../app/">เป้าหมาย</a> เชื่อมต่อเอเจนต์ได้มากเท่าที่ต้องการ ทีละตัว'),
  'connect.empty.after': L(
    'Then tell it which goal to work on, and your funnels appear here. Not sure what it will look like? <a href="../demo/">See the demo</a>.',
    'Потом скажите ему, над какой целью работать, и ваши воронки появятся здесь. Хотите посмотреть, как это выглядит? <a href="../demo/">Откройте демо</a>.',
    '然后告诉它要推进哪个目标，你的漏斗就会出现在这里。想先看看效果？<a href="../demo/">查看演示</a>。',
    'จากนั้นบอกมันว่าจะทำเป้าหมายไหน แล้วกรวยของคุณจะปรากฏที่นี่ อยากเห็นหน้าตาก่อน? <a href="../demo/">ดูเดโม</a>'),
  'connect.prompt': L(
    (url) => `Connect this MCP server for me: ${url} (GoalAgents, remote, sign-in with OAuth). If you can't connect it yourself, tell me exactly how to do it in this app.`,
    (url) => `Подключи мне этот MCP-сервер: ${url} (GoalAgents, удалённый, вход через OAuth). Если не можешь подключить сам, объясни точно, как это сделать в этом приложении.`,
    (url) => `请帮我连接这个 MCP 服务器：${url}（GoalAgents，远程，通过 OAuth 登录）。如果你无法自己连接，请准确告诉我在这个应用里该怎么做。`,
    (url) => `ช่วยเชื่อมต่อ MCP เซิร์ฟเวอร์นี้ให้หน่อย: ${url} (GoalAgents, รีโมต, เข้าสู่ระบบด้วย OAuth) ถ้าเชื่อมต่อเองไม่ได้ ช่วยบอกวิธีทำในแอปนี้อย่างละเอียด`),
  'copy': L('Copy', 'Копировать', '复制', 'คัดลอก'),
  'copied': L('Copied', 'Скопировано', '已复制', 'คัดลอกแล้ว'),
  'copy.manual': L('Select the text and copy it', 'Выделите текст и скопируйте', '请选中文字并复制', 'เลือกข้อความแล้วคัดลอก'),

  // Goals page
  'app.updated': L((t) => `Updated ${t} ago`, (t) => `Обновлено ${t} назад`, (t) => `${t}前更新`, (t) => `อัปเดตเมื่อ ${t} ที่แล้ว`),
  'app.failed': L('Could not update', 'Не удалось обновить', '更新失败', 'อัปเดตไม่สำเร็จ'),
  'app.refresh': L('Refresh', 'Обновить', '刷新', 'รีเฟรช'),
  'app.refreshTitle': L('Refresh now', 'Обновить сейчас', '立即刷新', 'รีเฟรชตอนนี้'),
  'time.s': L((n) => `${n}s`, (n) => `${n} с`, (n) => `${n} 秒`, (n) => `${n} วิ`),
  'time.min': L((n) => `${n} min`, (n) => `${n} мин`, (n) => `${n} 分钟`, (n) => `${n} นาที`),
  'time.h': L((n) => `${n} h`, (n) => `${n} ч`, (n) => `${n} 小时`, (n) => `${n} ชม.`),
  'demo.clock': L((d) => `Demo · day ${d}`, (d) => `Демо · день ${d}`, (d) => `演示 · 第 ${d} 天`, (d) => `เดโม · วันที่ ${d}`),
  'demo.clockTitle': L('Demo time runs fast: one day every two seconds', 'В демо время идёт быстро: день за две секунды', '演示中时间过得很快：两秒一天', 'ในเดโมเวลาเดินเร็ว: สองวินาทีเท่ากับหนึ่งวัน'),

  // Board: popups and badges
  'board.waiting': L(
    (n) => `${n} ${n === 1 ? 'agent is' : 'agents are'} waiting for you`,
    (n) => `${n} ${({ one: 'агент ждёт', few: 'агента ждут' })[pluralOf(n)] || 'агентов ждут'} вашего ответа`,
    (n) => `${n} 个智能体在等你回复`,
    (n) => `เอเจนต์ ${n} ตัวกำลังรอคุณ`),
  'board.asking': L((who) => `${who} is waiting for you`, (who) => `${who} ждёт вашего ответа`, (who) => `${who} 在等你回复`, (who) => `${who} กำลังรอคุณ`),
  'board.askedAsleep': L((who) => `${who} asked you, then went to sleep`, (who) => `${who} задал вопрос и уснул`, (who) => `${who} 提了问题，然后睡着了`, (who) => `${who} ถามคุณแล้วเข้านอน`),
  'board.nextRun': L((when) => `It will pick your answer up on its next run, ${when}.`, (when) => `Он заберёт ответ при следующем запуске, ${when}.`, (when) => `它会在下次运行时取走你的回复（${when}）。`, (when) => `มันจะรับคำตอบของคุณในรอบถัดไป ${when}`),
  'board.inTime': L((t) => `in ${t}`, (t) => `через ${t}`, (t) => `${t}后`, (t) => `ในอีก ${t}`),
  'board.whenRuns': L('when it next runs', 'когда запустится', '下次运行时', 'เมื่อมันรันครั้งถัดไป'),
  'board.resting': L((who) => `${who} is resting until the next run`, (who) => `${who} отдыхает до следующего запуска`, (who) => `${who} 正在休息，等待下次运行`, (who) => `${who} กำลังพักจนถึงรอบถัดไป`),
  'board.starting': L((who) => `${who} is starting a shift`, (who) => `${who} начинает смену`, (who) => `${who} 开始轮班`, (who) => `${who} กำลังเริ่มกะ`),
  'board.finished': L((who) => `${who} finished a shift`, (who) => `${who} закончил смену`, (who) => `${who} 结束了轮班`, (who) => `${who} จบกะแล้ว`),
  'board.working': L((who) => `${who} is working`, (who) => `${who} работает`, (who) => `${who} 正在工作`, (who) => `${who} กำลังทำงาน`),
  'board.open': L((who) => `Open ${who}`, (who) => `Открыть ${who}`, (who) => `打开 ${who}`, (who) => `เปิด ${who}`),
  'board.replyIn': L((who) => `Reply in ${who}`, (who) => `Ответить в ${who}`, (who) => `在 ${who} 中回复`, (who) => `ตอบใน ${who}`),
  'board.answer': L('Your answer', 'Ваш ответ', '你的回复', 'คำตอบของคุณ'),
  'board.send': L('Send answer', 'Отправить ответ', '发送回复', 'ส่งคำตอบ'),
  'board.close': L('Close', 'Закрыть', '关闭', 'ปิด'),
  'board.goalReached': L('goal reached ✓', 'цель достигнута ✓', '目标已达成 ✓', 'ถึงเป้าหมายแล้ว ✓'),
  'board.goal': L((total, every) => `goal: ${total}, 1 per ${every}`, (total, every) => `цель: ${total}, 1 за ${every}`, (total, every) => `目标：${total}，每 ${every} 1 个`, (total, every) => `เป้าหมาย: ${total}, 1 ต่อ ${every}`),
  'board.next': L((eta) => `next ${eta}`, (eta) => `следующий ${eta}`, (eta) => `下一个 ${eta}`, (eta) => `ถัดไป ${eta}`),
  // Units: per hour, day, week, month (flows "+8/d") and durations ("≈21 d").
  'unit.h': L('h', 'ч', '时', 'ชม.'),
  'unit.d': L('d', 'д', '天', 'วัน'),
  'unit.w': L('w', 'нед', '周', 'สัปดาห์'),
  'unit.mo': L('mo', 'мес', '月', 'เดือน'),
  'dur.h': L((n) => `${n} h`, (n) => `${n} ч`, (n) => `${n} 小时`, (n) => `${n} ชม.`),
  'dur.d': L((n) => `${n} d`, (n) => `${n} д`, (n) => `${n} 天`, (n) => `${n} วัน`),
  'dur.mo': L((n) => `${n} mo`, (n) => `${n} мес`, (n) => `${n} 个月`, (n) => `${n} เดือน`),

  // Pricing
  'pricing.h1': L('Pricing', 'Тарифы', '价格', 'ราคา'),
  'pricing.lead': L('Pro is free during early access: everyone who signs up now gets it.', 'Pro бесплатен на время раннего доступа: его получает каждый, кто зарегистрируется сейчас.', '抢先体验期间 Pro 免费：现在注册的每个人都能获得。', 'Pro ใช้ฟรีในช่วงทดลองใช้ก่อนใคร ทุกคนที่สมัครตอนนี้จะได้รับ'),
  'pricing.forever': L('forever', 'навсегда', '永久', 'ตลอดไป'),
  'pricing.free1': L('<b>3</b> goal funnels', '<b>3</b> воронки целей', '<b>3</b> 个目标漏斗', 'กรวยเป้าหมาย <b>3</b> อัน'),
  'pricing.free2': L('<b>3</b> stages in each funnel', '<b>3</b> этапа в каждой воронке', '每个漏斗 <b>3</b> 个阶段', '<b>3</b> ขั้นในแต่ละกรวย'),
  'pricing.free3': L('<b>1</b> agent at each step, <b>4</b> in a funnel', '<b>1</b> агент на каждом шаге, <b>4</b> в воронке', '每一步 <b>1</b> 个智能体，每个漏斗 <b>4</b> 个', 'เอเจนต์ <b>1</b> ตัวต่อขั้น <b>4</b> ตัวต่อกรวย'),
  'pricing.pro1': L('<b>10</b> goal funnels', '<b>10</b> воронок целей', '<b>10</b> 个目标漏斗', 'กรวยเป้าหมาย <b>10</b> อัน'),
  'pricing.pro2': L('<b>5</b> stages in each funnel', '<b>5</b> этапов в каждой воронке', '每个漏斗 <b>5</b> 个阶段', '<b>5</b> ขั้นในแต่ละกรวย'),
  'pricing.pro3': L('<b>2</b> agents at each step, <b>12</b> in a funnel', '<b>2</b> агента на каждом шаге, <b>12</b> в воронке', '每一步 <b>2</b> 个智能体，每个漏斗 <b>12</b> 个', 'เอเจนต์ <b>2</b> ตัวต่อขั้น <b>12</b> ตัวต่อกรวย'),
  'pricing.any': L('Claude, ChatGPT, Gemini and any MCP agent', 'Claude, ChatGPT, Gemini и любой MCP-агент', 'Claude、ChatGPT、Gemini 及任何 MCP 智能体', 'Claude, ChatGPT, Gemini และเอเจนต์ MCP ใดก็ได้'),
  'pricing.live': L('Live dashboard, all six themes', 'Живая доска, все шесть тем', '实时看板，全部六种主题', 'แดชบอร์ดสด ครบทั้งหกธีม'),
  'pricing.answer': L('Answer your agents from the dashboard', 'Отвечайте агентам прямо с доски', '直接在看板上回复智能体', 'ตอบเอเจนต์ได้จากแดชบอร์ด'),
  'pricing.startFree': L('Start free', 'Начать бесплатно', '免费开始', 'เริ่มใช้ฟรี'),
  'pricing.early': L('Early access', 'Ранний доступ', '抢先体验', 'ทดลองใช้ก่อนใคร'),
  'pricing.perMonth': L('per month, free during early access', 'в месяц, бесплатно в раннем доступе', '每月，抢先体验期间免费', 'ต่อเดือน ฟรีในช่วงทดลองใช้ก่อนใคร'),
  'pricing.getPro': L('Get Pro free', 'Получить Pro бесплатно', '免费获取 Pro', 'รับ Pro ฟรี'),
  'pricing.fine1': L(
    'Agents work at the steps of a funnel: above the first stage, between stages, and below the last one, where they turn the last stage into results. A funnel has one step more than stages.',
    'Агенты работают на шагах воронки: над первым этапом, между этапами и под последним, где они превращают последний этап в результаты. Шагов в воронке на один больше, чем этапов.',
    '智能体在漏斗的各个步骤上工作：第一阶段之上、阶段之间，以及最后一个阶段之下（把最后阶段变成成果）。步骤数比阶段数多一个。',
    'เอเจนต์ทำงานที่ขั้นตอนของกรวย: เหนือขั้นแรก ระหว่างขั้น และใต้ขั้นสุดท้ายที่เปลี่ยนขั้นสุดท้ายเป็นผลลัพธ์ จำนวนขั้นตอนมากกว่าจำนวนขั้นหนึ่ง'),
  'pricing.fine2': L(
    'When early access ends, Pro becomes $10 a month. We will tell you before that, and you can keep using the free plan.',
    'Когда ранний доступ закончится, Pro будет стоить $10 в месяц. Мы предупредим заранее, а бесплатным тарифом можно будет пользоваться дальше.',
    '抢先体验结束后，Pro 为每月 10 美元。我们会提前通知你，你也可以继续使用免费方案。',
    'เมื่อช่วงทดลองใช้ก่อนใครจบลง Pro จะมีราคา $10 ต่อเดือน เราจะแจ้งล่วงหน้า และคุณยังใช้แผนฟรีต่อได้'),

  // Privacy
  'privacy.h1': L('Privacy', 'Конфиденциальность', '隐私', 'ความเป็นส่วนตัว'),
  'privacy.updated': L('Last updated: 15 October 2026', 'Обновлено: 15 октября 2026', '最后更新：2026 年 10 月 15 日', 'อัปเดตล่าสุด: 15 ตุลาคม 2026'),
  'privacy.h.store': L('What we store', 'Что мы храним', '我们存储什么', 'เราเก็บอะไรบ้าง'),
  'privacy.store': L(
    'When you sign in with Google or an email link, we store your email address and a user ID. With Google we also receive your name and profile picture; we do not use them for anything else. When your agents connect, we store the funnels, counts, results and agent states they report.',
    'Когда вы входите через Google или по ссылке из письма, мы храним ваш адрес почты и идентификатор пользователя. От Google мы также получаем имя и фото профиля и больше ни для чего их не используем. Когда подключаются ваши агенты, мы храним воронки, счётчики, результаты и состояния агентов, о которых они сообщают.',
    '当你通过 Google 或邮件链接登录时，我们存储你的邮箱地址和用户 ID。通过 Google 我们还会收到你的姓名和头像，但不会用于其他用途。当你的智能体连接后，我们存储它们汇报的漏斗、计数、成果和智能体状态。',
    'เมื่อคุณเข้าสู่ระบบด้วย Google หรือลิงก์ทางอีเมล เราเก็บที่อยู่อีเมลและรหัสผู้ใช้ของคุณ จาก Google เรายังได้รับชื่อและรูปโปรไฟล์ แต่ไม่นำไปใช้อย่างอื่น เมื่อเอเจนต์ของคุณเชื่อมต่อ เราเก็บกรวย ตัวเลข ผลลัพธ์ และสถานะเอเจนต์ที่พวกมันรายงาน'),
  'privacy.h.why': L('Why', 'Зачем', '为什么', 'ทำไม'),
  'privacy.why': L(
    'Only to sign you in and show your dashboard. We do not sell your data, show ads or share it with third parties, except the services that run GoalAgents: Supabase (database and sign-in) and GitHub Pages (hosting).',
    'Только чтобы вы могли войти и видеть свою доску. Мы не продаём данные, не показываем рекламу и не передаём данные третьим лицам, кроме сервисов, на которых работает GoalAgents: Supabase (база данных и вход) и GitHub Pages (хостинг).',
    '仅用于让你登录并显示你的看板。我们不出售你的数据、不展示广告，也不与第三方共享，运行 GoalAgents 的服务除外：Supabase（数据库和登录）和 GitHub Pages（托管）。',
    'เพื่อให้คุณเข้าสู่ระบบและแสดงแดชบอร์ดเท่านั้น เราไม่ขายข้อมูล ไม่แสดงโฆษณา และไม่แบ่งปันกับบุคคลที่สาม ยกเว้นบริการที่ใช้รัน GoalAgents: Supabase (ฐานข้อมูลและการเข้าสู่ระบบ) และ GitHub Pages (โฮสติ้ง)'),
  'privacy.h.google': L('Google data', 'Данные Google', 'Google 数据', 'ข้อมูลจาก Google'),
  'privacy.google': L(
    'GoalAgents asks Google only for your email and basic profile. Its use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.',
    'GoalAgents запрашивает у Google только почту и базовый профиль. Использование информации, полученной через API Google, соответствует <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, включая требования Limited Use.',
    'GoalAgents 只向 Google 请求你的邮箱和基本资料。对从 Google API 获得的信息的使用遵循 <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>，包括 Limited Use 要求。',
    'GoalAgents ขอจาก Google เพียงอีเมลและโปรไฟล์พื้นฐาน การใช้ข้อมูลที่ได้รับจาก Google API เป็นไปตาม <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a> รวมถึงข้อกำหนด Limited Use'),
  'privacy.h.delete': L('Deleting your data', 'Удаление данных', '删除你的数据', 'การลบข้อมูลของคุณ'),
  'privacy.delete': L(
    'Write to <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a> and we will delete your account and everything your agents reported.',
    'Напишите на <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>, и мы удалим ваш аккаунт и всё, что сообщили ваши агенты.',
    '写信到 <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>，我们会删除你的账户及你的智能体汇报的所有内容。',
    'เขียนมาที่ <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a> แล้วเราจะลบบัญชีของคุณและทุกอย่างที่เอเจนต์ของคุณรายงาน'),

  // Contact
  'contact.h1': L('Contact', 'Контакты', '联系', 'ติดต่อ'),
  'contact.who': L('GoalAgents is made by Oleg Ponfilenok.', 'GoalAgents делает Олег Понфиленок.', 'GoalAgents 由 Oleg Ponfilenok 打造。', 'GoalAgents สร้างโดย Oleg Ponfilenok'),
  'contact.h.write': L('Write to us', 'Напишите нам', '给我们写信', 'เขียนถึงเรา'),
  'contact.write': L('Questions, ideas, bugs or a partnership: <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>.', 'Вопросы, идеи, ошибки или партнёрство: <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>.', '问题、想法、错误或合作：<a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>。', 'คำถาม ไอเดีย บั๊ก หรือความร่วมมือ: <a href="mailto:ponfil@gmail.com">ponfil@gmail.com</a>'),
  'contact.h.code': L('Code', 'Код', '代码', 'โค้ด'),
  'contact.code': L(
    'The code and the MCP protocol are on <a href="https://github.com/oponfil/goalagents" target="_blank" rel="noopener">GitHub</a>. Issues and pull requests are welcome.',
    'Код и протокол MCP — на <a href="https://github.com/oponfil/goalagents" target="_blank" rel="noopener">GitHub</a>. Issues и pull requests приветствуются.',
    '代码和 MCP 协议在 <a href="https://github.com/oponfil/goalagents" target="_blank" rel="noopener">GitHub</a> 上，欢迎提交 issue 和 pull request。',
    'โค้ดและโปรโตคอล MCP อยู่บน <a href="https://github.com/oponfil/goalagents" target="_blank" rel="noopener">GitHub</a> ยินดีรับ issue และ pull request'),

  // Sign in
  'login.h1': L('Sign in', 'Вход', '登录', 'เข้าสู่ระบบ'),
  'login.sub': L('New here? The same steps create your account.', 'Впервые здесь? Те же шаги создадут аккаунт.', '第一次来？同样的步骤会为你创建账户。', 'มาครั้งแรก? ขั้นตอนเดียวกันจะสร้างบัญชีให้คุณ'),
  'login.or': L('or with email', 'или по почте', '或使用邮箱', 'หรือด้วยอีเมล'),
  'login.send': L('Email me a sign-in link', 'Прислать ссылку для входа', '给我发送登录链接', 'ส่งลิงก์เข้าสู่ระบบทางอีเมล'),
  'login.signing': L('Signing in…', 'Входим…', '正在登录…', 'กำลังเข้าสู่ระบบ…'),
  'login.sending': L('Sending…', 'Отправляем…', '正在发送…', 'กำลังส่ง…'),
  'login.expired': L(
    'That sign-in link was already used or has expired: each link works once, for a short time. Ask for a new one below, or continue with Google.',
    'Эта ссылка для входа уже использована или устарела: каждая работает один раз и недолго. Запросите новую ниже или войдите через Google.',
    '此登录链接已被使用或已过期：每个链接只能使用一次，且有效期很短。请在下方重新获取，或使用 Google 登录。',
    'ลิงก์เข้าสู่ระบบนี้ถูกใช้ไปแล้วหรือหมดอายุ: แต่ละลิงก์ใช้ได้ครั้งเดียวในเวลาสั้น ๆ ขอลิงก์ใหม่ด้านล่าง หรือเข้าสู่ระบบด้วย Google'),
  'login.failed': L('Signing in with that link did not work. Ask for a new one below, or continue with Google.', 'Войти по этой ссылке не получилось. Запросите новую ниже или войдите через Google.', '无法通过该链接登录。请在下方重新获取，或使用 Google 登录。', 'เข้าสู่ระบบด้วยลิงก์นั้นไม่สำเร็จ ขอลิงก์ใหม่ด้านล่าง หรือเข้าสู่ระบบด้วย Google'),
  'login.check': L((email) => `Check ${email} for a sign-in link.`, (email) => `Проверьте ${email}: там ссылка для входа.`, (email) => `请查看 ${email} 中的登录链接。`, (email) => `ตรวจสอบ ${email} เพื่อดูลิงก์เข้าสู่ระบบ`),

  // OAuth consent
  'consent.loading': L('Loading…', 'Загрузка…', '加载中…', 'กำลังโหลด…'),
  'consent.cant': L("Can't connect", 'Не удаётся подключить', '无法连接', 'เชื่อมต่อไม่ได้'),
  'consent.toGoals': L('Go to Goals', 'Перейти к целям', '前往目标', 'ไปที่เป้าหมาย'),
  'consent.noRequest': L('This link has no authorization request. Start connecting from your agent again.', 'В этой ссылке нет запроса на доступ. Начните подключение из агента ещё раз.', '此链接没有授权请求。请从你的智能体重新开始连接。', 'ลิงก์นี้ไม่มีคำขออนุญาต เริ่มเชื่อมต่อจากเอเจนต์ของคุณอีกครั้ง'),
  'consent.anApp': L('An app', 'Приложение', '一个应用', 'แอปหนึ่ง'),
  'consent.theApp': L('the app', 'приложение', '该应用', 'แอป'),
  'consent.h1': L((name) => `Connect ${name}?`, (name) => `Подключить ${name}?`, (name) => `连接 ${name}？`, (name) => `เชื่อมต่อ ${name}?`),
  'consent.wants': L((name, email) => `${name} wants to work with your GoalAgents as ${email}.`, (name, email) => `${name} хочет работать с вашим GoalAgents от имени ${email}.`, (name, email) => `${name} 想以 ${email} 的身份使用你的 GoalAgents。`, (name, email) => `${name} ต้องการทำงานกับ GoalAgents ของคุณในชื่อ ${email}`),
  'consent.p1': L('See your goal funnels, counts and agents', 'Видеть ваши воронки, счётчики и агентов', '查看你的目标漏斗、计数和智能体', 'ดูกรวยเป้าหมาย ตัวเลข และเอเจนต์ของคุณ'),
  'consent.p2': L('Create and change funnels, report progress and results', 'Создавать и менять воронки, сообщать о прогрессе и результатах', '创建和修改漏斗，汇报进度和成果', 'สร้างและแก้ไขกรวย รายงานความคืบหน้าและผลลัพธ์'),
  'consent.p3': L('Show itself at work and ask you questions', 'Показывать себя за работой и задавать вам вопросы', '展示自己的工作并向你提问', 'แสดงตัวขณะทำงานและถามคำถามคุณ'),
  'consent.note': L((host) => `After you allow it, you go back to ${host}. Only allow apps you started connecting yourself.`, (host) => `После разрешения вы вернётесь в ${host}. Разрешайте только приложения, которые подключаете сами.`, (host) => `授权后你会回到 ${host}。只授权你自己发起连接的应用。`, (host) => `หลังอนุญาต คุณจะกลับไปที่ ${host} อนุญาตเฉพาะแอปที่คุณเริ่มเชื่อมต่อเองเท่านั้น`),
  'consent.allow': L('Allow', 'Разрешить', '允许', 'อนุญาต'),
  'consent.deny': L('Deny', 'Отклонить', '拒绝', 'ปฏิเสธ'),
};

// The text for key in the current language (English if missing); functions take args.
export function t(key, ...args) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const v = entry[lang] ?? entry.en;
  return typeof v === 'function' ? v(...args) : v;
}

// Fill the static page: data-i18n (text), data-i18n-html (text with markup), data-i18n-attr.
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}

document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
applyI18n();
