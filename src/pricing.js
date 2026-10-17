// The pricing page: "Get Pro" opens the Creem checkout; on Pro already, the button shows the plan
// and opens the subscription settings (or nothing to manage for Pro granted without paying).
import { supabase } from './auth.js?v=b34377a6';
import { account, openBilling } from './billing.js?v=b34377a6';
import { t, lang } from './i18n.js?v=b34377a6';

const button = document.getElementById('get-pro');
const note = document.getElementById('billing-note');
const fail = () => { button.disabled = false; note.textContent = t('billing.failed'); note.hidden = false; };

button.addEventListener('click', async e => {
  e.preventDefault();
  if (button.disabled) return;
  button.disabled = true; note.hidden = true;
  try { await openBilling(button.dataset.kind || 'checkout'); } catch { fail(); }
});

const { data: { session } } = await supabase.auth.getSession();
if (session) {
  const me = await account();
  if (me?.pro) {
    const date = me.until ? me.until.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    button.removeAttribute('data-i18n');
    if (me.paying) { button.textContent = t('nav.manage'); button.dataset.kind = 'portal'; }
    else { button.textContent = date ? t('nav.proUntil', date) : t('pricing.current'); button.disabled = true; button.classList.add('current'); }
  }
}
