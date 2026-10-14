/**
 * Shared SOC/Audit-style visual components used by Compliance, Gap Analysis, and similar pages.
 */

export function IconWrapper({ children, size = 16, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  )
}

export function CheckIcon() { return <IconWrapper size={14}><polyline points="20 6 9 17 4 12" /></IconWrapper> }
export function XIcon() { return <IconWrapper size={14}><path d="M18 6 6 18M6 6l12 12" /></IconWrapper> }
export function MinusIcon() { return <IconWrapper size={14}><path d="M5 12h14" /></IconWrapper> }
export function GlobeIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconWrapper> }
export function ListIcon() { return <IconWrapper><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></IconWrapper> }
export function GridIcon() { return <IconWrapper><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></IconWrapper> }
export function SearchIcon() { return <IconWrapper><circle cx={11} cy={11} r="8" /><path d="m21 21-4.35-4.35" /></IconWrapper> }
export function MapIcon() { return <IconWrapper><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></IconWrapper> }
export function TargetIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></IconWrapper> }
export function DownloadIcon() { return <IconWrapper><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></IconWrapper> }
export function ArrowRightIcon({ style }: { style?: React.CSSProperties } = {}) { return <IconWrapper style={style}><path d="M5 12h14M12 5l7 7-7 7" /></IconWrapper> }
export function ShieldIcon() { return <IconWrapper><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconWrapper> }
export function ExclaimIcon() { return <IconWrapper><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></IconWrapper> }
export function LockIcon() { return <IconWrapper><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></IconWrapper> }
export function SettingsIcon() { return <IconWrapper><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.07a2 2 0 0 1-2.83 2.83l-.07-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.07.06a2 2 0 0 1-2.83-2.83l.06-.07a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.07a2 2 0 0 1 2.83-2.83l.07.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.07-.06a2 2 0 0 1 2.83 2.83l-.06.07a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></IconWrapper> }
export function SignalIcon() { return <IconWrapper><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" /></IconWrapper> }
export function CostIcon() { return <IconWrapper><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></IconWrapper> }
export function OpsIcon() { return <IconWrapper><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M21 12a9 9 0 0 0-9-9" /></IconWrapper> }
export function PerfIcon() { return <IconWrapper><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></IconWrapper> }
export function RelIcon() { return <IconWrapper><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" /></IconWrapper> }
export function SovIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconWrapper> }
export function SusIcon() { return <IconWrapper><path d="M12 22c4.97 0 9-4.03 9-9-4.5 0-9-4.5-9-9-4.5 4.5-9 9-9 9 0 4.97 4.03 9 9 9z" /></IconWrapper> }
export function AgenticIcon() { return <IconWrapper><path d="M12 2a4 4 0 0 1 4 4c0 2.5-2 4-4 7-2-3-4-4.5-4-7a4 4 0 0 1 4-4z" /><circle cx="12" cy="15" r="3" /></IconWrapper> }

export function scoreColor(s: number) {
  return s >= 80 ? 'var(--score-high)' : s >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
}

export function scoreGlow(s: number) {
  return scoreColor(s)
}

export function statusColor(role: 'good' | 'warn' | 'bad' | 'info' | 'text' | 'muted') {
  const map: Record<typeof role, string> = {
    good: 'var(--pass)', warn: 'var(--score-mid)', bad: 'var(--fail)', info: 'var(--waf-brand)',
    text: 'var(--text)', muted: 'var(--muted)',
  }
  return map[role]
}

export function CircularScore({ value, size = 96, stroke = 8, color, track = 'var(--track)' }: { value: number; size?: number; stroke?: number; color: string; track?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="scc-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 6px var(--ring-glow))' }}>
        <defs>
          <linearGradient id={`sccGrad-${value}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#sccGrad-${value})`}
          strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="scc-ring__inner">
        <span className="scc-ring__value" style={{ color }}>{value}</span>
        <span className="scc-ring__unit">/100</span>
      </div>
    </div>
  )
}

export function SegmentedTabs<T extends string>({ options, value, onChange }: { options: { key: T; label: string; icon?: () => JSX.Element; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="scc-tabs">
      {options.map(opt => {
        const active = value === opt.key
        const disabled = opt.disabled
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            className={`scc-tab ${active ? 'scc-tab--active' : ''} ${disabled ? 'scc-tab--disabled' : ''}`}
            onClick={() => !disabled && onChange(opt.key)}
            disabled={disabled}
            aria-disabled={disabled}
          >
            {Icon && <span className="scc-tab__icon"><Icon /></span>}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SectionCard({ title, subtitle, children, className = '', style = {} }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`scc-card ${className}`} style={style}>
      <div className="scc-card__header">
        <div className="scc-card__title">{title}</div>
        {subtitle && <div className="scc-card__subtitle">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

export function KpiTile({ label, value, color, small }: { label: string; value: string | number; color: string; small?: boolean }) {
  return (
    <div className="scc-kpi" style={{ borderTopColor: color }}>
      <div className="scc-kpi__label">{label}</div>
      <div className={`scc-kpi__value ${small ? 'scc-kpi__value--small' : ''}`} style={{ color }}>{value}</div>
    </div>
  )
}

/** Inject shared SOC visual styles wherever these components are used. */
export function SocStyles() {
  return <style>{sharedSocCss}</style>
}

const sharedSocCss = `
/* Score ring */
.scc-ring {
  position: relative;
}
.scc-ring__inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.scc-ring__value {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-ring__unit {
  font-size: 0.55rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.06em;
}

/* KPI grid */
.scc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}
.scc-kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 2px solid var(--waf-brand);
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.scc-kpi:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--waf-brand) 30%, transparent);
}
.scc-kpi__label {
  font-size: 0.55rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.scc-kpi__value {
  font-size: 1.3rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}
.scc-kpi__value--small {
  font-size: 1rem;
}

@media (max-width: 1100px) {
  .scc-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* Tabs */
.scc-tabs {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  border-radius: 10px;
  padding: 0.3rem;
  gap: 0.25rem;
  align-self: flex-start;
  backdrop-filter: blur(8px);
}
.scc-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.scc-tab:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}
.scc-tab--active {
  background: color-mix(in srgb, var(--waf-brand) 15%, transparent);
  color: var(--waf-brand);
}
.scc-tab--active:hover {
  background: color-mix(in srgb, var(--waf-brand) 20%, transparent);
  color: var(--waf-brand);
}
.scc-tab--disabled {
  opacity: 0.45;
  filter: grayscale(0.6);
  cursor: not-allowed;
  pointer-events: none;
}
.scc-tab--disabled.scc-tab--active {
  opacity: 1;
  filter: none;
  pointer-events: auto;
}
.scc-tab__icon {
  opacity: 0.85;
}

/* Cards */
.scc-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-md);
}
.scc-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.scc-card__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.scc-card__subtitle {
  font-size: 0.72rem;
  color: var(--muted);
}

/* Form helpers */
.scc-select {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  outline: none;
}
.scc-btn-ghost {
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.scc-btn-ghost:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--waf-brand) 30%, transparent);
  background: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}

/* Country / jurisdiction chips */
.scc-country-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.scc-country-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--waf-brand) 12%, transparent);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.scc-country-chip:hover {
  border-color: color-mix(in srgb, var(--waf-brand) 25%, transparent);
  color: var(--text);
}
.scc-country-chip--active {
  border-color: color-mix(in srgb, var(--waf-brand) 40%, transparent);
  background: color-mix(in srgb, var(--waf-brand) 12%, transparent);
  color: var(--waf-brand);
  box-shadow: 0 0 12px color-mix(in srgb, var(--waf-brand) 12%, transparent);
}
.scc-country-chip__flag {
  font-size: 1rem;
  line-height: 1;
}
.scc-country-chip__check {
  display: inline-flex;
  color: var(--waf-brand);
}

/* Empty state */
.scc-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}

@media (max-width: 900px) {
  .scc-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .scc-kpi-grid { grid-template-columns: 1fr; }
  .scc-tabs { align-self: stretch; flex-wrap: wrap; }
}
`

