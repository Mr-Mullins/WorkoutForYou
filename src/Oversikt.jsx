import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Oversikt.css'

export default function Oversikt({ session, userProfile }) {
  const [stats, setStats] = useState({
    week: 0,
    month: 0,
    year: 0
  })
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user) {
      fetchStats()
      fetchWeeklyActivity()
    }
  }, [session])

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'God morgen'
    if (hour < 18) return 'God dag'
    return 'God kveld'
  }

  function getFirstName() {
    if (userProfile?.full_name) {
      return userProfile.full_name.split(' ')[0]
    }
    if (session?.user?.user_metadata?.full_name) {
      return session.user.user_metadata.full_name.split(' ')[0]
    }
    return ''
  }

  function getStartOfWeek() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString().split('T')[0]
  }

  function getStartOfMonth() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  }

  function getStartOfYear() {
    const now = new Date()
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  }

  async function fetchStats() {
    try {
      const userId = session.user.id
      const weekStart = getStartOfWeek()
      const monthStart = getStartOfMonth()
      const yearStart = getStartOfYear()

      const [weekResult, monthResult, yearResult] = await Promise.all([
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('completed_at', weekStart),
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('completed_at', monthStart),
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('completed_at', yearStart)
      ])

      setStats({
        week: weekResult.count || 0,
        month: monthResult.count || 0,
        year: yearResult.count || 0
      })
    } catch (error) {
      console.error('Feil ved henting av statistikk:', error)
    }
  }

  async function fetchWeeklyActivity() {
    try {
      const userId = session.user.id
      const today = new Date()
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(today.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('workouts')
        .select('completed_at')
        .eq('user_id', userId)
        .gte('completed_at', sevenDaysAgo.toISOString().split('T')[0])

      if (error) throw error

      // Grupper per dag
      const activityByDay = {}
      const dayNames = ['Son', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lor']

      // Initialiser alle 7 dager
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const dayName = dayNames[date.getDay()]
        activityByDay[dateStr] = { day: dayName, count: 0, date: dateStr }
      }

      // Tell øvelser per dag
      if (data) {
        data.forEach(workout => {
          const dateStr = workout.completed_at
          if (activityByDay[dateStr]) {
            activityByDay[dateStr].count++
          }
        })
      }

      setWeeklyActivity(Object.values(activityByDay))
      setLoading(false)
    } catch (error) {
      console.error('Feil ved henting av ukentlig aktivitet:', error)
      setLoading(false)
    }
  }

  const maxActivity = Math.max(...weeklyActivity.map(d => d.count), 1)
  const firstName = getFirstName()

  if (loading) {
    return (
      <div className="oversikt-loading">
        <p>Laster oversikt...</p>
      </div>
    )
  }

  return (
    <div className="oversikt-container">
      <section className="greeting-section">
        <h1>{getGreeting()}{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="greeting-subtitle">Klar for dagens treningsøkt?</p>
      </section>

      <section className="app-info-section">
        <h2>Om TreningsAppen</h2>
        <p>
          Denne appen hjelper deg med å holde oversikt over treningsøvelsene dine.
          Logg øvelsene du gjennomfører, spor vektprogresjonen din, og se statistikk
          over aktiviteten din over tid.
        </p>
      </section>

      <section className="stats-section">
        <h2>Din aktivitet</h2>
        <div className="stats-cards">
          <div className="stat-card">
            <span className="stat-number">{stats.week}</span>
            <span className="stat-label">Denne uken</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.month}</span>
            <span className="stat-label">Denne måneden</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.year}</span>
            <span className="stat-label">Dette året</span>
          </div>
        </div>
      </section>

      <section className="activity-chart-section">
        <h2>Siste 7 dager</h2>
        <div className="bar-chart">
          {weeklyActivity.map((day, index) => (
            <div key={index} className="bar-column">
              <div className="bar-wrapper">
                <div
                  className="bar"
                  style={{ height: `${(day.count / maxActivity) * 100}%` }}
                >
                  {day.count > 0 && <span className="bar-value">{day.count}</span>}
                </div>
              </div>
              <span className="bar-label">{day.day}</span>
            </div>
          ))}
        </div>
        <p className="chart-description">Antall øvelser gjennomført per dag</p>
      </section>
    </div>
  )
}
