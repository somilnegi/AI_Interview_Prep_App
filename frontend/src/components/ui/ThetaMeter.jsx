import { thetaToPercent } from '../../utils/helpers'

export function ThetaMeter({ theta = 0, abilityLevel, showHistory = false, history = [] }) {
  const pct = thetaToPercent(theta)
  return (
    <div className="bg-ink rounded-2xl p-5 text-white">
      <div className="text-[10px] font-bold tracking-widest uppercase text-white/40 mb-1">
        Ability Estimate (θ)
      </div>
      <div className="font-display text-xl font-bold mb-4">
        {abilityLevel || '—'}
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/30 mt-1.5">
        <span>Novice</span>
        <span className="text-white/60 font-semibold">θ = {theta.toFixed(2)}</span>
        <span>Expert</span>
      </div>

      {showHistory && history.length > 1 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
            Session trajectory
          </div>
          <svg viewBox={`0 0 200 40`} className="w-full" style={{ height: 40 }}>
            {(() => {
              const pts = history.map((v, i) => {
                const x = (i / (history.length - 1)) * 200
                const y = 40 - thetaToPercent(v) * 0.4
                return `${x},${y}`
              })
              return (
                <polyline
                  points={pts.join(' ')}
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            })()}
          </svg>
        </div>
      )}
    </div>
  )
}
