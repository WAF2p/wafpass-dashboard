interface BrandLogoProps {
  /** Rendered height of the mascot mark in pixels. */
  height?: number
  /** Render the WOMBATpass wordmark next to the mark. */
  showName?: boolean
  /** Extra class for the wrapping element (layout hooks live on the parent). */
  className?: string
}

/**
 * WOMBATpass brand lock-up: the wombat mascot mark plus the product name.
 *
 * The name is rendered as text rather than baked into the image so it follows
 * the active light/dark theme. The mascot artwork is unchanged in both themes.
 */
export default function BrandLogo({ height = 32, showName = true, className }: BrandLogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}
    >
      <img
        src="/logo.png"
        alt={showName ? '' : 'WOMBATpass'}
        width={height}
        height={height}
        style={{ height, width: height, objectFit: 'contain', flexShrink: 0 }}
      />
      {showName && (
        <span
          style={{
            fontSize: `${Math.round(height * 0.52)}px`,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: 'var(--text)',
          }}
        >
          WOMBAT<span style={{ color: 'var(--waf-brand)' }}>pass</span>
        </span>
      )}
    </span>
  )
}
