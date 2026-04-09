export function Spinner({ size = 'md', light = false }) {
  const sz = { sm: 'w-4 h-4 border-2', md: 'w-5 h-5 border-2', lg: 'w-8 h-8 border-[3px]' }[size]
  const color = light
    ? 'border-white/30 border-t-white'
    : 'border-surface-4 border-t-ink'
  return (
    <div className={`${sz} ${color} rounded-full animate-spin`} />
  )
}
