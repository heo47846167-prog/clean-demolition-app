import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wlalunrwuzsdvxfopdjv.supabase.co";
const supabaseKey = "sb_publishable_sgPKwvDbqXL00gk4GfCmIQ_EU-Db3EV";

export const supabase = createClient(supabaseUrl, supabaseKey);