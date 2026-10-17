import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=f6bfcdbd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Pages of this site, resolved from this file, so they work on goalagents.run and on localhost alike.
export const siteUrl = path => new URL('../' + path, import.meta.url).href;
export const appUrl = () => siteUrl('app/');

// Where to go after signing in: ?next= when it is a page of this site (the OAuth consent page
// sends people here and wants them back), otherwise the account page.
export function afterSignIn() {
  const next = new URLSearchParams(location.search).get('next');
  try {
    const url = new URL(next, location.href);
    if (next && url.origin === location.origin) return url.href;
  } catch {}
  return appUrl();
}
