import { useState, useEffect } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from './supabaseClient'
import Dashboard from './Dashboard'
import Admin from './Admin'
import './App.css'

function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setMessage('')

    if (password !== confirmPassword) {
      setMessage('Passordene matcher ikke')
      return
    }

    if (password.length < 6) {
      setMessage('Passordet må være minst 6 tegn')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: password })
    
    if (error) {
      setMessage('Feil: ' + error.message)
      setLoading(false)
    } else {
      setMessage('Passord oppdatert! Du blir logget inn...')
      // Rydd opp URL-en
      window.history.replaceState(null, '', window.location.pathname)
      // Vent litt før redirect
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    }
  }

  return (
    <div className="auth-container">
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2>Sett nytt passord</h2>
        <p>Vennligst skriv inn ditt nye passord nedenfor</p>
      </div>
      <form onSubmit={handleUpdatePassword} style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Nytt passord:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '16px'
            }}
            placeholder="Skriv inn nytt passord"
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Bekreft passord:
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '16px'
            }}
            placeholder="Bekreft nytt passord"
          />
        </div>
        {message && (
          <div style={{
            padding: '10px',
            marginBottom: '15px',
            borderRadius: '4px',
            backgroundColor: message.includes('Feil') ? '#fee' : '#efe',
            color: message.includes('Feil') ? '#c33' : '#3c3'
          }}>
            {message}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: loading ? '#ccc' : '#27ae60',
            color: 'white',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Oppdaterer...' : 'Oppdater passord'}
        </button>
      </form>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)

  // Enkel admin-sjekk basert på e-postadresse
  // Du kan endre dette til å bruke en admin-rolle i Supabase hvis du vil
  const isAdmin = () => {
    if (!session?.user?.email) return false
    // Legg til din admin-e-postadresse her, eller sjekk mot en admin-tabell i Supabase
    const adminEmails = [
      // Legg til admin-e-postadresser her, f.eks:
      // 'admin@example.com'
    ]
    return adminEmails.includes(session.user.email.toLowerCase())
  }

  useEffect(() => {
    // Sjekk om brukeren kommer fra en nullstillingslenke (sjekk URL hash)
    const checkRecoveryLink = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const type = hashParams.get('type')
      const accessToken = hashParams.get('access_token')
      
      if (type === 'recovery' && accessToken) {
        setShowPasswordReset(true)
        return true
      }
      return false
    }

    if (checkRecoveryLink()) {
      // Hvis vi har en recovery link, prøv å hente session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Håndter passord-nullstilling
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true)
      }
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Hvis brukeren er på nullstillingssiden, vis passord-skjema
  if (showPasswordReset) {
    return <UpdatePasswordForm />
  }

  if (!session) {
    return (
      <div className="auth-container">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['email']}
        />
      </div>
    )
  }

  // Vis Admin-komponenten hvis brukeren er admin og har valgt å vise admin
  if (showAdmin && isAdmin()) {
    return <Admin session={session} onBack={() => setShowAdmin(false)} />
  }

  // Vis Dashboard med admin-knapp hvis brukeren er admin
  return <Dashboard session={session} isAdmin={isAdmin()} onShowAdmin={() => setShowAdmin(true)} />
}

export default App
