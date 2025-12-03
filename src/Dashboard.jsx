import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Dashboard({ session, isAdmin = false, onShowAdmin, userProfile }) {
  const [completed, setCompleted] = useState([])
  const [exerciseGroups, setExerciseGroups] = useState([])
  const [loading, setLoading] = useState(true)

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
      // Hent alle aktive exercise groups
      const { data: groups, error: groupsError } = await supabase
        .from('exercise_groups')
        .select('*')
        .eq('active', true)
        .order('order', { ascending: true })

      if (groupsError) throw groupsError

      if (groups && groups.length > 0) {
        // Hent øvelser for hver gruppe
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
      } else {
        // Fallback: Hent alle øvelser uten gruppe (for bakoverkompatibilitet)
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('active', true)
          .order('order', { ascending: true })

        if (error) throw error

        if (exercises && exercises.length > 0) {
          setExerciseGroups([{
            id: 0,
            name: 'Alle øvelser',
            description: '',
            exercises: exercises
          }])
        }
      }
    } catch (error) {
      console.error('Feil ved henting av exercise groups:', error.message)
      // Fallback til hardkodede øvelser
      setExerciseGroups([{
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
      }])
    }
  }

  async function fetchTodaysWorkouts() {
    try {
      const user = session.user
      const today = new Date().toISOString().split('T')[0] // Får dagens dato som YYYY-MM-DD

      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_id')
        .eq('user_id', user.id)
        .eq('completed_at', today)

      if (error) throw error
      
      // Lagrer bare ID-ene til øvelsene som er gjort i dag
      if (data) {
        setCompleted(data.map(row => row.exercise_id))
      }
    } catch (error) {
      console.error('Feil ved henting av øvelser:', error.message)
    }
  }

  async function toggleExercise(exerciseId) {
    // Sjekk om den allerede er gjort
    const isDone = completed.includes(exerciseId)

    if (isDone) {
      // Vi fjerner den ikke fra databasen i denne enkle versjonen (valgfritt), 
      // men vi kan oppdatere visningen lokalt om du vil. 
      // For nå, la oss bare si at gjort er gjort!
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

      // Oppdater listen lokalt så knappen blir grønn med en gang
      setCompleted([...completed, exerciseId])

    } catch (error) {
      alert('Klarte ikke lagre: ' + error.message)
    }
  }


  if (loading) return <div style={{padding: '20px', textAlign: 'center'}}>Laster dine data...</div>

  return (
    <div className="container">
      <header style={{textAlign: 'center', marginBottom: '30px', marginTop: '20px'}}>
        <h1 style={{fontSize: '1.2rem', fontWeight: 'normal', margin: '0 0 8px 0'}}>
          Hei, {userProfile?.first_name || session.user.email?.split('@')[0]}. Lykke til med økten! 😊
        </h1>
        <p className="subtitle" style={{fontSize: '0.9rem', margin: '0'}}>Dagens økt</p>
      </header>

      {(() => {
        const totalExercises = exerciseGroups.reduce((sum, group) => sum + (group.exercises?.length || 0), 0)
        const totalCompleted = completed.length
        return (
          <>
            <div style={styles.progressContainer}>
              <div style={{...styles.progressBar, width: `${totalExercises > 0 ? (totalCompleted / totalExercises) * 100 : 0}%`}}></div>
            </div>
            <p style={{textAlign: 'center', fontSize: '0.9rem', marginBottom: '20px'}}>
              {totalCompleted} av {totalExercises} fullført
            </p>
          </>
        )
      })()}

      {exerciseGroups.map(group => (
        <div key={group.id} style={styles.groupContainer}>
          <div style={styles.groupHeader}>
            <h2 style={styles.groupTitle}>{group.name}</h2>
            {group.description && (
              <p style={styles.groupDescription}>{group.description}</p>
            )}
          </div>
          
          {group.exercises && group.exercises.length > 0 ? (
            group.exercises.map(ex => {
              const isDone = completed.includes(ex.id)
              return (
                <div key={ex.id} style={{...styles.card, ...(isDone ? styles.cardDone : {})}}>
                  <div style={styles.cardHeader}>
                    <span style={styles.exerciseTitle}>{ex.title}</span>
                    {isDone && <span style={{color: '#27ae60', fontWeight: 'bold'}}>✓</span>}
                  </div>
                  <div style={styles.details}>{ex.description || ex.desc}</div>
                  <button 
                    onClick={() => toggleExercise(ex.id)}
                    style={{...styles.actionBtn, ...(isDone ? styles.btnActive : {})}}
                    disabled={isDone}
                  >
                    {isDone ? 'Utført!' : 'Marker som utført'}
                  </button>
                </div>
              )
            })
          ) : (
            <p style={{textAlign: 'center', color: '#999', padding: '20px'}}>Ingen øvelser i denne gruppen</p>
          )}
        </div>
      ))}
    </div>
  )
}

// Enkel CSS styling inne i filen for å slippe ekstra filer
const styles = {
  logoutBtn: {
    background: 'transparent', border: '1px solid #7f8c8d', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontSize: '0.8rem'
  },
  progressContainer: {
    background: '#e0e0e0', borderRadius: '20px', height: '20px', overflow: 'hidden', marginBottom: '10px'
  },
  progressBar: {
    background: '#27ae60', height: '100%', transition: 'width 0.3s ease'
  },
  card: {
    background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '15px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid transparent'
  },
  cardDone: {
    background: '#f0fff4', border: '1px solid #27ae60'
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'
  },
  exerciseTitle: {
    fontWeight: 'bold', fontSize: '1.1rem'
  },
  details: {
    fontSize: '0.95rem', color: '#555', marginBottom: '15px'
  },
  actionBtn: {
    width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
    background: '#ecf0f1', color: '#2c3e50', fontWeight: 'bold', cursor: 'pointer'
  },
  btnActive: {
    background: '#27ae60', color: 'white'
  },
  groupContainer: {
    marginBottom: '40px'
  },
  groupHeader: {
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e0e0e0'
  },
  groupTitle: {
    margin: '0 0 8px 0',
    fontSize: '1.3rem',
    color: '#2c3e50',
    fontWeight: 'bold'
  },
  groupDescription: {
    margin: '0',
    fontSize: '0.9rem',
    color: '#666',
    fontStyle: 'italic'
  }
}