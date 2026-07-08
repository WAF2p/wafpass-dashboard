import { useState } from 'react'

interface DiffViewerProps {
  diffPreview: Record<string, string[]>
  defaultExpanded?: boolean
}

export default function DiffViewer({ diffPreview, defaultExpanded = true }: DiffViewerProps) {
  const files = Object.entries(diffPreview)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    files.forEach(([file]) => { init[file] = defaultExpanded })
    return init
  })

  if (files.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
        No diff preview available.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {files.map(([file, lines]) => {
        const isOpen = expanded[file] ?? defaultExpanded
        return (
          <div
            key={file}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'var(--card-bg, #fff)',
            }}
          >
            <button
              onClick={() => setExpanded(e => ({ ...e, [file]: !isOpen }))}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.85rem',
                background: 'rgba(0,148,255,.05)',
                border: 'none',
                borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span>{file}</span>
              <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{isOpen ? 'Collapse' : `Expand (${lines.length} lines)`}</span>
            </button>
            {isOpen && (
              <div style={{ maxHeight: '420px', overflow: 'auto' }}>
                <pre
                  style={{
                    margin: 0,
                    padding: '0.75rem',
                    fontSize: '0.72rem',
                    lineHeight: 1.55,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    background: '#0f172a',
                    color: '#e2e8f0',
                  }}
                >
                  {lines.map((line, i) => {
                    let bg: string | undefined
                    let color = '#e2e8f0'
                    if (line.startsWith('+')) {
                      bg = 'rgba(34,197,94,.12)'
                      color = '#86efac'
                    } else if (line.startsWith('-')) {
                      bg = 'rgba(239,68,68,.12)'
                      color = '#fca5a5'
                    } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
                      color = '#94a3b8'
                    }
                    return (
                      <div
                        key={i}
                        style={{
                          background: bg,
                          color,
                          whiteSpace: 'pre',
                          padding: '0 0.25rem',
                        }}
                      >
                        {line || ' '}
                      </div>
                    )
                  })}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
