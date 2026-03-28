import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import RunDetailPage from './pages/RunDetailPage'
import RunsPage from './pages/RunsPage'

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ background: '#1e2130', padding: '1rem 0', borderBottom: '1px solid #2d3748' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#60a5fa' }}>WAF++ PASS</span>
          <Link to="/" style={{ color: '#a0aec0' }}>Runs</Link>
        </div>
      </nav>
      <main className="container" style={{ paddingTop: '2rem' }}>
        <Routes>
          <Route path="/" element={<RunsPage />} />
          <Route path="/runs/:id" element={<RunDetailPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
