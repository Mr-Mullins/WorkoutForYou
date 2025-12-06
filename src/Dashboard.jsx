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
      // Optimalisert: Hent alle grupper med øvelser i ett enkelt kall ved hjelp av JOIN
      const { data: groups, error: groupsError } = await supabase
        .from('exercise_groups')
        .select(`
          *,
          exercises:exercises!exercise_group_id(
            *,
            active
          )
        `)
        .eq('active', true)
        .order('order', { ascending: true })

      if (groupsError) throw groupsError

      if (groups && groups.length > 0) {
        // Filtrer og sorter øvelser for hver gruppe
        const groupsWithExercises = groups.map(group => ({
          ...group,
          exercises: (group.exercises || [])
            .filter(ex => ex.active)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        }))

        setExerciseGroups(groupsWithExercises)
        if (selectedGroupId === null && groupsWithExercises.length > 0) {
          setSelectedGroupId(groupsWithExercises[0].id)
        }
      } else {
        // Fallback: Hent alle aktive øvelser hvis ingen grupper finnes
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
                          data-tooltip={isDone ? "Øvelsen er allerede utført i dag" : "Klikk for å markere øvelsen som utført"}
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
