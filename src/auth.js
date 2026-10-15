import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Where sign-in links and Google bring the user back: the account page on this same site,
// so it works on goalagents.run and on localhost alike.
export const appUrl = () => new URL('../app/', location.href).href;
