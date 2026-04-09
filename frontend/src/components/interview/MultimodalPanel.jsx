export function MultimodalPanel({ data }) {
  if (!data) return null

  const wpmStyle =
    data.wpm_category === 'ideal'    ? 'bg-emerald-50 text-emerald-700' :
    data.wpm_category === 'too_fast' ? 'bg-amber-50 text-amber-700'    :
                                       'bg-red-50 text-red-700'

  const starKeys = ['situation', 'task', 'action', 'result']
  const deliveryColor =
    data.delivery_score >= 7 ? 'text-emerald-600' :
    data.delivery_score >= 5 ? 'text-amber-600'   : 'text-red-600'

  const Row = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-surface-3 last:border-0 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  )

  return (
    <div className="card-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🎙️</span>
        <span className="font-display font-bold text-sm">Delivery Analysis</span>
      </div>

      <Row label="Speaking pace">
        {Math.round(data.words_per_minute)} wpm{' '}
        <span className={`badge ml-1 text-[10px] ${wpmStyle}`}>{data.wpm_category}</span>
      </Row>
      <Row label="Filler words">
        <span className={data.filler_count > 5 ? 'text-red-600' : 'text-emerald-600'}>
          {data.filler_count}
          {data.filler_words_found?.length > 0 && (
            <span className="text-ink-4 font-normal text-xs ml-1">
              ({data.filler_words_found.slice(0, 3).join(', ')})
            </span>
          )}
        </span>
      </Row>
      <Row label="Hedging phrases">
        <span className={data.hedge_count > 3 ? 'text-red-600' : 'text-emerald-600'}>
          {data.hedge_count}
        </span>
      </Row>
      <Row label="Vocabulary richness">
        {Math.round(data.vocabulary_richness * 100)}%
      </Row>
      <Row label="Long pauses">
        <span className={data.long_pause_count > 2 ? 'text-amber-600' : 'text-ink'}>
          {data.long_pause_count}
        </span>
      </Row>
      <Row label="STAR structure">
        <div className="flex gap-1">
          {starKeys.map((k) => (
            <div
              key={k}
              title={k}
              className={`w-2.5 h-2.5 rounded-full ${data.star_components?.[k] ? 'bg-brand-500' : 'bg-surface-4'}`}
            />
          ))}
        </div>
      </Row>
      <div className="flex justify-between items-center pt-2 mt-1">
        <span className="text-xs font-bold tracking-wider uppercase text-ink-3">Delivery score</span>
        <span className={`font-display text-2xl font-bold ${deliveryColor}`}>
          {data.delivery_score.toFixed(1)}<span className="text-sm text-ink-4 font-normal">/10</span>
        </span>
      </div>

      {data.delivery_breakdown && (
        <div className="mt-3 pt-3 border-t border-surface-3 space-y-1.5">
          {Object.entries(data.delivery_breakdown).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-ink-4 capitalize">{k.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-400 rounded-full" style={{ width: `${v * 10}%` }} />
                </div>
                <span className="text-ink-3 w-6 text-right">{v.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
