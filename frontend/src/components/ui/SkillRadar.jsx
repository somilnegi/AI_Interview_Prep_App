import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'

const DIM_LABELS = {
  clarity: 'Clarity', depth: 'Depth', relevance: 'Relevance',
  communication: 'Comm.', starStructure: 'STAR', specificity: 'Specificity',
}

export function SkillRadar({ averages, height = 260 }) {
  if (!averages) return null
  const data = Object.entries(averages).map(([k, v]) => ({
    dim: DIM_LABELS[k] || k,
    score: Math.round((v ?? 0) * 10),
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="#e3e0d5" />
        <PolarAngleAxis
          dataKey="dim"
          tick={{ fontSize: 11, fill: '#6b6b7e', fontFamily: 'DM Sans' }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#e84b1a"
          fill="#e84b1a"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
