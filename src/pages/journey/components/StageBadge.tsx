import { JOURNEY_STAGES, stageFor } from '../../journeyUtils'

export default function StageBadge({ score, size = 'md', short = false }: { score: number; size?: 'sm' | 'md'; short?: boolean }) {
  const st = stageFor(score)
  const small = size === 'sm'
  return (
    <span
      title={st.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: small ? '0.12rem 0.5rem' : '0.2rem 0.65rem',
        borderRadius: 999,
        fontSize: small ? '0.62rem' : '0.72rem',
        fontWeight: 700,
        background: `${st.color}15`,
        border: `1px solid ${st.color}40`,
        color: st.color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}
    >
      <span style={{ fontSize: small ? '0.7rem' : '0.85rem', flexShrink: 0 }}>{st.icon}</span>
      {short ? st.shortLabel ?? st.label : st.label}
    </span>
  )
}

export function StageBadgeByIdx({ idx, size = 'md', short = false }: { idx: number; size?: 'sm' | 'md'; short?: boolean }) {
  const st = JOURNEY_STAGES[idx]
  if (!st) return null
  const small = size === 'sm'
  return (
    <span
      title={st.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: small ? '0.12rem 0.5rem' : '0.2rem 0.65rem',
        borderRadius: 999,
        fontSize: small ? '0.62rem' : '0.72rem',
        fontWeight: 700,
        background: `${st.color}15`,
        border: `1px solid ${st.color}40`,
        color: st.color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}
    >
      <span style={{ fontSize: small ? '0.7rem' : '0.85rem', flexShrink: 0 }}>{st.icon}</span>
      {short ? st.shortLabel ?? st.label : st.label}
    </span>
  )
}
