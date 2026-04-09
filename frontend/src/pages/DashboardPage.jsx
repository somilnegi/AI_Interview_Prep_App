import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { interviewAPI } from '../services/api'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { SkillRadar } from '../components/ui/SkillRadar'
import { ThetaChart } from '../components/ui/ThetaChart'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, scoreColor, RUBRIC_DIMS } from '../utils/helpers'

function MetricCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-2xl p-6 ${accent ? 'bg-brand-500 text-white' : 'bg-white border border-surface-4'}`}>
      <div className={`text-[10px] font-bold tracking-widest uppercase mb-3 ${accent ? 'text-white/60' : 'text-ink-4'}`}>
        {label}
      </div>
      <div className={`font-display text-4xl font-black tracking-tight ${accent ? 'text-white' : 'text-ink'}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-xs mt-1.5 ${accent ? 'text-white/60' : 'text-ink-4'}`}>{sub}</div>
      )}
    </div>
  )
}

// ─── Compute all dashboard stats from live history array ──────────────────────
// This avoids relying on the stale user object in localStorage which is only
// set at login time and never refreshed after interviews complete.

function computeStats(history) {
  if (!history.length) return null

  const total      = history.length
  const avgPerf    = history.reduce((s, iv) => s + (iv.averageScore ?? 0), 0) / total
  const bestScore  = Math.max(...history.map(iv => iv.averageScore ?? 0))
  const bestTheta  = Math.max(...history.map(iv => iv.theta ?? 0))

  // Theta history across sessions (chronological — history is sorted desc, reverse it)
  const thetaHistory = [...history].reverse().map(iv => iv.theta ?? 0)

  // Skill averages — average each rubric dimension across all sessions
  const dimKeys = RUBRIC_DIMS.map(d => d.key)
  const skillAverages = {}
  for (const key of dimKeys) {
    const vals = history
      .map(iv => iv.skillGapMap?.averages?.[key])
      .filter(v => v != null)
    skillAverages[key] = vals.length
      ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2))
      : 0
  }

  const hasSkills = Object.values(skillAverages).some(v => v > 0)

  return { total, avgPerf, bestScore, bestTheta, thetaHistory, skillAverages, hasSkills }
}

export default function DashboardPage() {
  const { user }                    = useAuth()
  const [history, setHistory]       = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    interviewAPI.history()
      .then(r => setHistory(r.data.interviews || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => computeStats(history), [history])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-8 py-8 animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-black tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            Track your performance and ability growth across sessions
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Total interviews"
            value={stats?.total ?? 0}
            sub="completed sessions"
            accent
          />
          <MetricCard
            label="Avg. performance"
            value={stats ? stats.avgPerf.toFixed(1) : '—'}
            sub={stats?.total ? `across ${stats.total} session${stats.total > 1 ? 's' : ''}` : 'no sessions yet'}
          />
          <MetricCard
            label="Best theta (θ)"
            value={stats ? stats.bestTheta.toFixed(2) : '—'}
            sub="peak ability"
          />
          <MetricCard
            label="Best score"
            value={stats ? stats.bestScore.toFixed(1) : '—'}
            sub="single session high"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Skill radar */}
          <div className="bg-white border border-surface-4 rounded-2xl p-6">
            <h2 className="font-display text-base font-bold mb-1">Skill dimensions</h2>
            <p className="text-xs text-ink-4 mb-4">
              Rubric averages across {stats?.total ?? 0} session{stats?.total !== 1 ? 's' : ''}
            </p>
            {stats?.hasSkills ? (
              <SkillRadar averages={stats.skillAverages} height={240} />
            ) : (
              <div className="h-60 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl">📊</span>
                <span className="text-sm text-ink-4">Complete an interview to see your skill radar</span>
              </div>
            )}
          </div>

          {/* Theta chart */}
          <div className="bg-white border border-surface-4 rounded-2xl p-6">
            <h2 className="font-display text-base font-bold mb-1">Ability growth (θ)</h2>
            <p className="text-xs text-ink-4 mb-4">
              IRT ability estimate across completed sessions
            </p>
            {stats?.thetaHistory?.length > 1 ? (
              <ThetaChart history={stats.thetaHistory} height={240} />
            ) : (
              <div className="h-60 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl">📈</span>
                <span className="text-sm text-ink-4">
                  {stats?.total === 1
                    ? 'Complete one more interview to see your growth chart'
                    : 'Complete interviews to track your ability over time'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Skill bars — only shown when data exists */}
        {stats?.hasSkills && (
          <div className="bg-white border border-surface-4 rounded-2xl p-6 mb-8">
            <h2 className="font-display text-base font-bold mb-1">Skill breakdown</h2>
            <p className="text-xs text-ink-4 mb-5">Average score per dimension across all sessions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
              {RUBRIC_DIMS.map(({ key, label }) => {
                const val   = stats.skillAverages[key] ?? 0
                const pct   = Math.round(val * 10)
                const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-3">{label}</span>
                      <span className="font-semibold text-ink">{val.toFixed(1)}/10</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Recent sessions</h2>
            {history.length > 5 && (
              <Link to="/history" className="text-sm text-brand-500 font-medium hover:underline">
                View all {history.length} →
              </Link>
            )}
          </div>

          {history.length === 0 ? (
            <div className="bg-white border border-surface-4 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="font-display text-lg font-bold mb-2">No interviews yet</h3>
              <p className="text-ink-3 text-sm mb-6">Start your first adaptive interview session</p>
              <Link to="/interview/start" className="btn btn-accent">
                Start first interview →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 5).map((iv) => (
                <Link
                  key={iv._id}
                  to={`/history/${iv._id}`}
                  className="flex items-center gap-4 bg-white border border-surface-4 rounded-2xl p-5 hover:shadow-md hover:-translate-y-px transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-base truncate">{iv.role}</div>
                    <div className="text-xs text-ink-4 mt-0.5">
                      {formatDate(iv.createdAt)} · {iv.maxQuestions} questions · θ = {iv.theta?.toFixed(2)}
                    </div>
                    {iv.feedbackSummary && (
                      <p className="text-xs text-ink-3 mt-1.5 line-clamp-1">{iv.feedbackSummary}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`badge ${iv.readinessPrediction === 'READY' ? 'badge-ready' : 'badge-not'}`}>
                      {iv.readinessPrediction}
                    </span>
                    <span className={`font-display text-2xl font-black ${scoreColor(iv.averageScore)}`}>
                      {(iv.averageScore ?? 0).toFixed(1)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
