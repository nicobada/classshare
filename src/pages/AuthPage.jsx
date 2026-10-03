import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const envEmails = import.meta.env.VITE_ALLOWED_EMAILS || ''
const ALLOWED_EMAILS = envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
const ALLOWED_DOMAIN = (import.meta.env.VITE_ALLOWED_DOMAIN || '').trim().toLowerCase()
const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL || 'demo@classshare.app').trim()
const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD || 'ClassShareDemo2025!').trim()

/**
 * Checks if the given email is permitted to log in or register.
 * @param {string} email
 * @returns {boolean}
 */
function isEmailAllowed(email) {
  const normalized = email.toLowerCase().trim()
  if (normalized === DEMO_EMAIL.toLowerCase()) return true
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(normalized)) return false
  if (ALLOWED_DOMAIN && !normalized.endsWith(ALLOWED_DOMAIN)) return false
  return true
}

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handle = async (e) => {
    e.preventDefault()
    setError('')

    if (!isEmailAllowed(form.email)) {
      setError(
        ALLOWED_DOMAIN
          ? `Devi usare un'email che termina con ${ALLOWED_DOMAIN}`
          : 'Questa email non è autorizzata per questa classe.'
      )
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        if (!form.name.trim()) {
          setError('Inserisci il tuo nome.')
          setLoading(false)
          return
        }
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password)
        await updateProfile(cred.user, { displayName: form.name })
        await setDoc(doc(db, 'profiles', cred.user.uid), {
          uid: cred.user.uid,
          name: form.name,
          email: form.email,
          fileCount: 0,
          createdAt: serverTimestamp()
        })
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password)
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Email già registrata.',
        'auth/wrong-password': 'Password errata.',
        'auth/user-not-found': 'Utente non trovato.',
        'auth/weak-password': 'Password troppo corta (min 6 caratteri).',
        'auth/invalid-email': 'Email non valida.',
        'auth/invalid-credential': 'Credenziali non valide.'
      }
      setError(msgs[err.code] || 'Errore: ' + err.message)
    }
    setLoading(false)
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    setError('')
    try {
      try {
        await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD)
      } catch (loginErr) {
        if (
          loginErr.code === 'auth/user-not-found' ||
          loginErr.code === 'auth/invalid-credential'
        ) {
          const cred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD)
          await updateProfile(cred.user, { displayName: 'Visitatore Demo' })
          await setDoc(doc(db, 'profiles', cred.user.uid), {
            uid: cred.user.uid,
            name: 'Visitatore Demo',
            email: DEMO_EMAIL,
            fileCount: 0,
            createdAt: serverTimestamp()
          })
        } else {
          throw loginErr
        }
      }
    } catch (err) {
      setError('Errore accesso demo: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoIcon}>⬡</span>
          <span style={s.logoText}>ClassShare</span>
        </div>
        <p style={s.sub}>
          {mode === 'login' ? 'Bentornato nella tua classe.' : 'Unisciti alla tua classe.'}
        </p>

        <div style={s.tabs}>
          <button
            style={mode === 'login' ? s.tabActive : s.tab}
            onClick={() => { setMode('login'); setError('') }}
          >
            Accedi
          </button>
          <button
            style={mode === 'register' ? s.tabActive : s.tab}
            onClick={() => { setMode('register'); setError('') }}
          >
            Registrati
          </button>
        </div>

        <form onSubmit={handle} style={s.form}>
          {mode === 'register' && (
            <div style={s.field}>
              <label style={s.label}>Nome completo</label>
              <input
                style={s.input}
                placeholder="es. Marco Rossi"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
          )}
          <div style={s.field}>
            <label style={s.label}>Email scolastica</label>
            <input
              style={s.input}
              type="email"
              placeholder={ALLOWED_DOMAIN ? `nome${ALLOWED_DOMAIN}` : 'nome@scuola.it'}
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              required
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button style={loading ? s.btnDisabled : s.btn} type="submit" disabled={loading}>
            {loading ? 'Caricamento...' : mode === 'login' ? 'Accedi' : 'Crea account'}
          </button>
        </form>

        <div style={s.divider}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>oppure per il portfolio</span>
          <span style={s.dividerLine} />
        </div>

        <button
          type="button"
          style={s.demoBtn}
          onClick={handleDemoLogin}
          disabled={loading}
        >
          ⚡ Prova rapida con Account Demo
        </button>

        <p style={s.hint}>
          Accesso riservato alla classe. I recruiter possono usare il pulsante demo per esplorare l'app.
        </p>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0e0e10',
    padding: '1rem'
  },
  card: {
    background: '#17171a',
    border: '1px solid #2a2a2f',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px'
  },
  logo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  logoIcon: { fontSize: '22px', color: '#7c6dfa' },
  logoText: { fontSize: '20px', fontWeight: '600', color: '#e8e6e0', letterSpacing: '-0.3px' },
  sub: { fontSize: '14px', color: '#6b6b75', marginBottom: '24px' },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: '#0e0e10',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '24px'
  },
  tab: {
    flex: 1,
    padding: '8px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    color: '#6b6b75',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif'
  },
  tabActive: {
    flex: 1,
    padding: '8px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: '#7c6dfa',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'DM Sans, sans-serif'
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', color: '#9b9ba8', fontWeight: '500' },
  input: {
    background: '#0e0e10',
    border: '1px solid #2a2a2f',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e8e6e0',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    transition: 'border-color 0.15s'
  },
  error: {
    fontSize: '13px',
    color: '#f87171',
    background: '#2a1515',
    borderRadius: '8px',
    padding: '10px 14px'
  },
  btn: {
    background: '#7c6dfa',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    marginTop: '4px',
    transition: 'opacity 0.15s'
  },
  btnDisabled: {
    background: '#3d3860',
    color: '#9b9ba8',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'not-allowed',
    fontFamily: 'DM Sans, sans-serif',
    marginTop: '4px'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '20px 0 16px 0'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: '#2a2a2f'
  },
  dividerText: {
    fontSize: '11px',
    color: '#6b6b75',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  demoBtn: {
    background: 'rgba(124, 109, 250, 0.12)',
    color: '#a99bfc',
    border: '1px solid rgba(124, 109, 250, 0.3)',
    borderRadius: '8px',
    padding: '11px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    transition: 'all 0.15s'
  },
  hint: { marginTop: '20px', fontSize: '12px', color: '#4a4a55', textAlign: 'center', lineHeight: '1.4' }
}
