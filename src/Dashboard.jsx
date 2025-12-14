import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Dashboard.css'

export default function Dashboard({ session, isAdmin = false, onShowAdmin, userProfile }) {
  const [completed, setCompleted] = useState([])
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [workoutModal, setWorkoutModal] = useState(null) // { exercise: {...}, lastWorkoutWeights: [...] }
  const [workoutWeights, setWorkoutWeights] = useState({}) // { setNumber: weight }
  const [exerciseLastWeights, setExerciseLastWeights] = useState({}) // { exerciseId: [workout_sets] }
  const [exerciseTodayWeights, setExerciseTodayWeights] = useState({}) // { exerciseId: [workout_sets] }

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchExerciseGroups(), fetchTodaysWorkouts()])
      } catch (error) {
        console.error('Feil ved lasting av data:', error.message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedImage) {
        setSelectedImage(null)
      }
    }

    if (selectedImage) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [selectedImage])

  // Hent vektdata når exerciseGroups er lastet
  useEffect(() => {
    if (exerciseGroups.length > 0 && !loading && session?.user) {
      fetchAllLastWeights()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseGroups.length, loading])

  async function fetchExerciseGroups() {
    try {
      // Optimalisert: Hent alle grupper med øvelser og bilder i ett enkelt kall ved hjelp av JOIN
      const { data: groups, error: groupsError } = await supabase
        .from('exercise_groups')
        .select(`
          *,
          exercises:exercises!exercise_group_id(
            *,
            active,
            exercise_images(
              image_url,
              order
            )
          )
        `)
        .eq('active', true)
        .order('order', { ascending: true })

      if (groupsError) throw groupsError

      if (groups && groups.length > 0) {
        // Filtrer og sorter øvelser for hver gruppe, og sorter bilder
        const groupsWithExercises = groups.map(group => ({
          ...group,
          exercises: (group.exercises || [])
            .filter(ex => ex.active)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(ex => ({
              ...ex,
              exercise_images: (ex.exercise_images || []).sort((a, b) => (a.order || 0) - (b.order || 0))
            }))
        }))

        setExerciseGroups(groupsWithExercises)
        if (selectedGroupId === null && groupsWithExercises.length > 0) {
          setSelectedGroupId(groupsWithExercises[0].id)
        }
      } else {
        // Fallback: Hent alle aktive øvelser hvis ingen grupper finnes
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select(`
            *,
            exercise_images(
              image_url,
              order
            )
          `)
          .eq('active', true)
          .order('order', { ascending: true })

        if (error) throw error

        if (exercises && exercises.length > 0) {
          const fallbackGroup = {
            id: 0,
            name: 'Alle øvelser',
            description: '',
            exercises: exercises.map(ex => ({
              ...ex,
              exercise_images: (ex.exercise_images || []).sort((a, b) => (a.order || 0) - (b.order || 0))
            }))
          }
          setExerciseGroups([fallbackGroup])
          if (selectedGroupId === null) {
            setSelectedGroupId(0)
          }
        }
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
      // Fallback til tom liste hvis tabellen ikke finnes ennå
      setExerciseGroups([])
    }
  }

  async function fetchTodaysWorkouts() {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('workouts')
        .select('id, exercise_id')
        .eq('user_id', user.id)
        .eq('completed_at', today)

      if (error) throw error
      
      if (data) {
        setCompleted(data.map(row => row.exercise_id))
        
        // Hent vektdata for dagens workouts
        if (data.length > 0) {
          const workoutIds = data.map(w => w.id)
          const { data: todaySets, error: setsError } = await supabase
            .from('workout_sets')
            .select('set_number, weight, workout_id')
            .in('workout_id', workoutIds)
            .order('set_number', { ascending: true })

          if (!setsError && todaySets) {
            // Organiser sets per exercise_id
            const weightsByExercise = {}
            data.forEach(workout => {
              const setsForWorkout = todaySets.filter(s => s.workout_id === workout.id)
              if (setsForWorkout.length > 0) {
                weightsByExercise[workout.exercise_id] = setsForWorkout.map(s => ({
                  set_number: s.set_number,
                  weight: s.weight
                }))
              }
            })
            setExerciseTodayWeights(weightsByExercise)
          }
        }
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
    }
  }

  async function toggleExercise(exercise) {
    const isDone = completed.includes(exercise.id)
    
    if (isDone) {
      alert("Allerede registrert i dag! Bra jobba.")
      return
    }

    // Hent vekt fra forrige gang hvis øvelsen bruker kg
    let lastWorkoutWeights = []
    if (exercise.weight_unit === 'kg') {
      lastWorkoutWeights = await fetchLastWorkoutWeights(exercise.id)
    }

    // Åpne modal
    setWorkoutModal({ exercise, lastWorkoutWeights })
    
    // Initialiser vekt-array med tomme verdier eller verdier fra forrige gang
    const initialWeights = {}
    const numSets = exercise.sets || 1
    for (let i = 1; i <= numSets; i++) {
      initialWeights[i] = lastWorkoutWeights[i - 1]?.weight || ''
    }
    setWorkoutWeights(initialWeights)
  }

  async function fetchLastWorkoutWeights(exerciseId) {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]
      
      // Hent siste workout for denne øvelsen (ikke i dag)
      const { data: lastWorkout, error: workoutError } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .neq('completed_at', today)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (workoutError || !lastWorkout) {
        return []
      }

      // Hent workout_sets for denne workout
      const { data: sets, error: setsError } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', lastWorkout.id)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching workout sets:', setsError)
        return []
      }

      return sets || []
    } catch (error) {
      console.error('Error fetching last workout weights:', error)
      return []
    }
  }

  async function fetchAllLastWeights() {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]
      
      // Hent alle kg-øvelser fra exerciseGroups state
      const kgExercises = []
      exerciseGroups.forEach(group => {
        if (group.exercises) {
          group.exercises.forEach(ex => {
            if (ex.weight_unit === 'kg' && ex.active) {
              kgExercises.push(ex.id)
            }
          })
        }
      })

      if (kgExercises.length === 0) {
        return
      }

      // Hent siste workout for hver kg-øvelse (ikke i dag)
      // Vi bruker en subquery for å få den siste workout per exercise
      const { data: lastWorkouts, error: workoutError } = await supabase
        .from('workouts')
        .select('id, exercise_id, completed_at')
        .eq('user_id', user.id)
        .in('exercise_id', kgExercises)
        .neq('completed_at', today)
        .order('completed_at', { ascending: false })

      if (workoutError || !lastWorkouts || lastWorkouts.length === 0) {
        return
      }

      // Grupper workouts per exercise_id (ta bare den siste for hver øvelse)
      const latestWorkoutPerExercise = {}
      lastWorkouts.forEach(workout => {
        if (!latestWorkoutPerExercise[workout.exercise_id]) {
          latestWorkoutPerExercise[workout.exercise_id] = workout.id
        }
      })

      // Hent alle workout_sets for disse workouts
      const workoutIds = Object.values(latestWorkoutPerExercise)
      if (workoutIds.length === 0) {
        return
      }

      const { data: allSets, error: setsError } = await supabase
        .from('workout_sets')
        .select('set_number, weight, workout_id')
        .in('workout_id', workoutIds)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching workout sets:', setsError)
        return
      }

      // Organiser sets per exercise_id
      const weightsByExercise = {}
      if (allSets) {
        // Må mappe workout_id tilbake til exercise_id
        const workoutToExercise = {}
        Object.entries(latestWorkoutPerExercise).forEach(([exerciseId, workoutId]) => {
          workoutToExercise[workoutId] = parseInt(exerciseId)
        })

        allSets.forEach(set => {
          const exerciseId = workoutToExercise[set.workout_id]
          if (exerciseId) {
            if (!weightsByExercise[exerciseId]) {
              weightsByExercise[exerciseId] = []
            }
            weightsByExercise[exerciseId].push({
              set_number: set.set_number,
              weight: set.weight
            })
          }
        })
      }

      setExerciseLastWeights(weightsByExercise)
    } catch (error) {
      console.error('Error fetching all last weights:', error)
    }
  }

  async function saveWorkoutWithSets(exerciseId, setsData) {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]

      // Opprett workout
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert([
          { 
            user_id: user.id, 
            exercise_id: exerciseId,
            completed_at: today
          }
        ])
        .select()
        .single()

      if (workoutError) throw workoutError

      // Hvis øvelsen bruker kg og det er vektdata, lagre workout_sets
      if (setsData && Object.keys(setsData).length > 0) {
        const setsToInsert = Object.entries(setsData)
          .filter(([setNum, weight]) => weight !== '' && weight !== null)
          .map(([setNum, weight]) => ({
            workout_id: workout.id,
            set_number: parseInt(setNum),
            weight: parseFloat(weight)
          }))

        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert)

          if (setsError) throw setsError
        }
      }

      setCompleted([...completed, exerciseId])
      setWorkoutModal(null)
      setWorkoutWeights({})
      
      // Oppdater vektdata for denne øvelsen i state (dagens vekt)
      if (setsData && Object.keys(setsData).length > 0) {
        const newWeights = Object.entries(setsData)
          .filter(([setNum, weight]) => weight !== '' && weight !== null)
          .map(([setNum, weight]) => ({
            set_number: parseInt(setNum),
            weight: parseFloat(weight)
          }))
        
        // Oppdater dagens vekt
        setExerciseTodayWeights(prev => ({
          ...prev,
          [exerciseId]: newWeights
        }))
      }
    } catch (error) {
      alert('Klarte ikke lagre: ' + error.message)
    }
  }

  function handleCloseWorkoutModal() {
    setWorkoutModal(null)
    setWorkoutWeights({})
  }

  function handleCopyLastWeights() {
    if (!workoutModal?.lastWorkoutWeights || workoutModal.lastWorkoutWeights.length === 0) {
      return
    }

    const newWeights = {}
    workoutModal.lastWorkoutWeights.forEach((set, index) => {
      newWeights[index + 1] = set.weight || ''
    })
    setWorkoutWeights(newWeights)
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Laster dine data...</p>
      </div>
    )
  }

  const selectedGroup = exerciseGroups.find(g => g.id === selectedGroupId)
  const groupExercises = selectedGroup?.exercises || []

  // Tab colors
  const tabColors = [
    '#3498db', '#e74c3c', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085'
  ]

  return (
    <div className="dashboard-container">
      {selectedGroup && (
        <div className="dashboard-content">
          {/* Tabs */}
          {exerciseGroups.length > 1 && (
            <div className="tabs-container">
              {exerciseGroups.map((group, index) => {
                const groupExercises = group.exercises || []
                const completedInGroup = groupExercises.filter(ex => completed.includes(ex.id)).length
                const allCompleted = groupExercises.length > 0 && completedInGroup === groupExercises.length
                const tabColor = tabColors[index % tabColors.length]
                const isActive = selectedGroupId === group.id

                return (
                  <button
                    key={group.id}
                    className={`tab-button ${isActive ? 'active' : ''} ${allCompleted ? 'completed' : ''}`}
                    onClick={() => setSelectedGroupId(group.id)}
                    style={{
                      '--tab-color': tabColor,
                      ...(isActive ? {
                        borderTopColor: tabColor,
                        borderRightColor: tabColor,
                        borderLeftColor: tabColor,
                        borderBottomColor: tabColor,
                        color: tabColor
                      } : {
                        borderTopColor: `${tabColor}80`,
                        borderRightColor: `${tabColor}80`,
                        borderLeftColor: `${tabColor}80`,
                        borderBottomColor: 'transparent',
                        color: tabColor
                      }),
                      ...(allCompleted ? {
                        borderTopColor: '#27ae60',
                        borderRightColor: '#27ae60',
                        borderLeftColor: '#27ae60',
                        borderBottomColor: '#27ae60',
                        color: '#27ae60'
                      } : {})
                    }}
                  >
                    <span className="tab-name">
                      {group.name} <span className="tab-counter">{completedInGroup}/{groupExercises.length}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Exercises */}
          <div className="exercises-wrapper">
            {groupExercises.length > 0 ? (
              groupExercises.map(ex => {
                const isDone = completed.includes(ex.id)
                const images = ex.exercise_images && ex.exercise_images.length > 0 
                  ? ex.exercise_images.map(img => img.image_url)
                  : []
                const lastWeights = exerciseLastWeights[ex.id] || []
                return (
                  <div key={ex.id} className={`exercise-card ${isDone ? 'completed' : ''}`}>
                    <div className="exercise-card-content">
                      {images.length > 0 && (
                        <div className="exercise-images-container">
                          {images.map((imageUrl, index) => (
                            <div 
                              key={index}
                              className="exercise-image-thumbnail"
                              onClick={() => setSelectedImage(imageUrl)}
                            >
                              <img 
                                src={imageUrl} 
                                alt={`${ex.title} - Bilde ${index + 1}`}
                                className="exercise-thumbnail-img"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="exercise-card-main">
                        <div className="exercise-card-header">
                          <h3 className="exercise-title">{ex.title}</h3>
                          <button 
                            className={`exercise-button ${isDone ? 'completed' : ''}`}
                            onClick={() => toggleExercise(ex)}
                            disabled={isDone}
                            data-tooltip={isDone ? "Øvelsen er allerede utført i dag" : "Klikk for å markere øvelsen som utført"}
                          >
                            {isDone && <span className="exercise-checkmark-icon">✓</span>}
                            {isDone ? 'Utført!' : 'Marker som utført'}
                          </button>
                        </div>
                        <p className="exercise-description">{ex.description || ex.desc}</p>
                        {ex.weight_unit === 'kg' && weightsToShow.length > 0 && (
                          <div className="exercise-last-weights">
                            <span className="last-weights-label">{weightsLabel}</span>
                            <span className="last-weights-values">
                              {weightsToShow.map((set, index) => (
                                <span key={index} className="last-weight-item">
                                  Set {set.set_number}: {set.weight} kg
                                  {index < weightsToShow.length - 1 && ', '}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="no-exercises">Ingen øvelser i denne gruppen</p>
            )}
          </div>

          {/* Image Modal/Lightbox */}
          {selectedImage && (
            <div 
              className="image-modal-overlay"
              onClick={() => setSelectedImage(null)}
            >
              <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="image-modal-close"
                  onClick={() => setSelectedImage(null)}
                  aria-label="Lukk bilde"
                >
                  ×
                </button>
                <img 
                  src={selectedImage} 
                  alt="Stort bilde"
                  className="image-modal-img"
                />
              </div>
            </div>
          )}

          {/* Workout Modal */}
          {workoutModal && (
            <div 
              className="workout-modal-overlay"
              onClick={handleCloseWorkoutModal}
            >
              <div className="workout-modal-content" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="workout-modal-close"
                  onClick={handleCloseWorkoutModal}
                  aria-label="Lukk"
                >
                  ×
                </button>
                <h2>Registrer {workoutModal.exercise.title}</h2>
                
                {workoutModal.exercise.weight_unit === 'kg' && (
                  <>
                    <div className="workout-modal-section">
                      <h3>Vekt per set</h3>
                      {Array.from({ length: workoutModal.exercise.sets || 1 }, (_, i) => i + 1).map(setNum => (
                        <div key={setNum} className="workout-weight-input-group">
                          <label>Set {setNum} (kg):</label>
                          <input
                            type="number"
                            step="0.5"
                            value={workoutWeights[setNum] || ''}
                            onChange={(e) => setWorkoutWeights({ ...workoutWeights, [setNum]: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>

                    {workoutModal.lastWorkoutWeights && workoutModal.lastWorkoutWeights.length > 0 && (
                      <div className="workout-modal-section">
                        <h3>Forrige gang</h3>
                        <div className="last-workout-weights">
                          {workoutModal.lastWorkoutWeights.map((set, index) => (
                            <div key={index} className="last-weight-item">
                              Set {set.set_number}: {set.weight} kg
                            </div>
                          ))}
                        </div>
                        <button 
                          className="copy-weights-btn"
                          onClick={handleCopyLastWeights}
                        >
                          Bruk vekt fra forrige gang
                        </button>
                      </div>
                    )}
                  </>
                )}

                {workoutModal.exercise.weight_unit === 'kropp' && (
                  <p className="workout-modal-info">Ingen vektregistrering for denne øvelsen.</p>
                )}

                <div className="workout-modal-actions">
                  <button 
                    className="workout-save-btn"
                    onClick={() => saveWorkoutWithSets(workoutModal.exercise.id, workoutWeights)}
                  >
                    Lagre
                  </button>
                  <button 
                    className="workout-cancel-btn"
                    onClick={handleCloseWorkoutModal}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}