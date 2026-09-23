import { useEffect, useState } from 'react'
import { fetchServerHealth, getServerUrl } from '../api'
import { useI18n } from '../i18n'

interface WelcomeChecklistProps {
  serverUrl: string
  demoLoading: boolean
  demoError: string | null
  demoRunId: string | null
  onRunDemo: () => void
  onOpenRunHistory: () => void
  onShowAdvanced?: () => void
}

const STORAGE_PREFIX = 'wafpass_onboarding_'

function useStepDone(key: string): [boolean, () => void] {
  const fullKey = `${STORAGE_PREFIX}${key}_done`
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(fullKey) === '1'
    } catch {
      return false
    }
  })
  const markDone = () => {
    try {
      localStorage.setItem(fullKey, '1')
    } catch {
      // ignore
    }
    setDone(true)
  }
  return [done, markDone]
}

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={copy}
      style={{
        padding: '0.25rem 0.55rem',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--muted)',
        fontSize: '0.7rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  )
}

function StepBadge({ done, loading, index }: { done: boolean; loading?: boolean; index: number }) {
  return (
    <div
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? '#22c55e' : loading ? 'var(--waf-brand)' : 'rgba(148,163,184,.2)',
        color: done || loading ? '#fff' : 'var(--muted)',
        fontSize: '0.7rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {done ? '✓' : loading ? '◌' : index}
    </div>
  )
}

function StepRow({
  index,
  title,
  desc,
  done,
  command,
  onCopy,
  loading,
  action,
}: {
  index: number
  title: string
  desc: string
  done: boolean
  command?: string
  onCopy?: () => void
  loading?: boolean
  action?: { label: string; onClick: () => void }
}) {
  const { t } = useI18n()

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border)',
        opacity: done ? 0.8 : 1,
      }}
    >
      <StepBadge done={done} loading={loading} index={index} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
            {done ? t('welcome.stepDone') : loading ? t('welcome.stepInProgress') : t('welcome.stepPending')}
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5, marginTop: '0.15rem' }}>
          {desc}
        </div>
        {command && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.4rem',
              padding: '0.35rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(0,148,255,.06)',
              border: '1px solid rgba(0,148,255,.15)',
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: '0.72rem',
                color: 'var(--text)',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {command}
            </code>
            <CopyButton text={command} onCopy={onCopy} />
          </div>
        )}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              marginTop: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--waf-brand)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

