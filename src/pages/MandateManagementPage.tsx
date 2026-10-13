/**
 * Mandate Administration — create and manage the companies ("mandates")
 * inside this holding. holding_admin only (Phase 3.2).
 *
 * Phase 6a: org-chart redesign (large centered logos, a real recursive
 * tree with connecting lines for the holding-to-subsidiary hierarchy via
 * the `.org-chart` CSS in index.css, rollup summaries on any node that has
 * children) and the new MandateEditModal replacing the old inline 4-field
 * form. Hierarchy here is organizational/display metadata only — see
 * .plan.md's Phase 6a section and the Mandant model's docstring for why
 * this doesn't change who can see what data.
 *
 * See decisions/adrs/ADR-003-multi-mandant-tenancy.md and .plan.md.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { fetchMandants, updateMandant, fetchMandantRollup, type MandantOut, type MandantRollupOut, type MandateType } from '../api'
import { useI18n } from '../i18n'
import { buildHash } from '../routing'
import MandateLogo from '../components/MandateLogo'
import MandateEditModal from '../components/MandateEditModal'

const MANDATE_TYPE_COLORS: Record<MandateType, string> = {
  holding: '#7c3aed', subsidiary: '#0094FF', division: '#059669',
}

function TypeBadge({ type }: { type: MandateType }) {
  const { t } = useI18n()
  const color = MANDATE_TYPE_COLORS[type] ?? 'var(--muted)'
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '6px',
      background: `${color}18`, color, fontWeight: 700, fontSize: '0.62rem',
    }}>
      {t(`pages.mandates.editModal.mandateType.${type}`)}
    </span>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useI18n()
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '6px',
      background: active ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.1)',
      color: active ? '#059669' : 'var(--muted)', fontWeight: 700, fontSize: '0.62rem',
    }}>
      {active ? t('common.active') : t('common.inactive')}
    </span>
  )
}

function PlainBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.45rem', borderRadius: '6px',
      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)',
      fontWeight: 700, fontSize: '0.62rem',
    }}>
      {children}
    </span>
  )
}

interface NodeCardProps {
  mandant: MandantOut
  isRoot: boolean
  rollup: MandantRollupOut | undefined
  onEdit: (m: MandantOut) => void
  onToggleActive: (m: MandantOut) => void
  onView: (m: MandantOut) => void
}

function MandateNodeCard({ mandant, isRoot, rollup, onEdit, onToggleActive, onView }: NodeCardProps) {
  const { t } = useI18n()
  const logoSize = isRoot ? 60 : 44
  return (
    <div className="card" style={{
      padding: isRoot ? '1.1rem 1.3rem' : '0.8rem 0.95rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: '0.45rem', minWidth: isRoot ? '190px' : '165px',
    }}>
      <button
        onClick={() => onView(mandant)}
        title={t('pages.mandates.viewAsHint', { name: mandant.name })}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
      >
        <MandateLogo name={mandant.name} logoUrl={mandant.logo_url} size={logoSize} />
      </button>
      <div style={{ fontSize: isRoot ? '0.92rem' : '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{mandant.name}</div>
      <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.66rem', color: 'var(--muted)' }}>{mandant.slug}</div>
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <TypeBadge type={mandant.mandate_type} />
        <StatusBadge active={mandant.is_active} />
        {isRoot && mandant.jurisdiction && <PlainBadge>{mandant.jurisdiction}</PlainBadge>}
        {mandant.parent_id && (
          <PlainBadge>
            {mandant.inherit_parent_policies ? t('pages.mandates.inheritedBadge') : t('pages.mandates.customOverrideBadge')}
          </PlainBadge>
        )}
      </div>
      {rollup && (
        <div style={{ fontSize: '0.64rem', color: 'var(--muted)', lineHeight: 1.5 }}>
          <div>{t('pages.mandates.rollup.mandateCount', { count: rollup.mandate_count })}</div>
          <div>
            {t('pages.mandates.rollup.runCount', { count: rollup.run_count })}
            {rollup.avg_score != null && ` · ${t('pages.mandates.rollup.avgScore', { score: String(Math.round(rollup.avg_score)) })}`}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.15rem' }}>
        <button onClick={() => onEdit(mandant)} style={{ background: 'none', border: 'none', color: 'var(--waf-brand)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, padding: 0 }}>
          {t('common.edit')}
        </button>
        <button onClick={() => onToggleActive(mandant)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, padding: 0 }}>
          {mandant.is_active ? t('common.disabled') : t('common.enabled')}
        </button>
      </div>
    </div>
  )
}

interface TreeNodeProps {
  mandant: MandantOut
  isRoot: boolean
  allMandants: MandantOut[]
  rollups: Record<string, MandantRollupOut>
  onEdit: (m: MandantOut) => void
  onToggleActive: (m: MandantOut) => void
  onView: (m: MandantOut) => void
}

/** One <li> — the node itself, plus (recursively) a nested <ul> of its own
 * children. The .org-chart CSS (index.css) supplies the connecting lines;
 * this component only needs to produce the right nested <ul>/<li> shape. */
