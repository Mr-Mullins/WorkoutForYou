import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Dashboard({ session }) {
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)

  // Listen over øvelsene dine
  const exercises = [
    { id: 1, title: "1. Liggende Bekkenvipp", desc: "10-15 repetisjoner. Stram magen, press ryggen ned." },
    { id: 2, title: "2. Barnets stilling", desc: "Hold 30-60 sek. Pass på kneprotesen." },
    { id: 3, title: "3. Tøy hofteleddsbøyer", desc: "30 sek per side. Ikke svai i ryggen." },
    { id: 4, title: "4. Fuglehunden", desc: "3 x 10 reps. Løft lavt og kontrollert." },
    { id: 5, title: "5. Seteløft", desc: "3 x 10 reps. Stopp når kroppen er rett." }
  ]

  useEffect(() => {
    fetchTodaysWorkouts()
  }, [])

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
    } finally {
      setLoading(false)
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

      // HER var sannsynligvis feilen din sist (manglende komma i objektet under)
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <div style={{padding: '20px', textAlign: 'center'}}>Laster dine data...</div>

  return (
    <div className="container">
      <header style={{textAlign: 'center', marginBottom: '30px', marginTop: '20px'}}>
        <h1>Hei, {session.user.email?.split('@')[0]}!</h1>
        <p className="subtitle">Dagens økt</p>
        <button onClick={handleSignOut} style={styles.logoutBtn}>Logg ut</button>
      </header>

      <div style={styles.progressContainer}>
        <div style={{...styles.progressBar, width: `${(completed.length / 5) * 100}%`}}></div>
      </div>
      <p style={{textAlign: 'center', fontSize: '0.9rem', marginBottom: '20px'}}>
        {completed.length} av 5 fullført
      </p>

      {exercises.map(ex => {
        const isDone = completed.includes(ex.id)
        return (
          <div key={ex.id} style={{...styles.card, ...(isDone ? styles.cardDone : {})}}>
            <div style={styles.cardHeader}>
              <span style={styles.exerciseTitle}>{ex.title}</span>
              {isDone && <span style={{color: '#27ae60', fontWeight: 'bold'}}>✓</span>}
            </div>
            <div style={styles.details}>{ex.desc}</div>
            <button 
              onClick={() => toggleExercise(ex.id)}
              style={{...styles.actionBtn, ...(isDone ? styles.btnActive : {})}}
              disabled={isDone}
            >
              {isDone ? 'Utført!' : 'Marker som utført'}
            </button>
          </div>
        )
      })}
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
  }
}