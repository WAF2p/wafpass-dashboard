/**
 * Access & Roles — role-based navigation model and planned auth integrations.
 * Layout mirrors the compact full-width grid used by the rest of the dashboard.
 */

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'clevel',
    label: 'C-Level',
    subtitle: 'CEO · COO · CFO · CTO · Board',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.30)',
    access: 'Read-only',
    accessColor: '#64748b',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    description: 'Strategic leadership. Business risk posture, regulatory status, financial impact, and board-level compliance reporting.',
    pages: [
      { name: 'Dashboard',         note: 'Overall WAF++ risk posture' },
      { name: 'Compliance Matrix',  note: 'Regulatory framework coverage' },
      { name: 'Cost Impact',        note: 'Financial exposure from failing controls' },
      { name: 'Gap Analysis',       note: 'Shortest path to full compliance' },
    ],
    restriction: 'No scan or remediation actions.',
  },
  {
    id: 'ciso',
    label: 'CISO',
    subtitle: 'Chief Information Security Officer',
    color: '#0094ff',
    bg: 'rgba(0,148,255,0.08)',
    border: 'rgba(0,148,255,0.28)',
    access: 'Governance R/W',
    accessColor: '#0094ff',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
    description: 'Security governance and accountability. Manages risk decisions, waiver approvals, and audit evidence for compliance frameworks.',
    pages: [
      { name: 'Risk Acceptance',   note: 'Formal risk decisions with approver & expiry' },
      { name: 'Waivers',           note: 'Suppress controls with justification' },
      { name: 'Skipped Controls',  note: 'Coverage gap visibility' },
      { name: 'Audit Log',         note: 'Tamper-evident governance record' },
      { name: 'Evidence Package',  note: 'SOC2 / ISO27001 artifacts' },
      { name: 'Deployed Regions',  note: 'Data residency & sovereignty' },
    ],
    restriction: 'Cannot trigger scans.',
  },
  {
    id: 'architect',
    label: 'Architect',
    subtitle: 'Solutions · Cloud · Platform Architect',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.28)',
    access: 'Design R/W',
    accessColor: '#8b5cf6',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    description: 'Infrastructure design. Control coverage, resource topology, attack surfaces, and module-level compliance for architecture decisions.',
    pages: [
      { name: 'Controls Catalogue', note: 'Browse, filter & author controls' },
      { name: 'Exploit Paths',      note: 'Attack chain from internet surfaces' },
      { name: 'Blast Radius',       note: 'Failure propagation analysis' },
      { name: 'Dependency Graph',   note: 'Full resource topology' },
      { name: 'Module Scores',      note: 'Per-module pass rate & score drag' },
      { name: 'Changes & Drift',    note: 'Plan changes and control regressions' },
      { name: 'Sandbox',            note: 'Live HCL evaluation' },
    ],
    restriction: 'Cannot approve governance records.',
  },
  {
    id: 'engineer',
    label: 'Engineer',
    subtitle: 'DevOps · DevSecOps · Platform · App Engineer',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.28)',
    access: 'Full Scan R/W',
    accessColor: '#22c55e',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    description: 'Hands-on engineering. Fix prioritisation, secret hygiene, and the full scan lifecycle from trigger to resolution.',
    pages: [
      { name: 'Findings',           note: 'Per-check results with remediation' },
      { name: 'Secret Scanner',     note: 'Hardcoded credentials in IaC' },
      { name: 'Remediation Sprint', note: 'Prioritised fix queue' },
      { name: 'Run Scan',           note: 'Trigger scans or generate CLI command' },
      { name: 'Run History',        note: 'All recorded runs with stage & branch' },
      { name: 'Run Comparison',     note: 'Finding-level diff between runs' },
    ],
    restriction: 'Cannot approve risk acceptances or generate evidence packages.',
  },
]

// ── Auth providers ────────────────────────────────────────────────────────────

const AUTH_PROVIDERS = [
  {
    id: 'entraid',
    label: 'Microsoft Entra ID',
    sublabel: 'Azure AD · Microsoft 365',
    color: '#0078d4',
    bg: 'rgba(0,120,212,0.08)',
    border: 'rgba(0,120,212,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    protocol: 'OAuth 2.0 · OIDC',
    notes: ['Group → role mapping via tenant config', 'MFA & Conditional Access support', 'Service principal for CI/CD pipelines'],
  },
  {
    id: 'localdc',
    label: 'Local Domain Controller',
    sublabel: 'Active Directory · LDAP / Kerberos',
    color: '#475569',
    bg: 'rgba(71,85,105,0.08)',
    border: 'rgba(71,85,105,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    protocol: 'LDAPS · Kerberos',
    notes: ['LDAP over TLS with certificate pinning', 'AD security group → role mapping', 'Kerberos pass-through for domain clients'],
  },
  {
    id: 'keycloak',
    label: 'Keycloak',
    sublabel: 'Self-hosted OIDC / SAML Identity Provider',
    color: '#4a90d9',
    bg: 'rgba(74,144,217,0.08)',
    border: 'rgba(74,144,217,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l10 6v8l-10 6L2 16V8l10-6z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    protocol: 'OIDC · SAML 2.0',
    notes: ['Realm role → WAF++ role via JWT claims', 'SAML 2.0 fallback for legacy IdP federations', 'Client credentials for service accounts'],
  },
]