function OrgTreeNode({ mandant, isRoot, allMandants, rollups, onEdit, onToggleActive, onView }: TreeNodeProps) {
  const children = allMandants.filter(m => m.parent_id === mandant.id)
  return (
    <li>
      <MandateNodeCard mandant={mandant} isRoot={isRoot} rollup={rollups[mandant.id]} onEdit={onEdit} onToggleActive={onToggleActive} onView={onView} />
      {children.length > 0 && (
        <ul>
          {children
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => (
              <OrgTreeNode
                key={child.id} mandant={child} isRoot={false}
                allMandants={allMandants} rollups={rollups}
                onEdit={onEdit} onToggleActive={onToggleActive} onView={onView}
              />
            ))}
        </ul>
      )}
    </li>
  )
}

export default function MandateManagementPage() {
  const { t } = useI18n()
  const { isHoldingAdmin, setEffectiveMandantId } = useAuth()

  const [mandants, setMandants] = useState<MandantOut[]>([])
  const [rollups, setRollups] = useState<Record<string, MandantRollupOut>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MandantOut | 'new' | null>(null)

  function load() {
    setLoading(true)
    fetchMandants()
      .then(setMandants)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (isHoldingAdmin) load() }, [isHoldingAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(mandants.map(m => [m.id, m]))
  // A mandate whose parent_id points nowhere in this list (deleted parent,
  // shouldn't normally happen since the server never hard-deletes mandates,
  // but defensive regardless) is treated as a root too, same as one with
  // parent_id === null — each becomes its own independent .org-chart tree.
  const roots = mandants
    .filter(m => !m.parent_id || !byId.has(m.parent_id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const hasChildren = new Set(mandants.filter(m => m.parent_id).map(m => m.parent_id as string))

  useEffect(() => {
    // Rollups are only meaningful for a node that actually has children —
    // a childless mandate's own card already shows everything relevant.
    const branchIds = mandants.filter(m => hasChildren.has(m.id)).map(m => m.id)
    if (branchIds.length === 0) return
    let cancelled = false
    Promise.all(branchIds.map(id => fetchMandantRollup(id).catch(() => null)))
      .then(results => {
        if (cancelled) return
        const next: Record<string, MandantRollupOut> = {}
        results.forEach((r, i) => { if (r) next[branchIds[i]] = r })
        setRollups(next)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandants.length])

  async function handleToggleActive(m: MandantOut) {
    try {
      await updateMandant(m.id, { is_active: !m.is_active })
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  function handleSaved() {
    setEditing(null)
    load()
  }

  // Clicking a mandate's logo "impersonates" it: the Global Context
  // Switcher (Phase 6a) narrows to exactly this mandate (same mechanism
  // as MandateIndicator's own dropdown — see AuthContext.setEffectiveMandantId),
  // then jumps to its overview. A full reload, not an in-app navigate():
  // every already-fetched page's data was scoped under whatever context
  // was active before this click, so only a reload guarantees everything
  // re-fetches under the new one.
  function handleView(m: MandantOut) {
    setEffectiveMandantId(m.id, m.name, m.logo_url)
    window.location.hash = buildHash('globaldashboard', null)
    window.location.reload()
  }

  if (!isHoldingAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '1rem 1.25rem', borderRadius: '10px',
        background: 'rgba(218,44,56,0.06)', border: '1px solid rgba(218,44,56,0.18)',
      }}>
        <svg width="16" height="16" fill="none" stroke="#DA2C38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: '0.83rem', color: '#DA2C38', fontWeight: 600 }}>{t('pages.mandates.holdingAdminRequired')}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        {[
          { label: t('pages.mandates.totalMandates'), value: mandants.length, color: 'var(--text)' },
          { label: t('pages.mandates.active'), value: mandants.filter(m => m.is_active).length, color: '#059669' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Mandate org chart ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('pages.mandates.mandatesHeader')}
          </div>
          <button
            onClick={() => setEditing('new')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.85rem', borderRadius: '8px',
              background: 'var(--waf-brand)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0,148,255,0.25)',
            }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {t('pages.mandates.newMandateBtn')}
          </button>
        </div>

        {loading ? (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}><div className="spinner" /></div>
        ) : error ? (
          <div className="card" style={{ padding: '0.875rem 1.25rem', color: '#DA2C38', fontSize: '0.78rem', background: 'rgba(218,44,56,0.04)' }}>{error}</div>
        ) : roots.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem 1.25rem', color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            {t('common.noData')}
          </div>
        ) : (
          <div className="card" style={{ padding: '1.75rem 1.25rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2.5rem' }}>
              {roots.map(root => (
                <ul className="org-chart" key={root.id}>
                  <OrgTreeNode
                    mandant={root} isRoot allMandants={mandants} rollups={rollups}
                    onEdit={setEditing} onToggleActive={handleToggleActive} onView={handleView}
                  />
                </ul>
              ))}
            </div>
          </div>
        )}
      </section>

      {editing !== null && (
        <MandateEditModal
          mandant={editing === 'new' ? null : editing}
          allMandants={mandants}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
