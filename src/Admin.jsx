import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Admin.css'

export default function Admin({ session, onBack }) {
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [formData, setFormData] = useState({ title: '', description: '', order: 0, active: true, exercise_group_id: null, sets: 1, reps: null, weight_unit: 'kropp' })
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '', order: 0, active: true })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [exerciseImages, setExerciseImages] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [selectedImageService, setSelectedImageService] = useState('midjourney')

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
        const { data, error } = await supabase
          .from('exercise_groups')
          .insert([
            {
              name: groupFormData.name,
              description: groupFormData.description,
              order: parseInt(groupFormData.order),
              active: groupFormData.active
            }
          ])
          .select()
          .single()

        if (error) throw error

        // Hvis vi opprettet en ny gruppe, sett den som valgt
        if (data) {
          await fetchExerciseGroups()
          setSelectedGroupId(data.id)
        } else {
          await fetchExerciseGroups()
        }
      }

      setGroupFormData({ name: '', description: '', order: exerciseGroups.length + 1, active: true })
      setEditingGroupId(null)
      setShowGroupForm(false)
      
      // Hvis vi redigerte en eksisterende gruppe, oppdater listen
      if (editingGroupId) {
        await fetchExerciseGroups()
      }
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

      let savedExerciseId = editingId

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
            sets: formData.sets ? parseInt(formData.sets) : 1,
            reps: formData.reps ? parseInt(formData.reps) : null,
            weight_unit: formData.weight_unit || 'kropp',
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)

        if (error) throw error
      } else {
        // Opprett ny øvelse
        const { data, error } = await supabase
          .from('exercises')
          .insert([
            {
              title: formData.title,
              description: formData.description,
              order: parseInt(formData.order),
              active: formData.active,
              exercise_group_id: formData.exercise_group_id || selectedGroupId,
              sets: formData.sets ? parseInt(formData.sets) : 1,
              reps: formData.reps ? parseInt(formData.reps) : null,
              weight_unit: formData.weight_unit || 'kropp'
            }
          ])
          .select()
          .single()

        if (error) throw error
        if (data) {
          savedExerciseId = data.id
        }
      }

      // Save exercise images
      if (savedExerciseId && exerciseImages.length > 0) {
        await saveExerciseImages(savedExerciseId)
      }

      // Nullstill form og oppdater liste
      setFormData({ title: '', description: '', order: exercises.length + 1, active: true, exercise_group_id: selectedGroupId, sets: 1, reps: null, weight_unit: 'kropp' })
      setExerciseImages([])
      setEditingId(null)
      setShowAddForm(false)
      fetchExercises()
    } catch (error) {
      alert('Feil ved lagring: ' + error.message)
    }
  }

  async function saveExerciseImages(exerciseId) {
    try {
      // Delete existing images first if editing
      if (editingId) {
        const { data: existingImages } = await supabase
          .from('exercise_images')
          .select('*')
          .eq('exercise_id', exerciseId)

        if (existingImages && existingImages.length > 0) {
          // Delete images from storage
          const filesToDelete = existingImages.map(img => {
            const urlParts = img.image_url.split('/')
            return urlParts[urlParts.length - 1].split('?')[0]
          })

          await supabase.storage
            .from('exercise-images')
            .remove(filesToDelete)

          // Delete from database
          await supabase
            .from('exercise_images')
            .delete()
            .eq('exercise_id', exerciseId)
        }
      }

      // Insert new images
      if (exerciseImages.length > 0) {
        const imagesToInsert = exerciseImages.map((imgUrl, index) => ({
          exercise_id: exerciseId,
          image_url: imgUrl,
          order: index
        }))

        const { error } = await supabase
          .from('exercise_images')
          .insert(imagesToInsert)

        if (error) throw error
      }
    } catch (error) {
      console.error('Error saving exercise images:', error)
      throw error
    }
  }

  async function handleEdit(exercise) {
    setFormData({
      title: exercise.title,
      description: exercise.description,
      order: exercise.order,
      active: exercise.active,
      exercise_group_id: exercise.exercise_group_id || selectedGroupId,
      sets: exercise.sets || 1,
      reps: exercise.reps || null,
      weight_unit: exercise.weight_unit || 'kropp'
    })
    setEditingId(exercise.id)
    setShowAddForm(true)
    
    // Fetch existing images
    try {
      const { data: images, error } = await supabase
        .from('exercise_images')
        .select('*')
        .eq('exercise_id', exercise.id)
        .order('order', { ascending: true })

      if (error) throw error
      
      if (images && images.length > 0) {
        setExerciseImages(images.map(img => img.image_url))
      } else {
        setExerciseImages([])
      }
    } catch (error) {
      console.error('Error fetching exercise images:', error)
      setExerciseImages([])
    }
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
    setFormData({ title: '', description: '', order: exercises.length + 1, active: true, exercise_group_id: selectedGroupId, sets: 1, reps: null, weight_unit: 'kropp' })
    setExerciseImages([])
    setEditingId(null)
    setShowAddForm(false)
    setSelectedImageService('midjourney')
  }

  async function handleImageUpload(event) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // Check total images won't exceed 5
    if (exerciseImages.length + files.length > 5) {
      alert('Maksimum 5 bilder per øvelse. Du har allerede ' + exerciseImages.length + ' bilder.')
      return
    }

    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert('Kun bildefiler er tillatt')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Bildet er for stort. Maks størrelse er 5MB')
        return
      }
    }

    setUploadingImages(true)

    try {
      const uploadedUrls = []

      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(7)
        const fileName = `exercise-${timestamp}-${randomId}.${fileExt}`
        const filePath = fileName

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exercise-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(`Kunne ikke laste opp bilde: ${uploadError.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('exercise-images')
          .getPublicUrl(filePath)

        if (!publicUrl) {
          throw new Error('Kunne ikke hente URL for opplastet bilde')
        }

        uploadedUrls.push(publicUrl)
      }

      // Add to state
      setExerciseImages([...exerciseImages, ...uploadedUrls])
      
      // Reset file input
      event.target.value = ''
    } catch (error) {
      console.error('Upload error:', error)
      alert('Feil ved opplasting av bilder: ' + (error.message || 'Ukjent feil'))
    } finally {
      setUploadingImages(false)
    }
  }

  function handleRemoveImage(index) {
    const newImages = exerciseImages.filter((_, i) => i !== index)
    setExerciseImages(newImages)
  }

  function generateImageSearchURL(exerciseTitle, exerciseDescription, service) {
    // Definer prompt-maler for hver tjeneste
    const servicePrompts = {
      midjourney: "Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Midjourney AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
      dalle: "Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. DALL-E AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
      stableDiffusion: "Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Stable Diffusion AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
      leonardo: "Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. Leonardo.ai AI-generert bilde. Stilistisk tegning. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder.",
      generic: "Tegnet illustrasjon av en person som utfører øvelsen [TITTEL]. [BESKRIVELSE]. Fokus på riktig form og teknikk. AI-generert tegning. Stilistisk illustrasjon. Hvit bakgrunn. Ingen vannmerker. Søk i Google Bilder."
    }
    
    // Velg riktig prompt-mal basert på tjeneste
    const promptTemplate = servicePrompts[service] || servicePrompts.generic
    
    // Erstatt plassholdere med faktiske verdier
    const fullPrompt = promptTemplate
      .replace('[TITTEL]', exerciseTitle || '')
      .replace('[BESKRIVELSE]', exerciseDescription || '')
    
    // URL-kode den fullstendige strengen
    const encodedPrompt = encodeURIComponent(fullPrompt)
    
    // Generer URL
    const baseURL = "https://www.google.com/search?tbm=isch&q="
    const finalURL = baseURL + encodedPrompt
    
    return finalURL
  }

  function handleGenerateImageSearch() {
    if (!formData.title || !formData.description) {
      alert('Du må fylle ut både tittel og beskrivelse for å generere bildesøk')
      return
    }
    
    const url = generateImageSearchURL(formData.title, formData.description, selectedImageService)
    window.open(url, '_blank')
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
            setExerciseImages([])
            setEditingId(null)
            setSelectedImageService('midjourney')
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
            <label>Antall sets:</label>
            <input
              type="number"
              value={formData.sets || 1}
              onChange={(e) => setFormData({ ...formData, sets: parseInt(e.target.value) || 1 })}
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Antall repetisjoner per set:</label>
            <input
              type="number"
              value={formData.reps || ''}
              onChange={(e) => setFormData({ ...formData, reps: e.target.value ? parseInt(e.target.value) : null })}
              min="1"
              placeholder="F.eks. 10"
            />
          </div>
          <div className="form-group">
            <label>Vektenhet:</label>
            <select
              value={formData.weight_unit || 'kropp'}
              onChange={(e) => setFormData({ ...formData, weight_unit: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            >
              <option value="kropp">Kropp</option>
              <option value="kg">Kilogram (kg)</option>
            </select>
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
          <div className="form-group">
            <label>Bilder (maks 5):</label>
            <div style={{ marginTop: '10px' }}>
              {exerciseImages.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {exerciseImages.map((imgUrl, index) => (
                    <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={imgUrl}
                        alt={`Bilde ${index + 1}`}
                        style={{
                          width: '100px',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #ddd'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          lineHeight: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {exerciseImages.length < 5 && (
                <label
                  style={{
                    display: 'inline-block',
                    padding: '10px 20px',
                    background: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: uploadingImages ? 'wait' : 'pointer',
                    opacity: uploadingImages ? 0.6 : 1
                  }}
                >
                  {uploadingImages ? 'Laster opp...' : `+ Last opp bilde (${exerciseImages.length}/5)`}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImages}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
              {exerciseImages.length >= 5 && (
                <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px' }}>
                  Maksimum 5 bilder nådd
                </p>
              )}
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '20px', marginBottom: '10px' }}>
            <label>Velg AI-bildetjeneste:</label>
            <select
              value={selectedImageService}
              onChange={(e) => setSelectedImageService(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                marginBottom: '10px'
              }}
            >
              <option value="midjourney">Midjourney</option>
              <option value="dalle">DALL-E</option>
              <option value="stableDiffusion">Stable Diffusion</option>
              <option value="leonardo">Leonardo.ai</option>
              <option value="generic">Generisk AI-tegning</option>
            </select>
            <button
              type="button"
              onClick={handleGenerateImageSearch}
              disabled={!formData.title || !formData.description}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: !formData.title || !formData.description ? '#ccc' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: !formData.title || !formData.description ? 'not-allowed' : 'pointer',
                opacity: !formData.title || !formData.description ? 0.6 : 1,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (formData.title && formData.description) {
                  e.target.style.background = '#2980b9'
                }
              }}
              onMouseLeave={(e) => {
                if (formData.title && formData.description) {
                  e.target.style.background = '#3498db'
                }
              }}
            >
              Generer illustrasjon for øvelsen
            </button>
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
