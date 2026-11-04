import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  mono?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  /** Rendered in place of the body when there are no rows. */
  empty?: ReactNode
  onRowClick?: (row: T) => void
  caption?: string
  className?: string
  skeletonRows?: number
}

/**
 * The single table pattern: shared header/row styling, tabular numerals,
 * horizontal scroll on narrow viewports, skeleton rows while loading and a
 * real empty state instead of a bare "no data" row.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  caption,
  className = '',
  skeletonRows = 5,
}: DataTableProps<T>) {
  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="data-table ui-table">
        {caption != null && <caption className="ui-sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ textAlign: col.align ?? 'left', width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`skeleton-${r}`} className="ui-table-skeleton" aria-hidden="true">
                {columns.map(col => (
                  <td key={col.key}><Skeleton height={10} /></td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="ui-table-empty">
                {empty ?? 'No records'}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map(row => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'ui-table-row-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={col.mono ? 'mono' : undefined}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
