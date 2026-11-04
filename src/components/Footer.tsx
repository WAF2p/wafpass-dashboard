// Footer content - centralized "CMS" style configuration
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: 'https://www.wombat-gov.dev', label: 'Main Page', external: true },
      { href: 'https://www.wombat-gov.dev/docs', label: 'Documentation', external: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: 'https://github.com/WAF2p', label: 'GitHub', external: true },
      { href: 'https://www.wombat-gov.dev/blog', label: 'Blog', external: true },
    ],
  },
] as const

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="footer-brand-link" href="https://www.wombat-gov.dev" {...EXTERNAL}>
              <img src="/logo.png" alt="" width={24} height={24} />
              <span>WOMBAT</span>
            </a>
            <p className="footer-desc">
              WOMBAT is an open-source framework for security and compliance.
              It is distributed free of charge — the framework and its utilities
              are not sold.
            </p>
            <p className="footer-note">
              Audit and hosting certification services are planned from 2030.
            </p>
          </div>

          <nav className="footer-nav" aria-label="Footer">
            {FOOTER_COLUMNS.map(column => (
              <div className="footer-col" key={column.title}>
                <h3 className="footer-col-title">{column.title}</h3>
                {column.links.map(link => (
                  <a key={link.href} href={link.href} {...EXTERNAL}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
            <div className="footer-col">
              <h3 className="footer-col-title">Community</h3>
              <a
                className="footer-partner"
                href="https://www.cloudnativeconference.de"
                {...EXTERNAL}
                aria-label="Cloud Native Conference"
              >
                <img
                  src="https://lirp.cdn-website.com/9dbc9654/dms3rep/multi/opt/Cloud-Native_Conference_2022_white-f2589334-1920w.png"
                  alt="Cloud Native Conference"
                  loading="lazy"
                />
              </a>
            </div>
          </nav>
        </div>

        <div className="footer-bottom">
          <div className="footer-legal">
            <span>© 2026 WOMBAT</span>
            <span className="footer-dot" aria-hidden="true" />
            <span>Open source</span>
            <span className="footer-dot" aria-hidden="true" />
            <span>Community driven</span>
          </div>
          <div className="footer-bottom-links">
            <a href="#/legal">Legal notice</a>
            <span className="footer-dot" aria-hidden="true" />
            <a href="https://www.wombat-gov.dev" {...EXTERNAL}>wombat-gov.dev</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
