/**
 * Access & Roles — role definitions and auth provider roadmap.
 * User management and API key management are on their own pages.
 */
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'

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
    restriction: 'Cannot approve risk acceptances or manage users.',
  },
  {
    id: 'admin',
    label: 'Admin',
    subtitle: 'System Administrator',
    color: '#DA2C38',
    bg: 'rgba(218,44,56,0.08)',
    border: 'rgba(218,44,56,0.30)',
    access: 'Full Access',
    accessColor: '#DA2C38',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M16 11l1.5 1.5L21 9" />
      </svg>
    ),
    description: 'Full system access plus user lifecycle management. Exclusive right to create accounts, reset passwords, assign any role, and grant or revoke admin privileges.',
    pages: [
      { name: 'All pages',        note: 'Inherits full engineer access' },
      { name: 'User Management',  note: 'Create, edit, activate/deactivate, delete users' },
      { name: 'API Keys',         note: 'Generate and revoke CI/CD service keys' },
      { name: 'SSO Settings',     note: 'Configure OIDC and SAML2 providers' },
      { name: 'Role Assignment',  note: 'Exclusive right to grant the admin role' },
    ],
    restriction: 'Only admins can modify other admin accounts.',
  },
]

// ── Auth providers ────────────────────────────────────────────────────────────

const AUTH_PROVIDERS = [
  {
    id: 'local',
    label: 'Local accounts',
    sublabel: 'Username + bcrypt password',
    status: 'live' as const,
    statusLabel: 'Live',
    statusColor: '#22c55e',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    protocol: 'Local · JWT',
    notes: ['Admin-created accounts stored in the users table', 'bcrypt password hashing with configurable rounds', 'Always available alongside any SSO provider'],
  },
  {
    id: 'oidc',
    label: 'OpenID Connect',
    sublabel: 'Entra ID · Keycloak · Okta · Auth0 · Google',
    status: 'live' as const,
    statusLabel: 'Live',
    statusColor: '#22c55e',
    color: '#0094ff',
    bg: 'rgba(0,148,255,0.08)',
    border: 'rgba(0,148,255,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    protocol: 'OAuth 2.0 · OIDC',
    notes: ['Authorization Code flow with discovery endpoint', 'JWT claim → WAF++ role mapping (configurable)', 'Auto-provisioning of new users on first login'],
  },
  {
    id: 'saml2',
    label: 'SAML 2.0',
    sublabel: 'ADFS · Keycloak · Azure AD · Okta · any SAML IdP',
    status: 'live' as const,
    statusLabel: 'Live',
    statusColor: '#22c55e',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
    protocol: 'SAML 2.0',
    notes: ['HTTP-Redirect binding for AuthnRequests', 'SAML attribute → WAF++ role mapping (configurable)', 'SP metadata endpoint for IdP registration'],
  },
  {
    id: 'ldap',
    label: 'Local Domain Controller',
    sublabel: 'Active Directory · LDAP / Kerberos',
    status: 'roadmap' as const,
    statusLabel: 'Roadmap',
    statusColor: '#64748b',
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
]

// ── Implementation notes ──────────────────────────────────────────────────────

const IMPL_NOTES = [
  { label: 'Current state',         body: 'Phase 2 live — local JWT auth plus OIDC and SAML2 SSO. SSO providers are configured in the admin SSO Settings page and stored in the database. Local accounts remain available alongside SSO.' },
  { label: 'SSO token handoff',     body: 'After SSO authentication the server issues a standard WAF++ JWT and redirects to the dashboard with tokens in query params. The frontend stores them in localStorage — the session model is identical to local login.' },
  { label: 'Role claim source',     body: 'For local accounts, roles are stored in the users table. For OIDC/SAML2, an optional role claim/attribute is mapped server-side via a JSON mapping table configured in SSO Settings.' },
  { label: 'Enforcement boundary',  body: 'wafpass-server enforces roles via middleware on every request. The dashboard reflects roles returned by the server after token exchange — no role logic lives in the frontend.' },
  { label: 'Session model',         body: 'Short-lived JWT access tokens (60 min default) with silent refresh via a long-lived refresh token. Both stored in localStorage for session persistence across page reloads.' },
  { label: 'Multi-provider',        body: 'OIDC and SAML2 can be enabled simultaneously alongside local accounts. LDAP federation is planned for a future release.' },
  { label: 'Service accounts',      body: 'CI/CD pipelines use the X-Api-Key header. Admin users can generate per-service keys in the API Keys page. A legacy global key can also be set via WAFPASS_API_KEY on the server.' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccessRolesPage() {
  const { role } = useAuth()
  const { t } = useI18n()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Top banner ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1.1rem', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(0,148,255,0.05) 100%)',
        border: '1px solid rgba(34,197,94,0.22)',
      }}>
        <div style={{
          flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a',
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
            {t('pages.access.bannerTitle')}{' '}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {t('pages.access.bannerText')}
            {role === 'admin' && <strong>{t('pages.access.bannerAdminText')}</strong>}
          </span>
        </div>
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center',
          padding: '0.18rem 0.65rem', borderRadius: '999px',
          background: 'rgba(34,197,94,0.12)', color: '#16a34a',
          fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap',
          border: '1px solid rgba(34,197,94,0.25)',
        }}>
          {t('pages.access.bannerBadge')}
        </span>
      </div>

      {/* ── Roles & Navigation Access ──────────────────────────────────────── */}
      <section>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
          {t('pages.access.rolesHeader')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
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
            {t('pages.access.authProvidersHeader')}
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
                        background: `${p.statusColor}18`, color: p.statusColor,
                        fontWeight: 600, fontSize: '0.62rem',
                      }}>
                        {p.statusLabel}
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
            {t('pages.access.implNotesHeader')}
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
