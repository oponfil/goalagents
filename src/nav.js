// The nav on every page: the language picker, and once signed in, "Sign in" becomes "Goals" with
// "Sign out" next to it. A signed-in person's language is kept in their account too.
import { supabase, siteUrl } from './auth.js?v=37d7cad7';
import { t, lang, chosen, LANGS, SHORT, setLang, onLangSaved, adoptLang } from './i18n.js?v=37d7cad7';

const links = document.querySelector('nav .links');
const signin = document.querySelector('.links a.signin');
const { data: { session } } = await supabase.auth.getSession();

// Language picker: a plain select, so phones get their native list.
if (links) {
  const pick = document.createElement('select');
  pick.className = 'lang';
  pick.title = pick.ariaLabel = t('nav.lang');
  for (const [code, name] of Object.entries(LANGS)) pick.add(new Option(`${SHORT[code]} · ${name}`, code, false, code === lang));
  // Closed, it shows just the short code.
  const label = () => { [...pick.options].forEach(o => { o.textContent = o.value === pick.value && !pick.matches(':focus') ? SHORT[o.value] : `${SHORT[o.value]} · ${LANGS[o.value]}`; }); };
  pick.addEventListener('focus', label); pick.addEventListener('blur', label); label();
  pick.addEventListener('change', () => setLang(pick.value));
  (signin || links.lastElementChild)?.before(pick);
}

if (session) {
  const saved = session.user.user_metadata?.lang;
  onLangSaved(code => supabase.auth.updateUser({ data: { lang: code } }));
  // A new device follows the account; a language picked here (or none in the account yet) is
  // written to the account.
  if (saved && !chosen) adoptLang(saved);
  else if (saved !== lang) supabase.auth.updateUser({ data: { lang } }).catch(() => {});
}

if (signin && session) {
  const goals = new URL(signin.getAttribute('href').replace('login/', 'app/'), location.href).href;
  signin.textContent = t('nav.goals');
  signin.removeAttribute('data-i18n');
  signin.href = goals;
  signin.title = session.user.email;

  const out = document.createElement('a');
  out.href = '#';
  out.textContent = t('nav.signout');
  out.addEventListener('click', async e => {
    e.preventDefault();
    // Only this browser: a global sign-out would also cut off the agents connected by OAuth.
    await supabase.auth.signOut({ scope: 'local' });
    location.replace(siteUrl(''));
  });
  signin.before(out);

  // Email when an agent asks a question: a checkbox with a bell, kept in the account so the MCP
  // server sees it when an agent asks.
  const notify = document.createElement('label');
  notify.className = 'notify';
  notify.title = t('nav.notifyTitle', session.user.email);
  notify.innerHTML = `<input type="checkbox"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span class="wide"></span>`;
  notify.querySelector('span').textContent = t('nav.notify');
  const box = notify.querySelector('input');
  box.checked = !!session.user.user_metadata?.notify_email;
  box.addEventListener('change', async () => {
    box.disabled = true;
    const { error } = await supabase.auth.updateUser({ data: { notify_email: box.checked } });
    if (error) box.checked = !box.checked;
    box.disabled = false;
  });
  out.before(notify);
  // On a phone there is no room for both: signed-in people keep Sign out, Pricing goes.
  document.querySelector('.links a[href$="pricing/"]')?.classList.add('wide');
}
