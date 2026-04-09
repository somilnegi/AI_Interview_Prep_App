import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { interviewAPI } from '../services/api'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { RubricBars } from '../components/ui/RubricBars'
import { SkillRadar } from '../components/ui/SkillRadar'
import { ThetaChart } from '../components/ui/ThetaChart'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, scoreColor } from '../utils/helpers'

export default function InterviewDetailPage() {
  const { id }                    = useParams()
  const [interview, setInterview] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [openQ, setOpenQ]         = useState(null)

  useEffect(() => {
    interviewAPI.getOne(id)
      .then(r => setInterview(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96"><Spinner size="lg" /></div>
    </DashboardLayout>
  )

  if (!interview) return (
    <DashboardLayout>
      <div className="p-8 text-ink-3">Interview not found.</div>
    </DashboardLayout>
  )

  const ready = interview.readinessPrediction === 'READY'

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-8 py-8 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-4 mb-6">
          <Link to="/history" className="hover:text-ink">History</Link>
          <span>/</span>
          <span className="text-ink">{interview.role}</span>
        </div>

        {/* Readiness banner */}
        <div className={`rounded-2xl p-6 mb-6 flex items-center gap-5 border ${
          ready
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <span className="text-4xl">{ready ? '🎉' : '📚'}</span>
          <div>
            <div className={`font-display text-2xl font-black ${ready ? 'text-emerald-700' : 'text-red-700'}`}>
              {ready ? 'Interview Ready!' : 'More Practice Needed'}
            </div>
            <div className="text-sm text-ink-3 mt-1">
              {interview.confidenceScore}% confidence · {interview.abilityLevel} · θ = {interview.theta?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Role',         val: interview.role             },
            { label: 'Date',         val: formatDate(interview.createdAt) },
            { label: 'Avg score',    val: `${(interview.averageScore ?? 0).toFixed(1)}/10` },
            { label: 'Questions',    val: interview.maxQuestions     },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white border border-surface-4 rounded-xl p-4">
              <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-1">{label}</div>
              <div className="font-display font-bold text-sm text-ink">{val}</div>
            </div>
          ))}
        </div>

        {/* Feedback summary */}
        {interview.feedbackSummary && (
          <div className="bg-white border border-surface-4 rounded-2xl p-6 mb-6">
            <h2 className="font-display font-bold text-base mb-3">AI Feedback Summary</h2>
            <p className="text-sm text-ink-2 leading-relaxed">{interview.feedbackSummary}</p>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {interview.skillGapMap?.averages && (
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <h2 className="font-display font-bold text-base mb-1">Skill breakdown</h2>
              <p className="text-xs text-ink-4 mb-4">Rubric averages for this session</p>
              <SkillRadar averages={interview.skillGapMap.averages} height={220} />
            </div>
          )}
          {interview.thetaHistory?.length > 1 && (
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <h2 className="font-display font-bold text-base mb-1">Ability trajectory</h2>
              <p className="text-xs text-ink-4 mb-4">θ evolution during this session</p>
              <ThetaChart history={interview.thetaHistory} height={220} />
            </div>
          )}
        </div>

        {/* Rubric averages */}
        {interview.skillGapMap?.averages && (
          <div className="bg-white border border-surface-4 rounded-2xl p-6 mb-6">
            <h2 className="font-display font-bold text-base mb-4">Rubric scores</h2>
            <RubricBars rubric={interview.skillGapMap.averages} />
            <div className="grid grid-cols-2 gap-4 mt-5">
              {interview.skillGapMap.strongAreas?.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">💪 Strong</div>
                  <div className="flex flex-wrap gap-1">
                    {interview.skillGapMap.strongAreas.map(a => (
                      <span key={a} className="badge bg-emerald-100 text-emerald-700 text-[10px]">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {interview.skillGapMap.weakAreas?.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">⚠️ Improve</div>
                  <div className="flex flex-wrap gap-1">
                    {interview.skillGapMap.weakAreas.map(a => (
                      <span key={a} className="badge bg-red-100 text-red-700 text-[10px]">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question-by-question review */}
        {interview.questions?.length > 0 && (
          <div className="bg-white border border-surface-4 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-3">
              <h2 className="font-display font-bold text-base">Question review</h2>
            </div>
            {interview.questions.filter(q => q.userAnswer).map((q, i) => (
              <div key={i} className="border-b border-surface-3 last:border-0">
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-surface-2 transition-colors"
                  onClick={() => setOpenQ(openQ === i ? null : i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-surface-3 text-ink-3 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-ink line-clamp-1">{q.questionText}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className={`font-display font-bold text-base ${scoreColor(q.score)}`}>
                      {q.score?.toFixed(1)}
                    </span>
                    <span className="text-ink-4 text-xs">{openQ === i ? '▲' : '▼'}</span>
                  </div>
                </button>

                {openQ === i && (
                  <div className="px-6 pb-5 space-y-4 border-t border-surface-3 bg-surface-2/50">
                    <div className="pt-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-4 mb-2">Your answer</div>
                      <p className="text-sm text-ink-2 leading-relaxed bg-white p-3 rounded-xl border border-surface-4">
                        {q.userAnswer}
                      </p>
                    </div>
                    <RubricBars rubric={q.rubric} />
                    {q.strengthHighlight && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">💪 Strength</div>
                        <p className="text-xs text-emerald-800 leading-relaxed">{q.strengthHighlight}</p>
                      </div>
                    )}
                    {q.aiEvaluation && (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">⚠️ Mistakes</div>
                        <p className="text-xs text-red-800 leading-relaxed">{q.aiEvaluation}</p>
                      </div>
                    )}
                    {q.improvedAnswer && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">✅ Model answer</div>
                        <p className="text-xs text-blue-800 leading-relaxed">{q.improvedAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Link to="/interview/start" className="btn btn-accent">Practice again →</Link>
          <Link to="/history" className="btn btn-ghost">← Back to history</Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
