import { useState } from 'react'
import { supabase } from './supabaseClient'
import './Sidebar.css'

export default function Sidebar({ session, isAdmin, currentView, onNavigate, onSignOut, userProfile }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    if (onSignOut) onSignOut()
  }

  const handleNavigate = (view) => {
    onNavigate(view)
    setIsOpen(false) // Lukk menyen på mobil etter navigering
  }

  return (
    <>
      {/* Hamburger-knapp for mobil */}
      <button 
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {/* Overlay for mobil */}
      {isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>WorkoutForYou</h2>
          <div className="user-profile">
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt="Profilbilde" 
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(userProfile?.first_name?.[0] || userProfile?.last_name?.[0] || session?.user?.email?.[0]?.toUpperCase() || '?')}
              </div>
            )}
            <div className="user-info">
              <p className="user-name">
                {userProfile?.first_name && userProfile?.last_name
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : userProfile?.first_name || userProfile?.last_name
                  ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
                  : session?.user?.email?.split('@')[0]}
              </p>
              <p className="user-email">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            <span className="nav-icon">🏋️</span>
            <span className="nav-text">Dagens økt</span>
          </button>

          <button
            className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => handleNavigate('admin')}
          >
            <span className="nav-icon">🔧</span>
            <span className="nav-text">Øvelsesbygger</span>
          </button>

          <button
            className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => handleNavigate('profile')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">Min profil</span>
          </button>

          <div className="nav-divider"></div>

          <button
            className="nav-item logout"
            onClick={handleSignOut}
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logg ut</span>
          </button>
        </nav>
      </aside>
    </>
  )
}

