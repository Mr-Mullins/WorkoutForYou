import { useState, useEffect } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from './supabaseClient'
import Dashboard from './Dashboard'
import Admin from './Admin'
import UserAdmin from './UserAdmin'
import Sidebar from './Sidebar'
import SignUpForm from './SignUpForm'
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
  const [showSignUp, setShowSignUp] = useState(false)
  const [currentView, setCurrentView] = useState('dashboard')
  const [userProfile, setUserProfile] = useState(null)

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

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) {
        fetchUserProfile(session.user.id)
      }
    }

    // Last session uansett om det er recovery link eller ikke
    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Håndter passord-nullstilling
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true)
      }
      setSession(session)
      
      // Hent brukerprofil når session endres
      if (session?.user) {
        fetchUserProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserProfile(userId) {
    try {
      // Prøv først å hente fra user_profiles tabell
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        // Håndter både avatar_url og avatar_URL (små og store bokstaver)
        const profileData = {
          ...data,
          avatar_url: data.avatar_url || data.avatar_URL || ''
        }
        setUserProfile(profileData)
        return
      }

      // Hvis profil ikke finnes (PGRST116 = ingen rader funnet), hent fra user_metadata
      if (error?.code === 'PGRST116') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const profile = {
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            avatar_url: user.user_metadata?.avatar_url || ''
          }
          setUserProfile(profile)
          
          // Opprett profil i bakgrunnen (ikke blokker UI)
          supabase
            .from('user_profiles')
            .insert({
              user_id: userId,
              ...profile
            })
            .catch(err => console.error('Kunne ikke opprette profil:', err))
        }
      } else if (error) {
        // Hvis det er en annen feil, logg den og prøv fallback
        console.error('Feil ved henting av profil:', error)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserProfile({
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            avatar_url: user.user_metadata?.avatar_url || ''
          })
        }
      }
    } catch (error) {
      console.error('Feil ved henting av profil:', error)
      // Fallback til user_metadata ved uventet feil
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserProfile({
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            avatar_url: user.user_metadata?.avatar_url || ''
          })
        }
      } catch (fallbackError) {
        console.error('Fallback feilet også:', fallbackError)
      }
    }
  }

  // Hvis brukeren er på nullstillingssiden, vis passord-skjema
  if (showPasswordReset) {
    return <UpdatePasswordForm />
  }

  useEffect(() => {
    // Fjern "Sign in with Email" knappen når Auth-komponenten er lastet
    const removeProviderButton = () => {
      const authWrapper = document.querySelector('.auth-wrapper')
      if (authWrapper) {
        // Finn alle buttons og sjekk om de er provider-knapper
        const buttons = authWrapper.querySelectorAll('button[data-state="default"]')
        buttons.forEach(button => {
          const text = button.textContent || button.innerText || ''
          // Kun fjern hvis det er "Sign in with Email" knappen
          if (text.toLowerCase().includes('sign in with email') || 
              (text.toLowerCase().includes('email') && text.toLowerCase().includes('sign'))) {
            button.style.display = 'none'
            // Hvis parent div bare inneholder denne knappen, skjul den også
            const parent = button.parentElement
            if (parent && parent.children.length === 1 && parent.tagName === 'DIV') {
              parent.style.display = 'none'
            }
          }
        })
      }
    }

    // Kjør etter en liten delay for å la Auth-komponenten rendres først
    const timer = setTimeout(removeProviderButton, 200)
    const timer2 = setTimeout(removeProviderButton, 1000)

    return () => {
      clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [session, showSignUp])

  if (!session) {
    if (showSignUp) {
      return (
        <div className="auth-container">
          <SignUpForm 
            onSignUpSuccess={() => setShowSignUp(false)}
            onBack={() => setShowSignUp(false)}
          />
        </div>
      )
    }
    
    return (
      <div className="auth-container">
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <div className="auth-wrapper">
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#27ae60',
                      brandAccent: '#229954',
                    }
                  }
                }
              }}
              providers={['email']}
              view="sign_in"
              onlyThirdPartyProviders={false}
              magicLink={false}
            />
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => setShowSignUp(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#646cff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              Har du ikke konto? Registrer deg her
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Layout med sidebar
  return (
    <div className="app-layout">
      <Sidebar
        session={session}
        isAdmin={isAdmin()}
        currentView={currentView}
        onNavigate={setCurrentView}
        onSignOut={() => setSession(null)}
        userProfile={userProfile}
      />
      <main className="main-content">
        {currentView === 'admin' ? (
          <Admin session={session} onBack={() => setCurrentView('dashboard')} />
        ) : currentView === 'profile' ? (
          <UserAdmin 
            session={session} 
            onProfileUpdate={() => {
              if (session?.user) {
                fetchUserProfile(session.user.id)
              }
            }}
          />
        ) : (
          <Dashboard 
            session={session} 
            isAdmin={isAdmin()} 
            onShowAdmin={() => setCurrentView('admin')} 
            userProfile={userProfile}
          />
        )}
      </main>
    </div>
  )
}

export default App
