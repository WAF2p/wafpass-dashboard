import { Fragment, type ReactNode } from 'react'
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
  /** Adds a leading checkbox column. Pair with selectedKeys/onSelectionChange. */
  selectable?: boolean
  /** Keys (from rowKey) of the currently selected rows. */
  selectedKeys?: string[]
  /** Called with the next key set. Select-all only affects visible rows. */
  onSelectionChange?: (keys: string[]) => void
  /** Rendered in an extra full-width row beneath each matching row. */
  renderExpanded?: (row: T) => ReactNode
  /** Keys (from rowKey) whose expanded content should be shown. */
  expandedKeys?: string[]
  /** Extra class applied to a row, for page-specific row styling. */
  rowClassName?: (row: T) => string | undefined
  /** Rendered in a trailing actions column. */
  actions?: (row: T) => ReactNode
  /** Header for the trailing actions column. */
  actionsHeader?: ReactNode
}

/**
 * The single table pattern: shared header/row styling, tabular numerals,
 * horizontal scroll on narrow viewports, skeleton rows while loading and a
 * real empty state instead of a bare "no data" row.
 *
 * Optional selection, row expansion and per-row actions layer on top without
 * changing the default behaviour of existing callers.
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
  selectable = false,
  selectedKeys,
  onSelectionChange,
  renderExpanded,
  expandedKeys,
  rowClassName,
  actions,
  actionsHeader,
}: DataTableProps<T>) {
  const hasActions = actions != null
  const totalColumns = columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)

  const selected = new Set(selectedKeys ?? [])
  const expanded = new Set(expandedKeys ?? [])
  const visibleKeys = rows.map(rowKey)
  const selectedVisibleCount = visibleKeys.reduce(
    (count, key) => (selected.has(key) ? count + 1 : count),
    0,
  )
  const allVisibleSelected = rows.length > 0 && selectedVisibleCount === rows.length
  const someVisibleSelected = selectedVisibleCount > 0

  function emitSelection(next: Set<string>) {
    onSelectionChange?.(Array.from(next))
  }

  function toggleAll() {
    const next = new Set(selected)
    if (allVisibleSelected) {
      visibleKeys.forEach(key => next.delete(key))
    } else {
      visibleKeys.forEach(key => next.add(key))
    }
    emitSelection(next)
  }

  function toggleRow(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    emitSelection(next)
  }

  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className="data-table ui-table">
        {caption != null && <caption className="ui-sr-only">{caption}</caption>}
        <thead>
          <tr>
            {selectable && (
              <th className="ui-table-select" style={{ textAlign: 'left', width: '1px' }}>
                <input
                  type="checkbox"
                  className="ui-table-checkbox"
                  checked={allVisibleSelected}
                  ref={el => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map(col => (
              <th key={col.key} style={{ textAlign: col.align ?? 'left', width: col.width }}>
                {col.header}
              </th>
            ))}
            {hasActions && (
              <th className="ui-table-actions-header" style={{ textAlign: 'left' }}>
                {actionsHeader}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`skeleton-${r}`} className="ui-table-skeleton" aria-hidden="true">
                {selectable && <td><Skeleton height={10} /></td>}
                {columns.map(col => (
                  <td key={col.key}><Skeleton height={10} /></td>
                ))}
                {hasActions && <td><Skeleton height={10} /></td>}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={totalColumns} className="ui-table-empty">
                {empty ?? 'No records'}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map(row => {
              const key = rowKey(row)
              const isSelected = selectable && selected.has(key)
              const isExpanded = expanded.has(key)
              const classes = [
                onRowClick ? 'ui-table-row-clickable' : '',
                isSelected ? 'ui-table-row-selected' : '',
                isExpanded ? 'ui-table-row-expanded' : '',
                rowClassName?.(row) ?? '',
              ].filter(Boolean).join(' ')

              return (
                <Fragment key={key}>
                  <tr
                    className={classes || undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable && (
                      <td
                        className="ui-table-select"
                        onClick={e => { e.stopPropagation(); toggleRow(key) }}
                      >
                        <input
                          type="checkbox"
                          className="ui-table-checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          onClick={e => e.stopPropagation()}
                          aria-label="Select row"
                        />
                      </td>
                    )}
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
                    {hasActions && (
                      <td className="ui-table-actions-cell" onClick={e => e.stopPropagation()}>
                        {actions(row)}
                      </td>
                    )}
                  </tr>

                  {isExpanded && renderExpanded && (
                    <tr className="ui-table-expanded-row">
                      <td colSpan={totalColumns} className="ui-table-expanded-cell">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
