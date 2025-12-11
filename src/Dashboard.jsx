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
<<<<<<< HEAD
      const user = session.user;
      const today = new Date().toISOString().split("T")[0]; // Får dagens dato som YYYY-MM-DD
=======
      const user = session.user
      const today = new Date().toISOString().split('T')[0]
>>>>>>> origin/main

      const { data, error } = await supabase
        .from("workouts")
        .select("exercise_id")
        .eq("user_id", user.id)
        .eq("completed_at", today);

      if (error) throw error;

<<<<<<< HEAD
      // Lagrer bare ID-ene til øvelsene som er gjort i dag
=======
      if (error) throw error
      
>>>>>>> origin/main
      if (data) {
        setCompleted(data.map((row) => row.exercise_id));
      }
    } catch (error) {
<<<<<<< HEAD
      console.error("Feil ved henting av øvelser:", error.message);
    } finally {
      setLoading(false);
=======
      console.error('Feil ved henting av øvelser:', error.message)
>>>>>>> origin/main
    }
  }

  async function toggleExercise(exerciseId) {
<<<<<<< HEAD
    // Sjekk om den allerede er gjort
    const isDone = completed.includes(exerciseId);

    if (isDone) {
      // Vi fjerner den ikke fra databasen i denne enkle versjonen (valgfritt),
      // men vi kan oppdatere visningen lokalt om du vil.
      // For nå, la oss bare si at gjort er gjort!
      alert("Allerede registrert i dag! Bra jobba.");
      return;
=======
    const isDone = completed.includes(exerciseId)

    if (isDone) {
      alert("Allerede registrert i dag! Bra jobba.")
      return
>>>>>>> origin/main
    }

    try {
      const user = session.user;
      const today = new Date().toISOString().split("T")[0];

<<<<<<< HEAD
      // HER var sannsynligvis feilen din sist (manglende komma i objektet under)
      const { error } = await supabase.from("workouts").insert([
        {
          user_id: user.id,
          exercise_id: exerciseId,
          completed_at: today,
        },
      ]);
=======
      const { error } = await supabase
        .from('workouts')
        .insert([
          { 
            user_id: user.id, 
            exercise_id: exerciseId,
            completed_at: today
          }
        ])
>>>>>>> origin/main

      if (error) throw error;

<<<<<<< HEAD
      // Oppdater listen lokalt så knappen blir grønn med en gang
      setCompleted([...completed, exerciseId]);
=======
      setCompleted([...completed, exerciseId])

>>>>>>> origin/main
    } catch (error) {
      alert(`Klarte ikke lagre: ${error.message}`);
    }
  }

<<<<<<< HEAD
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading)
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Laster dine data...
      </div>
    );

  return (
    <div className="container">
      <header
        style={{ textAlign: "center", marginBottom: "30px", marginTop: "20px" }}
      >
        <h1>Hei, {session.user.email?.split("@")[0]}!</h1>
        <p className="subtitle">Dagens økt</p>
        <button onClick={handleSignOut} style={styles.logoutBtn}>
          Logg ut
        </button>
      </header>

      <div style={styles.progressContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${(completed.length / 5) * 100}%`,
          }}
        ></div>
      </div>
      <p
        style={{
          textAlign: "center",
          fontSize: "0.9rem",
          marginBottom: "20px",
        }}
      >
        {completed.length} av 5 fullført
      </p>

      {exercises.map((ex) => {
        const isDone = completed.includes(ex.id);
        return (
          <div
            key={ex.id}
            style={{ ...styles.card, ...(isDone ? styles.cardDone : {}) }}
          >
            <div style={styles.cardHeader}>
              <span style={styles.exerciseTitle}>{ex.title}</span>
              {isDone && (
                <span style={{ color: "#27ae60", fontWeight: "bold" }}>✓</span>
              )}
            </div>
            <div style={styles.details}>{ex.desc}</div>
            <button
              onClick={() => toggleExercise(ex.id)}
              style={{
                ...styles.actionBtn,
                ...(isDone ? styles.btnActive : {}),
              }}
              disabled={isDone}
            >
              {isDone ? "Utført!" : "Marker som utført"}
            </button>
          </div>
        );
      })}
=======
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
>>>>>>> origin/main
    </div>
  );
}
<<<<<<< HEAD

// Enkel CSS styling inne i filen for å slippe ekstra filer
const styles = {
  logoutBtn: {
    background: "transparent",
    border: "1px solid #7f8c8d",
    padding: "5px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "10px",
    fontSize: "0.8rem",
  },
  progressContainer: {
    background: "#e0e0e0",
    borderRadius: "20px",
    height: "20px",
    overflow: "hidden",
    marginBottom: "10px",
  },
  progressBar: {
    background: "#27ae60",
    height: "100%",
    transition: "width 0.3s ease",
  },
  card: {
    background: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "15px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    border: "1px solid transparent",
  },
  cardDone: {
    background: "#f0fff4",
    border: "1px solid #27ae60",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  exerciseTitle: {
    fontWeight: "bold",
    fontSize: "1.1rem",
  },
  details: {
    fontSize: "0.95rem",
    color: "#555",
    marginBottom: "15px",
  },
  actionBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    background: "#ecf0f1",
    color: "#2c3e50",
    fontWeight: "bold",
    cursor: "pointer",
  },
  btnActive: {
    background: "#27ae60",
    color: "white",
  },
};
=======
>>>>>>> origin/main
