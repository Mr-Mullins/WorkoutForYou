import { useState } from 'react'
import { supabase } from './supabaseClient'
import './SignUpForm.css'

export default function SignUpForm({ onSignUpSuccess, onBack }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    // Validering
    if (formData.password !== formData.confirmPassword) {
      setMessage('Passordene matcher ikke')
      return
    }

    if (formData.password.length < 6) {
      setMessage('Passordet må være minst 6 tegn')
      return
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setMessage('Fornavn og etternavn er påkrevd')
      return
    }

    setLoading(true)

    try {
      // Opprett bruker
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim()
          }
        }
      })

      if (error) throw error

      // Profil vil bli opprettet automatisk via database trigger
      // eller når brukeren logger inn første gang

      setMessage('Registrering vellykket! Sjekk e-posten din for bekreftelseslenke.')
      
      // Vent litt før redirect
      setTimeout(() => {
        if (onSignUpSuccess) onSignUpSuccess()
      }, 2000)
    } catch (error) {
      setMessage('Feil ved registrering: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="signup-container">
      <div className="signup-header">
        <h2>Opprett konto</h2>
        <p>Fyll ut informasjonen nedenfor for å opprette en konto</p>
      </div>

      {message && (
        <div className={`signup-message ${message.includes('Feil') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="signup-form">
        <div className="form-row">
          <div className="form-group">
            <label>Fornavn *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              placeholder="Skriv inn fornavn"
            />
          </div>

          <div className="form-group">
            <label>Etternavn *</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              placeholder="Skriv inn etternavn"
            />
          </div>
        </div>

        <div className="form-group">
          <label>E-post *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            placeholder="din@epost.no"
          />
        </div>

        <div className="form-group">
          <label>Passord *</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
            placeholder="Minst 6 tegn"
          />
        </div>

        <div className="form-group">
          <label>Bekreft passord *</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            minLength={6}
            placeholder="Bekreft passordet"
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn"
          >
            {loading ? 'Oppretter konto...' : 'Opprett konto'}
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="back-btn"
            >
              Tilbake til innlogging
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

