import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Dashboard.css'

export default function Dashboard({ session, isAdmin = false, onShowAdmin, userProfile }) {
  const [completed, setCompleted] = useState([])
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroupId, setSelectedGroupId] = useState(null)

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

  async function fetchExerciseGroups() {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('exercise_groups')
        .select('*')
        .eq('active', true)
        .order('order', { ascending: true })

      if (groupsError) throw groupsError

      if (groups && groups.length > 0) {
        const groupsWithExercises = await Promise.all(
          groups.map(async (group) => {
            const { data: exercises, error: exercisesError } = await supabase
              .from('exercises')
              .select('*')
              .eq('exercise_group_id', group.id)
              .eq('active', true)
              .order('order', { ascending: true })

            if (exercisesError) {
              console.error(`Feil ved henting av øvelser for gruppe ${group.id}:`, exercisesError)
              return { ...group, exercises: [] }
            }

            return { ...group, exercises: exercises || [] }
          })
        )

        setExerciseGroups(groupsWithExercises)
        if (selectedGroupId === null && groupsWithExercises.length > 0) {
          setSelectedGroupId(groupsWithExercises[0].id)
        }
      } else {
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('active', true)
          .order('order', { ascending: true })

        if (error) throw error

        if (exercises && exercises.length > 0) {
          const fallbackGroup = {
            id: 0,
            name: 'Alle øvelser',
            description: '',
            exercises: exercises
          }
          setExerciseGroups([fallbackGroup])
          if (selectedGroupId === null) {
            setSelectedGroupId(0)
          }
        }
      }
    } catch (error) {
      console.error('Feil ved henting av exercise groups:', error.message)
      const fallbackGroup = {
        id: 0,
        name: 'Rygg',
        description: '',
        exercises: [
          { id: 1, title: "1. Liggende Bekkenvipp", description: "10-15 repetisjoner. Stram magen, press ryggen ned.", order: 1 },
          { id: 2, title: "2. Barnets stilling", description: "Hold 30-60 sek. Pass på kneprotesen.", order: 2 },
          { id: 3, title: "3. Tøy hofteleddsbøyer", description: "30 sek per side. Ikke svai i ryggen.", order: 3 },
          { id: 4, title: "4. Fuglehunden", description: "3 x 10 reps. Løft lavt og kontrollert.", order: 4 },
          { id: 5, title: "5. Seteløft", description: "3 x 10 reps. Stopp når kroppen er rett.", order: 5 }
        ]
      }
      setExerciseGroups([fallbackGroup])
      if (selectedGroupId === null) {
        setSelectedGroupId(0)
      }
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

  async function toggleExercise(exerciseId) {
    const isDone = completed.includes(exerciseId)

    if (isDone) {
      alert("Allerede registrert i dag! Bra jobba.")
      return
    }

    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('workouts')
        .insert([
          { 
            user_id: user.id, 
            exercise_id: exerciseId,
            completed_at: today
          }
        ])

      if (error) throw error

      setCompleted([...completed, exerciseId])

    } catch (error) {
      alert('Klarte ikke lagre: ' + error.message)
    }
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
                return (
                  <div key={ex.id} className={`exercise-card ${isDone ? 'completed' : ''}`}>
                    <div className="exercise-card-content">
                      <div className="exercise-card-main">
                        <div className="exercise-card-header">
                          <h3 className="exercise-title">{ex.title}</h3>
                          {isDone && <span className="exercise-checkmark">✓</span>}
                        </div>
                        <p className="exercise-description">{ex.description || ex.desc}</p>
                      </div>
                      <div className="exercise-card-action">
                        <button 
                          className={`exercise-button ${isDone ? 'completed' : ''}`}
                          onClick={() => toggleExercise(ex.id)}
                          disabled={isDone}
                        >
                          {isDone ? 'Utført!' : 'Marker som utført'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="no-exercises">Ingen øvelser i denne gruppen</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