export default function WelcomeChecklist({
  serverUrl,
  demoLoading,
  demoError,
  demoRunId,
  onRunDemo,
  onOpenRunHistory,
  onShowAdvanced,
}: WelcomeChecklistProps) {
  const { t } = useI18n()
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  const [initDone, markInitDone] = useStepDone('init')
  const [scanDone, markScanDone] = useStepDone('scan')
  const [viewDone, markViewDone] = useStepDone('view')

  useEffect(() => {
    let cancelled = false
    fetchServerHealth()
      .then(() => {
        if (!cancelled) setServerOnline(true)
      })
      .catch(() => {
        if (!cancelled) setServerOnline(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (demoRunId) {
      markScanDone()
      markViewDone()
    }
  }, [demoRunId, markScanDone, markViewDone])

  const effectiveServerUrl = getServerUrl() || serverUrl
  const initCmd = t('welcome.initCommand')
  const demoCmd = t('welcome.runDemoCommand', { serverUrl: effectiveServerUrl })

  const steps = [
    {
      key: 'init',
      title: t('welcome.stepInit'),
      desc: t('welcome.stepInitDesc'),
      done: initDone,
      command: initCmd,
      onCopy: markInitDone,
    },
    {
      key: 'scan',
      title: t('welcome.stepScan'),
      desc: t('welcome.stepScanDesc'),
      done: scanDone || !!demoRunId,
      command: demoCmd,
      onCopy: markScanDone,
      loading: demoLoading,
    },
    {
      key: 'view',
      title: t('welcome.stepView'),
      desc: t('welcome.stepViewDesc'),
      done: viewDone || !!demoRunId,
      action: demoRunId
        ? { label: t('welcome.openRunHistory'), onClick: onOpenRunHistory }
        : undefined,
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Hero panel */}
      <div
        style={{
          padding: '1.5rem 1.75rem',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(0,148,255,.1) 0%, rgba(124,58,237,.08) 100%)',
          border: '1px solid rgba(0,148,255,.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              flexShrink: 0,
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(0,148,255,.15)',
              border: '1px solid rgba(0,148,255,.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
              {t('welcome.title')}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {t('welcome.subtitleShort')}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              background: serverOnline === true ? 'rgba(34,197,94,.1)' : serverOnline === false ? 'rgba(239,68,68,.1)' : 'rgba(148,163,184,.1)',
              border: `1px solid ${serverOnline === true ? 'rgba(34,197,94,.3)' : serverOnline === false ? 'rgba(239,68,68,.3)' : 'rgba(148,163,184,.3)'}`,
              fontSize: '0.72rem',
              color: serverOnline === true ? '#22c55e' : serverOnline === false ? '#ef4444' : 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: serverOnline === true ? '#22c55e' : serverOnline === false ? '#ef4444' : '#94a3b8',
              }}
            />
            {t('welcome.serverStatus')}: {serverOnline === true ? t('welcome.serverOnline') : serverOnline === false ? t('welcome.serverOffline') : '…'}
          </div>
        </div>
      </div>

      {/* Two paths */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Try it now */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            background: 'var(--bg)',
            border: '2px solid var(--waf-brand)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(0,148,255,.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--waf-brand)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              1
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('welcome.pathTryTitle')}
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6, flex: 1 }}>
            {t('welcome.pathTryDesc')}
          </div>
          <button
            onClick={onRunDemo}
            disabled={demoLoading}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--waf-brand)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: demoLoading ? 'wait' : 'pointer',
              opacity: demoLoading ? 0.7 : 1,
            }}
          >
            {demoLoading ? t('welcome.demoRunning') : t('welcome.seeExampleScan')}
          </button>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center' }}>
            {t('welcome.seeExampleScanDesc')}
          </div>
        </div>

        {/* Have the CLI? */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(148,163,184,.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              2
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('welcome.pathCliTitle')}
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6, flex: 1 }}>
            {t('welcome.pathCliDesc')}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.55rem',
              borderRadius: '6px',
              background: 'rgba(0,148,255,.06)',
              border: '1px solid rgba(0,148,255,.15)',
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: '0.72rem',
                color: 'var(--text)',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {demoCmd}
            </code>
            <CopyButton text={demoCmd} onCopy={markScanDone} />
          </div>
        </div>
      </div>

      {/* How to install (fallback) */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'var(--bg)',
          border: '1px dashed var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>
            {t('welcome.howToInstallTitle')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            {t('welcome.howToInstallDesc')}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.5rem',
            borderRadius: '6px',
            background: 'rgba(0,148,255,.06)',
            border: '1px solid rgba(0,148,255,.15)',
            flex: 2,
            minWidth: '220px',
          }}
        >
          <code
            style={{
              flex: 1,
              fontSize: '0.7rem',
              color: 'var(--text)',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {t('welcome.installCommand')}
          </code>
          <CopyButton text={t('welcome.installCommand')} />
        </div>
      </div>

      {/* Red line steps */}
      <div
        style={{
          padding: '0.25rem 1.25rem 0.75rem',
          borderRadius: '12px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ padding: '0.75rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('welcome.checklistTitle')}
        </div>
        {steps.map((step, idx) => (
          <StepRow
            key={step.key}
            index={idx + 1}
            title={step.title}
            desc={step.desc}
            done={step.done}
            command={step.command}
            onCopy={step.onCopy}
            loading={step.loading}
            action={step.action}
          />
        ))}
      </div>

      {/* Alerts */}
      {demoError && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)',
            fontSize: '0.82rem',
            color: '#ef4444',
          }}
        >
          {t('welcome.demoError', { message: demoError })}
        </div>
      )}

      {demoRunId && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(34,197,94,.08)',
            border: '1px solid rgba(34,197,94,.25)',
            fontSize: '0.82rem',
            color: '#22c55e',
          }}
        >
          {t('welcome.demoSuccess')}
        </div>
      )}

      {/* Advanced options */}
      {onShowAdvanced && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'var(--bg)',
            border: '1px dashed var(--border)',
            cursor: 'pointer',
          }}
          onClick={onShowAdvanced}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onShowAdvanced() }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('welcome.advancedOptions')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {t('welcome.advancedOptionsDesc')}
            </div>
          </div>
          <svg width="16" height="16" fill="none" stroke="var(--muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  )
}
