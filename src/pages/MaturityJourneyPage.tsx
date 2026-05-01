import { useState } from 'react'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { getMaturityMeta, Settings } from './settingsUtils'

export interface MaturityJourneyPageProps {
  run: RunDetail | null
  runs: RunSummary[]
  maturityLevel: number
  settings: Settings
  waiverCount: number
  riskCount: number
  navigate: (page: Page) => void
}

const STAGE_META = [
  { icon: '🏗', label: 'Hangar',           range: '0–19',   color: '#ef4444', min: 0,  max: 19  },
  { icon: '🔍', label: 'Pre-Flight',        range: '20–39',  color: '#f97316', min: 20, max: 39  },
  { icon: '🚀', label: 'Boarding & Taxi',   range: '40–59',  color: '#eab308', min: 40, max: 59  },
  { icon: '✈',  label: 'Takeoff Roll',      range: '60–74',  color: '#0094FF', min: 60, max: 74  },
  { icon: '🛫', label: 'Cruise Altitude',   range: '75–89',  color: '#8b5cf6', min: 75, max: 89  },
  { icon: '🏁', label: 'Final Approach',    range: '90–100', color: '#059669', min: 90, max: 100 },
]

function stageFor(score: number): number {
  if (score >= 90) return 5
  if (score >= 75) return 4
  if (score >= 60) return 3
  if (score >= 40) return 2
  if (score >= 20) return 1
  return 0
}

// Clean side-view airplane SVG facing right
function PlaneIcon({ size = 48, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 40" fill="none"
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(0,148,255,0.8))' } : undefined}>
      {/* Fuselage */}
      <rect x="4" y="17" width="52" height="6" rx="3" fill="#0094FF" />
      {/* Nose */}
      <path d="M56 17 L64 20 L56 23 Z" fill="#3b82f6" />
      {/* Main wing (upper + lower sweep) */}
      <path d="M36 20 L22 4 L30 8 L42 20 Z" fill="#60a5fa" />
      <path d="M36 20 L22 36 L30 32 L42 20 Z" fill="#60a5fa" />
      {/* Tail fin vertical */}
      <path d="M10 19 L8 10 L16 14 L16 19 Z" fill="#93c5fd" />
      {/* Horizontal stabilizer */}
      <path d="M10 22 L8 31 L16 27 L16 22 Z" fill="#93c5fd" />
      {/* Engine pod upper */}
      <rect x="30" y="11" width="10" height="4" rx="2" fill="#1d4ed8" />
      {/* Engine pod lower */}
      <rect x="30" y="25" width="10" height="4" rx="2" fill="#1d4ed8" />
      {/* Cockpit window */}
      <ellipse cx="52" cy="20" rx="3" ry="2" fill="rgba(255,255,255,0.85)" />
      {/* Cabin windows */}
      <circle cx="44" cy="20" r="1.4" fill="rgba(255,255,255,0.6)" />
      <circle cx="39" cy="20" r="1.4" fill="rgba(255,255,255,0.6)" />
      <circle cx="34" cy="20" r="1.4" fill="rgba(255,255,255,0.6)" />
    </svg>
  )
}

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.55rem', borderRadius: 999, background: bg, color, border: `1px solid ${border}`, fontWeight: 700 }}>
      {children}
    </span>
  )
}

