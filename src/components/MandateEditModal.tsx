/**
 * MandateEditModal — full lifecycle create/edit for a mandate (Phase 6a).
 *
 * Replaces MandateManagementPage.tsx's old inline 4-field form. Four tabs:
 * General & Branding, Governance & Sovereignty, Policy & Inheritance
 * (informational only — see .plan.md's Risks table on the ADR-003
 * conflict), Audit & Metadata. holding_admin only — the page that renders
 * this already gates on that.
 */
import { useState } from 'react'
import {
  createMandant, updateMandant,
  type MandantOut, type MandantCreatePayload, type MandantUpdatePayload,
  type MandateType, type RiskTier, type AuthMode,
} from '../api'
import { useI18n } from '../i18n'
import MandateLogo from './MandateLogo'

interface Props {
  mandant: MandantOut | null // null = create mode
  allMandants: MandantOut[]
  onClose: () => void
  onSaved: () => void
}

const MANDATE_TYPES: MandateType[] = ['holding', 'subsidiary', 'division']
const RISK_TIERS: RiskTier[] = ['low', 'medium', 'high', 'critical']
const AUTH_MODES: AuthMode[] = ['inherit', 'sso_optional', 'local_only']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.7rem', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'block',
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** True if candidateId is a descendant of ancestorId in the flat list —
 * used to keep the parent-mandate dropdown cycle-free by construction,
 * matching the server's own _would_create_cycle() check. */
function isDescendantOf(allMandants: MandantOut[], candidateId: string, ancestorId: string): boolean {
  let current = allMandants.find(m => m.id === candidateId)
  const seen = new Set<string>()
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true
    if (seen.has(current.id)) break
    seen.add(current.id)
    current = allMandants.find(m => m.id === current!.parent_id)
  }
  return false
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'general' | 'governance' | 'policy' | 'audit'