// ── Implementation notes ──────────────────────────────────────────────────────

const IMPL_NOTES = [
  { label: 'Role claim source',     body: 'Roles come from the IdP — JWT claim, LDAP group, or SAML attribute. Mapping from IdP group to WAF++ role is configured server-side and requires no frontend deploy to change.' },
  { label: 'Enforcement boundary',  body: 'wafpass-server enforces roles via middleware on every request. The dashboard reflects roles returned by the server after token exchange — no role logic lives in the frontend.' },
  { label: 'Session model',         body: 'Short-lived JWT access tokens (15 min) with silent refresh. Tokens are stored in memory only — not localStorage — to reduce XSS exposure.' },
  { label: 'Multi-provider',        body: 'One primary provider per deployment, configured via environment variables. Provider federation (e.g. Entra ID + Keycloak in parallel) is out of scope for v1.' },
  { label: 'Service accounts',      body: 'CI/CD pipelines use client credentials grant or API keys scoped to the Engineer role, bypassing the interactive browser login flow entirely.' },
  { label: 'Current state',         body: 'Authentication is not enforced yet. All pages are visible to everyone. This page is the living spec the future login implementation targets.' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccessRolesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Top banner ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1.1rem', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(0,148,255,0.07) 0%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(0,148,255,0.22)',
      }}>
        <div style={{
          flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px',
          background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0094ff',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
            Role-based access — currently informational.{' '}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Navigation is already organised by role. Authentication and access enforcement are on the roadmap. All pages are currently visible to everyone — this page is the living spec for the future login implementation.
          </span>
        </div>
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center',
          padding: '0.18rem 0.65rem', borderRadius: '999px',
          background: 'rgba(100,116,139,0.12)', color: '#64748b',
          fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap',
        }}>
          Auth: Roadmap
        </span>
      </div>

      {/* ── Roles & Navigation Access ──────────────────────────────────────── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
          Roles &amp; Navigation Access
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {ROLES.map(role => (
            <div key={role.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* Role header */}
              <div style={{
                padding: '0.75rem 0.875rem',
                background: role.bg,
                borderBottom: `1px solid ${role.border}`,
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              }}>
                <div style={{
                  flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.7)', border: `1px solid ${role.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: role.color,
                }}>
                  {role.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: role.color }}>{role.label}</span>
                    <span style={{
                      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '999px',
                      background: `${role.accessColor}18`, color: role.accessColor,
                      fontWeight: 600, fontSize: '0.65rem', whiteSpace: 'nowrap',
                    }}>
                      {role.access}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem', lineHeight: 1.3 }}>{role.subtitle}</div>
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '0.6rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.5 }}>{role.description}</p>
              </div>

              {/* Page list */}
              <div style={{ flex: 1, padding: '0.5rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {role.pages.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <svg width="10" height="10" fill="none" stroke={role.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.note}</span>
                  </div>
                ))}
              </div>

              {/* Footer restriction */}
              <div style={{
                padding: '0.4rem 0.875rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: '0.69rem', color: 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {role.restriction}
              </div>

            </div>
          ))}
        </div>
      </section>

      {/* ── Auth providers + Impl notes side-by-side ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>

        {/* Auth providers */}
        <section>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            Planned Authentication Providers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {AUTH_PROVIDERS.map(p => (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                  padding: '0.65rem 0.875rem',
                  borderBottom: '1px solid var(--border)',
                  background: p.bg,
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                }}>
                  <div style={{
                    flexShrink: 0, width: '30px', height: '30px', borderRadius: '7px',
                    background: 'rgba(255,255,255,0.65)', border: `1px solid ${p.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color,
                  }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.83rem', color: p.color }}>{p.label}</span>
                      <span style={{
                        display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '999px',
                        background: 'rgba(100,116,139,0.10)', color: '#64748b',
                        fontWeight: 600, fontSize: '0.62rem',
                      }}>
                        Roadmap
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{p.sublabel} · <strong style={{ color: 'var(--text)' }}>{p.protocol}</strong></div>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: '0.5rem 0.875rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                  {p.notes.map(note => (
                    <li key={note} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text)' }}>
                      <span style={{ flexShrink: 0, color: p.color, fontWeight: 700, lineHeight: 1.4 }}>›</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Implementation notes */}
        <section>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
            Implementation Notes
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {IMPL_NOTES.map((note, i) => (
              <div key={note.label} style={{
                display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.75rem',
                padding: '0.65rem 0.875rem',
                borderBottom: i < IMPL_NOTES.length - 1 ? '1px solid var(--border)' : undefined,
                alignItems: 'start',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', paddingTop: '0.05rem', lineHeight: 1.35 }}>
                  {note.label}
                </div>
                <div style={{ fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {note.body}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

    </div>
  )
}
