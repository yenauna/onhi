(function () {
  if (window.getSupabaseClient) return;

  const DEFAULT_SUPABASE_URL = 'https://ytouzrchngqyuqafziad.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_WUrSn1U6sszhHrpEPOXwCA_ZQoJo6nW';

  const SUPABASE_URL = String(window.ONHI_SUPABASE_URL || DEFAULT_SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = String(window.ONHI_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || '').trim();

  const isValid = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'undefined' && SUPABASE_ANON_KEY !== 'undefined';

  let initPromise = null;

  const createClientOnce = () => {
    if (window.sb) {
      console.log('[Supabase] reuse existing global client');
      return window.sb;
    }

    if (!isValid) {
      console.error('[Supabase] Invalid configuration:', {
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY ? '[provided]' : SUPABASE_ANON_KEY,
      });
      return null;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.error('[Supabase] SDK is not ready.');
      return null;
    }

    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] client initialized once');
    return window.sb;
  };

  const ensureSdkLoaded = () => {
    if (window.supabase?.createClient) return Promise.resolve();

    if (window.__onhiSupabaseSdkLoadingPromise) {
      return window.__onhiSupabaseSdkLoadingPromise;
    }

    window.__onhiSupabaseSdkLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-onhi-supabase-sdk="true"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.dataset.onhiSupabaseSdk = 'true';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return window.__onhiSupabaseSdkLoadingPromise;
  };

 const ensureSupabaseClient = async () => {
    if (window.sb) return window.sb;
    if (!initPromise) {
      initPromise = ensureSdkLoaded()
        .then(createClientOnce)
        .catch((error) => {
          console.error('[Supabase] SDK load failed:', error);
          return null;
        });
    }
    return initPromise;
  };

  window.getSupabaseClient = () => window.sb || null;
  window.ensureSupabaseClient = ensureSupabaseClient;

  ensureSupabaseClient();
})();