export default function MandateEditModal({ mandant, allMandants, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const isEdit = mandant !== null

  const [tab, setTab] = useState<Tab>('general')
  const [name, setName] = useState(mandant?.name ?? '')
  const [slug, setSlug] = useState(mandant?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [logoUrl, setLogoUrl] = useState(mandant?.logo_url ?? '')
  const [mandateType, setMandateType] = useState<MandateType>(mandant?.mandate_type ?? 'subsidiary')
  const [parentId, setParentId] = useState<string>(mandant?.parent_id ?? '')
  const [isActive, setIsActive] = useState(mandant?.is_active ?? true)
  const [jurisdiction, setJurisdiction] = useState(mandant?.jurisdiction ?? '')
  const [riskTier, setRiskTier] = useState<RiskTier | ''>(mandant?.risk_tier ?? '')
  const [dataResidency, setDataResidency] = useState(mandant?.data_residency ?? '')
  const [inheritParentPolicies, setInheritParentPolicies] = useState(mandant?.inherit_parent_policies ?? true)
  const [authMode, setAuthMode] = useState<AuthMode>(mandant?.auth_mode ?? 'inherit')

  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const parentOptions = allMandants.filter(m =>
    (!mandant || m.id !== mandant.id) && !(mandant && isDescendantOf(allMandants, m.id, mandant.id))
  )

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
    try {
      if (isEdit) {
        const payload: MandantUpdatePayload = {
          name, logo_url: logoUrl, is_active: isActive, mandate_type: mandateType,
          parent_id: parentId || null,
          jurisdiction: jurisdiction || null,
          risk_tier: (riskTier || null) as RiskTier | null,
          data_residency: dataResidency || null,
          inherit_parent_policies: inheritParentPolicies,
          auth_mode: authMode,
        }
        await updateMandant(mandant!.id, payload)
      } else {
        const payload: MandantCreatePayload = {
          name, slug, logo_url: logoUrl, mandate_type: mandateType,
          parent_id: parentId || null,
          jurisdiction: jurisdiction || null,
          risk_tier: (riskTier || null) as RiskTier | null,
          data_residency: dataResidency || null,
          inherit_parent_policies: inheritParentPolicies,
          auth_mode: authMode,
        }
        await createMandant(payload)
      }
      onSaved()
    } catch (e) {
      setSaveErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: t('pages.mandates.editModal.tabGeneral') },
    { id: 'governance', label: t('pages.mandates.editModal.tabGovernance') },
    { id: 'policy', label: t('pages.mandates.editModal.tabPolicy') },
    { id: 'audit', label: t('pages.mandates.editModal.tabAudit') },
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 10000, width: '740px', maxWidth: '95vw',
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '88vh',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            {isEdit ? t('pages.mandates.editMandateTitle') : t('pages.mandates.newMandateTitle')}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--muted)', cursor: 'pointer', padding: '0.3rem 0.65rem', fontSize: '0.85rem',
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              padding: '0.65rem 0.85rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              borderBottom: tab === tb.id ? '2px solid var(--waf-brand)' : '2px solid transparent',
              color: tab === tb.id ? 'var(--waf-brand)' : 'var(--muted)',
            }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <MandateLogo name={name || '?'} logoUrl={logoUrl} size={88} />
                <div style={{ width: '100%' }}>
                  <label style={labelStyle}>{t('pages.mandates.logoUrlLabel')}</label>
                  <input style={inputStyle} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                  {/* No dedicated upload endpoint/object storage exists anywhere in
                      this app — same base64-data-URL pattern already used for user
                      avatars (UserManagementPage.tsx) and project images
                      (PassportDashboardPage.tsx): the picked file is encoded
                      client-side and stored directly in logo_url, which is a plain
                      TEXT column either way, so no server change is needed. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <label htmlFor="mandate-logo-upload" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer',
                      fontSize: '0.72rem', color: 'var(--text)', padding: '0.25rem 0.6rem',
                      borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)',
                    }}>
                      <svg width="12" height="12" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {t('pages.mandates.uploadLogoBtn')}
                      <input
                        id="mandate-logo-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => setLogoUrl((ev.target?.result as string) ?? '')
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                      {logoUrl.startsWith('data:') ? t('pages.mandates.logoLoaded') : t('pages.mandates.logoSizeHint')}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t('pages.mandates.nameLabel')}</label>
                <input style={inputStyle} value={name} onChange={e => {
                  const v = e.target.value
                  setName(v)
                  if (!slugTouched) setSlug(slugify(v))
                }} placeholder="Acme Corp" />
              </div>
              <div>
                <label style={labelStyle}>{t('pages.mandates.slugLabel')}</label>
                <input style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }} value={slug} disabled={isEdit}
                  onChange={e => { setSlugTouched(true); setSlug(e.target.value) }} placeholder="acme-corp" />
                {!isEdit && <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{t('pages.mandates.slugHint')}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('pages.mandates.editModal.mandateTypeLabel')}</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={mandateType} onChange={e => setMandateType(e.target.value as MandateType)}>
                    {MANDATE_TYPES.map(mt => <option key={mt} value={mt}>{t(`pages.mandates.editModal.mandateType.${mt}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('pages.mandates.editModal.parentLabel')}</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={parentId} onChange={e => setParentId(e.target.value)}>
                    <option value="">{t('pages.mandates.editModal.noParent')}</option>
                    {parentOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              {isEdit && (
                <div>
                  <label style={labelStyle}>{t('common.active')}</label>
                  <select style={{ ...inputStyle, cursor: 'pointer' }} value={isActive ? '1' : '0'} onChange={e => setIsActive(e.target.value === '1')}>
                    <option value="1">{t('common.active')}</option>
                    <option value="0">{t('common.inactive')}</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {tab === 'governance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={labelStyle}>{t('pages.mandates.editModal.jurisdictionLabel')}</label>
                <input style={inputStyle} value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} placeholder="EU, DE, US-CA…" />
                <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{t('pages.mandates.editModal.jurisdictionHint')}</div>
              </div>
              <div>
                <label style={labelStyle}>{t('pages.mandates.editModal.riskTierLabel')}</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={riskTier} onChange={e => setRiskTier(e.target.value as RiskTier | '')}>
                  <option value="">{t('pages.mandates.editModal.riskTierNone')}</option>
                  {RISK_TIERS.map(rt => <option key={rt} value={rt}>{t(`pages.mandates.editModal.riskTier.${rt}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('pages.mandates.editModal.dataResidencyLabel')}</label>
                <input style={inputStyle} value={dataResidency} onChange={e => setDataResidency(e.target.value)} placeholder="eu-central-1, on-prem-de…" />
                <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{t('pages.mandates.editModal.dataResidencyHint')}</div>
              </div>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <div>
                <label htmlFor="mandate-auth-mode" style={labelStyle}>{t('pages.mandates.editModal.authModeLabel')}</label>
                <select id="mandate-auth-mode" style={{ ...inputStyle, cursor: 'pointer' }} value={authMode} onChange={e => setAuthMode(e.target.value as AuthMode)}>
                  {AUTH_MODES.map(am => <option key={am} value={am}>{t(`pages.mandates.editModal.authMode.${am}`)}</option>)}
                </select>
                <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{t('pages.mandates.editModal.authModeHint')}</div>
                {authMode !== 'local_only' && (
                  <div style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{t('pages.mandates.editModal.authModeSsoConfigHint')}</div>
                )}
              </div>
            </div>
          )}

          {tab === 'policy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem 0.85rem',
                borderRadius: '8px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)',
              }}>
                <svg width="15" height="15" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <span style={{ fontSize: '0.74rem', color: '#d97706', lineHeight: 1.5 }}>{t('pages.mandates.editModal.policyInformationalNote')}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={inheritParentPolicies} onChange={e => setInheritParentPolicies(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{t('pages.mandates.editModal.inheritPoliciesLabel')}</span>
              </label>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.mandates.editModal.inheritPoliciesHint')}</div>
            </div>
          )}

          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isEdit ? (
                <>
                  <AuditRow label={t('pages.mandates.editModal.auditId')} value={mandant!.id} mono />
                  <AuditRow label={t('pages.mandates.editModal.auditCreated')} value={fmtDateTime(mandant!.created_at)} />
                  <AuditRow label={t('pages.mandates.editModal.auditUpdated')} value={fmtDateTime(mandant!.updated_at)} />
                </>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t('pages.mandates.editModal.auditUnavailableOnCreate')}</div>
              )}
            </div>
          )}

          {saveErr && <div style={{ color: '#DA2C38', fontSize: '0.78rem', marginTop: '1rem' }}>{saveErr}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !name || (!isEdit && !slug)} style={{
            padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none',
            background: 'var(--waf-brand)', color: '#fff', fontWeight: 600,
            fontSize: '0.8rem', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button onClick={onClose} style={{
            padding: '0.5rem 1.1rem', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
            fontSize: '0.8rem', cursor: 'pointer',
          }}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </>
  )
}

function AuditRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontFamily: mono ? 'ui-monospace,monospace' : undefined, wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
