import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { interviewAPI } from '../services/api'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, scoreColor } from '../utils/helpers'

export default function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all') // all | ready | not-ready

  useEffect(() => {
    interviewAPI.history()
      .then(r => setHistory(r.data.interviews || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = history.filter(iv => {
    if (filter === 'ready')     return iv.readinessPrediction === 'READY'
    if (filter === 'not-ready') return iv.readinessPrediction === 'NOT READY'
    return true
  })

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-8 py-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight">Interview history</h1>
            <p className="text-ink-3 text-sm mt-1">{history.length} completed sessions</p>
          </div>
          <Link to="/interview/start" className="btn btn-accent">+ New interview</Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all',       label: 'All sessions' },
            { key: 'ready',     label: '✅ Ready'     },
            { key: 'not-ready', label: '📚 Not ready' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === key
                  ? 'bg-ink text-white'
                  : 'bg-white border border-surface-4 text-ink-3 hover:bg-surface-3'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-surface-4 rounded-2xl p-14 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="font-display text-lg font-bold mb-2">No interviews found</h3>
            <p className="text-ink-3 text-sm mb-6">
              {filter === 'all' ? 'Start your first session to see it here.' : 'No sessions match this filter.'}
            </p>
            {filter === 'all' && (
              <Link to="/interview/start" className="btn btn-accent">Start first interview →</Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((iv) => (
              <Link
                key={iv._id}
                to={`/history/${iv._id}`}
                className="block bg-white border border-surface-4 rounded-2xl p-6 hover:shadow-md hover:-translate-y-px transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-display font-bold text-lg">{iv.role}</span>
                      <span className={`badge badge-${iv.difficulty}`}>{iv.difficulty}</span>
                      {iv.resumeBased && (
                        <span className="badge bg-brand-50 text-brand-600">resume-based</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-4 mb-3">
                      {formatDate(iv.createdAt)} · {iv.maxQuestions} questions · Ability: {iv.abilityLevel || '—'}
                    </div>
                    {iv.feedbackSummary && (
                      <p className="text-sm text-ink-3 leading-relaxed line-clamp-2">
                        {iv.feedbackSummary}
                      </p>
                    )}

                    {/* Skill chips */}
                    {iv.skillGapMap?.weakAreas?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-[10px] text-ink-4 uppercase tracking-wider font-bold">Weak:</span>
                        {iv.skillGapMap.weakAreas.map(a => (
                          <span key={a} className="badge bg-red-50 text-red-600 text-[10px]">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`badge ${iv.readinessPrediction === 'READY' ? 'badge-ready' : 'badge-not'}`}>
                      {iv.readinessPrediction}
                    </span>
                    <div className="text-right">
                      <div className={`font-display text-3xl font-black leading-none ${scoreColor(iv.averageScore)}`}>
                        {(iv.averageScore ?? 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-ink-4 mt-0.5">/10</div>
                    </div>
                    <div className="text-xs text-ink-4">θ = {iv.theta?.toFixed(2)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
