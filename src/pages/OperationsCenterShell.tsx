import { ReactNode } from 'react'

export function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

export function SectionCard({
  title,
  icon,
  children,
  action,
  style,
}: {
  title: string
  icon: string
  children: ReactNode
  action?: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '1.1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
          <Icon path={icon} size={16} />
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function PriorityRow({
  label,
  count,
  total,
  color,
  meta,
  badge,
}: {
  label: string
  count: number
  total: number
  color: string
  meta?: string
  badge?: ReactNode
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {badge}
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color, flexShrink: 0 }}>{count}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--track)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }} />
      </div>
      {meta && <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{meta}</div>}
    </div>
  )
}

export function MiniBadge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        fontSize: '0.58rem',
        fontWeight: 800,
        padding: '0.12rem 0.4rem',
        borderRadius: '4px',
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        color,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

export function TwoColumnGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
        gap: '0.85rem',
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  )
}

export function RightRail({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: '260px' }}>
      {children}
    </div>
  )
}

export function CenterHero({
  eyebrow,
  title,
  subtitle,
  accent,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  accent: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: '260px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              color: accent,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.35rem', lineHeight: 1.2 }}>
          {title}
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}

export function CenterTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: string; disabled?: boolean }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '999px',
              border: `1px solid ${selected ? 'var(--waf-brand)' : 'var(--border)'}`,
              background: selected ? 'color-mix(in srgb, var(--waf-brand) 15%, transparent)' : 'var(--surface-el)',
              color: selected ? 'var(--waf-brand)' : tab.disabled ? 'var(--muted)' : 'var(--text)',
              fontSize: '0.78rem',
              fontWeight: selected ? 700 : 600,
              cursor: tab.disabled ? 'not-allowed' : 'pointer',
              opacity: tab.disabled ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            <Icon path={tab.icon} size={14} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
  demo,
}: {
  label: string
  value: ReactNode
  sub: string
  color: string
  icon: string
  demo?: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        minWidth: '180px',
        flex: 1,
      }}
    >
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color,
          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          flexShrink: 0,
        }}
      >
        <Icon path={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 800,
              color: 'var(--muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
          {demo && (
            <span
              style={{
                fontSize: '0.55rem',
                fontWeight: 700,
                padding: '0.08rem 0.35rem',
                borderRadius: '999px',
                background: 'color-mix(in srgb, var(--waf-warn) 14%, transparent)',
                color: 'var(--waf-warn)',
                border: '1px solid color-mix(in srgb, var(--waf-warn) 30%, transparent)',
                textTransform: 'uppercase',
              }}
            >
              demo
            </span>
          )}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{sub}</div>
      </div>
    </div>
  )
}

export function StubBanner({ title, description, badge = 'RFC' }: { title: string; description: string; badge?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.9rem 1.1rem',
        borderRadius: '12px',
        border: '1px solid color-mix(in srgb, var(--waf-warn) 22%, transparent)',
        background: 'color-mix(in srgb, var(--waf-warn) 7%, transparent)',
      }}
    >
      <div style={{ color: 'var(--waf-warn)', flexShrink: 0 }}>
        <Icon path="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--waf-warn)', marginBottom: '0.15rem' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{description}</div>
      </div>
      <div
        style={{
          flexShrink: 0,
          fontSize: '0.62rem',
          fontWeight: 800,
          padding: '0.25rem 0.55rem',
          borderRadius: '6px',
          background: 'color-mix(in srgb, var(--waf-warn) 15%, transparent)',
          color: 'var(--waf-warn)',
          border: '1px solid color-mix(in srgb, var(--waf-warn) 30%, transparent)',
        }}
      >
        {badge}
      </div>
    </div>
  )
}
