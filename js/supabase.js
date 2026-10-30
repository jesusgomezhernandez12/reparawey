import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";

const supabaseUrl = "https://TU_PROYECTO.supabase.co";
const supabaseKey = "TU_CLAVE_ANONIMA";

const isConfigured =
  supabaseUrl !== "https://TU_PROYECTO.supabase.co" &&
  supabaseKey !== "TU_CLAVE_ANONIMA";

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createMockClient();

function createMockClient() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
    upsert: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
    update: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
    delete: () => Promise.resolve({ data: null, error: { message: "Supabase no configurado" } }),
  };
  return { from: () => chain };
}

export default supabase;
