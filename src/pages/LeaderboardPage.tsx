import { useEffect, useState } from 'react'
import { fetchLeaderboard, LeaderboardEntry, LeaderboardOut } from '../api'
import { useI18n } from '../i18n'
import { scoreColor } from '../severity';
import { DataTable, EmptyState, PageHeader, Skeleton } from '../ui'

const TIER_COLORS: Record<number, string> = {
  1: 'var(--score-mid-ink)', 2: 'var(--waf-brand-ink)', 3: '#0891b2', 4: 'var(--waf-info)', 5: 'var(--score-high-ink)',
}

const MEDAL: Record<number, { color: string; label: string }> = {
  1: { color: '#FFD700', label: '1st' },
  2: { color: '#C0C0C0', label: '2nd' },
  3: { color: '#CD7F32', label: '3rd' },
}

const PODIUM_HEIGHT: Record<number, number> = { 1: 130, 2: 100, 3: 80 }
const PODIUM_ORDER = [2, 1, 3]

type RankedEntry = LeaderboardEntry & { rank: number }

function TierBadge({ level, label }: { level: number; label: string }) {
  const color = TIER_COLORS[level] ?? 'var(--muted)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: `color-mix(in srgb, ${color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      borderRadius: '999px', padding: '0.15rem 0.55rem',
      fontSize: '0.7rem', fontWeight: 700, color,
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
        borderRadius: '12px',
        padding: '1rem 0.875rem',
        textAlign: 'center',
        marginBottom: '0.5rem',
      }}>
        {/* Crown for 1st */}
        {isFirst && (
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>👑</div>
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
          fontSize: '0.7rem', color: 'var(--muted)',
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
            ? <><span style={{ color: 'var(--pass-ink)', fontWeight: 700 }}>+{entry.tiers_gained}</span> {t('pages.leaderboard.tiersIn30d')}</>
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
  const ranked: RankedEntry[] = rest.map((entry, i) => ({ ...entry, rank: i + 4 }))

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
        <EmptyState title={t('pages.leaderboard.noData')} />
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
                    background: 'var(--row-hover)',
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
              <DataTable<RankedEntry>
                rows={ranked}
                rowKey={row => row.project}
                columns={[
                  {
                    key: 'rank',
                    header: '#',
                    width: '4rem',
                    render: row => (
                      <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.8rem' }}>
                        #{row.rank}
                      </span>
                    ),
                  },
                  {
                    key: 'project',
                    header: 'Project',
                    render: row => (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                          {row.display_name || row.project}
                        </div>
                        {row.display_name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{row.project}</div>
                        )}
                      </>
                    ),
                  },
                  {
                    key: 'team',
                    header: 'Team',
                    render: row => (
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {row.owner_team || row.owner || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'tier',
                    header: 'Tier',
                    render: row => <TierBadge level={row.tier_level} label={row.tier_label} />,
                  },
                  {
                    key: 'score',
                    header: 'Score',
                    render: row => (
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: scoreColor(row.score) }}>
                        {row.score}
                      </span>
                    ),
                  },
                  {
                    key: 'metric',
                    header: rest[0]?.tiers_gained != null ? t('pages.leaderboard.colTiersGained') : t('pages.leaderboard.colDaysAtTier5'),
                    render: row => row.tiers_gained != null ? (
                      <span style={{ color: 'var(--pass-ink)', fontWeight: 700, fontSize: '0.85rem' }}>+{row.tiers_gained}</span>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>{row.days_held}d</span>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
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
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }} aria-busy="true">
        <Skeleton height={44} width="40%" />
        <Skeleton height={16} width="60%" />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', justifyContent: 'center', marginTop: '1rem' }}>
          <Skeleton height={190} width={160} radius={12} />
          <Skeleton height={240} width={180} radius={12} />
          <Skeleton height={150} width={160} radius={12} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title={t('pages.leaderboard.loadFailed')}
        description={error}
      />
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader
        title={t('pages.leaderboard.title')}
        description={t('pages.leaderboard.subtitle')}
      />

      <Podium
        entries={data?.top_sovereign ?? []}
        label={t('pages.leaderboard.topSovereign')}
        color="var(--score-high-ink)"
      />

      <Podium
        entries={data?.most_improved ?? []}
        label={t('pages.leaderboard.mostImproved')}
        color="var(--pass-ink)"
      />

    </div>
  )
}
