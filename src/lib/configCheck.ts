/**
 * A build without Supabase credentials used to throw while the module graph was
 * still evaluating, which paints a blank white page — the least diagnosable
 * failure there is. This lets the entry point check first and say what is wrong.
 */
export interface MissingConfig { keys: string[] }

export function findMissingConfig(): MissingConfig | null {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const keys = required.filter(k => !env[k] || String(env[k]).trim() === '')
  return keys.length > 0 ? { keys } : null
}

/** Painted directly into the DOM: React never boots without a Supabase client. */
export function renderConfigError(root: HTMLElement, missing: MissingConfig) {
  const el = document.documentElement.lang === 'en' ||
             !navigator.language?.toLowerCase().startsWith('el')
  const t = el
    ? {
        title: 'This deployment is not configured yet',
        body: 'The build is missing its Supabase credentials, so the app cannot start.',
        howTo: 'Add these environment variables to the deployment and rebuild:',
        note: 'On Vercel they must be set for the environment being deployed — production variables do not apply to preview builds.',
      }
    : {
        title: 'Αυτό το deployment δεν έχει ρυθμιστεί',
        body: 'Λείπουν τα κλειδιά του Supabase από το build, οπότε η εφαρμογή δεν μπορεί να ξεκινήσει.',
        howTo: 'Πρόσθεσε αυτές τις μεταβλητές περιβάλλοντος και ξανακάνε build:',
        note: 'Στο Vercel πρέπει να οριστούν για το περιβάλλον που ανεβαίνει — οι μεταβλητές του production δεν ισχύουν για τα preview builds.',
      }

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                padding:24px;background:#F8F7F5;font-family:Verdana,Arial,sans-serif;color:#1A1814;">
      <div style="max-width:520px;background:#fff;border:1px solid #E8E5DF;border-radius:16px;padding:28px;">
        <div style="font-size:32px;line-height:1;margin-bottom:12px;">⚙️</div>
        <h1 style="margin:0 0 8px;font-size:20px;">${t.title}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#6B6760;">${t.body}</p>
        <p style="margin:0 0 8px;font-size:13px;font-weight:bold;">${t.howTo}</p>
        <pre style="margin:0 0 16px;padding:12px;background:#F0EEE9;border-radius:10px;
                    font-size:12px;overflow-x:auto;">${missing.keys.join('\n')}</pre>
        <p style="margin:0;font-size:12px;color:#A8A49E;">${t.note}</p>
      </div>
    </div>`
}
