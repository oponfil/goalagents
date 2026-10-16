// The nav on every page: the language picker, and once signed in, "Sign in" becomes "Goals" with
// "Sign out" next to it. A signed-in person's language is kept in their account too.
import { supabase, siteUrl } from './auth.js';
import { t, lang, chosen, LANGS, SHORT, setLang, onLangSaved, adoptLang } from './i18n.js';

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
  // On a phone there is no room for both: signed-in people keep Sign out, Pricing goes.
  document.querySelector('.links a[href$="pricing/"]')?.classList.add('wide');
}
