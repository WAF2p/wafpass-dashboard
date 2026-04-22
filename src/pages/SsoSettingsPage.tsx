import { useEffect, useState } from 'react'
import { deleteSsoConfig, fetchSsoConfigs, upsertSsoConfig, type SsoConfigOut } from '../api'

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '0.63rem', color: 'var(--muted)', opacity: 0.75 }}>{hint}</div>}
    </div>
  )
}

const inputSx: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '6px',
  padding: '0.35rem 0.65rem', fontSize: '0.8rem',
  fontFamily: 'inherit',
}

const textareaSx: React.CSSProperties = {
  ...inputSx,
  minHeight: '70px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.72rem',
}

// ── OIDC section ──────────────────────────────────────────────────────────────

const OIDC_DEFAULTS = {
  discovery_url: '',
  authorization_endpoint: '',
  client_id: '',
  client_secret: '',
  redirect_uri: '',
  frontend_url: 'http://localhost:5173',
  scopes: 'openid profile email',
  username_claim: 'email',
  display_name_claim: 'name',
  default_role: 'clevel',
  role_claim: '',
  role_mapping_raw: '',
  auto_provision: true,
}

function toOidcForm(config: Record<string, unknown>) {
  return {
    discovery_url:          String(config.discovery_url ?? ''),
    authorization_endpoint: String(config.authorization_endpoint ?? ''),
    client_id:              String(config.client_id ?? ''),
    client_secret:    String(config.client_secret ?? ''),
    redirect_uri:     String(config.redirect_uri ?? ''),
    frontend_url:     String(config.frontend_url ?? 'http://localhost:5173'),
    scopes:           Array.isArray(config.scopes) ? (config.scopes as string[]).join(' ') : String(config.scopes ?? 'openid profile email'),
    username_claim:   String(config.username_claim ?? 'email'),
    display_name_claim: String(config.display_name_claim ?? 'name'),
    default_role:     String(config.default_role ?? 'clevel'),
    role_claim:       String(config.role_claim ?? ''),
    role_mapping_raw: config.role_mapping ? JSON.stringify(config.role_mapping, null, 2) : '',
    auto_provision:   config.auto_provision !== false,
  }
}

function fromOidcForm(f: typeof OIDC_DEFAULTS): Record<string, unknown> {
  const out: Record<string, unknown> = {
    discovery_url:      f.discovery_url.trim(),
    client_id:          f.client_id.trim(),
    client_secret:      f.client_secret.trim(),
    redirect_uri:       f.redirect_uri.trim(),
    frontend_url:       f.frontend_url.trim(),
    scopes:             f.scopes.trim().split(/\s+/).filter(Boolean),
    username_claim:     f.username_claim.trim() || 'email',
    display_name_claim: f.display_name_claim.trim() || 'name',
    default_role:       f.default_role.trim() || 'clevel',
    auto_provision:     f.auto_provision,
  }
  if (f.authorization_endpoint.trim()) out.authorization_endpoint = f.authorization_endpoint.trim()
  if (f.role_claim.trim()) out.role_claim = f.role_claim.trim()
  if (f.role_mapping_raw.trim()) {
    try { out.role_mapping = JSON.parse(f.role_mapping_raw) } catch {}
  }
  return out
}

