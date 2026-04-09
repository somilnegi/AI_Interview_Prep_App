import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewAPI, jdAPI } from '../services/api'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { Spinner } from '../components/ui/Spinner'

export default function StartInterviewPage() {
  const navigate = useNavigate()
  const [tab, setTab]           = useState('manual') // manual | jd
  const [role, setRole]         = useState('')
  const [difficulty, setDiff]   = useState('medium')
  const [maxQ, setMaxQ]         = useState(5)
  const [useResume, setResume]  = useState(false)
  const [jd, setJd]             = useState('')
  const [jdResult, setJdResult] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const startManual = async () => {
    if (!role.trim()) return
    setError(''); setLoading(true)
    try {
      const { data } = await interviewAPI.start({ role, difficulty, maxQuestions: maxQ, useResume })
      navigate(`/interview/${data.interviewId}`, { state: { role } })
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start interview')
    } finally { setLoading(false) }
  }

  const startFromJD = async () => {
    if (jd.trim().length < 50) return
    setError(''); setLoading(true)
    try {
      const { data } = await jdAPI.startFromJD({ jobDescription: jd, difficulty, maxQuestions: maxQ })
      navigate(`/interview/${data.interviewId}`, { state: { role: data.role } })
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start JD-based interview')
    } finally { setLoading(false) }
  }

  const analyzeJD = async () => {
    if (jd.trim().length < 50) return
    setError(''); setLoading(true)
    try {
      const { data } = await jdAPI.analyze({ jobDescription: jd, difficulty })
      setJdResult(data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to analyse job description')
    } finally { setLoading(false) }
  }

  const Diff = ({ val }) => (
    <button
      onClick={() => setDiff(val)}
      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
        difficulty === val
          ? 'bg-ink text-white'
          : 'bg-surface-3 text-ink-3 hover:bg-surface-4'
      }`}
    >
      {val}
    </button>
  )

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-8 py-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-black tracking-tight">New interview</h1>
          <p className="text-ink-3 text-sm mt-1">Choose how you want to practise today</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-4 mb-6">
          {[['manual', 'Custom role'], ['jd', 'From job posting']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === k
                  ? 'border-brand-500 text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <div className="bg-white border border-surface-4 rounded-2xl p-7 space-y-6">
          {/* ── Manual tab ── */}
          {tab === 'manual' && (
            <>
              <div>
                <label className="label">Target role</label>
                <input
                  className="input"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  onKeyDown={e => e.key === 'Enter' && startManual()}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Starting difficulty</label>
                <div className="flex gap-2">
                  <Diff val="easy" /><Diff val="medium" /><Diff val="hard" />
                </div>
              </div>

              <div>
                <label className="label">Number of questions: <strong>{maxQ}</strong></label>
                <input
                  type="range" min={3} max={15} step={1}
                  value={maxQ} onChange={e => setMaxQ(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-xs text-ink-4 mt-1"><span>3</span><span>15</span></div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-surface-2 transition-colors">
                <input
                  type="checkbox"
                  checked={useResume}
                  onChange={e => setResume(e.target.checked)}
                  className="w-4 h-4 accent-brand-500"
                />
                <div>
                  <div className="text-sm font-medium text-ink">Use my resume</div>
                  <div className="text-xs text-ink-4">Get questions tailored to your actual experience</div>
                </div>
              </label>

              <button
                className="btn btn-accent btn-lg w-full"
                onClick={startManual}
                disabled={loading || !role.trim()}
              >
                {loading ? <Spinner light /> : 'Begin interview →'}
              </button>
            </>
          )}

          {/* ── JD tab ── */}
          {tab === 'jd' && (
            <>
              <div>
                <label className="label">Paste the job description</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 160 }}
                  value={jd}
                  onChange={e => setJd(e.target.value)}
                  placeholder="Paste the full job posting here — the more detail, the better the questions…"
                />
              </div>

              <div>
                <label className="label">Difficulty</label>
                <div className="flex gap-2">
                  <Diff val="easy" /><Diff val="medium" /><Diff val="hard" />
                </div>
              </div>

              <div>
                <label className="label">Number of questions: <strong>{maxQ}</strong></label>
                <input
                  type="range" min={3} max={15} step={1}
                  value={maxQ} onChange={e => setMaxQ(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="btn btn-ghost flex-1"
                  onClick={analyzeJD}
                  disabled={loading || jd.trim().length < 50}
                >
                  {loading ? <Spinner /> : '🔍 Analyze JD first'}
                </button>
                <button
                  className="btn btn-accent flex-1"
                  onClick={startFromJD}
                  disabled={loading || jd.trim().length < 50}
                >
                  {loading ? <Spinner light /> : 'Start interview →'}
                </button>
              </div>

              {/* JD analysis result */}
              {jdResult && (
                <div className="bg-surface-2 rounded-2xl p-5 space-y-4 border border-surface-4">
                  <div className="font-display font-bold text-lg">{jdResult.role}</div>

                  {[
                    { label: 'Technical skills', items: jdResult.technicalSkills },
                    { label: 'Soft skills',       items: jdResult.softSkills      },
                    { label: 'Keywords',          items: jdResult.experienceKeywords },
                  ].map(({ label, items }) => items?.length > 0 && (
                    <div key={label}>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-2">{label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(s => (
                          <span key={s} className="px-2.5 py-1 bg-white border border-surface-4 rounded-full text-xs text-ink-2">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {jdResult.readinessChecklist?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-2">
                        Readiness checklist
                      </div>
                      <div className="space-y-2">
                        {jdResult.readinessChecklist.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-brand-500 font-bold mt-0.5">☐</span>
                            <div>
                              <span className="font-medium">{c.item}</span>
                              <span className="text-ink-4"> — {c.why}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
