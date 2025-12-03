import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Admin.css'

export default function Admin({ session, onBack }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ title: '', description: '', order: 0, active: true })
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchExercises()
  }, [])

  async function fetchExercises() {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('order', { ascending: true })

      if (error) throw error
      
      if (data) {
        setExercises(data)
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
      alert('Kunne ikke hente øvelser. Sjekk at exercises-tabellen eksisterer i Supabase.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      if (editingId) {
        // Oppdater eksisterende øvelse
        const { error } = await supabase
          .from('exercises')
          .update({
            title: formData.title,
            description: formData.description,
            order: parseInt(formData.order),
            active: formData.active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)

        if (error) throw error
      } else {
        // Opprett ny øvelse
        const { error } = await supabase
          .from('exercises')
          .insert([
            {
              title: formData.title,
              description: formData.description,
              order: parseInt(formData.order),
              active: formData.active
            }
          ])

        if (error) throw error
      }

      // Nullstill form og oppdater liste
      setFormData({ title: '', description: '', order: exercises.length + 1, active: true })
      setEditingId(null)
      setShowAddForm(false)
      fetchExercises()
    } catch (error) {
      alert('Feil ved lagring: ' + error.message)
    }
  }

  function handleEdit(exercise) {
    setFormData({
      title: exercise.title,
      description: exercise.description,
      order: exercise.order,
      active: exercise.active
    })
    setEditingId(exercise.id)
    setShowAddForm(true)
  }

  function handleCancel() {
    setFormData({ title: '', description: '', order: exercises.length + 1, active: true })
    setEditingId(null)
    setShowAddForm(false)
  }

  async function handleDelete(id) {
    if (!confirm('Er du sikker på at du vil slette denne øvelsen?')) return

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

      if (error) throw error

      fetchExercises()
    } catch (error) {
      alert('Feil ved sletting: ' + error.message)
    }
  }

  async function handleToggleActive(id, currentActive) {
    try {
      const { error } = await supabase
        .from('exercises')
        .update({ active: !currentActive })
        .eq('id', id)

      if (error) throw error

      fetchExercises()
    } catch (error) {
      alert('Feil ved oppdatering: ' + error.message)
    }
  }

  async function handleMoveUp(id, currentOrder) {
    if (currentOrder <= 1) return

    const prevExercise = exercises.find(ex => ex.order === currentOrder - 1)
    if (!prevExercise) return

    try {
      // Bytt rekkefølge
      await supabase
        .from('exercises')
        .update({ order: currentOrder - 1 })
        .eq('id', id)

      await supabase
        .from('exercises')
        .update({ order: currentOrder })
        .eq('id', prevExercise.id)

      fetchExercises()
    } catch (error) {
      alert('Feil ved flytting: ' + error.message)
    }
  }

  async function handleMoveDown(id, currentOrder) {
    const maxOrder = Math.max(...exercises.map(ex => ex.order))
    if (currentOrder >= maxOrder) return

    const nextExercise = exercises.find(ex => ex.order === currentOrder + 1)
    if (!nextExercise) return

    try {
      // Bytt rekkefølge
      await supabase
        .from('exercises')
        .update({ order: currentOrder + 1 })
        .eq('id', id)

      await supabase
        .from('exercises')
        .update({ order: currentOrder })
        .eq('id', nextExercise.id)

      fetchExercises()
    } catch (error) {
      alert('Feil ved flytting: ' + error.message)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Laster...</div>
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Admin - Administrer øvelser</h1>
        <button onClick={onBack} className="back-btn">
          Tilbake til Dashboard
        </button>
      </header>

      <div className="admin-actions">
        <button 
          onClick={() => {
            setFormData({ title: '', description: '', order: exercises.length + 1, active: true })
            setEditingId(null)
            setShowAddForm(!showAddForm)
          }}
          className="add-btn"
        >
          {showAddForm ? 'Avbryt' : '+ Legg til ny øvelse'}
        </button>
      </div>

      {showAddForm && (
        <div className="form-card">
          <h2>{editingId ? 'Rediger øvelse' : 'Ny øvelse'}</h2>
          <div className="form-group">
            <label>Tittel:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="F.eks. Liggende Bekkenvipp"
            />
          </div>
          <div className="form-group">
            <label>Beskrivelse:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="F.eks. 10-15 repetisjoner. Stram magen, press ryggen ned."
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Rekkefølge:</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              min="1"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              Aktiv (vis i Dashboard)
            </label>
          </div>
          <div className="form-actions">
            <button onClick={handleSave} className="save-btn">
              {editingId ? 'Oppdater' : 'Lagre'}
            </button>
            <button onClick={handleCancel} className="cancel-btn">
              Avbryt
            </button>
          </div>
        </div>
      )}

      <div className="exercises-list">
        <h2>Eksisterende øvelser ({exercises.length})</h2>
        {exercises.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            Ingen øvelser funnet. Legg til din første øvelse!
          </p>
        ) : (
          exercises.map((exercise) => (
            <div key={exercise.id} className={`exercise-item ${!exercise.active ? 'inactive' : ''}`}>
              <div className="exercise-info">
                <div className="exercise-header">
                  <span className="exercise-order">#{exercise.order}</span>
                  <h3>{exercise.title}</h3>
                  <span className={`status-badge ${exercise.active ? 'active' : 'inactive'}`}>
                    {exercise.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <p className="exercise-description">{exercise.description}</p>
              </div>
              <div className="exercise-actions">
                <button 
                  onClick={() => handleMoveUp(exercise.id, exercise.order)}
                  className="action-btn move-btn"
                  title="Flytt opp"
                >
                  ↑
                </button>
                <button 
                  onClick={() => handleMoveDown(exercise.id, exercise.order)}
                  className="action-btn move-btn"
                  title="Flytt ned"
                >
                  ↓
                </button>
                <button 
                  onClick={() => handleToggleActive(exercise.id, exercise.active)}
                  className={`action-btn ${exercise.active ? 'deactivate-btn' : 'activate-btn'}`}
                >
                  {exercise.active ? 'Deaktiver' : 'Aktiver'}
                </button>
                <button 
                  onClick={() => handleEdit(exercise)}
                  className="action-btn edit-btn"
                >
                  Rediger
                </button>
                <button 
                  onClick={() => handleDelete(exercise.id)}
                  className="action-btn delete-btn"
                >
                  Slett
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

