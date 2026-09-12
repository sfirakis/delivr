import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })

  const { signIn, signUp, signInWithGoogle } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // /home belonged to the retired customer app; partners land on their dashboard.
  const from = (location.state as any)?.from?.pathname ?? '/merchant'

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.email || !form.password) { toast.error('Συμπλήρωσε email & κωδικό'); return }
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(form.email, form.password)
      } else {
        if (!form.fullName) { toast.error('Συμπλήρωσε το όνομά σου'); setLoading(false); return }
        await signUp(form.email, form.password, form.fullName)
        toast.success('Ο λογαριασμός δημιουργήθηκε! Έλεγξε το email σου.')
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      toast.error(err.message ?? 'Κάτι πήγε στραβά')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen flex flex-col">
      {/* Hero */}
      <div className="bg-ink-1 px-8 pt-16 pb-10 flex-shrink-0">
        <h1 className="font-display font-black text-5xl text-brand mb-2">delivr</h1>
        <p className="text-ink-3 text-sm">
          {mode === 'signin' ? 'Καλώς ήρθες πίσω 👋' : 'Δημιούργησε λογαριασμό 🚀'}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-8 pb-6 overflow-y-auto space-y-4">

        {/* Mode toggle */}
        <div className="flex bg-surface-2 rounded-full p-1 gap-1">
          {(['signin','signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all
                ${mode === m ? 'bg-brand text-white' : 'text-ink-2'}`}>
              {m === 'signin' ? 'Σύνδεση' : 'Εγγραφή'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <div>
            <label className="input-label">Ονοματεπώνυμο</label>
            <div className="input-wrapper">
              <span className="text-ink-3">👤</span>
              <input className="input-field" placeholder="Αντώνης Παπαδόπουλος"
                value={form.fullName} onChange={update('fullName')} />
            </div>
          </div>
        )}

        <div>
          <label className="input-label">Email</label>
          <div className="input-wrapper">
            <span className="text-ink-3">✉️</span>
            <input className="input-field" type="email" placeholder="you@email.com"
              value={form.email} onChange={update('email')} autoComplete="email" />
          </div>
        </div>

        <div>
          <label className="input-label">Κωδικός</label>
          <div className="input-wrapper">
            <span className="text-ink-3">🔒</span>
            <input className="input-field" type="password" placeholder="Τουλάχιστον 6 χαρακτήρες"
              value={form.password} onChange={update('password')} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>
        </div>

        {mode === 'signin' && (
          <button className="text-sm text-brand font-medium self-end block ml-auto">
            Ξέχασες τον κωδικό;
          </button>
        )}

        <button className="btn btn-primary btn-lg mt-2" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size={20} color="white" /> : mode === 'signin' ? 'Σύνδεση' : 'Δημιουργία λογαριασμού'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-surface-4" />
          <span className="text-xs text-ink-3 font-medium">ή συνέχισε με</span>
          <div className="flex-1 h-px bg-surface-4" />
        </div>

        {/* Social */}
        <button className="btn btn-secondary btn-lg gap-3" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Συνέχεια με Google
        </button>

        <p className="text-xs text-ink-3 text-center pb-4">
          Με τη σύνδεση αποδέχεσαι τους{' '}
          <Link to="/terms" className="text-brand underline underline-offset-2">
            Όρους Χρήσης &amp; την Πολιτική Απορρήτου
          </Link>
          <br />
          <span className="text-[11px]">
            By signing in you accept the{' '}
            <Link to="/terms" className="text-brand underline underline-offset-2">Terms &amp; Privacy Policy</Link>
          </span>
        </p>
      </div>
    </div>
  )
}