const STAGE_STORY: Array<{
  quote: string
  body: string[]
  priority: string[]
  links: Array<{ label: string; page: Page }>
}> = [
  {
    quote: '"The aircraft sits in the hangar. Nobody has run a preflight check."',
    body: [
      'The aircraft sits in the hangar. Maintenance logs are incomplete. The pre-flight checklist hasn\'t been run. No clearance has been requested from the control tower. This isn\'t an aircraft ready to carry passengers — it\'s metal waiting to be prepared.',
      'In infrastructure terms: public buckets, no encryption, default credentials, no logging. An attacker doesn\'t need to be sophisticated here — they just need to show up. The threat model is "everyone," and the blast radius is "everything."',
    ],
    priority: [
      'Install WAF++ and run your first scan — get a baseline score',
      'Eliminate all public storage, exposed databases, and public ACLs',
      'Enable encryption at rest on all storage resources',
      'Enforce TLS/HTTPS everywhere — no plaintext transport',
      'Enable audit logging — if you can\'t see it, you can\'t defend it',
    ],
    links: [{ label: 'Run Scan →', page: 'runscan' }],
  },
  {
    quote: '"Ground crew has arrived. Each system gets a pass or a red flag."',
    body: [
      'The ground crew has arrived. Fuel checks, tire pressure, hydraulic fluid — each system gets evaluated. You\'re not ready to fly yet, but you know exactly what needs fixing.',
      'The most dangerous aircraft isn\'t the one with known problems — it\'s the one where nobody looked. You\'ve looked. Now the work of resolving critical red flags begins in earnest. IAM policies need tightening. Secrets are drifting through environment variables. Encryption is patchy.',
      'Good news: every finding is an opportunity. You have a manifest. Work the list.',
    ],
    priority: [
      'Tighten IAM — no wildcards on critical actions, no *:* policies',
      'Enable secret scanning — rotate any secrets found in IaC immediately',
      'Lock down security groups — default-deny inbound, whitelist only what\'s required',
      'VPC flow logs — understand all traffic before you trust any traffic',
      'Enable MFA on all privileged accounts — passwords alone are not a door, they\'re a note on a door',
    ],
    links: [{ label: 'View Findings →', page: 'findings' }, { label: 'Secret Scanner →', page: 'secrets' }],
  },
  {
    quote: '"Boarding complete. Taxi to runway. Control tower has you on radar."',
    body: [
      'Passengers are boarded. Doors are armed. You\'ve requested taxi clearance and control tower has you on radar. There\'s still turbulence ahead — some systems aren\'t where they need to be — but the aircraft is moving under its own power, and the crew knows the plan.',
      'This is where operational discipline begins to differentiate teams. The risk register is no longer "we have no idea" — it\'s a formal document. Waivers are documented, not hidden. Someone has signed their name next to the accepted risks. That accountability matters.',
      'You\'re on the taxiway. The runway is ahead. Don\'t take off with a door still open.',
    ],
    priority: [
      'Formalize risk acceptances — every accepted risk needs an approver, a reason, and an expiry',
      'Deploy WAF in front of all internet-facing workloads',
      'Enable backup policies — RTO/RPO targets enforced by configuration, not prayer',
      'Tag every resource — cost accountability is security accountability',
      'Understand your blast radius — use the Blast Radius visualizer now',
    ],
    links: [{ label: 'Risk Acceptance →', page: 'risk' }, { label: 'Blast Radius →', page: 'blastradius' }],
  },
  {
    quote: '"V1 — no turning back. Engines at full thrust. The runway is disappearing."',
    body: [
      'V1. No turning back. The engines are at full thrust, the runway is disappearing beneath you, and the nose is beginning to lift. You\'ve committed to the flight.',
      'At this stage, automated gates mean new IaC can\'t bypass the checklist. WAF++ is running in CI/CD. Every pull request goes through the same controls your production environment enforces. The ground crew doesn\'t just check the aircraft before each flight — they\'re embedded in the engineering process.',
      'Compliance frameworks are no longer aspirational — GDPR and ISO 27001 coverage is measurable, reportable, and mapped. Auditors get a PDF. Engineers get a CI gate.',
    ],
    priority: [
      'Integrate wafpass check into CI/CD — fail pipelines on critical findings',
      'Upgrade maturity level in Settings — unlock blast radius and advanced controls',
      'Map compliance frameworks — run the Compliance Matrix export for GDPR, ISO 27001',
      'Multi-region deployment strategies — single region is a single point of failure',
      'Implement cost anomaly detection — unexpected spend is often the first signal of a compromise',
    ],
    links: [{ label: 'Compliance Matrix →', page: 'compliance' }, { label: 'Settings →', page: 'settings' }],
  },
  {
    quote: '"35,000 feet. Autopilot engaged. Coffee is being served in business class."',
    body: [
      'Altitude captured. Autopilot engaged. Your infrastructure is being actively monitored, risks are formally accepted and documented, and new deployments are gated against the control library. You are, in aviation terms, en route.',
      'The difference between here and the previous stage isn\'t just score — it\'s culture. Security has moved left. It\'s not a review at the end of the sprint; it\'s a constraint at the beginning. Engineers ask "does this pass the WAF?" before they write the Terraform.',
      'Sovereignty controls are active. You know exactly where your data lives and why. Carbon tracking gives you a second metric to optimize around. Performance baselines exist.',
    ],
    priority: [
      'Activate higher maturity level — enable Auto-Fix, carbon tracking, full pillar coverage',
      'Data residency controls — ensure all PII/sensitive data has explicit region locking',
      'Performance right-sizing — over-provisioned resources are wasted budget and attack surface',
      'BSI C5 and EUCS coverage — prepare for European regulatory requirements proactively',
      'Architect the Sandbox test suite — run new patterns through the sandbox before deploying',
    ],
    links: [{ label: 'Architect Sandbox →', page: 'sandbox' }, { label: 'Deployed Regions →', page: 'regions' }],
  },
  {
    quote: '"Flaps down. ILS locked. ATC cleared you for landing. You\'ve earned your PASS."',
    body: [
      'Flaps down. Landing gear extended. ILS signal locked. ATC has cleared you for landing. Your security posture is optimized — the controls are green, the waivers are documented, the compliance matrix is mapped, and the risk register is current.',
      'You\'ve earned your WAF++ PASS. This is what a cleared aircraft looks like: every system checked, every risk formally acknowledged, every framework covered. Security is not something that happens to your infrastructure — it\'s something your infrastructure is.',
      'The runway is behind you. The hangar is a distant memory. The only remaining flight plan is continuous improvement — because the destination is a standard, not a location.',
    ],
    priority: [
      'All critical and high controls passing — zero unacknowledged critical findings',
      'All compliance frameworks mapped and reportable',
      'Risk acceptance register complete — every accepted risk has an owner, RFC, and expiry',
      'Continuous scanning in CI/CD — no deployment lands without a passing WAF score',
      'L5 Excellence active — carbon tracking, sustainability pillar, full multi-cloud intelligence',
    ],
    links: [{ label: 'View Dashboard →', page: 'dashboard' }, { label: 'Evidence Package →', page: 'evidence' }],
  },
]

