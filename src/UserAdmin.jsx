import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './UserAdmin.css'

export default function UserAdmin({ session, onProfileUpdate }) {
  const [profile, setProfile] = useState({ firstName: '', lastName: '', avatarUrl: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [session])

  async function fetchProfile() {
    try {
      // Hent profil fra user_profiles tabellen
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = ingen rader funnet
        throw error
      }

      if (data) {
        setProfile({
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          avatarUrl: data.avatar_url || ''
        })
      } else {
        // Hvis ingen profil finnes, prøv å hente fra user_metadata
        const firstName = session.user.user_metadata?.first_name || ''
        const lastName = session.user.user_metadata?.last_name || ''
        const avatarUrl = session.user.user_metadata?.avatar_url || ''
        
        setProfile({ firstName, lastName, avatarUrl })
      }
    } catch (error) {
      console.error('Feil ved henting av profil:', error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')

    try {
      // Oppdater eller opprett profil i user_profiles tabellen
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: session.user.id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: profile.avatarUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      // Oppdater også user_metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: profile.avatarUrl
        }
      })

      if (metadataError) throw metadataError

      setMessage('Profil oppdatert!')
      setTimeout(() => setMessage(''), 3000)
      
      // Oppdater profil i parent component
      if (onProfileUpdate) {
        onProfileUpdate()
      }
    } catch (error) {
      setMessage('Feil ved lagring: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    // Valider filtype
    if (!file.type.startsWith('image/')) {
      setMessage('Kun bildefiler er tillatt')
      return
    }

    // Valider filstørrelse (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Bildet er for stort. Maks størrelse er 5MB')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Slett gammelt bilde hvis det finnes
      if (profile.avatarUrl) {
        try {
          const urlParts = profile.avatarUrl.split('/')
          const fileName = urlParts[urlParts.length - 1]
          if (fileName && fileName.includes('.')) {
            await supabase.storage.from('avatars').remove([`avatars/${fileName}`])
          }
        } catch (error) {
          console.error('Kunne ikke slette gammelt bilde:', error)
        }
      }

      // Last opp nytt bilde
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Hent public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setProfile({ ...profile, avatarUrl: publicUrl })
      setMessage('Bilde lastet opp! Husk å lagre endringene.')
    } catch (error) {
      setMessage('Feil ved opplasting av bilde: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveImage() {
    if (!profile.avatarUrl) return

    try {
      const urlParts = profile.avatarUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]
      if (fileName && fileName.includes('.')) {
        await supabase.storage.from('avatars').remove([`avatars/${fileName}`])
      }
      setProfile({ ...profile, avatarUrl: '' })
      setMessage('Bilde fjernet! Husk å lagre endringene.')
    } catch (error) {
      console.error('Feil ved sletting av bilde:', error)
      setProfile({ ...profile, avatarUrl: '' })
      setMessage('Bilde fjernet fra profil. Husk å lagre endringene.')
    }
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Laster profil...</div>
  }

  return (
    <div className="user-admin-container">
      <header className="user-admin-header">
        <h1>Min profil</h1>
        <p style={{ color: '#666', marginTop: '8px', fontSize: '0.95rem' }}>
          Rediger din profilinformasjon og profilbilde
        </p>
      </header>

      {message && (
        <div className={`message ${message.includes('Feil') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="profile-form">
        <div className="profile-image-section">
          <h3>Profilbilde</h3>
          <div className="avatar-container">
            {profile.avatarUrl ? (
              <img 
                src={profile.avatarUrl} 
                alt="Profilbilde" 
                className="avatar-preview"
              />
            ) : (
              <div className="avatar-placeholder">
                {profile.firstName?.[0] || profile.lastName?.[0] || session.user.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="image-actions">
            <label className="upload-btn">
              {uploading ? 'Laster opp...' : 'Last opp bilde'}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            {profile.avatarUrl && (
              <button 
                onClick={handleRemoveImage}
                className="remove-btn"
              >
                Fjern bilde
              </button>
            )}
          </div>
        </div>

        <div className="profile-info-section">
          <div className="form-group">
            <label>Fornavn:</label>
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              placeholder="Skriv inn fornavn"
            />
          </div>

          <div className="form-group">
            <label>Etternavn:</label>
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              placeholder="Skriv inn etternavn"
            />
          </div>

          <div className="form-group">
            <label>E-post:</label>
            <input
              type="email"
              value={session.user.email}
              disabled
              className="disabled-input"
            />
            <small style={{ color: '#666', fontSize: '0.85rem' }}>
              E-post kan ikke endres
            </small>
          </div>

          <div className="form-actions">
            <button 
              onClick={handleSave} 
              className="save-btn"
              disabled={saving}
            >
              {saving ? 'Lagrer...' : 'Lagre endringer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

