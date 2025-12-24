import { useState } from 'react'
import { supabase } from './supabaseClient'
import './LoginForm.css'

export default function LoginForm({ onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
    } catch (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setMessage('')

    if (!email) {
      setMessage('Skriv inn e-postadressen din')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })

      if (error) throw error

      setMessage('Sjekk e-posten din for tilbakestillingslenke')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="login-container">
        <div className="login-header">
          <h2>Glemt passord</h2>
          <p>Skriv inn e-postadressen din for å tilbakestille passordet</p>
        </div>

        {message && (
          <div className={`login-message ${message.includes('Sjekk') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleForgotPassword} className="login-form">
          <div className="form-group">
            <label>E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="din@epost.no"
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Sender...' : 'Send tilbakestillingslenke'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false)
                setMessage('')
              }}
              className="back-btn"
            >
              Tilbake til innlogging
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <h2>Logg inn</h2>
        <p>Skriv inn e-post og passord for å logge inn</p>
      </div>

      {message && (
        <div className="login-message error">
          {message}
        </div>
      )}

      <form onSubmit={handleLogin} className="login-form">
        <div className="form-group">
          <label>E-post</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="din@epost.no"
          />
        </div>

        <div className="form-group">
          <label>Passord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Skriv inn passord"
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Logger inn...' : 'Logg inn'}
          </button>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="forgot-btn"
          >
            Glemt passord?
          </button>
        </div>
      </form>
    </div>
  )
}
