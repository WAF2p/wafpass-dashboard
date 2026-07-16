export interface JourneyCardProps {
  children: React.ReactNode
  accent?: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export default function JourneyCard({ children, accent, className = '', style, onClick }: JourneyCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : undefined,
        ...(accent ? { borderLeft: `4px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
