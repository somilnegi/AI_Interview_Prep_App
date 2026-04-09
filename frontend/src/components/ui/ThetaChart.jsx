import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export function ThetaChart({ history, height = 220 }) {
  if (!history || history.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-ink-4 text-sm"
        style={{ height }}
      >
        Complete more interviews to see your growth
      </div>
    )
  }
  const data = history.map((v, i) => ({ label: `S${i + 1}`, theta: parseFloat(v.toFixed(2)) }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d5" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b6b7e' }} />
        <YAxis domain={[-3, 3]} tick={{ fontSize: 11, fill: '#6b6b7e' }} />
        <Tooltip
          formatter={(v) => [v.toFixed(2), 'θ (ability)']}
          contentStyle={{ fontFamily: 'DM Sans', fontSize: 12, borderRadius: 8, border: '1px solid #e3e0d5' }}
        />
        <Line
          type="monotone"
          dataKey="theta"
          stroke="#e84b1a"
          strokeWidth={2.5}
          dot={{ fill: '#e84b1a', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
