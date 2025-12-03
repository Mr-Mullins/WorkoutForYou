import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Admin.css'

export default function Admin({ session, onBack }) {
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [formData, setFormData] = useState({ title: '', description: '', order: 0, active: true, exercise_group_id: null })
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '', order: 0, active: true })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)

  useEffect(() => {
    fetchExerciseGroups()
  }, [])

  useEffect(() => {
    if (selectedGroupId !== null) {
      fetchExercises()
    }
  }, [selectedGroupId])

  async function fetchExerciseGroups() {
    try {
      const { data, error } = await supabase
        .from('exercise_groups')
        .select('*')
        .order('order', { ascending: true })

      if (error) throw error
      
      if (data) {
        setExerciseGroups(data)
        if (data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data[0].id)
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Feil ved henting av exercise groups:', error.message)
      setLoading(false)
    }
  }

  async function fetchExercises() {
    try {
      if (selectedGroupId === null) {
        setExercises([])
        return
      }

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('exercise_group_id', selectedGroupId)
        .order('order', { ascending: true })

      if (error) throw error
      
      if (data) {
        setExercises(data)
      } else {
        setExercises([])
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
    }
  }

  async function handleSaveGroup() {
    try {
      if (editingGroupId) {
        const { error } = await supabase
          .from('exercise_groups')
          .update({
            name: groupFormData.name,
            description: groupFormData.description,
            order: parseInt(groupFormData.order),
            active: groupFormData.active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGroupId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('exercise_groups')
          .insert([
            {
              name: groupFormData.name,
              description: groupFormData.description,
              order: parseInt(groupFormData.order),
              active: groupFormData.active
            }
          ])

        if (error) throw error
      }

      setGroupFormData({ name: '', description: '', order: exerciseGroups.length + 1, active: true })
      setEditingGroupId(null)
      setShowGroupForm(false)
      fetchExerciseGroups()
    } catch (error) {
      alert('Feil ved lagring av gruppe: ' + error.message)
    }
  }

  async function handleSave() {
    try {
      if (!formData.exercise_group_id && selectedGroupId) {
        formData.exercise_group_id = selectedGroupId
      }

      if (!formData.exercise_group_id) {
        alert('Du må velge en exercise group')
        return
      }

      if (editingId) {
        // Oppdater eksisterende øvelse
        const { error } = await supabase
          .from('exercises')
          .update({
            title: formData.title,
            description: formData.description,
            order: parseInt(formData.order),
            active: formData.active,
            exercise_group_id: formData.exercise_group_id,
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
              active: formData.active,
              exercise_group_id: formData.exercise_group_id || selectedGroupId
            }
          ])

        if (error) throw error
      }

      // Nullstill form og oppdater liste
      setFormData({ title: '', description: '', order: exercises.length + 1, active: true, exercise_group_id: selectedGroupId })
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
      active: exercise.active,
      exercise_group_id: exercise.exercise_group_id || selectedGroupId
    })
    setEditingId(exercise.id)
    setShowAddForm(true)
  }

  function handleEditGroup(group) {
    setGroupFormData({
      name: group.name,
      description: group.description || '',
      order: group.order,
      active: group.active
    })
    setEditingGroupId(group.id)
    setShowGroupForm(true)
  }

  function handleCancel() {
    setFormData({ title: '', description: '', order: exercises.length + 1, active: true, exercise_group_id: selectedGroupId })
    setEditingId(null)
    setShowAddForm(false)
  }

  function handleCancelGroup() {
    setGroupFormData({ name: '', description: '', order: exerciseGroups.length + 1, active: true })
    setEditingGroupId(null)
    setShowGroupForm(false)
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Er du sikker på at du vil slette denne exercise group? Alle øvelser i gruppen vil også bli slettet.')) return

    try {
      // Slett først alle øvelser i gruppen
      await supabase
        .from('exercises')
        .delete()
        .eq('exercise_group_id', id)

      // Slett deretter gruppen
      const { error } = await supabase
        .from('exercise_groups')
        .delete()
        .eq('id', id)

      if (error) throw error

      fetchExerciseGroups()
      if (selectedGroupId === id) {
        setSelectedGroupId(null)
      }
    } catch (error) {
      alert('Feil ved sletting: ' + error.message)
    }
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
        <h1>Øvelsesbygger</h1>
        <p style={{color: '#666', marginTop: '8px', fontSize: '0.95rem'}}>
          Bygg og rediger øvelsene som vises i dagens økt
        </p>
      </header>

      <div className="admin-actions">
        <button 
          onClick={() => {
            setGroupFormData({ name: '', description: '', order: exerciseGroups.length + 1, active: true })
            setEditingGroupId(null)
            setShowGroupForm(!showGroupForm)
          }}
          className="add-btn"
          style={{ marginRight: '10px' }}
        >
          {showGroupForm ? 'Avbryt' : '+ Legg til exercise group'}
        </button>
        <button 
          onClick={() => {
            setFormData({ title: '', description: '', order: exercises.length + 1, active: true, exercise_group_id: selectedGroupId })
            setEditingId(null)
            setShowAddForm(!showAddForm)
          }}
          className="add-btn"
          disabled={!selectedGroupId && exerciseGroups.length > 0}
        >
          {showAddForm ? 'Avbryt' : '+ Legg til ny øvelse'}
        </button>
      </div>

      {showGroupForm && (
        <div className="form-card">
          <h2>{editingGroupId ? 'Rediger exercise group' : 'Ny exercise group'}</h2>
          <div className="form-group">
            <label>Gruppens navn:</label>
            <input
              type="text"
              value={groupFormData.name}
              onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
              placeholder="F.eks. Rygg"
            />
          </div>
          <div className="form-group">
            <label>Beskrivelse:</label>
            <textarea
              value={groupFormData.description}
              onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
              placeholder="Beskrivelse av gruppen"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Rekkefølge:</label>
            <input
              type="number"
              value={groupFormData.order}
              onChange={(e) => setGroupFormData({ ...groupFormData, order: parseInt(e.target.value) || 0 })}
              min="1"
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={groupFormData.active}
                onChange={(e) => setGroupFormData({ ...groupFormData, active: e.target.checked })}
              />
              Aktiv (vis i Dashboard)
            </label>
          </div>
          <div className="form-actions">
            <button onClick={handleSaveGroup} className="save-btn">
              {editingGroupId ? 'Oppdater' : 'Lagre'}
            </button>
            <button onClick={handleCancelGroup} className="cancel-btn">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Exercise Groups liste */}
      {exerciseGroups.length > 0 && (
        <div className="exercise-groups-section" style={{ marginBottom: '30px' }}>
          <h2>Exercise Groups ({exerciseGroups.length})</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {exerciseGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: selectedGroupId === group.id ? '2px solid #27ae60' : '1px solid #ddd',
                  background: selectedGroupId === group.id ? '#f0fff4' : 'white',
                  color: selectedGroupId === group.id ? '#27ae60' : '#2c3e50',
                  fontWeight: selectedGroupId === group.id ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {exerciseGroups.map(group => (
              <div key={group.id} style={{
                background: 'white',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                flex: '1',
                minWidth: '200px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{group.name}</h3>
                  <span className={`status-badge ${group.active ? 'active' : 'inactive'}`}>
                    {group.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                {group.description && (
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#666' }}>{group.description}</p>
                )}
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button 
                    onClick={() => handleEditGroup(group)}
                    className="action-btn edit-btn"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Rediger
                  </button>
                  <button 
                    onClick={() => handleDeleteGroup(group.id)}
                    className="action-btn delete-btn"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Slett
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="form-card">
          <h2>{editingId ? 'Rediger øvelse' : 'Legg til ny øvelse'}</h2>
          <div className="form-group">
            <label>Øvelsens navn:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="F.eks. Liggende Bekkenvipp"
            />
          </div>
          <div className="form-group">
            <label>Innhold/Beskrivelse:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="F.eks. 10-15 repetisjoner. Stram magen, press ryggen ned."
              rows={4}
            />
          </div>
          <div className="form-group">
            <label>Exercise Group:</label>
            <select
              value={formData.exercise_group_id || selectedGroupId || ''}
              onChange={(e) => setFormData({ ...formData, exercise_group_id: parseInt(e.target.value) || null })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            >
              <option value="">Velg exercise group</option>
              {exerciseGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
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
        <h2>
          {selectedGroupId 
            ? `Øvelser i "${exerciseGroups.find(g => g.id === selectedGroupId)?.name || 'Valgt gruppe'}" (${exercises.length})`
            : `Velg en exercise group for å se øvelser`
          }
        </h2>
        {!selectedGroupId && exerciseGroups.length > 0 && (
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '15px' }}>
            Velg en exercise group ovenfor for å se og redigere øvelser
          </p>
        )}
        {exercises.length === 0 && selectedGroupId ? (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            Ingen øvelser funnet i denne gruppen. Legg til din første øvelse!
          </p>
        ) : exercises.length > 0 ? (
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
        ) : null}
      </div>
    </div>
  )
}
