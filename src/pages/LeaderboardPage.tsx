import { useEffect, useState } from 'react'
import { fetchLeaderboard, LeaderboardEntry, LeaderboardOut } from '../api'
import { useI18n } from '../i18n'

const TIER_COLORS: Record<number, string> = {
  1: '#d97706', 2: '#0094FF', 3: '#0891b2', 4: '#7c3aed', 5: '#059669',
}

const MEDAL: Record<number, { color: string; label: string; glow: string }> = {
  1: { color: '#FFD700', label: '1st', glow: 'rgba(255,215,0,0.35)' },
  2: { color: '#C0C0C0', label: '2nd', glow: 'rgba(192,192,192,0.35)' },
  3: { color: '#CD7F32', label: '3rd', glow: 'rgba(205,127,50,0.35)' },
}

const PODIUM_HEIGHT: Record<number, number> = { 1: 130, 2: 100, 3: 80 }
const PODIUM_ORDER = [2, 1, 3]

function TierBadge({ level, label }: { level: number; label: string }) {
  const color = TIER_COLORS[level] ?? '#64748b'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: '999px', padding: '0.15rem 0.55rem',
      fontSize: '0.68rem', fontWeight: 700, color,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      L{level} · {label}
    </span>
  )
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const { t } = useI18n()
  const medal = MEDAL[rank]
  const height = PODIUM_HEIGHT[rank] ?? 70
  const name = entry.display_name || entry.project
  const team = entry.owner_team || entry.owner || '—'
  const isFirst = rank === 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '200px' }}>
      {/* Card */}
      <div style={{
        width: '100%',
        background: isFirst
          ? `linear-gradient(135deg, ${medal.color}28 0%, ${medal.color}10 100%)`
          : `linear-gradient(135deg, ${medal.color}18 0%, ${medal.color}08 100%)`,
        border: `1.5px solid ${medal.color}99`,
        borderRadius: '14px',
        padding: '1rem 0.875rem',
        textAlign: 'center',
        boxShadow: isFirst ? `0 0 32px ${medal.glow}, 0 4px 24px rgba(0,0,0,0.2)` : `0 2px 12px rgba(0,0,0,0.15)`,
        marginBottom: '0.5rem',
      }}>
        {/* Crown for 1st */}
        {isFirst && (
          <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>👑</div>
        )}
        {/* Medal circle */}
        <div style={{
          width: isFirst ? '52px' : '42px',
          height: isFirst ? '52px' : '42px',
          borderRadius: '50%',
          background: `${medal.color}35`,
          border: `2.5px solid ${medal.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 0.75rem',
          fontSize: isFirst ? '1.1rem' : '0.9rem',
          fontWeight: 900,
          color: medal.color,
          boxShadow: `0 0 12px ${medal.glow}`,
        }}>
          {medal.label}
        </div>
        {/* Project name */}
        <div style={{
          fontSize: isFirst ? '0.88rem' : '0.8rem',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '0.25rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={name}>
          {name}
        </div>
        {/* Team */}
        <div style={{
          fontSize: '0.68rem', color: 'var(--muted)',
          marginBottom: '0.6rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={team}>
          {team}
        </div>
        <TierBadge level={entry.tier_level} label={entry.tier_label} />
        {/* Metric */}
        <div style={{
          marginTop: '0.6rem',
          fontSize: '0.7rem',
          color: 'var(--muted)',
        }}>
          {entry.tiers_gained != null
            ? <><span style={{ color: '#22c55e', fontWeight: 700 }}>+{entry.tiers_gained}</span> {t('pages.leaderboard.tiersIn30d')}</>
            : <><span style={{ color: medal.color, fontWeight: 700 }}>{entry.days_held}</span> {t('pages.leaderboard.daysAtTier5')}</>
          }
        </div>
      </div>
      {/* Podium block */}
      <div style={{
        width: '100%',
        height: `${height}px`,
        background: `linear-gradient(180deg, ${medal.color}44 0%, ${medal.color}22 100%)`,
        border: `1px solid ${medal.color}80`,
        borderBottom: 'none',
        borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '0.5rem',
        fontSize: '0.7rem', fontWeight: 700, color: `${medal.color}aa`,
      }}>
        #{rank}
      </div>
    </div>
  )
}

function Podium({ entries, label, color }: { entries: LeaderboardEntry[]; label: string; color: string }) {
  const { t } = useI18n()
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  // Pad to 3 so layout is stable
  const ordered = PODIUM_ORDER.map(r => ({ rank: r, entry: top3[r - 1] ?? null }))

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        marginBottom: '1.5rem',
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{label}</h2>
      </div>

      {entries.length === 0 ? (
        <div style={{
          padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        }}>
          {t('pages.leaderboard.noData')}
        </div>
      ) : (
        <>
          {/* Podium */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '1rem', justifyContent: 'center',
            marginBottom: '0', borderBottom: '2px solid var(--border)', paddingBottom: '0',
          }}>
            {ordered.map(({ rank, entry }) =>
              entry ? (
                <PodiumCard key={entry.project} entry={entry} rank={rank} />
              ) : (
                <div key={rank} style={{ flex: 1, maxWidth: '200px' }}>
                  <div style={{
                    height: `${PODIUM_HEIGHT[rank]}px`,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed var(--border)',
                    borderBottom: 'none',
                    borderRadius: '8px 8px 0 0',
                  }} />
                </div>
              )
            )}
          </div>

          {/* Ranks 4-10 table */}
          {rest.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Project</th>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Tier</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>
                      {rest[0]?.tiers_gained != null ? t('pages.leaderboard.colTiersGained') : t('pages.leaderboard.colDaysAtTier5')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((entry, i) => (
                    <tr key={entry.project} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.8rem' }}>
                          #{i + 4}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>
                          {entry.display_name || entry.project}
                        </div>
                        {entry.display_name && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{entry.project}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {entry.owner_team || entry.owner || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <TierBadge level={entry.tier_level} label={entry.tier_label} />
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: '0.82rem', fontWeight: 700,
                          color: entry.score >= 80 ? '#059669' : entry.score >= 60 ? '#d97706' : '#DA2C38',
                        }}>
                          {entry.score}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {entry.tiers_gained != null ? (
                          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem' }}>+{entry.tiers_gained}</span>
                        ) : (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>{entry.days_held}d</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 1rem', textAlign: 'left',
  fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const tdStyle: React.CSSProperties = {
  padding: '0.65rem 1rem', verticalAlign: 'middle',
}

export default function LeaderboardPage() {
  const { t } = useI18n()
  const [data, setData] = useState<LeaderboardOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(218,44,56,.3)',
        background: 'rgba(218,44,56,.08)', color: '#f87171', fontSize: '0.85rem',
      }}>
        {t('pages.leaderboard.loadFailed')}: {error}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem',
        padding: '1.25rem 1.5rem', borderRadius: '14px', marginBottom: '2rem',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(5,150,105,0.12) 100%)',
        border: '1px solid rgba(255,215,0,0.4)',
      }}>
        <div style={{
          flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(255,215,0,0.25)', border: '1px solid rgba(255,215,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
        }}>
          🏆
        </div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>
            {t('pages.leaderboard.title')}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            {t('pages.leaderboard.subtitle')}
          </div>
        </div>
      </div>

      <Podium
        entries={data?.top_sovereign ?? []}
        label={t('pages.leaderboard.topSovereign')}
        color="#059669"
      />

      <Podium
        entries={data?.most_improved ?? []}
        label={t('pages.leaderboard.mostImproved')}
        color="#22c55e"
      />

    </div>
  )
}
