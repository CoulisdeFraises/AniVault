import { createClient } from "@supabase/supabase-js";

// Config d'auth explicite plutôt que de laisser supabase-js deviner :
// dans certains contextes sandboxés (PWA standalone, webview embarquée...),
// la détection automatique du storage peut silencieusement échouer et
// retomber sur un adaptateur en mémoire (non persistant) — la session ne
// survit alors JAMAIS à un redémarrage de l'app, ce qui correspond
// exactement à "je dois systématiquement me reconnecter en rouvrant l'app".
// En le précisant nous-mêmes, on retire toute ambiguïté.
//
// IMPORTANT : `storageKey` n'est PAS fixé ici — on garde la clé par défaut
// que supabase-js dérive automatiquement du projet. La changer casserait
// la lecture des sessions déjà persistées (nouvelle clé = rien retrouvé =
// tout le monde déconnecté une fois de plus), ce qui irait à l'encontre du
// correctif.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storage:            window.localStorage,
    },
  }
);