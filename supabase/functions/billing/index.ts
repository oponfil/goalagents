// Payments for Goalcraft Pro through Creem (the merchant of record: it takes the money, handles
// taxes and sends the receipts). Three routes:
//   POST /billing/checkout  a signed-in person starts paying: a Creem checkout link
//   POST /billing/portal    a paying person manages or cancels their subscription: a portal link
//   POST /billing/webhook   Creem tells us what happened; this moves accounts.pro_until
// Function secrets: CREEM_API_KEY, CREEM_WEBHOOK_SECRET (both from the Creem dashboard),
// CREEM_PRODUCT_ID, and CREEM_API (https://test-api.creem.io/v1 in test mode,
// https://api.creem.io/v1 live).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const SITE = 'https://goalcraft.ai'
const API = Deno.env.get('CREEM_API') ?? 'https://test-api.creem.io/v1'
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const DAY = 86400e3

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

async function creem(path: string, body: unknown) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('CREEM_API_KEY')!, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Creem ${path}: ${res.status} ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

// The signed-in person behind a request from the site.
async function person(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  const { data } = await admin.auth.getUser(token)
  return data.user
}

async function checkout(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const session = await creem('/checkouts', {
    product_id: Deno.env.get('CREEM_PRODUCT_ID'),
    request_id: user.id,
    customer: { email: user.email },
    success_url: `${SITE}/app/?pro=1`,
    metadata: { user_id: user.id },
  })
  return json({ url: session.checkout_url })
}

async function portal(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const { data } = await admin.from('accounts').select('creem_customer_id').eq('user_id', user.id).maybeSingle()
  if (!data?.creem_customer_id) return json({ error: 'no_subscription' }, 404)
  const res = await creem('/customers/billing', { customer_id: data.creem_customer_id })
  return json({ url: res.customer_portal_link })
}

// Creem signs the raw body with HMAC-SHA256 and the webhook secret, hex in creem-signature.
async function signed(body: string, signature: string | null) {
  if (!signature) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('CREEM_WEBHOOK_SECRET')!),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('')
  if (hex.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

async function webhook(req: Request) {
  const body = await req.text()
  if (!(await signed(body, req.headers.get('creem-signature')))) return json({ error: 'bad_signature' }, 401)
  const event = JSON.parse(body), type: string = event.eventType, o = event.object ?? {}
  const customer: string | undefined = typeof o.customer === 'string' ? o.customer : o.customer?.id
  const subscription: string | undefined = o.object === 'subscription' ? o.id : o.subscription?.id
  // Whose account: the user id we put in the checkout's metadata, else the Creem customer we stored.
  let userId: string | undefined = o.metadata?.user_id ?? o.subscription?.metadata?.user_id
  if (!userId && customer) {
    const { data } = await admin.from('accounts').select('user_id').eq('creem_customer_id', customer).maybeSingle()
    userId = data?.user_id
  }
  if (!userId) return json({ ignored: type })

  const { data: account } = await admin.from('accounts').select('pro_until').eq('user_id', userId).maybeSingle()
  const until = account?.pro_until ? Date.parse(account.pro_until) : 0
  const periodEnd = o.current_period_end_date ? Date.parse(o.current_period_end_date) : 0
  const change: Record<string, unknown> = { subscription_status: o.object === 'subscription' ? o.status : type.split('.')[1] }
  if (customer) change.creem_customer_id = customer
  if (subscription) change.creem_subscription_id = subscription

  const paid = ['checkout.completed', 'subscription.active', 'subscription.paid'].includes(type) || (type === 'subscription.update' && o.status === 'active')
  if (paid) {
    // Paid: Pro through the paid period plus two days of slack for the next charge, never less
    // than what the person already had (an early-access year, say).
    const paidTo = periodEnd ? periodEnd + 2 * DAY : Date.now() + 33 * DAY
    Object.assign(change, { plan: 'pro', pro_until: new Date(Math.max(until, paidTo)).toISOString(), subscription_status: 'active' })
  }
  // Cancelled, expired or unpaid: only the status changes. pro_until already ends with the last
  // paid month (plus the slack), so Pro lapses on its own, and time granted otherwise is kept.
  const { error } = await admin.from('accounts').update(change).eq('user_id', userId)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: type })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const path = new URL(req.url).pathname.replace(/^.*\/billing/, '')
  try {
    if (req.method === 'POST' && path === '/checkout') return await checkout(req)
    if (req.method === 'POST' && path === '/portal') return await portal(req)
    if (req.method === 'POST' && path === '/webhook') return await webhook(req)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'failed' }, 502)
  }
})
