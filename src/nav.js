// The nav on every page. Signed out: a language picker and "Sign in". Signed in: "Goals" and a round
// profile button (the Google photo, or a plain silhouette) whose menu holds the rarely used
// settings: the language, email when an agent asks, and signing out. A signed-in person's language
// is kept in their account too.
import { supabase, siteUrl } from './auth.js?v=a0e80956';
import { t, lang, chosen, LANGS, SHORT, setLang, onLangSaved, adoptLang } from './i18n.js?v=a0e80956';

const links = document.querySelector('nav .links');
const signin = document.querySelector('.links a.signin');
const { data: { session } } = await supabase.auth.getSession();

// Language picker: a plain select, so phones get their native list. Short: closed it shows just the
// code (in the nav); long: always the full names (in the profile menu).
function languagePicker(short) {
  const pick = document.createElement('select');
  pick.className = 'lang';
  pick.title = pick.ariaLabel = t('nav.lang');
  for (const [code, name] of Object.entries(LANGS)) pick.add(new Option(`${SHORT[code]} · ${name}`, code, false, code === lang));
  if (short) {
    const label = () => { [...pick.options].forEach(o => { o.textContent = o.value === pick.value && !pick.matches(':focus') ? SHORT[o.value] : `${SHORT[o.value]} · ${LANGS[o.value]}`; }); };
    pick.addEventListener('focus', label); pick.addEventListener('blur', label); label();
  } else [...pick.options].forEach(o => { o.textContent = LANGS[o.value]; });
  pick.addEventListener('change', () => setLang(pick.value));
  return pick;
}

if (links && !session) (signin || links.lastElementChild)?.before(languagePicker(true));

if (session) {
  const saved = session.user.user_metadata?.lang;
  onLangSaved(code => supabase.auth.updateUser({ data: { lang: code } }));
  // A new device follows the account; a language picked here (or none in the account yet) is
  // written to the account.
  if (saved && !chosen) adoptLang(saved);
  else if (saved !== lang) supabase.auth.updateUser({ data: { lang } }).catch(() => {});
}

if (signin && session) {
  const user = session.user, meta = user.user_metadata || {};
  const goals = new URL(signin.getAttribute('href').replace('login/', 'app/'), location.href).href;
  signin.textContent = t('nav.goals');
  signin.removeAttribute('data-i18n');
  signin.href = goals;

  // The profile button: the Google photo when there is one, else a silhouette.
  const profile = document.createElement('div');
  profile.className = 'profile';
  const button = document.createElement('button');
  button.className = 'avatar';
  button.title = button.ariaLabel = `${t('nav.profile')} · ${user.email}`;
  const photo = meta.avatar_url || meta.picture;
  if (photo) {
    const img = document.createElement('img');
    img.src = photo; img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { img.remove(); button.innerHTML = SILHOUETTE; });
    button.append(img);
  } else button.innerHTML = SILHOUETTE;

  const menu = document.createElement('div');
  menu.className = 'profile-menu';
  menu.hidden = true;
  const email = document.createElement('div');
  email.className = 'email'; email.textContent = user.email;

  const langRow = document.createElement('label');
  langRow.className = 'row';
  langRow.append(document.createTextNode(t('nav.lang')), languagePicker(false));

  // Email when an agent asks a question, kept in the account so the MCP server sees it.
  const notify = document.createElement('label');
  notify.className = 'row check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!meta.notify_email;
  box.addEventListener('change', async () => {
    box.disabled = true;
    const { error } = await supabase.auth.updateUser({ data: { notify_email: box.checked } });
    if (error) box.checked = !box.checked;
    box.disabled = false;
  });
  notify.append(box, document.createTextNode(t('nav.notifyLong')));
  // The session can be older than a change made elsewhere: read the account's current settings.
  supabase.auth.getUser().then(({ data }) => { if (data?.user && !box.disabled) box.checked = !!data.user.user_metadata?.notify_email; });

  const out = document.createElement('a');
  out.href = '#'; out.className = 'signout';
  out.textContent = t('nav.signout');
  out.addEventListener('click', async e => {
    e.preventDefault();
    // Only this browser: a global sign-out would also cut off the agents connected by OAuth.
    await supabase.auth.signOut({ scope: 'local' });
    location.replace(siteUrl(''));
  });

  menu.append(email, langRow, notify, out);
  profile.append(button, menu);
  signin.after(profile);

  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('pointerdown', e => { if (!profile.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

const SILHOUETTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z"/></svg>';
