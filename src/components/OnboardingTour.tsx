import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

export interface OnboardingTourProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

const STEP_KEYS = [
  'welcome',
  'navigation',
  'scan',
  'runs',
  'dashboard',
  'findings',
  'passports',
  'journey',
  'remediation',
  'done',
] as const

type StepKey = typeof STEP_KEYS[number]

const STEP_META: Record<
  StepKey,
  { icon: string; color: string; illustration?: 'nav' | 'cli' | 'cards' | 'bars' | 'timeline' | 'badges' | 'actions' }
> = {
  welcome: { icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: '#0094FF' },
  navigation: { icon: 'M4 6h16M4 12h16M4 18h16', color: '#f59e0b', illustration: 'nav' },
  scan: { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', color: '#22c55e', illustration: 'cli' },
  runs: { icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', color: '#8b5cf6' },
  dashboard: { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: '#0094FF', illustration: 'cards' },
  findings: { icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: '#DA2C38', illustration: 'bars' },
  passports: { icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', color: '#14b8a6', illustration: 'badges' },
  journey: { icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8', color: '#DA2C38', illustration: 'timeline' },
  remediation: { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: '#eab308', illustration: 'actions' },
  done: { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#22c55e' },
}

function Icon({ d, color, size = 24 }: { d: string; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color ?? 'currentColor'} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

function NavPreview({ t }: { t: (key: string, vars?: Record<string, string | number>) => string }) {
  const sections = [
    { label: t('onboarding.sectionOverview'), color: '#f59e0b' },
    { label: t('onboarding.sectionCiso'), color: '#0094ff' },
    { label: t('onboarding.sectionArchitect'), color: '#8b5cf6' },
    { label: t('onboarding.sectionEngineer'), color: '#22c55e' },
    { label: t('onboarding.sectionRuns'), color: '#22c55e' },
    { label: t('onboarding.sectionAdmin'), color: '#f87171' },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
      {sections.map(s => (
        <div
          key={s.label}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.7rem', borderRadius: 999,
            background: 'var(--bg)', border: '1px solid var(--border)',
            fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  )
}

function CliCopy({ t }: { t: (key: string, vars?: Record<string, string | number>) => string }) {
  const [copied, setCopied] = useState<string | null>(null)
  const commands = [
    { label: t('onboarding.steps.scan.installLabel'), cmd: t('onboarding.steps.scan.installCommand') },
    { label: t('onboarding.steps.scan.checkLabel'), cmd: t('onboarding.steps.scan.checkCommand') },
    { label: t('onboarding.steps.scan.pushLabel'), cmd: t('onboarding.steps.scan.pushCommand') },
  ]

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{t('onboarding.clickToCopy')}</div>
      {commands.map(c => (
        <button
          key={c.label}
          onClick={() => copy(c.cmd, c.label)}
          style={{
            width: '100%', textAlign: 'left',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '0.75rem 1rem', cursor: 'pointer',
            transition: 'border-color 0.15s, transform 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--waf-brand)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '0.25rem', fontWeight: 600 }}>{c.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <code style={{ fontSize: '0.8rem', color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', wordBreak: 'break-all' }}>
              $ {c.cmd}
            </code>
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
              color: copied === c.label ? '#22c55e' : 'var(--waf-brand)',
            }}>
              {copied === c.label ? t('onboarding.copied') : t('onboarding.copyCommand')}
            </span>
          </div>
        </button>
      ))}
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontStyle: 'italic' }}>{t('onboarding.steps.scan.tip')}</div>
    </div>
  )
}

function CardGrid({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '0.75rem', borderRadius: 10,
            background: 'var(--bg)', border: '1px solid var(--border)',
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--waf-brand)', flexShrink: 0 }} />
          {item}
        </div>
      ))}
    </div>
  )
}

function SeverityBars({ items }: { items: string[] }) {
  const colors = ['#DA2C38', '#f97316', '#eab308', '#22c55e']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '1rem' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 70, fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{item}</div>
          <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${100 - i * 22}%`, background: colors[i], borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineMini({ stages }: { stages: string[] }) {
  return (
    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 12, right: 12, height: 3, background: 'var(--border)', borderRadius: 999 }} />
        <div style={{ position: 'absolute', top: 10, left: 12, width: '55%', height: 3, background: 'linear-gradient(90deg, #DA2C38, #22c55e)', borderRadius: 999 }} />
        {stages.map((s, i) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', zIndex: 1 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i <= 3 ? '#22c55e' : 'var(--surface)',
              border: `2px solid ${i <= 3 ? '#22c55e' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i <= 3 && <Icon d="M5 13l4 4L19 7" color="#fff" size={12} />}
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionPills({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '0.45rem 0.85rem', borderRadius: 999,
            background: 'rgba(0,148,255,.1)', border: '1px solid rgba(0,148,255,.25)',
            color: 'var(--waf-brand)', fontSize: '0.75rem', fontWeight: 700,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

export default function OnboardingTour({ open, onClose, onComplete }: OnboardingTourProps) {
  const { t, translations } = useI18n()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, STEP_KEYS.length - 1))
      if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const total = STEP_KEYS.length
  const currentKey = STEP_KEYS[step]
  const meta = STEP_META[currentKey]
  const isFirst = step === 0
  const isLast = step === total - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          width: 'min(760px, 95vw)',
          maxHeight: 'min(780px, 92vh)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '22px',
          boxShadow: '0 28px 90px rgba(0,0,0,.28)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Header */}
        <div style={{
          padding: '1.75rem 1.75rem 1rem',
          display: 'flex', alignItems: 'center', gap: '1.1rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: meta.color,
          }}>
            <Icon d={meta.icon} color={meta.color} size={28} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {t('onboarding.stepNOfM', { n: step + 1, m: total })}
            </div>
            <h2 id="onboarding-title" style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
              {t(`onboarding.steps.${currentKey}.title`)}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 10,
              color: 'var(--muted)', cursor: 'pointer', padding: '0.4rem 0.75rem', fontSize: '0.9rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem 1.5rem' }}>
          <p style={{
            margin: 0, fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.65,
          }}>
            {t(`onboarding.steps.${currentKey}.body`)}
          </p>

          {currentKey === 'navigation' && <NavPreview t={t} />}
          {currentKey === 'scan' && <CliCopy t={t} />}
          {currentKey === 'dashboard' && <CardGrid items={translations.onboarding.steps.dashboard.cards} />}
          {currentKey === 'findings' && <SeverityBars items={translations.onboarding.steps.findings.severities} />}
          {currentKey === 'passports' && <CardGrid items={translations.onboarding.steps.passports.fields} />}
          {currentKey === 'journey' && <TimelineMini stages={translations.onboarding.steps.journey.stages} />}
          {currentKey === 'remediation' && <ActionPills items={translations.onboarding.steps.remediation.actions} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.1rem 1.75rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600, padding: '0.45rem 0',
            }}
          >
            {t('onboarding.skip')}
          </button>

          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {STEP_KEYS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setStep(idx)}
                aria-label={t('onboarding.stepNOfM', { n: idx + 1, m: total })}
                style={{
                  width: idx === step ? 26 : 8, height: 8, borderRadius: 999,
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  background: idx === step ? meta.color : 'var(--border)',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '0.55rem 1.1rem', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t('onboarding.back')}
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '0.55rem 1.25rem', borderRadius: 10,
                border: 'none', background: 'var(--waf-brand)',
                color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,148,255,.25)',
              }}
            >
              {isLast ? t('onboarding.done') : t('onboarding.next')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
