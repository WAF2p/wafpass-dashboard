import { JOURNEY_STAGES } from '../journeyUtils'

export interface JourneyTimelineProps {
  activeStage: number
  orientation?: 'vertical' | 'horizontal'
  onSelect?: (stageIdx: number) => void
  compact?: boolean
}

const RED = '#DA2C38'
const GREEN = '#059669'

export default function JourneyTimeline({ activeStage, orientation = 'vertical', onSelect, compact = false }: JourneyTimelineProps) {
  const isVertical = orientation === 'vertical'
  const size = compact ? 520 : 720
  const nodeRadius = compact ? 6 : 9
  const strokeW = compact ? 2 : 3

  if (isVertical) {
    const width = 180
    const pad = 48
    const usable = size - pad * 2
    const step = usable / (JOURNEY_STAGES.length - 1)
    const cx = 36
    const labelLeft = 58

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: size, position: 'relative', overflow: 'hidden' }}>
        <svg width="100%" height={size} viewBox={`0 0 ${width} ${size}`} style={{ overflow: 'visible', flexShrink: 0 }}>
          <defs>
            <linearGradient id="j-redline-v" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED} />
              <stop offset="100%" stopColor={GREEN} />
            </linearGradient>
          </defs>
          {/* Base track */}
          <line x1={cx} y1={pad} x2={cx} y2={size - pad} stroke="var(--border)" strokeWidth={strokeW} strokeLinecap="round" />
          {/* Colored progress track up to active stage */}
          <line
            x1={cx}
            y1={pad}
            x2={cx}
            y2={pad + step * activeStage}
            stroke="url(#j-redline-v)"
            strokeWidth={strokeW + 1}
            strokeLinecap="round"
          />
          {JOURNEY_STAGES.map((st, idx) => {
            const cy = pad + idx * step
            const isHere = idx === activeStage
            const isPast = idx < activeStage
            const isFuture = idx > activeStage
            return (
              <g key={st.idx} onClick={() => onSelect?.(idx)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <title>{st.label}</title>
                {isHere && (
                  <circle cx={cx} cy={cy} r={nodeRadius + 8} fill={`${st.color}20`} />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={nodeRadius}
                  fill={isHere ? st.color : isPast ? GREEN : 'var(--bg)'}
                  stroke={isFuture ? 'var(--border)' : isPast ? GREEN : st.color}
                  strokeWidth={2}
                />
                {isPast && (
                  <path
                    d={`M ${cx - 4} ${cy} L ${cx - 1} ${cy + 3} L ${cx + 5} ${cy - 3}`}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {isHere && (
                  <circle cx={cx} cy={cy} r={nodeRadius - 3} fill="#fff" />
                )}
              </g>
            )
          })}
        </svg>
        {!compact && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {JOURNEY_STAGES.map((st, idx) => {
              const cy = pad + idx * step
              const isHere = idx === activeStage
              return (
                <div
                  key={st.idx}
                  title={st.label}
                  style={{
                    position: 'absolute',
                    left: labelLeft,
                    top: cy,
                    transform: 'translateY(-50%)',
                    fontSize: '0.68rem',
                    fontWeight: isHere ? 700 : 600,
                    color: isHere ? st.color : 'var(--muted)',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 118,
                    textAlign: 'left',
                  }}
                >
                  {st.shortLabel ?? st.label}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Horizontal (hero) layout
  const width = size
  const padH = 72
  const usableH = width - padH * 2
  const stepH = usableH / (JOURNEY_STAGES.length - 1)
  const cy = 56
  const finalY = cy + 28 - ((JOURNEY_STAGES.length - 1) / (JOURNEY_STAGES.length - 1)) * 42

  return (
    <div style={{ width: '100%', height: 120, position: 'relative', overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} 120`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="j-redline-h" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={RED} />
            <stop offset="100%" stopColor={GREEN} />
          </linearGradient>
        </defs>
        {/* Arc path */}
        <path
          d={`M ${padH} ${cy + 28} Q ${width / 2} ${cy - 42} ${width - padH} ${finalY}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray="6 5"
        />
        <path
          d={`M ${padH} ${cy + 28} Q ${width / 2} ${cy - 42} ${padH + stepH * activeStage} ${cy + 28 - (activeStage / 5) * 42}`}
          fill="none"
          stroke="url(#j-redline-h)"
          strokeWidth={strokeW + 1}
          strokeLinecap="round"
        />
        {JOURNEY_STAGES.map((st, idx) => {
          const x = padH + idx * stepH
          const y = cy + 28 - (idx / 5) * 42
          const isHere = idx === activeStage
          const isPast = idx < activeStage
          const labelBelow = idx % 2 === 0
          const showLabel = !compact || isHere
          return (
            <g key={st.idx} onClick={() => onSelect?.(idx)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              <title>{st.label}</title>
              {isHere && <circle cx={x} cy={y} r={nodeRadius + 8} fill={`${st.color}20`} />}
              <circle
                cx={x}
                cy={y}
                r={nodeRadius}
                fill={isHere ? st.color : isPast ? GREEN : 'var(--bg)'}
                stroke={isPast ? GREEN : isHere ? st.color : 'var(--border)'}
                strokeWidth={2}
              />
              {isPast && (
                <path
                  d={`M ${x - 4} ${y} L ${x - 1} ${y + 3} L ${x + 5} ${y - 3}`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {showLabel && (
                <text
                  x={x}
                  y={labelBelow ? y + 26 : y - 18}
                  textAnchor="middle"
                  fill={isHere ? st.color : 'var(--muted)'}
                  fontSize={compact ? 10 : 11}
                  fontWeight={isHere ? 700 : 500}
                >
                  {st.shortLabel ?? st.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
