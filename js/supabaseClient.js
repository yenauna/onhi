// Supabase UMD 전역 방식 (안전 버전)
(function () {
  const SUPABASE_URL = "https://ytouzrchngqyuqafziad.supabase.co";
  const SUPABASE_ANON_KEY = "여기에_anon_key_붙여넣기";

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  script.onload = function () {
    window.sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    console.log("[Supabase] ready");
  };
  document.head.appendChild(script);
})();