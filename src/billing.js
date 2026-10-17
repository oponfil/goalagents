// Paying for Pro: the site asks supabase/functions/billing for a Creem link and goes there, either
// to pay (checkout) or to manage or cancel the subscription (portal). account() reads the person's
// plan as the limits see it.
import { supabase, siteUrl } from './auth.js?v=7b3172f5';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=7b3172f5';

export async function account() {
  const { data } = await supabase.from('accounts').select('plan, pro_until, creem_customer_id, subscription_status').maybeSingle();
  if (!data) return null;
  const until = data.pro_until ? new Date(data.pro_until) : null;
  const pro = data.plan === 'pro' && (!until || until > new Date());
  return { pro, until, paying: !!data.creem_customer_id, status: data.subscription_status };
}

// Opens Creem: 'checkout' to pay for Pro, 'portal' to manage the subscription. Signed out, the
// person signs in first and comes back to the pricing page.
export async function openBilling(kind) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = siteUrl('login/?next=' + encodeURIComponent(siteUrl('pricing/'))); return; }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/billing/${kind}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY },
  });
  const body = await res.json().catch(() => ({}));
  if (!body.url) throw new Error(body.error || 'failed');
  location.href = body.url;
}
