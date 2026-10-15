// Signed in: the nav's "Sign in" button becomes "Goals", with "Sign out" next to it.
import { supabase, siteUrl } from './auth.js';

const signin = document.querySelector('.links a.signin');
const { data: { session } } = await supabase.auth.getSession();

if (signin && session) {
  const goals = new URL(signin.getAttribute('href').replace('login/', 'app/'), location.href).href;
  signin.textContent = 'Goals';
  signin.href = goals;
  signin.title = session.user.email;

  const out = document.createElement('a');
  out.href = '#';
  out.textContent = 'Sign out';
  out.addEventListener('click', async e => {
    e.preventDefault();
    await supabase.auth.signOut();
    location.replace(siteUrl(''));
  });
  signin.before(out);
  // On a phone there is no room for both: signed-in people keep Sign out, Pricing goes.
  document.querySelector('.links a[href$="pricing/"]')?.classList.add('wide');
}
