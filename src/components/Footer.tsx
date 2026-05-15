// Footer content - centralized "CMS" style configuration
const FOOTER_LINKS = [
  { href: 'https://waf2p.dev', label: 'Main Page' },
  { href: 'https://waf2p.dev/docs', label: 'Documentation' },
  { href: 'https://github.com/WAF2p', label: 'GitHub' },
  { href: 'https://waf2p.dev/blog', label: 'Blog' },
] as const;

export default function Footer() {
  return (
    <footer className="footer" style={{
      width: '100%',
      padding: '2.5rem 1rem',
      marginTop: '20px',
      background: 'var(--footer-bg)',
      color: 'var(--footer-text)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem',
      }}>
        <div style={{
          minWidth: '350px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--footer-light)',
            padding: '1.25rem 2.6rem',
            background: 'var(--footer-gradient)',
            borderRadius: '16px',
            border: '1px solid rgba(34,211,238,0.2)',
          }}>
            <span style={{ fontSize: '1.5rem' }}>❤️</span>
            <span>Created <span style={{ color: '#22d3ee' }}>with</span> the community, <span style={{ color: '#a78bfa' }}>for</span> the community</span>
            <span style={{ fontSize: '1.5rem' }}>🚀</span>
          </div>
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--footer-muted)',
            textAlign: 'center',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <span>© 2026 WAF++</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>Open Source</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span>Community Driven</span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--footer-muted)' }}>With love from</span>
            <a
              href="https://www.cloudnativeconference.de"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                color: 'var(--footer-light)',
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34,211,238,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <img
                src="https://lirp.cdn-website.com/9dbc9654/dms3rep/multi/opt/Cloud-Native_Conference_2022_white-f2589334-1920w.png"
                alt="Cloud Native Conference"
                style={{
                  height: '32px',
                  width: 'auto',
                  borderRadius: '4px',
                }}
              />
            </a>
            <span style={{ color: 'var(--footer-muted)' }}>•</span>
            <a
              href="https://waf2p.dev"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                color: 'var(--footer-light)',
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34,211,238,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <img
                src="/logo.png"
                alt="WAF++"
                style={{
                  height: '32px',
                  width: 'auto',
                  borderRadius: '4px',
                }}
              />
            </a>
          </div>
          <div style={{
            display: 'flex',
            gap: '2rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {FOOTER_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--footer-light)',
                  textDecoration: 'none',
                  transition: 'all 0.25s ease',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#22d3ee'
                  e.currentTarget.style.background = 'rgba(34,211,238,0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--footer-light)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
