import type { CSSProperties } from 'react'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string | number
  className?: string
  style?: CSSProperties
}

/** A single placeholder block. Shapes should match the content it replaces. */
export function Skeleton({ width = '100%', height = 12, radius = 4, className = '', style }: SkeletonProps) {
  return (
    <span
      className={`ui-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <span className={`ui-skeleton-text ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '65%' : '100%'} />
      ))}
    </span>
  )
}

/** Placeholder table rows — pair with <DataTable loading />. */
export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="ui-table-skeleton" aria-hidden="true">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c}><Skeleton height={10} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