interface StageCardProps {
  idx: number
  currentStage: number
  expanded: boolean
  onToggle: () => void
  onNav: (p: Page) => void
}

function StageCard({ idx, currentStage, expanded, onToggle, onNav }: StageCardProps) {
  const { t } = useI18n()
  const meta = STAGE_META[idx]
  const story = STAGE_STORY[idx]
  const isHere = idx === currentStage
  const isCleared = idx < currentStage

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${meta.color}`, borderRadius: 12, overflow: 'hidden',
    }}>
      <div onClick={onToggle} style={{ cursor: 'pointer', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `${meta.color}18`, border: `1.5px solid ${meta.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('pages.maturityJourney.stageTitle', { idx: String(idx), label: meta.label })}
            </span>
            <Pill color={meta.color} bg={`${meta.color}15`} border={`${meta.color}35`}>{meta.range} pts</Pill>
            {isHere && <Pill color="#60a5fa" bg="rgba(0,148,255,0.12)" border="rgba(0,148,255,0.3)">{t('pages.maturityJourney.youAreHere')}</Pill>}
            {isCleared && <Pill color="#34d399" bg="rgba(5,150,105,0.12)" border="rgba(5,150,105,0.3)">{t('pages.maturityJourney.clearedLabel')}</Pill>}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>{story.quote}</div>
        </div>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink: 0, color: '#64748b', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: meta.color, marginBottom: '0.5rem' }}>{t('pages.maturityJourney.theSituation')}</div>
              {story.body.map((p, i) => (
                <p key={i} style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: i < story.body.length - 1 ? '0.6rem' : 0 }}>{p}</p>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: meta.color, marginBottom: '0.5rem' }}>
                {idx === 5 ? t('pages.maturityJourney.excellenceStandard') : t('pages.maturityJourney.priorityControls')}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {story.priority.map((item, i) => (
                  <li key={i} style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ color: idx === 5 ? '#059669' : meta.color, flexShrink: 0, marginTop: 2 }}>{idx === 5 ? '✓' : '▸'}</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {story.links.map(link => (
                  <button key={link.page} onClick={e => { e.stopPropagation(); onNav(link.page) }}
                    style={{
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      padding: '0.3rem 0.75rem', borderRadius: 6,
                      background: 'transparent',
                      color: meta.color,
                      border: `1px solid ${meta.color}80`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${meta.color}18`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MaturityJourneyPage({
  run, maturityLevel, waiverCount, riskCount, navigate,
}: MaturityJourneyPageProps) {
  const { t } = useI18n()
  const score = run?.score ?? 0
  const currentStage = stageFor(score)
  const [expandedStage, setExpandedStage] = useState<number | null>(null)
  const matMeta = getMaturityMeta(maturityLevel)

  // Unique failing controls sorted by severity
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const failingControls = run
    ? [...new Map(
        run.findings
          .filter(f => f.status?.toUpperCase() === 'FAIL')
          .sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))
          .map(f => [f.control_id, f])
      ).values()].slice(0, 6)
    : []

  // Unique passing control IDs
  const passIds = run
    ? new Set(run.findings.filter(f => f.status?.toUpperCase() === 'PASS').map(f => f.control_id))
    : new Set<string>()

  // Dynamic frameworks from controls_meta
  const allFrameworks = run
    ? [...new Set(run.controls_meta.flatMap(c => c.regulatory_mapping?.map(r => r.framework) ?? []))]
        .filter(Boolean).sort()
    : []

  const frameworkStats = allFrameworks.map(fw => {
    const fwControls = run!.controls_meta.filter(c => c.regulatory_mapping?.some(r => r.framework === fw))
    const passing = fwControls.filter(c => passIds.has(c.id)).length
    const pct = fwControls.length ? Math.round(passing / fwControls.length * 100) : 0
    return { name: fw, total: fwControls.length, passing, pct }
  })

  const PILLARS = ['security', 'reliability', 'cost', 'operations', 'sovereign', 'sustainability', 'performance']
  const pillarStats = PILLARS.map(p => {
    const pControls = run?.controls_meta.filter(c => c.pillar === p) ?? []
    if (!pControls.length) return { name: p, total: 0, passing: 0, pct: 0 }
    const passing = pControls.filter(c => passIds.has(c.id)).length
    return { name: p, total: pControls.length, passing, pct: Math.round(passing / pControls.length * 100) }
  })

  const planePct   = [4, 18, 34, 52, 69, 86][currentStage]
  const planeTopPct = [72, 58, 44, 30, 20, 15][currentStage]
  const stageProgressWidth = [0, 20, 40, 60, 80, 97][currentStage]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 16, overflow: 'hidden', position: 'relative', minHeight: 220,
        background: 'linear-gradient(135deg, #070a12 0%, #0a1628 50%, #0d1f3c 100%)',
        border: '1px solid rgba(0,148,255,0.2)',
      }}>
        {/* Star field dots */}
        {[[8,12],[15,60],[25,35],[40,8],[55,70],[65,25],[72,55],[82,18],[90,65],[95,40]].map(([x, y], i) => (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y}%`,
            width: i % 3 === 0 ? 2 : 1, height: i % 3 === 0 ? 2 : 1,
            borderRadius: '50%', background: 'rgba(255,255,255,0.4)',
          }} />
        ))}

        {/* Flight path SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 900 240" preserveAspectRatio="xMidYMid meet" fill="none">
          <path d="M 70 195 Q 220 175 330 138 Q 480 90 630 68 Q 720 58 800 54"
            stroke="rgba(0,148,255,0.25)" strokeWidth="1.5" strokeDasharray="8 5" />
          {([
            [70, 195], [196, 170], [335, 136], [494, 93], [632, 68], [800, 54],
          ] as [number, number][]).map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i === currentStage ? 7 : 5}
              fill={i <= currentStage ? STAGE_META[i].color : 'rgba(71,85,105,0.5)'}
              opacity={i < currentStage ? 0.6 : 1}
              stroke={i === currentStage ? 'rgba(255,255,255,0.4)' : 'none'} strokeWidth={2} />
          ))}
          {/* Destination star */}
          <polygon points="800,42 803,50 812,50 805,55 808,64 800,58 792,64 795,55 788,50 797,50"
            fill="rgba(255,207,99,0.85)" />
        </svg>

        {/* Plane — positioned along path */}
        <div style={{
          position: 'absolute',
          left: `${planePct}%`, top: `${planeTopPct}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 1.4s cubic-bezier(.34,1.4,.64,1), top 1.4s cubic-bezier(.34,1.4,.64,1)',
        }}>
          <PlaneIcon size={52} glow />
        </div>

        {/* Text content */}
        <div style={{ position: 'relative', zIndex: 1, padding: '1.75rem 2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.3)',
            borderRadius: 999, padding: '0.2rem 0.75rem', marginBottom: '0.75rem',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0094FF', boxShadow: '0 0 5px #0094FF', display: 'inline-block' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              {t('pages.maturityJourney.hero')}
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.35rem', lineHeight: 1.2 }}>
            {t('pages.maturityJourney.yourJourney')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 460, lineHeight: 1.65, margin: '0 0 1.25rem' }}>
            {t('pages.maturityJourney.heroParagraph')}
          </p>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            {[
              { label: t('pages.maturityJourney.currentAltitude'), value: run ? `${score} / 100` : t('pages.maturityJourney.noScanYet'), color: run ? scoreColor(score) : '#64748b' },
              { label: t('pages.maturityJourney.flightStage'),     value: STAGE_META[currentStage].label,           color: STAGE_META[currentStage].color },
              { label: t('pages.maturityJourney.maturityLevel'),   value: matMeta.short,                            color: matMeta.textColor },
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '0.45rem 0.875rem', backdropFilter: 'blur(4px)',
              }}>
                <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.2rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Boarding Pass ──────────────────────────────────────────────────────── */}
      {run && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          display: 'flex', overflow: 'hidden',
        }}>
          {/* Left panel */}
          <div style={{ flex: 1, padding: '1.25rem 1.5rem', borderRight: '2px dashed rgba(0,148,255,0.2)' }}>
            <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              {t('pages.maturityJourney.boardingPass')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{t('pages.maturityJourney.from')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>LGCY</div>
                <div style={{ fontSize: '0.68rem', color: '#475569' }}>{t('pages.maturityJourney.legacyLabel')}</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 4 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <div>
                <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{t('pages.maturityJourney.to')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.04em' }}>EXCL</div>
                <div style={{ fontSize: '0.68rem', color: '#475569' }}>{t('pages.maturityJourney.excellenceLabel')}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                { label: t('pages.maturityJourney.bpProject'),  value: run.project || run.path.split('/').pop() || '—' },
                { label: t('pages.maturityJourney.bpMaturity'), value: matMeta.label },
                { label: t('pages.maturityJourney.bpScore'),    value: `${score} pts`, color: scoreColor(score) },
                { label: t('pages.maturityJourney.bpControls'), value: `${passIds.size} / ${run.controls_loaded}` },
                { label: t('pages.maturityJourney.bpWaivers'),  value: String(waiverCount) },
                { label: t('pages.maturityJourney.bpRisk'),     value: String(riskCount) },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: item.color || 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right stub */}
          <div style={{ width: 148, padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '0.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Flight No.</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#60a5fa', letterSpacing: '0.05em' }}>WAF-PASS</div>
              <div style={{ fontSize: '0.62rem', color: '#475569', marginTop: '0.15rem' }}>
                {new Date(run.created_at).toLocaleDateString()}
              </div>
            </div>
            {/* Barcode decoration */}
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              {[18, 12, 22, 8, 16, 20, 10, 24, 14, 8, 18, 12, 22, 6, 20, 14, 10, 18].map((h, i) => (
                <div key={i} style={{
                  width: 2, height: h, borderRadius: 1,
                  background: i % 5 === 0 ? 'rgba(0,148,255,0.7)' : 'rgba(100,116,139,0.4)',
                }} />
              ))}
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{
                display: 'inline-block', padding: '0.18rem 0.65rem', borderRadius: 999,
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                background: score >= 80 ? 'rgba(5,150,105,0.2)' : score >= 60 ? 'rgba(217,119,6,0.2)' : 'rgba(218,44,56,0.2)',
                color:      score >= 80 ? '#34d399'              : score >= 60 ? '#fbbf24'              : '#f87171',
                border:     `1px solid ${score >= 80 ? 'rgba(52,211,153,0.3)' : score >= 60 ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)'}`,
              }}>
                {score >= 80 ? t('pages.maturityJourney.cleared') : score >= 60 ? t('pages.maturityJourney.boarding') : t('pages.maturityJourney.grounded')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No-scan placeholder */}
      {!run && (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16, textAlign: 'center', padding: '2.5rem' }}>
          <PlaneIcon size={40} />
          <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, margin: '0.75rem 0 0.25rem' }}>{t('pages.maturityJourney.hangar')}</p>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '1rem' }}>{t('pages.maturityJourney.hangarDesc')}</p>
          <button onClick={() => navigate('runscan')} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>{t('pages.maturityJourney.runFirstScan')}</button>
        </div>
      )}

      {/* ── Flight Map ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>{t('pages.maturityJourney.flightMap')}</h3>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem' }}>{t('pages.maturityJourney.flightMapDesc')}</p>
        <div style={{ position: 'relative', padding: '0 1rem' }}>
          {/* Track */}
          <div style={{ position: 'absolute', top: 20, left: '5%', right: '5%', height: 2, background: 'var(--border)', borderRadius: 1 }} />
          {/* Progress */}
          <div style={{
            position: 'absolute', top: 20, left: '5%', height: 2,
            background: `linear-gradient(90deg, ${STAGE_META[0].color}, ${STAGE_META[currentStage].color})`,
            borderRadius: 1, transition: 'width 1.2s ease',
            width: `${stageProgressWidth * 0.9}%`,
          }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', position: 'relative', zIndex: 2 }}>
            {STAGE_META.map((s, idx) => {
              const isHere = idx === currentStage
              const isPast = idx < currentStage
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.4rem' }}
                  onClick={() => setExpandedStage(expandedStage === idx ? null : idx)}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                    border: `2px solid ${idx <= currentStage ? s.color : 'rgba(71,85,105,0.4)'}`,
                    background: isPast ? `${s.color}30` : isHere ? `${s.color}18` : 'transparent',
                    boxShadow: isHere ? `0 0 0 4px ${s.color}20, 0 0 14px ${s.color}40` : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {isPast ? (
                      <svg width="16" height="16" fill="none" stroke={s.color} strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{s.icon}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.25, color: idx <= currentStage ? s.color : '#475569' }}>{s.label}</div>
                    <div style={{ fontSize: '0.58rem', color: '#475569' }}>{s.range} pts</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Stage Story Cards ──────────────────────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>{t('pages.maturityJourney.stageStories')}</h3>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.875rem' }}>{t('pages.maturityJourney.stageStoriesDesc')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {STAGE_META.map((_, idx) => (
            <StageCard key={idx} idx={idx} currentStage={currentStage}
              expanded={expandedStage === idx}
              onToggle={() => setExpandedStage(expandedStage === idx ? null : idx)}
              onNav={navigate} />
          ))}
        </div>
      </div>

      {/* ── Project Passport ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>{t('pages.maturityJourney.projectPassport')}</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>{t('pages.maturityJourney.passportDesc')}</p>
          </div>
          <button onClick={() => navigate('compliance')} className="btn btn-outline" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{t('pages.maturityJourney.fullMatrix')}</button>
        </div>

        {/* Framework stamps */}
        {frameworkStats.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              {t('pages.maturityJourney.complianceFrameworks')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
              {frameworkStats.map(fw => {
                const color = fw.pct >= 80 ? '#059669' : fw.pct >= 50 ? '#eab308' : '#64748b'
                const bg    = fw.pct >= 80 ? 'rgba(5,150,105,0.08)' : fw.pct >= 50 ? 'rgba(234,179,8,0.07)' : 'rgba(71,85,105,0.05)'
                const bdr   = fw.pct >= 80 ? 'rgba(5,150,105,0.4)' : fw.pct >= 50 ? 'rgba(234,179,8,0.35)' : 'rgba(71,85,105,0.25)'
                return (
                  <div key={fw.name} style={{ borderRadius: 12, padding: '0.75rem 1rem', minWidth: 120, flex: '1 1 120px', maxWidth: 180, background: bg, border: `1.5px solid ${bdr}`, position: 'relative' }}>
                    {fw.pct >= 80 && (
                      <div style={{ position: 'absolute', top: 6, right: 6 }}>
                        <svg width="13" height="13" fill="none" stroke="#34d399" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color, marginBottom: '0.4rem' }}>{fw.name}</div>
                    <div style={{ height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: '0.35rem' }}>
                      <div style={{ height: '100%', width: `${fw.pct}%`, background: color, borderRadius: 999, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color }}>{fw.pct}%</div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{t('pages.maturityJourney.controlsOf', { passing: String(fw.passing), total: String(fw.total) })}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No frameworks yet */}
        {!run && (
          <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', marginBottom: '1.25rem' }}>
            {t('pages.maturityJourney.noFrameworks')}
          </div>
        )}

        {/* Pillar stamps */}
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            {t('pages.maturityJourney.infraPillars')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.5rem' }}>
            {pillarStats.map(p => {
              const color = p.pct >= 80 ? '#059669' : p.pct >= 60 ? '#eab308' : '#ef4444'
              return (
                <div key={p.name} style={{
                  borderRadius: 10, padding: '0.625rem 0.75rem',
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  border: `1px solid ${p.pct >= 80 ? 'rgba(5,150,105,0.35)' : 'var(--border)'}`,
                  background: p.pct >= 80 ? 'rgba(5,150,105,0.05)' : 'transparent',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color }}>{p.name.slice(0, 3).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)', marginBottom: 3 }}>{p.name}</div>
                    <div style={{ height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.pct}%`, background: color, borderRadius: 999, transition: 'width 1s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.62rem', marginTop: 3, color }}>
                      {p.total > 0 ? `${p.pct}% (${p.passing}/${p.total})` : t('pages.maturityJourney.noControls')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Next Waypoints ─────────────────────────────────────────────────────── */}
      {failingControls.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>{t('pages.maturityJourney.nextWaypoints')}</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>{t('pages.maturityJourney.nextWaypointsDesc')}</p>
            </div>
            <button onClick={() => navigate('findings')} className="btn btn-outline" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{t('pages.maturityJourney.allFindings')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {failingControls.map(f => {
              const sevColor = ({ critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' } as Record<string, string>)[f.severity] || '#64748b'
              return (
                <div key={f.control_id}
                  onClick={() => navigate('findings')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.75rem 1rem', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'transparent',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,148,255,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '' }}>
                  <div style={{ width: 4, height: 40, borderRadius: 2, flexShrink: 0, background: sevColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>{f.control_id}</span>
                      <Pill color={sevColor} bg={`${sevColor}18`} border={`${sevColor}35`}>{f.severity}</Pill>
                      <Pill color="#94a3b8" bg="rgba(71,85,105,0.12)" border="rgba(71,85,105,0.2)">{f.pillar}</Pill>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.check_title}
                    </div>
                  </div>
                  <svg width="15" height="15" fill="none" stroke="#475569" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {run && failingControls.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
          <svg style={{ display: 'block', margin: '0 auto 0.5rem' }} width="30" height="30" fill="none" stroke="#34d399" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#34d399', margin: '0 0 0.2rem' }}>{t('pages.maturityJourney.noWaypoints')}</p>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>{t('pages.maturityJourney.finalApproach')}</p>
        </div>
      )}

      {/* ── Flight Manual ───────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.5rem' }}>
          {[
            {
              ch: 'Chapter 1', title: 'Why This Journey Matters',
              body: 'Cloud security isn\'t a checklist you complete once. It\'s an operating standard you maintain continuously. The WAF++ control library encodes collective knowledge of cloud security into executable, automatable checks. Each control represents a class of attack, a compliance requirement, or an operational failure mode that has been observed, documented, and encoded into policy.',
            },
            {
              ch: 'Chapter 2', title: 'How Scoring Works',
              body: 'The score is weighted by severity. Critical findings carry 10× the weight of low findings. A single unpatched critical IAM misconfiguration suppresses the score more than ten low-severity tagging violations. This is intentional — not all risks are equal. Fix critical controls first. The score will follow.',
            },
            {
              ch: 'Chapter 3', title: 'When to Accept Risk',
              body: 'Not every control can be immediately remediated. Legacy systems, vendor constraints, and architectural trade-offs are real. The WAF++ risk acceptance workflow exists precisely for these cases — document the risk, name the approver, set an expiry. A waiver with an owner and a date is infinitely better than an undocumented deviation.',
            },
          ].map(item => (
            <div key={item.ch}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                {t('pages.maturityJourney.flightManual', { chapter: item.ch })}
              </div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.4rem' }}>{item.title}</h4>
              <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
