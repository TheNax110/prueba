const SUPABASE_URL = "https://ylgcmtmhdimiidsyazgt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZ2NtdG1oZGltaWlkc3lhemd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDc5OTcsImV4cCI6MjEwMzc4Mzk5N30.hUF6pxRob31_qNEJae91vqhFpT4ctINSDMJagcxlpM0";

if (SUPABASE_URL === "TU_SUPABASE_URL" || SUPABASE_ANON_KEY === "TU_SUPABASE_ANON_KEY") {
  console.warn(
    '⚠️ LIMPIARTE: todavía no configuraste SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase.js. ' +
    'El sitio no va a poder conectarse a la base de datos hasta que los completes.'
  );
}

// Cliente único de Supabase, usado por data.js y auth.js.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