function OidcSection({ initial, onSaved }: { initial: SsoConfigOut | null; onSaved(): void }) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [form, setForm]       = useState(initial ? toOidcForm(initial.config) : { ...OIDC_DEFAULTS })
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  function set(k: keyof typeof OIDC_DEFAULTS, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await upsertSsoConfig('oidc', enabled, fromOidcForm(form))
      setMsg({ ok: true, text: 'OIDC configuration saved.' })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove OIDC configuration?')) return
    setSaving(true)
    try {
      await deleteSsoConfig('oidc')
      setMsg({ ok: true, text: 'OIDC configuration removed.' })
      setEnabled(false)
      setForm({ ...OIDC_DEFAULTS })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      setSaving(false)
    }
  }

  const ROLES = ['clevel', 'ciso', 'architect', 'engineer', 'admin']

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>OpenID Connect (OIDC)</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
            Compatible with Entra ID, Keycloak, Okta, Auth0, Google, and any OIDC-compliant IdP.
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: enabled ? '#22c55e' : 'var(--muted)' }}>
          <div
            onClick={() => setEnabled(e => !e)}
            style={{
              width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
              background: enabled ? '#22c55e' : 'var(--border)',
              position: 'relative', transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: '2px', left: enabled ? '18px' : '2px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
            }} />
          </div>
          {enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
        <Field label="Discovery URL" hint="e.g. …/v2.0/.well-known/openid-configuration">
          <input style={inputSx} value={form.discovery_url} onChange={e => set('discovery_url', e.target.value)} placeholder="https://..." />
        </Field>
        <Field label="Authorization Endpoint (optional)" hint="Overrides the browser redirect URL from discovery — use when the server reaches the IdP via an internal hostname (e.g. Docker).">
          <input style={inputSx} value={form.authorization_endpoint} onChange={e => set('authorization_endpoint', e.target.value)} placeholder="http://localhost:8080/realms/master/protocol/openid-connect/auth" />
        </Field>
        <Field label="Client ID">
          <input style={inputSx} value={form.client_id} onChange={e => set('client_id', e.target.value)} placeholder="your-client-id" />
        </Field>
        <Field label="Client Secret">
          <input style={inputSx} type="password" value={form.client_secret} onChange={e => set('client_secret', e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="Redirect URI" hint="Must match the registered IdP redirect URI.">
          <input style={inputSx} value={form.redirect_uri} onChange={e => set('redirect_uri', e.target.value)} placeholder="https://api.example.com/auth/oidc/callback" />
        </Field>
        <Field label="Frontend URL" hint="Dashboard origin — where users land after login.">
          <input style={inputSx} value={form.frontend_url} onChange={e => set('frontend_url', e.target.value)} placeholder="http://localhost:5173" />
        </Field>
        <Field label="Scopes" hint="Space-separated. 'openid' required.">
          <input style={inputSx} value={form.scopes} onChange={e => set('scopes', e.target.value)} placeholder="openid profile email" />
        </Field>
        <Field label="Username claim" hint="Claim used as WAF++ username.">
          <input style={inputSx} value={form.username_claim} onChange={e => set('username_claim', e.target.value)} placeholder="email" />
        </Field>
        <Field label="Display name claim">
          <input style={inputSx} value={form.display_name_claim} onChange={e => set('display_name_claim', e.target.value)} placeholder="name" />
        </Field>
        <Field label="Default role" hint="For new SSO users with no role match.">
          <select style={inputSx} value={form.default_role} onChange={e => set('default_role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Role claim (optional)" hint="id_token claim containing groups/roles.">
          <input style={inputSx} value={form.role_claim} onChange={e => set('role_claim', e.target.value)} placeholder="roles" />
        </Field>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label='Role mapping (JSON, optional)' hint='{"IdPGroup": "wafpass_role"}'>
            <textarea style={{ ...textareaSx, minHeight: '52px' }} value={form.role_mapping_raw} onChange={e => set('role_mapping_raw', e.target.value)} placeholder='{"Admin": "admin", "Reader": "clevel"}' />
          </Field>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.auto_provision} onChange={e => set('auto_provision', e.target.checked)} />
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Auto-provision new users</span>
        <span style={{ color: 'var(--muted)' }}>— create a WAF++ account on first SSO login</span>
      </label>

      {msg && (
        <div style={{
          padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem',
          background: msg.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
          color: msg.ok ? '#15803d' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.825rem',
            background: saving ? 'var(--bg)' : 'var(--waf-brand)', color: saving ? 'var(--muted)' : '#fff',
            border: '1px solid var(--waf-brand)', cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save OIDC'}
        </button>
        {initial && (
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.825rem',
              background: 'transparent', color: '#ef4444',
              border: '1px solid rgba(239,68,68,.4)', cursor: 'pointer',
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── SAML2 section ─────────────────────────────────────────────────────────────

const SAML_DEFAULTS = {
  entity_id: '',
  acs_url: '',
  sp_certificate: '',
  sp_private_key: '',
  idp_entity_id: '',
  idp_sso_url: '',
  idp_certificate: '',
  frontend_url: 'http://localhost:5173',
  username_attribute: '',
  display_name_attribute: '',
  default_role: 'clevel',
  role_attribute: '',
  role_mapping_raw: '',
  auto_provision: true,
}

function toSamlForm(config: Record<string, unknown>) {
  return {
    entity_id:              String(config.entity_id ?? ''),
    acs_url:                String(config.acs_url ?? ''),
    sp_certificate:         String(config.sp_certificate ?? ''),
    sp_private_key:         String(config.sp_private_key ?? ''),
    idp_entity_id:          String(config.idp_entity_id ?? ''),
    idp_sso_url:            String(config.idp_sso_url ?? ''),
    idp_certificate:        String(config.idp_certificate ?? ''),
    frontend_url:           String(config.frontend_url ?? 'http://localhost:5173'),
    username_attribute:     String(config.username_attribute ?? ''),
    display_name_attribute: String(config.display_name_attribute ?? ''),
    default_role:           String(config.default_role ?? 'clevel'),
    role_attribute:         String(config.role_attribute ?? ''),
    role_mapping_raw:       config.role_mapping ? JSON.stringify(config.role_mapping, null, 2) : '',
    auto_provision:         config.auto_provision !== false,
  }
}

function fromSamlForm(f: typeof SAML_DEFAULTS): Record<string, unknown> {
  const out: Record<string, unknown> = {
    entity_id:      f.entity_id.trim(),
    acs_url:        f.acs_url.trim(),
    idp_entity_id:  f.idp_entity_id.trim(),
    idp_sso_url:    f.idp_sso_url.trim(),
    idp_certificate: f.idp_certificate.trim(),
    frontend_url:   f.frontend_url.trim(),
    default_role:   f.default_role.trim() || 'clevel',
    auto_provision: f.auto_provision,
  }
  if (f.sp_certificate.trim())    out.sp_certificate   = f.sp_certificate.trim()
  if (f.sp_private_key.trim())    out.sp_private_key   = f.sp_private_key.trim()
  if (f.username_attribute.trim()) out.username_attribute = f.username_attribute.trim()
  if (f.display_name_attribute.trim()) out.display_name_attribute = f.display_name_attribute.trim()
  if (f.role_attribute.trim())    out.role_attribute   = f.role_attribute.trim()
  if (f.role_mapping_raw.trim()) {
    try { out.role_mapping = JSON.parse(f.role_mapping_raw) } catch {}
  }
  return out
}

function Saml2Section({ initial, onSaved }: { initial: SsoConfigOut | null; onSaved(): void }) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [form, setForm]       = useState(initial ? toSamlForm(initial.config) : { ...SAML_DEFAULTS })
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  function set(k: keyof typeof SAML_DEFAULTS, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      await upsertSsoConfig('saml2', enabled, fromSamlForm(form))
      setMsg({ ok: true, text: 'SAML2 configuration saved.' })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove SAML2 configuration?')) return
    setSaving(true)
    try {
      await deleteSsoConfig('saml2')
      setMsg({ ok: true, text: 'SAML2 configuration removed.' })
      setEnabled(false)
      setForm({ ...SAML_DEFAULTS })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Delete failed' })
    } finally {
      setSaving(false)
    }
  }

  const metadataUrl = `${window.location.origin}/auth/saml/metadata`
  const ROLES = ['clevel', 'ciso', 'architect', 'engineer', 'admin']

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>SAML 2.0</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
            Compatible with Active Directory FS, Keycloak, Okta, Azure AD, and any SAML 2.0 IdP.
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: enabled ? '#22c55e' : 'var(--muted)' }}>
          <div
            onClick={() => setEnabled(e => !e)}
            style={{
              width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
              background: enabled ? '#22c55e' : 'var(--border)',
              position: 'relative', transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: '2px', left: enabled ? '18px' : '2px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: '#fff', transition: 'left .2s',
            }} />
          </div>
          {enabled ? 'Enabled' : 'Disabled'}
        </label>
      </div>

      {initial && (
        <div style={{
          padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem',
          background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)',
          color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>SP Metadata:</span>
          <a href={metadataUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--waf-brand)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{metadataUrl}</a>
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Register this URL in your IdP.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
        <div style={{ gridColumn: 'span 3', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: '0.15rem' }}>Service Provider (SP)</div>
        <Field label="SP Entity ID" hint="Registered in the IdP.">
          <input style={inputSx} value={form.entity_id} onChange={e => set('entity_id', e.target.value)} placeholder="https://wafpass.example.com" />
        </Field>
        <Field label="ACS URL" hint="Points to this server's /auth/saml/acs.">
          <input style={inputSx} value={form.acs_url} onChange={e => set('acs_url', e.target.value)} placeholder="https://api.example.com/auth/saml/acs" />
        </Field>
        <Field label="Frontend URL" hint="Dashboard origin — where users land after login.">
          <input style={inputSx} value={form.frontend_url} onChange={e => set('frontend_url', e.target.value)} placeholder="http://localhost:5173" />
        </Field>
        <Field label="SP Certificate (PEM, optional)" hint="For signed AuthnRequests. Leave blank to skip.">
          <textarea style={{ ...textareaSx, minHeight: '58px' }} value={form.sp_certificate} onChange={e => set('sp_certificate', e.target.value)} placeholder="-----BEGIN CERTIFICATE-----&#10;..." />
        </Field>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label="SP Private Key (PEM, optional)" hint="Required if SP Certificate is set.">
            <textarea style={{ ...textareaSx, minHeight: '58px' }} value={form.sp_private_key} onChange={e => set('sp_private_key', e.target.value)} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." />
          </Field>
        </div>

        <div style={{ gridColumn: 'span 3', height: '1px', background: 'var(--border)', margin: '0.1rem 0' }} />
        <div style={{ gridColumn: 'span 3', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Identity Provider (IdP)</div>
        <Field label="IdP Entity ID">
          <input style={inputSx} value={form.idp_entity_id} onChange={e => set('idp_entity_id', e.target.value)} placeholder="https://idp.example.com" />
        </Field>
        <Field label="IdP SSO URL (HTTP-Redirect)">
          <input style={inputSx} value={form.idp_sso_url} onChange={e => set('idp_sso_url', e.target.value)} placeholder="https://idp.example.com/sso/saml" />
        </Field>
        <div style={{ gridColumn: 'span 3' }}>
          <Field label="IdP Certificate (PEM)" hint="Validates the SAML assertion signature.">
            <textarea style={{ ...textareaSx, minHeight: '58px' }} value={form.idp_certificate} onChange={e => set('idp_certificate', e.target.value)} placeholder="-----BEGIN CERTIFICATE-----&#10;..." />
          </Field>
        </div>

        <div style={{ gridColumn: 'span 3', height: '1px', background: 'var(--border)', margin: '0.1rem 0' }} />
        <div style={{ gridColumn: 'span 3', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attribute Mapping</div>
        <Field label="Username attribute" hint="Leave blank to use NameID.">
          <input style={inputSx} value={form.username_attribute} onChange={e => set('username_attribute', e.target.value)} placeholder="…identity/claims/emailaddress" />
        </Field>
        <Field label="Display name attribute (optional)">
          <input style={inputSx} value={form.display_name_attribute} onChange={e => set('display_name_attribute', e.target.value)} placeholder="…claims/displayname" />
        </Field>
        <Field label="Default role">
          <select style={inputSx} value={form.default_role} onChange={e => set('default_role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Role attribute (optional)" hint="SAML attribute with groups/roles.">
          <input style={inputSx} value={form.role_attribute} onChange={e => set('role_attribute', e.target.value)} placeholder="Role" />
        </Field>
        <div style={{ gridColumn: 'span 2' }}>
          <Field label='Role mapping (JSON, optional)' hint='{"SAMLGroup": "wafpass_role"}'>
            <textarea style={{ ...textareaSx, minHeight: '52px' }} value={form.role_mapping_raw} onChange={e => set('role_mapping_raw', e.target.value)} placeholder='{"Admins": "admin"}' />
          </Field>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.auto_provision} onChange={e => set('auto_provision', e.target.checked)} />
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>Auto-provision new users</span>
        <span style={{ color: 'var(--muted)' }}>— create a WAF++ account on first SSO login</span>
      </label>

      {msg && (
        <div style={{
          padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem',
          background: msg.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
          color: msg.ok ? '#15803d' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.825rem',
            background: saving ? 'var(--bg)' : 'var(--waf-brand)', color: saving ? 'var(--muted)' : '#fff',
            border: '1px solid var(--waf-brand)', cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save SAML2'}
        </button>
        {initial && (
          <button
            onClick={handleDelete}
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.825rem',
              background: 'transparent', color: '#ef4444',
              border: '1px solid rgba(239,68,68,.4)', cursor: 'pointer',
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SsoSettingsPage() {
  const [configs, setConfigs] = useState<SsoConfigOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setConfigs(await fetchSsoConfigs())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SSO configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const oidcCfg  = configs.find(c => c.id === 'oidc')  ?? null
  const saml2Cfg = configs.find(c => c.id === 'saml2') ?? null

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
      <div className="spinner" />
    </div>
  )

  if (error) return (
    <div style={{ padding: '1rem', color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{
        padding: '0.6rem 1rem', borderRadius: '8px',
        background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)',
        fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5,
      }}>
        <strong style={{ color: 'var(--text)' }}>SSO Overview</strong> — Configure OIDC or SAML2 to allow users to sign in via your organisation's identity provider.
        When enabled, login buttons appear on the sign-in page. Local password accounts continue to work alongside SSO.
        <br />SAML2 requires <code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,.06)', padding: '0 0.3rem', borderRadius: '3px' }}>python3-saml</code> to be installed on the server (<code style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,.06)', padding: '0 0.3rem', borderRadius: '3px' }}>pip install "wafpass-server[saml]"</code>).
      </div>

      <OidcSection  initial={oidcCfg}  onSaved={load} />
      <Saml2Section initial={saml2Cfg} onSaved={load} />
    </div>
  )
}
