import { RUBRIC_DIMS } from '../../utils/helpers'

export function RubricBars({ rubric, questionType }) {
  if (!rubric) return null

  // Hide the STAR bar entirely for technical questions —
  // it's always 5 (not applicable) and would confuse the user
  const dims = RUBRIC_DIMS.filter(
    (d) => !(d.key === 'starStructure' && questionType === 'technical')
  )

  return (
    <div className="space-y-3">
      {dims.map(({ key, label }) => {
        const val   = rubric[key] ?? 0
        const pct   = val * 10
        const color =
          val >= 7.5 ? 'bg-emerald-500' :
          val >= 5   ? 'bg-amber-500'   : 'bg-red-500'

        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ink-3 font-medium">{label}</span>
              <span className="font-semibold text-ink">{val}/10</span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      {/* Label when STAR is hidden */}
      {questionType === 'technical' && (
        <div className="pt-1">
          <span className="text-[10px] text-ink-4 bg-surface-3 px-2 py-0.5 rounded-full">
            ℹ️ STAR structure not scored — technical question
          </span>
        </div>
      )}
    </div>
  )
}
