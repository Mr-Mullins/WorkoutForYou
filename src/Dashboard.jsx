import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Dashboard.css'

// Hjelpefunksjon for å regenerere ferske public URLs fra Supabase Storage
function regenerateImageUrl(imageUrl) {
  if (!imageUrl) return null

  try {
    // Ekstraher filnavnet fra URLen
    // URL-format: https://[prosjekt].supabase.co/storage/v1/object/public/exercise-images/[filnavn]
    // eller med token: ...?token=xxx
    const urlWithoutParams = imageUrl.split('?')[0]
    const parts = urlWithoutParams.split('/exercise-images/')

    if (parts.length < 2) {
      // Hvis URLen ikke matcher forventet format, returner original
      return imageUrl
    }

    const fileName = parts[1]

    // Generer fersk public URL
    const { data } = supabase.storage
      .from('exercise-images')
      .getPublicUrl(fileName)

    return data?.publicUrl || imageUrl
  } catch (error) {
    console.error('Feil ved regenerering av bilde-URL:', error)
    return imageUrl
  }
}

export default function Dashboard({ session, isAdmin = false, onShowAdmin, userProfile }) {
  const [completed, setCompleted] = useState([])
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [workoutModal, setWorkoutModal] = useState(null) // { exercise: {...}, lastWorkoutData: [...] }
  const [workoutWeights, setWorkoutWeights] = useState({}) // { setNumber: weight }
  const [workoutReps, setWorkoutReps] = useState({}) // { setNumber: reps }
  const [exerciseLastData, setExerciseLastData] = useState({}) // { exerciseId: [{ set_number, weight, reps }] }

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

  // Hent vekt/reps-data når exerciseGroups er lastet
  useEffect(() => {
    if (exerciseGroups.length > 0 && !loading && session?.user) {
      fetchAllLastData()
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
              exercise_images: (ex.exercise_images || [])
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(img => ({
                  ...img,
                  image_url: regenerateImageUrl(img.image_url)
                }))
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
              exercise_images: (ex.exercise_images || [])
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(img => ({
                  ...img,
                  image_url: regenerateImageUrl(img.image_url)
                }))
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
        .select('exercise_id')
        .eq('user_id', user.id)
        .eq('completed_at', today)

      if (error) throw error
      
      if (data) {
        setCompleted(data.map(row => row.exercise_id))
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
    }
  }

  async function toggleExercise(exercise) {
    const isDone = completed.includes(exercise.id)

    // Hvis allerede utført, fjern registreringen
    if (isDone) {
      await removeWorkout(exercise.id)
      return
    }

    // Hent data fra forrige gang og åpne modal
    const lastWorkoutData = await fetchLastWorkoutWeights(exercise.id)
    setWorkoutModal({ exercise, lastWorkoutData })

    // Initialiser vekt og reps arrays
    const initialWeights = {}
    const initialReps = {}
    const numSets = exercise.sets || 1
    for (let i = 1; i <= numSets; i++) {
      const lastSet = lastWorkoutData[i - 1]
      initialWeights[i] = lastSet?.weight || ''
      initialReps[i] = lastSet?.reps || ''
    }
    setWorkoutWeights(initialWeights)
    setWorkoutReps(initialReps)
  }

  async function removeWorkout(exerciseId) {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]

      // Finn workout for denne øvelsen i dag
      const { data: workout, error: findError } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .eq('completed_at', today)
        .single()

      if (findError || !workout) {
        console.error('Fant ikke workout:', findError)
        return
      }

      // Slett workout_sets først (foreign key)
      await supabase
        .from('workout_sets')
        .delete()
        .eq('workout_id', workout.id)

      // Slett workout
      const { error: deleteError } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workout.id)

      if (deleteError) throw deleteError

      // Oppdater UI
      setCompleted(completed.filter(id => id !== exerciseId))
    } catch (error) {
      alert('Klarte ikke fjerne registrering: ' + error.message)
    }
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

      // Hent workout_sets for denne workout (inkludert reps)
      const { data: sets, error: setsError } = await supabase
        .from('workout_sets')
        .select('set_number, weight, reps')
        .eq('workout_id', lastWorkout.id)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching workout sets:', setsError)
        return []
      }

      return sets || []
    } catch (error) {
      console.error('Error fetching last workout data:', error)
      return []
    }
  }

  async function fetchAllLastData() {
    try {
      const user = session.user

      // Hent alle øvelser fra exerciseGroups state
      const allExerciseIds = []
      exerciseGroups.forEach(group => {
        if (group.exercises) {
          group.exercises.forEach(ex => {
            if (ex.active) {
              allExerciseIds.push(ex.id)
            }
          })
        }
      })

      if (allExerciseIds.length === 0) {
        return
      }

      // Hent siste workout for hver øvelse (inkludert i dag)
      const { data: lastWorkouts, error: workoutError } = await supabase
        .from('workouts')
        .select('id, exercise_id, completed_at')
        .eq('user_id', user.id)
        .in('exercise_id', allExerciseIds)
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
        .select('set_number, weight, reps, workout_id')
        .in('workout_id', workoutIds)
        .order('set_number', { ascending: true })

      if (setsError) {
        console.error('Error fetching workout sets:', setsError)
        return
      }

      // Organiser sets per exercise_id
      const dataByExercise = {}
      if (allSets) {
        // Må mappe workout_id tilbake til exercise_id
        const workoutToExercise = {}
        Object.entries(latestWorkoutPerExercise).forEach(([exerciseId, workoutId]) => {
          workoutToExercise[workoutId] = parseInt(exerciseId)
        })

        allSets.forEach(set => {
          const exerciseId = workoutToExercise[set.workout_id]
          if (exerciseId) {
            if (!dataByExercise[exerciseId]) {
              dataByExercise[exerciseId] = []
            }
            dataByExercise[exerciseId].push({
              set_number: set.set_number,
              weight: set.weight,
              reps: set.reps
            })
          }
        })
      }

      setExerciseLastData(dataByExercise)
    } catch (error) {
      console.error('Error fetching all last data:', error)
    }
  }

  async function saveWorkoutWithSets(exerciseId, weightsData, repsData) {
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

      // Samle alle setnumre som har enten vekt eller reps
      const allSetNums = new Set([
        ...Object.keys(weightsData || {}),
        ...Object.keys(repsData || {})
      ])

      const setsToInsert = []
      allSetNums.forEach(setNum => {
        const weight = weightsData?.[setNum]
        const reps = repsData?.[setNum]

        // Sjekk om vi har gyldig data å lagre
        const hasWeight = weight !== '' && weight !== null && weight !== undefined
        const hasReps = reps !== '' && reps !== null && reps !== undefined

        if (hasWeight || hasReps) {
          setsToInsert.push({
            workout_id: workout.id,
            set_number: parseInt(setNum),
            weight: hasWeight ? parseFloat(weight) : null,
            reps: hasReps ? parseInt(reps) : null
          })
        }
      })

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert)

        if (setsError) throw setsError
      }

      setCompleted([...completed, exerciseId])
      setWorkoutModal(null)
      setWorkoutWeights({})
      setWorkoutReps({})

      // Oppdater data for denne øvelsen i state
      if (setsToInsert.length > 0) {
        const newData = setsToInsert.map(set => ({
          set_number: set.set_number,
          weight: set.weight,
          reps: set.reps
        }))

        setExerciseLastData(prev => ({
          ...prev,
          [exerciseId]: newData
        }))
      }
    } catch (error) {
      alert('Klarte ikke lagre: ' + error.message)
    }
  }

  function handleCloseWorkoutModal() {
    setWorkoutModal(null)
    setWorkoutWeights({})
    setWorkoutReps({})
  }

  function handleCopyLastData() {
    if (!workoutModal?.lastWorkoutData || workoutModal.lastWorkoutData.length === 0) {
      return
    }

    const newWeights = {}
    const newReps = {}
    workoutModal.lastWorkoutData.forEach((set, index) => {
      newWeights[index + 1] = set.weight || ''
      newReps[index + 1] = set.reps || ''
    })
    setWorkoutWeights(newWeights)
    setWorkoutReps(newReps)
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

  return (
    <div className="dashboard-container">
      {selectedGroup && (
        <div className="dashboard-content">
          {/* Tabs */}
          {exerciseGroups.length > 1 && (
            <div className="tabs-container">
              {exerciseGroups.map((group) => {
                const groupExercises = group.exercises || []
                const completedInGroup = groupExercises.filter(ex => completed.includes(ex.id)).length
                const allCompleted = groupExercises.length > 0 && completedInGroup === groupExercises.length
                const isActive = selectedGroupId === group.id

                return (
                  <button
                    key={group.id}
                    className={`tab-button ${isActive ? 'active' : ''} ${allCompleted ? 'completed' : ''}`}
                    onClick={() => setSelectedGroupId(group.id)}
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
                const lastData = exerciseLastData[ex.id] || []
                const isKgExercise = ex.weight_unit === 'kg'
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
                            data-tooltip={isDone ? "Klikk for å angre" : "Klikk for å markere øvelsen som utført"}
                          >
                            {isDone && <span className="exercise-checkmark-icon">✓</span>}
                            {isDone ? 'Utført!' : 'Marker som utført'}
                          </button>
                        </div>
                        <p className="exercise-description">{ex.description || ex.desc}</p>
                        <div className="exercise-stats">
                          <div className="exercise-stat-box">
                            <span className="stat-label">Sets</span>
                            <span className="stat-value">{ex.sets || 1}</span>
                          </div>
                          <div className="exercise-stat-box">
                            <span className="stat-label">Reps</span>
                            <span className="stat-value">{ex.reps || '–'}</span>
                          </div>
                        </div>
                        {lastData.length > 0 && (
                          <div className="exercise-last-weights">
                            <span className="last-weights-label">Sist registrert:</span>
                            <span className="last-weights-values">
                              {lastData.map((set, index) => (
                                <span key={index} className="last-weight-item">
                                  {isKgExercise && set.weight && (
                                    <><span className="last-weight-number">{set.weight}</span> kg</>
                                  )}
                                  {isKgExercise && set.weight && set.reps && ' × '}
                                  {set.reps && (
                                    <><span className="last-weight-number">{set.reps}</span> reps</>
                                  )}
                                  {!isKgExercise && !set.reps && set.weight && (
                                    <><span className="last-weight-number">{set.weight}</span> kg</>
                                  )}
                                  {index < lastData.length - 1 && ' · '}
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

                <div className="workout-modal-section">
                  <h3>Registrer per set</h3>
                  {Array.from({ length: workoutModal.exercise.sets || 1 }, (_, i) => i + 1).map(setNum => (
                    <div key={setNum} className="workout-set-row">
                      <span className="workout-set-label">Set {setNum}:</span>
                      {workoutModal.exercise.weight_unit === 'kg' && (
                        <div className="workout-input-group">
                          <input
                            type="number"
                            step="0.5"
                            value={workoutWeights[setNum] || ''}
                            onChange={(e) => setWorkoutWeights({ ...workoutWeights, [setNum]: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                          />
                          <span className="workout-input-unit">kg</span>
                        </div>
                      )}
                      <div className="workout-input-group">
                        <input
                          type="number"
                          value={workoutReps[setNum] || ''}
                          onChange={(e) => setWorkoutReps({ ...workoutReps, [setNum]: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          placeholder="0"
                        />
                        <span className="workout-input-unit">reps</span>
                      </div>
                    </div>
                  ))}
                </div>

                {workoutModal.lastWorkoutData && workoutModal.lastWorkoutData.length > 0 && (
                  <div className="workout-modal-section">
                    <h3>Forrige gang</h3>
                    <div className="last-workout-weights">
                      {workoutModal.lastWorkoutData.map((set, index) => (
                        <div key={index} className="last-weight-item">
                          Set {set.set_number}:
                          {workoutModal.exercise.weight_unit === 'kg' && set.weight && ` ${set.weight} kg`}
                          {set.weight && set.reps && ' ×'}
                          {set.reps && ` ${set.reps} reps`}
                        </div>
                      ))}
                    </div>
                    <button
                      className="copy-weights-btn"
                      onClick={handleCopyLastData}
                    >
                      Bruk data fra forrige gang
                    </button>
                  </div>
                )}

                <div className="workout-modal-actions">
                  <button
                    className="workout-save-btn"
                    onClick={() => saveWorkoutWithSets(workoutModal.exercise.id, workoutWeights, workoutReps)}
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