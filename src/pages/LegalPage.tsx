// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegalPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '1.5rem 2rem', borderRadius: '16px',
        background: 'rgba(0,148,255,0.07)',
        border: '1px solid rgba(0,148,255,0.25)',
      }}>
        <svg width="32" height="32" fill="none" stroke="#0094FF" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            Legal Notice
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Liability disclaimer, terms of use, and open source notice
          </p>
        </div>
      </div>

      {/* ── Open Source Nature ──────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Open Source Framework - No Commercial Sale
        </h2>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ marginBottom: '1rem' }}>
            WAF++ is an open-source project created by and for the community. It is distributed free of charge and no commercial transaction occurs when using this software.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong>We do not sell the WAF++ framework or any of its utilities.</strong> The framework is provided as-is for self-hosted use by organizations and individuals.
          </p>
          <p style={{ marginBottom: '0' }}>
            Any claims or liability related to usage of this software must be directed to the users themselves, as no commercial transaction occurs through the use of this framework.
          </p>
        </div>
      </div>

      {/* ── Future Certification Service ──────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Future Certification Service
        </h2>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ marginBottom: '1rem' }}>
            While the WAF++ framework itself remains free and open source, we plan to offer official certification services in the future.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            <strong>2030 Outlook:</strong> Official certification based on the WAF++ framework will be available for purchase. This will include:
          </p>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', marginBottom: '1rem', paddingLeft: 0 }}>
            <li style={{ marginBottom: '0.5rem' }}>Certification assessment and validation</li>
            <li style={{ marginBottom: '0.5rem' }}>Professional audit services</li>
            <li style={{ marginBottom: '0' }}>Hosting and management of certification records</li>
          </ul>
          <p style={{ marginBottom: '0' }}>
            <strong>Note:</strong> Even when certification services are available, the WAF++ framework itself will remain free and open source. You will only be paying for the certification service and hosting, not for the framework or utility tools.
          </p>
        </div>
      </div>

      {/* ── Liability Disclaimer ──────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Liability Disclaimer
        </h2>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ marginBottom: '1rem' }}>
            The content of this website and framework is prepared with the utmost care. However, no guarantee is given for the completeness, accuracy, or currency of the information provided.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            WAF++ does not replace individual legal or technical advice. Users are responsible for seeking appropriate professional advice relevant to their specific circumstances.
          </p>
          <p style={{ marginBottom: '1rem' }}>
            By using WAF++, you acknowledge that you use it at your own risk. The framework is provided "as is" without any warranty, express or implied.
          </p>
          <p style={{ marginBottom: '0' }}>
            The developers and maintainers of WAF++ shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the framework.
          </p>
        </div>
      </div>

      {/* ── External Links ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          External Links
        </h2>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ marginBottom: '0' }}>
            WAF++ may contain links to external websites that are not operated by us. We have no control over the content and practices of these sites and cannot accept responsibility or liability for their respective privacy notices.
          </p>
        </div>
      </div>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Questions or Concerns?
        </h2>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ marginBottom: '1rem' }}>
            If you have any questions about this legal notice, please contact the WAF++ team at:
          </p>
          <p style={{ marginBottom: '0', fontWeight: 600, fontFamily: 'monospace', background: 'rgba(0,148,255,0.08)', padding: '0.75rem', borderRadius: '8px' }}>
            page@waf2p.dev
          </p>
        </div>
      </div>
    </div>
  )
}
