import { RubricBars } from '../ui/RubricBars'
import { scoreColor } from '../../utils/helpers'

const TYPE_BADGE = {
  technical:    { label: 'Technical',    style: 'bg-blue-50 text-blue-700'    },
  behavioural:  { label: 'Behavioural',  style: 'bg-purple-50 text-purple-700' },
  general:      { label: 'General',      style: 'bg-surface-3 text-ink-3'      },
}

export function EvaluationCard({ evaluation }) {
  if (!evaluation) return null

  const {
    score, rubric, questionType,
    keyMistakes, strengthHighlight, improvedAnswer,
    abilityLevel, currentDifficulty,
  } = evaluation

  const typeBadge = TYPE_BADGE[questionType] || TYPE_BADGE.general

  return (
    <div className="card animate-slide-up mt-6 p-0 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3 bg-surface-2">
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-ink-4 mb-0.5">
            Score
          </div>
          <div className={`font-display text-4xl font-black ${scoreColor(score)}`}>
            {score.toFixed(1)}
            <span className="text-base font-normal text-ink-4">/10</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Question type badge */}
          {questionType && (
            <span className={`badge text-[10px] ${typeBadge.style}`}>
              {typeBadge.label}
            </span>
          )}
          {/* Difficulty badge */}
          {currentDifficulty && (
            <span className={`badge badge-${currentDifficulty}`}>
              {currentDifficulty}
            </span>
          )}
          {abilityLevel && (
            <div className="text-xs text-ink-3">{abilityLevel}</div>
          )}
        </div>
      </div>

      {/* Rubric bars — questionType passed so STAR is hidden for technical */}
      <div className="px-6 py-5 border-b border-surface-3">
        <div className="label mb-3">Rubric breakdown</div>
        <RubricBars rubric={rubric} questionType={questionType} />
      </div>

      {/* Feedback */}
      <div className="px-6 py-5 space-y-4">
        {strengthHighlight && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 mb-1.5">
              💪 What you did well
            </div>
            <p className="text-sm text-emerald-800 leading-relaxed">
              {strengthHighlight}
            </p>
          </div>
        )}
        {keyMistakes && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="text-[10px] font-bold tracking-widest uppercase text-red-600 mb-1.5">
              ⚠️ Key mistakes
            </div>
            <p className="text-sm text-red-800 leading-relaxed">{keyMistakes}</p>
          </div>
        )}
        {improvedAnswer && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="text-[10px] font-bold tracking-widest uppercase text-blue-600 mb-1.5">
              ✅ Model answer
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">
              {improvedAnswer}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
