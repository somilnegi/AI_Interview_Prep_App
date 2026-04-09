import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { resumeAPI, interviewAPI } from '../services/api'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { SkillRadar } from '../components/ui/SkillRadar'
import { ThetaChart } from '../components/ui/ThetaChart'
import { Spinner } from '../components/ui/Spinner'
import { RUBRIC_DIMS } from '../utils/helpers'

export default function ProfilePage() {
  const { user }                        = useAuth()
  const [hasResume,   setHasResume]     = useState(false)
  const [uploading,   setUploading]     = useState(false)
  const [uploadMsg,   setUploadMsg]     = useState('')
  const [history,     setHistory]       = useState([])
  const [loadingData, setLoadingData]   = useState(true)
  const fileRef = useRef()

  useEffect(() => {
    Promise.all([
      resumeAPI.status(),
      interviewAPI.history(),
    ])
      .then(([r, h]) => {
        setHasResume(r.data.hasResume)
        setHistory(h.data.interviews || [])
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [])

  // ── Compute stats from live history (same approach as DashboardPage) ──────
  const stats = useMemo(() => {
    if (!history.length) return null
    const total     = history.length
    const avgPerf   = history.reduce((s, iv) => s + (iv.averageScore ?? 0), 0) / total
    const bestTheta = Math.max(...history.map(iv => iv.theta ?? 0))

    // Chronological theta history (API returns newest-first, so reverse)
    const thetaHistory = [...history].reverse().map(iv => iv.theta ?? 0)

    // Average each rubric dimension across all sessions
    const skillAverages = {}
    for (const { key } of RUBRIC_DIMS) {
      const vals = history
        .map(iv => iv.skillGapMap?.averages?.[key])
        .filter(v => v != null)
      skillAverages[key] = vals.length
        ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2))
        : 0
    }

    const hasSkills = Object.values(skillAverages).some(v => v > 0)
    return { total, avgPerf, bestTheta, thetaHistory, skillAverages, hasSkills }
  }, [history])

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadMsg('')
    try {
      await resumeAPI.upload(file)
      setHasResume(true)
      setUploadMsg('Resume uploaded successfully!')
    } catch {
      setUploadMsg('Upload failed. Please try a text-based PDF under 5 MB.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    await resumeAPI.delete()
    setHasResume(false)
    setUploadMsg('')
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-8 py-8 animate-fade-in">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-black tracking-tight">Profile</h1>
          <p className="text-ink-3 text-sm mt-1">Your account details and long-term skill tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: account + resume ── */}
          <div className="space-y-5">

            {/* Account card */}
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 font-display text-xl font-black flex items-center justify-center shrink-0">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg truncate">{user?.name}</div>
                  <div className="text-xs text-ink-4 truncate">{user?.email}</div>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-surface-3">
                {loadingData ? (
                  <div className="flex items-center gap-2 py-2">
                    <Spinner size="sm" />
                    <span className="text-xs text-ink-4">Loading stats…</span>
                  </div>
                ) : (
                  <>
                    {[
                      {
                        label: 'Total interviews',
                        val: stats?.total ?? 0,
                      },
                      {
                        label: 'Avg. performance',
                        val: stats
                          ? `${stats.avgPerf.toFixed(1)} / ${stats.total} session${stats.total > 1 ? 's' : ''}`
                          : '—',
                      },
                      {
                        label: 'Best theta (θ)',
                        val: stats ? stats.bestTheta.toFixed(2) : '—',
                      },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex justify-between items-center text-sm">
                        <span className="text-ink-3">{label}</span>
                        <span className="font-semibold text-ink">{val}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Resume card */}
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <h2 className="font-display font-bold text-base mb-1">Resume</h2>
              <p className="text-xs text-ink-4 mb-4 leading-relaxed">
                Upload your CV to get questions tailored to your real experience.
              </p>

              {uploadMsg && (
                <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${
                  uploadMsg.includes('success')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {uploadMsg}
                </div>
              )}

              {hasResume ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  {/* <span className="text-xl">✅</span> */}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-emerald-700">Resume on file</div>
                    <div className="text-xs text-ink-4 mt-0.5">Enable "Use resume" when starting</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={handleDelete}>Remove</button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => handleUpload(e.target.files[0])}
                  />
                  <button
                    className="w-full border-2 border-dashed border-surface-4 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-brand-400 hover:bg-brand-50 transition-colors cursor-pointer"
                    onClick={() => fileRef.current.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Spinner /> : (
                      <>
                        <span className="text-3xl">📄</span>
                        <span className="text-xs text-ink-4">Click to upload PDF (max 5MB)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Right column: charts ── */}
          <div className="lg:col-span-2 space-y-5">

            {loadingData ? (
              <div className="bg-white border border-surface-4 rounded-2xl p-12 flex items-center justify-center gap-3">
                <Spinner />
                <span className="text-sm text-ink-4">Loading your data…</span>
              </div>
            ) : !stats ? (
              <div className="bg-white border border-surface-4 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">📊</div>
                <div className="font-display font-bold text-base mb-1">No interview data yet</div>
                <p className="text-sm text-ink-4">Complete your first interview to see skill charts here.</p>
              </div>
            ) : (
              <>
                {/* Skill radar */}
                <div className="bg-white border border-surface-4 rounded-2xl p-6">
                  <h2 className="font-display font-bold text-base mb-1">Skill radar</h2>
                  <p className="text-xs text-ink-4 mb-4">
                    Rubric averages across {stats.total} session{stats.total !== 1 ? 's' : ''}
                  </p>
                  {stats.hasSkills ? (
                    <SkillRadar averages={stats.skillAverages} height={260} />
                  ) : (
                    <div className="h-60 flex items-center justify-center text-sm text-ink-4">
                      No skill data available yet
                    </div>
                  )}
                </div>

                {/* Theta chart */}
                <div className="bg-white border border-surface-4 rounded-2xl p-6">
                  <h2 className="font-display font-bold text-base mb-1">Long-term ability (θ)</h2>
                  <p className="text-xs text-ink-4 mb-4">IRT theta across all sessions</p>
                  {stats.thetaHistory.length > 1 ? (
                    <ThetaChart history={stats.thetaHistory} height={200} />
                  ) : (
                    <div className="h-48 flex items-center justify-center text-sm text-ink-4">
                      Complete one more interview to see your growth chart
                    </div>
                  )}
                </div>

                {/* Skill breakdown bars */}
                {stats.hasSkills && (
                  <div className="bg-white border border-surface-4 rounded-2xl p-6">
                    <h2 className="font-display font-bold text-base mb-4">Skill breakdown</h2>
                    <div className="space-y-3">
                      {RUBRIC_DIMS.map(({ key, label }) => {
                        const val   = stats.skillAverages[key] ?? 0
                        const pct   = Math.round(val * 10)
                        const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-ink-3">{label}</span>
                              <span className="font-semibold">{val.toFixed(1)}/10</span>
                            </div>
                            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${color}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
