import { useLocation, useNavigate, Link } from 'react-router-dom'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { RubricBars } from '../components/ui/RubricBars'
import { SkillRadar } from '../components/ui/SkillRadar'
import { ThetaChart } from '../components/ui/ThetaChart'

export default function ResultsPage() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const results    = state?.results
  const role       = state?.role || 'Interview'

  if (!results) {
    navigate('/dashboard')
    return null
  }

  const ready = results.readinessPrediction === 'READY'

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-8 py-8 animate-fade-in">
        <h1 className="font-display text-3xl font-black tracking-tight mb-6">Your results</h1>

        {/* Readiness banner */}
        <div className={`rounded-2xl p-7 mb-6 flex items-center gap-6 border ${
          ready ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <span className="text-5xl">{ready ? '🎉' : '📚'}</span>
          <div className="flex-1">
            <div className={`font-display text-2xl font-black ${ready ? 'text-emerald-700' : 'text-red-700'}`}>
              {ready ? 'Ready for interviews!' : 'More practice needed'}
            </div>
            <div className="text-sm text-ink-3 mt-1">
              {results.predictionRationale}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-4 mb-1">Confidence</div>
            <div className="font-display text-3xl font-black text-ink">{results.confidenceScore}%</div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Average score',  val: `${(results.averageScore ?? 0).toFixed(1)}/10`, accent: true },
            { label: 'Ability (θ)',    val: results.theta?.toFixed(2) },
            { label: 'Ability level',  val: results.abilityLevel },
            { label: 'Role',           val: role },
          ].map(({ label, val, accent }) => (
            <div
              key={label}
              className={`rounded-2xl p-5 ${accent ? 'bg-brand-500 text-white' : 'bg-white border border-surface-4'}`}
            >
              <div className={`text-[10px] font-bold tracking-widest uppercase mb-2 ${accent ? 'text-white/60' : 'text-ink-4'}`}>
                {label}
              </div>
              <div className={`font-display text-2xl font-black leading-none ${accent ? 'text-white' : 'text-ink'}`}>
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback summary */}
        {results.feedbackSummary && (
          <div className="bg-white border border-surface-4 rounded-2xl p-6 mb-6">
            <h2 className="font-display font-bold text-base mb-3">AI Feedback Summary</h2>
            <p className="text-sm text-ink-2 leading-relaxed">{results.feedbackSummary}</p>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {results.skillGapMap?.averages && (
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <h2 className="font-display font-bold text-base mb-1">Skill breakdown</h2>
              <p className="text-xs text-ink-4 mb-4">6-dimension rubric averages</p>
              <SkillRadar averages={results.skillGapMap.averages} height={230} />
            </div>
          )}
          {results.thetaHistory?.length > 1 && (
            <div className="bg-white border border-surface-4 rounded-2xl p-6">
              <h2 className="font-display font-bold text-base mb-1">Ability trajectory</h2>
              <p className="text-xs text-ink-4 mb-4">θ evolution during this session</p>
              <ThetaChart history={results.thetaHistory} height={230} />
            </div>
          )}
        </div>

        {/* Rubric + skill gaps */}
        {results.skillGapMap && (
          <div className="bg-white border border-surface-4 rounded-2xl p-6 mb-6">
            <h2 className="font-display font-bold text-base mb-5">Rubric scores</h2>
            <RubricBars rubric={results.skillGapMap.averages} />

            <div className="grid grid-cols-2 gap-4 mt-6">
              {results.skillGapMap.strongAreas?.length > 0 && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">💪 Strong areas</div>
                  <div className="flex flex-wrap gap-1.5">
                    {results.skillGapMap.strongAreas.map(a => (
                      <span key={a} className="badge bg-emerald-100 text-emerald-700">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {results.skillGapMap.weakAreas?.length > 0 && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">⚠️ Needs work</div>
                  <div className="flex flex-wrap gap-1.5">
                    {results.skillGapMap.weakAreas.map(a => (
                      <span key={a} className="badge bg-red-100 text-red-700">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link to="/interview/start" className="btn btn-accent btn-lg">Practice again →</Link>
          <Link to="/dashboard"      className="btn btn-ghost btn-lg">Back to dashboard</Link>
          <Link to="/history"        className="btn btn-ghost btn-lg">View history</Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
