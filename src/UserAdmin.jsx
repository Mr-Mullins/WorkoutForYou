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
        // Håndter både avatar_url og avatar_URL (små og store bokstaver)
        const avatarUrl = data.avatar_url || data.avatar_URL || ''
        
        setProfile({
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          avatarUrl: avatarUrl
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
      const filePath = fileName

      // Slett gammelt bilde hvis det finnes
      if (profile.avatarUrl) {
        try {
          // Hent filnavn fra URL-en
          const urlParts = profile.avatarUrl.split('/')
          let oldFileName = urlParts[urlParts.length - 1]
          
          // Fjern query parameters hvis de finnes
          oldFileName = oldFileName.split('?')[0]
          
          if (oldFileName && oldFileName.includes('.')) {
            // Prøv å slette med bare filnavnet
            const { error: removeError } = await supabase.storage
              .from('avatars')
              .remove([oldFileName])
            
            if (removeError) {
              console.log('Første slettingsforsøk feilet, prøver alternativ path:', removeError.message)
              // Prøv alternativ path hvis første feiler
              try {
                const { error: altError } = await supabase.storage
                  .from('avatars')
                  .remove([`avatars/${oldFileName}`])
                if (altError) {
                  console.log('Alternativ sletting feilet også:', altError.message)
                }
              } catch (altError) {
                console.log('Alternativ sletting feilet også:', altError)
              }
            }
          }
        } catch (error) {
          console.log('Feil ved sletting av gammelt bilde (ikke kritisk):', error)
          // Fortsett uansett - ikke kast feil
        }
      }

      // Last opp nytt bilde
      console.log('Laster opp bilde med path:', filePath)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error detaljer:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error
        })
        throw new Error(`Kunne ikke laste opp bilde: ${uploadError.message}`)
      }

      console.log('Bilde lastet opp, henter public URL...')
      // Hent public URL - bruk riktig path
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)
      
      console.log('Public URL hentet:', publicUrl)

      if (!publicUrl) {
        throw new Error('Kunne ikke hente URL for opplastet bilde')
      }

      // Oppdater state
      const newProfile = { ...profile, avatarUrl: publicUrl }
      setProfile(newProfile)

      // Lagre automatisk i databasen
      console.log('Lagrer URL i database:', publicUrl)
      const { data: dbData, error: dbError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: session.user.id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: publicUrl, // Lagre URL-en direkte
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (dbError) {
        console.error('Database error detaljer:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        })
        // Prøv alternativ kolonnenavn hvis det feiler (hvis databasen har avatar_URL)
        try {
          const { error: altDbError } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: session.user.id,
              first_name: profile.firstName,
              last_name: profile.lastName,
              avatar_URL: publicUrl, // Prøv med store bokstaver
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
          
          if (altDbError) {
            throw altDbError
          } else {
            console.log('Lagret med avatar_URL (store bokstaver)')
            setMessage('Bilde lastet opp og lagret!')
          }
        } catch (altError) {
          console.error('Alternativ database lagring feilet også:', altError)
          // Vis advarsel, men ikke kast feil - bildet er lastet opp
          setMessage('Bilde lastet opp, men kunne ikke lagre i database. Prøv å lagre manuelt.')
        }
      } else {
        console.log('URL lagret i database med avatar_url')
        // Oppdater også user_metadata
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name: profile.firstName,
            last_name: profile.lastName,
            avatar_url: publicUrl
          }
        })

        if (metadataError) {
          console.error('Metadata update error:', metadataError)
        }

        setMessage('Bilde lastet opp og lagret!')
        
        // Oppdater profil i parent component
        if (onProfileUpdate) {
          onProfileUpdate()
        }
      }
    } catch (error) {
      console.error('Upload error details:', error)
      setMessage('Feil ved opplasting av bilde: ' + (error.message || 'Ukjent feil'))
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveImage() {
    if (!profile.avatarUrl) return

    setUploading(true)
    setMessage('')

    try {
      // Hent filnavn fra URL-en
      const urlParts = profile.avatarUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]
      
      // Fjern query parameters hvis de finnes
      const cleanFileName = fileName.split('?')[0]
      
      if (cleanFileName && cleanFileName.includes('.')) {
        // Prøv å slette med bare filnavnet
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([cleanFileName])
        
        if (removeError) {
          console.error('Remove error:', removeError)
          // Prøv alternativ path
          try {
            await supabase.storage.from('avatars').remove([`avatars/${cleanFileName}`])
          } catch (altError) {
            console.error('Alternativ sletting feilet:', altError)
          }
        }
      }
      
      // Oppdater state og database
      const newProfile = { ...profile, avatarUrl: '' }
      setProfile(newProfile)
      
      // Lagre i databasen
      const { error: dbError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: session.user.id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: '',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (!dbError) {
        // Oppdater også user_metadata
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name: profile.firstName,
            last_name: profile.lastName,
            avatar_url: ''
          }
        })

        if (metadataError) {
          console.error('Metadata update error:', metadataError)
        }

        setMessage('Bilde fjernet!')
        
        if (onProfileUpdate) {
          onProfileUpdate()
        }
      } else {
        setMessage('Bilde fjernet fra visning. Husk å lagre endringene.')
      }
    } catch (error) {
      console.error('Feil ved sletting av bilde:', error)
      setProfile({ ...profile, avatarUrl: '' })
      setMessage('Bilde fjernet fra visning. Husk å lagre endringene.')
    } finally {
      setUploading(false)
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

