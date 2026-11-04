import { useState, useEffect } from 'react'
import { sandboxScan, sandboxStatus, SandboxResponse, SandboxControlResult } from '../api'
import { severityBg, severityColor, scoreColor } from '../severity'
import { EmptyState, Skeleton, SkeletonText } from '../ui'
import { useI18n } from '../i18n'
import { PAGE_TITLE } from '../routing'

// ── Types shared between mock and real engine ─────────────────────────────────

interface CheckResult {
  check_id: string
  check_title: string
  severity: string
  status: string
  resource: string
  message: string
  remediation: string
}

interface SandboxResult {
  control_id: string
  control_title: string
  pillar: string
  severity: string
  status: string
  check_results: CheckResult[]
}

interface SandboxOutput {
  engine: 'mock' | 'real'
  controls_loaded?: number
  controls_dir?: string
  score: number
  total_pass: number
  total_fail: number
  total_skip: number
  results: SandboxResult[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PASS: 'var(--pass)', FAIL: 'var(--fail)', SKIP: 'var(--skip)',
}

const TEMPLATES: Record<string, { label: string; code: string }> = {
  weak_iam: {
    label: 'templateWeakIam',
    code: `resource "aws_iam_account_password_policy" "weak" {
  minimum_password_length        = 6
  require_symbols                = false
  require_numbers                = false
  require_uppercase_characters   = false
  require_lowercase_characters   = false
  allow_users_to_change_password = true
}
`,
  },
  open_storage: {
    label: 'templateOpenStorage',
    code: `resource "aws_s3_bucket" "data" {
  bucket = "unprotected-data-lake"
}

resource "aws_db_instance" "database" {
  identifier        = "prod-db"
  engine            = "postgres"
  instance_class    = "db.t3.medium"
  allocated_storage = 20
  username          = "admin"
  password          = "MyPassword123!"
  skip_final_snapshot = true
  # Missing: storage_encrypted, backup_retention_period, multi_az
}
`,
  },
  open_sg: {
    label: 'templateOpenSg',
    code: `resource "aws_security_group" "open" {
  name        = "allow-all"
  description = "Wide-open security group"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Unrestricted SSH
  }

  ingress {
    from_port   = 3389
    to_port     = 3389
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Unrestricted RDP
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`,
  },
  compliant_s3: {
    label: 'templateCompliantS3',
    code: `resource "aws_s3_bucket" "secure" {
  bucket = "my-secure-bucket"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "secure" {
  bucket = aws_s3_bucket.secure.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.bucket.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "secure" {
  bucket = aws_s3_bucket.secure.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "secure" {
  bucket                  = aws_s3_bucket.secure.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
`,
  },
  compliant_rds: {
    label: 'templateCompliantRds',
    code: `resource "aws_db_instance" "secure" {
  identifier              = "prod-db"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = "db.t3.medium"
  allocated_storage       = 20
  username                = "admin"
  manage_master_user_password = true
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn
  multi_az                = true
  backup_retention_period = 14
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "prod-db-final"
}
`,
  },
}

// ── Mock engine ───────────────────────────────────────────────────────────────

function simulateScan(code: string): SandboxOutput {
  const c = code.toLowerCase()
  const res: SandboxResult[] = []

  if (c.includes('aws_s3_bucket"') || c.includes("aws_s3_bucket '")) {
    const hasEnc = c.includes('aws_s3_bucket_server_side_encryption_configuration')
    const hasPab = c.includes('block_public_acls') && c.includes('= true')
    res.push({
      control_id: 'WAF-SEC-020', control_title: 'Data Encryption at Rest & in Transit',
      pillar: 'security', severity: 'critical',
      status: hasEnc ? 'PASS' : 'FAIL',
      check_results: [{
        check_id: 'waf-sec-020.tf.aws.s3-encryption',
        check_title: 'S3 bucket must have SSE enabled',
        severity: 'critical', resource: 'aws_s3_bucket',
        status: hasEnc ? 'PASS' : 'FAIL',
        message: hasEnc ? 'Encryption configured (aws:kms)' : "'server_side_encryption_configuration' block not found",
        remediation: hasEnc ? '' : 'Add an aws_s3_bucket_server_side_encryption_configuration resource referencing your bucket.',
      }, {
        check_id: 'waf-sec-020.tf.aws.s3-public-access-block',
        check_title: 'S3 public access block must be enabled',
        severity: 'high', resource: 'aws_s3_bucket',
        status: hasPab ? 'PASS' : 'FAIL',
        message: hasPab ? 'Public access block configured' : 'aws_s3_bucket_public_access_block not found',
        remediation: hasPab ? '' : 'Add aws_s3_bucket_public_access_block with all options set to true.',
      }],
    })
  }

  if (c.includes('aws_iam_account_password_policy')) {
    const m = c.match(/minimum_password_length\s*=\s*(\d+)/)
    const len = m ? parseInt(m[1]) : 0
    const ok = len >= 14 && c.includes('require_symbols') && !c.includes('require_symbols                = false')
    res.push({
      control_id: 'WAF-SEC-010', control_title: 'Identity & Access Management Baseline',
      pillar: 'security', severity: 'critical',
      status: ok ? 'PASS' : 'FAIL',
      check_results: [{
        check_id: 'waf-sec-010.tf.aws.iam-password-policy',
        check_title: 'IAM password policy meets minimum requirements',
        severity: 'critical', resource: 'aws_iam_account_password_policy',
        status: ok ? 'PASS' : 'FAIL',
        message: ok ? 'Password policy meets requirements' : `minimum_password_length is ${len || '(unset)'}, must be >= 14`,
        remediation: ok ? '' : 'Set minimum_password_length = 14 and all require_* flags to true.',
      }],
    })
  }

  if (c.includes('aws_security_group')) {
    const openSSH = c.includes('0.0.0.0/0') && (c.match(/from_port\s*=\s*22/) || c.match(/from_port\s*=\s*3389/))
    res.push({
      control_id: 'WAF-SEC-030', control_title: 'Network Security & Segmentation',
      pillar: 'security', severity: 'high',
      status: openSSH ? 'FAIL' : 'PASS',
      check_results: [{
        check_id: 'waf-sec-030.tf.aws.no-open-sg',
        check_title: 'Security groups must not allow unrestricted inbound',
        severity: 'critical', resource: 'aws_security_group',
        status: openSSH ? 'FAIL' : 'PASS',
        message: openSSH ? 'Unrestricted 0.0.0.0/0 ingress on SSH (22) or RDP (3389) detected' : 'No unrestricted inbound rules detected',
        remediation: openSSH ? 'Remove 0.0.0.0/0 ingress rules and restrict to known CIDR ranges.' : '',
      }],
    })
  }

  if (c.includes('aws_db_instance')) {
    const enc = c.match(/storage_encrypted\s*=\s*true/)
    const bk = c.match(/backup_retention_period\s*=\s*([7-9]|[1-9]\d+)/)
    const maz = c.match(/multi_az\s*=\s*true/)
    res.push({
      control_id: 'WAF-SEC-020-rds', control_title: 'Data Encryption at Rest (RDS)',
      pillar: 'security', severity: 'critical',
      status: enc ? 'PASS' : 'FAIL',
      check_results: [{
        check_id: 'waf-sec-020.tf.aws.rds-encryption',
        check_title: 'RDS storage must be encrypted',
        severity: 'critical', resource: 'aws_db_instance',
        status: enc ? 'PASS' : 'FAIL',
        message: enc ? 'storage_encrypted = true' : "'storage_encrypted' is not set or is false",
        remediation: enc ? '' : 'Set storage_encrypted = true.',
      }],
    })
    if (!bk) res.push({
      control_id: 'WAF-REL-030', control_title: 'Backup & Recovery Strategy',
      pillar: 'reliability', severity: 'high', status: 'FAIL',
      check_results: [{
        check_id: 'waf-rel-030.tf.aws.rds-backup', check_title: 'RDS backup retention period >= 7 days',
        severity: 'high', resource: 'aws_db_instance', status: 'FAIL',
        message: 'backup_retention_period is not set or < 7 days',
        remediation: 'Set backup_retention_period to at least 7.',
      }],
    })
    if (!maz) res.push({
      control_id: 'WAF-REL-010', control_title: 'Multi-AZ Deployment',
      pillar: 'reliability', severity: 'high', status: 'FAIL',
      check_results: [{
        check_id: 'waf-rel-010.tf.aws.rds-multi-az', check_title: 'RDS must be deployed Multi-AZ',
        severity: 'high', resource: 'aws_db_instance', status: 'FAIL',
        message: "'multi_az' is not set or is false",
        remediation: 'Set multi_az = true on aws_db_instance.',
      }],
    })
  }

  if (res.length === 0) {
    return { engine: 'mock', score: 100, total_pass: 0, total_fail: 0, total_skip: 1, results: [] }
  }
  const pass = res.filter(r => r.status === 'PASS').length
  const fail = res.filter(r => r.status === 'FAIL').length
  const scored = pass + fail
  return { engine: 'mock', score: scored ? Math.round(pass / scored * 100) : 100, total_pass: pass, total_fail: fail, total_skip: 0, results: res }
}

// ── Adapter: real engine response → SandboxOutput ────────────────────────────

function fromRealEngine(r: SandboxResponse): SandboxOutput {
  return {
    engine: 'real',
    controls_loaded: r.controls_loaded,
    controls_dir: r.controls_dir,
    score: r.score,
    total_pass: r.total_pass,
    total_fail: r.total_fail,
    total_skip: r.total_skip,
    results: r.results.map((cr: SandboxControlResult) => ({
      control_id: cr.control_id,
      control_title: cr.control_title,
      pillar: cr.pillar,
      severity: cr.severity,
      status: cr.status,
      check_results: cr.check_results,
    })),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────


type EngineMode = 'mock' | 'real'
type RealEngineStatus = 'unknown' | 'checking' | 'available' | 'unavailable'

// ── Component ─────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [output, setOutput] = useState<SandboxOutput | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [engineMode, setEngineMode] = useState<EngineMode>('mock')
  const [realStatus, setRealStatus] = useState<RealEngineStatus>('unknown')
  const [realStatusDetail, setRealStatusDetail] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)

  // Probe real engine availability once on mount
  useEffect(() => {
    setRealStatus('checking')
    sandboxStatus()
      .then(s => {
        if (s.engine_available && s.controls_dir_exists) {
          setRealStatus('available')
          setRealStatusDetail(`${s.controls_dir}`)
        } else if (!s.engine_available) {
          setRealStatus('unavailable')
          setRealStatusDetail(t('pages.phase3.sandbox.statusWombatCoreMissing'))
        } else {
          setRealStatus('unavailable')
          setRealStatusDetail(t('pages.phase3.sandbox.statusControlsDirNotFound', { dir: s.controls_dir }))
        }
      })
      .catch(() => {
        setRealStatus('unavailable')
        setRealStatusDetail(t('pages.phase3.sandbox.statusServerUnreachable'))
      })
  }, [])

  async function runScan() {
    if (!code.trim()) return
    setScanning(true)
    setOutput(null)
    setScanError(null)

    if (engineMode === 'real') {
      try {
        const result = await sandboxScan(code)
        setOutput(fromRealEngine(result))
      } catch (e) {
        setScanError(e instanceof Error ? e.message : String(e))
      }
    } else {
      await new Promise(r => setTimeout(r, 500))
      setOutput(simulateScan(code))
    }
    setScanning(false)
  }

  function handleTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = e.currentTarget
    const s = ta.selectionStart
    ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(ta.selectionEnd)
    ta.selectionStart = ta.selectionEnd = s + 2
    setCode(ta.value)
  }

  const realAvailable = realStatus === 'available'

  const enginePill = (() => {
    if (realStatus === 'checking') return { label: t('pages.phase3.sandbox.checking'), color: 'var(--skip)' }
    if (realStatus === 'available') return { label: t('pages.phase3.sandbox.realEngineReady'), color: 'var(--pass)' }
    return { label: t('pages.phase3.sandbox.realEngineUnavailable'), color: 'var(--waf-warn)' }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 className="ui-sr-only">{PAGE_TITLE['sandbox']}</h1>

      {/* Engine mode selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        padding: '0.75rem 1rem', borderRadius: '10px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('pages.phase3.sandbox.engine')}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['mock', 'real'] as EngineMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { if (mode === 'real' && !realAvailable) return; setEngineMode(mode); setOutput(null); setScanError(null) }}
              style={{
                padding: '0.35rem 0.875rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                border: `1px solid ${engineMode === mode ? 'var(--waf-brand)' : 'var(--border)'}`,
                background: engineMode === mode ? 'color-mix(in srgb, var(--waf-brand) 10%, transparent)' : 'var(--bg)',
                color: engineMode === mode ? 'var(--waf-brand-ink)' : mode === 'real' && !realAvailable ? 'var(--muted)' : 'var(--text)',
                cursor: mode === 'real' && !realAvailable ? 'not-allowed' : 'pointer',
                opacity: mode === 'real' && !realAvailable ? 0.6 : 1,
              }}
            >
              {mode === 'mock' ? t('pages.phase3.sandbox.mockRegex') : t('pages.phase3.sandbox.realEngine')}
            </button>
          ))}
        </div>

        <span style={{
          fontSize: '0.72rem', fontWeight: 600, color: enginePill.color,
          background: `color-mix(in srgb, ${enginePill.color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${enginePill.color} 25%, transparent)`,
          borderRadius: '999px', padding: '0.18rem 0.65rem',
        }}>
          {enginePill.label}
        </span>

        {realStatusDetail && (
          <span style={{ fontSize: '0.71rem', color: 'var(--muted)', marginLeft: 'auto', fontFamily: 'monospace' }}>
            {realStatusDetail}
          </span>
        )}

        {!realAvailable && realStatus !== 'checking' && (
          <span style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>
            {realStatus === 'unavailable'
              ? t('pages.phase3.sandbox.enableHint')
              : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Editor panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {t('pages.phase3.sandbox.editorTitle')}
            </h2>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  onClick={() => { setCode(tpl.code); setOutput(null); setScanError(null) }}
                  style={{
                    fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--muted)', cursor: 'pointer',
                  }}
                >
                  {t(`pages.phase3.sandbox.${tpl.label}`)}
                </button>
              ))}
              <button
                onClick={() => { setCode(''); setOutput(null); setScanError(null) }}
                style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                {t('pages.phase3.sandbox.clear')}
              </button>
            </div>
          </div>

          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleTab}
            placeholder={`${t('pages.phase3.sandbox.editorPlaceholderHint')}\n\nresource "aws_s3_bucket" "example" {\n  bucket = "my-bucket"\n}`}
            style={{
              width: '100%', minHeight: '380px', resize: 'vertical',
              background: '#0f172a', color: '#e2e8f0', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.875rem', fontSize: '0.78rem',
              fontFamily: 'monospace', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => void runScan()}
              disabled={scanning || !code.trim()}
              style={{
                background: scanning || !code.trim() ? 'var(--border)' : 'var(--waf-brand-btn)',
                color: scanning || !code.trim() ? 'var(--muted)' : 'white', border: 'none', borderRadius: '8px',
                padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700,
                cursor: scanning || !code.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
            >
              {scanning ? (
                <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> {t('pages.phase3.sandbox.analysing')}</>
              ) : t('pages.phase3.sandbox.analyseWith', { engine: engineMode === 'real' ? t('pages.phase3.sandbox.realEngineName') : t('pages.phase3.sandbox.mockEngineName') })}
            </button>
            {engineMode === 'real' && (
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {t('pages.phase3.sandbox.runsAllControls')}
              </span>
            )}
          </div>
        </div>

        {/* Results panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!output && !scanning && !scanError && (
            <EmptyState
              icon={<span style={{ fontSize: '2.5rem' }}>🔬</span>}
              title={t('pages.phase3.sandbox.emptyTitle')}
              description={engineMode === 'real'
                ? t('pages.phase3.sandbox.emptyDescReal')
                : t('pages.phase3.sandbox.emptyDescMock')}
            />
          )}

          {scanning && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <Skeleton height={20} width="45%" />
              <div style={{ marginTop: '1rem' }}>
                <SkeletonText lines={4} />
              </div>
            </div>
          )}

          {scanError && (
            <div style={{
              background: 'color-mix(in srgb, var(--fail) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)',
              borderRadius: '10px', padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--fail-ink)',
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>{t('pages.phase3.sandbox.engineError')}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{scanError}</div>
            </div>
          )}

          {output && (
            <>
              {/* Score card */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor(output.score), lineHeight: 1 }}>{output.score}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>/100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--pass-ink)' }}>{output.total_pass}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.phase3.sandbox.pass')}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--fail-ink)' }}>{output.total_fail}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.phase3.sandbox.fail')}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--muted)' }}>{output.total_skip}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.phase3.sandbox.skip')}</div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: '999px', height: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{
                        height: '100%', borderRadius: '999px', transition: 'width 0.7s',
                        width: `${output.score}%`, background: scoreColor(output.score),
                      }} />
                    </div>
                  </div>
                </div>

                {/* Engine metadata */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  <span>
                    {t('pages.phase3.sandbox.engineLabel')}{' '}
                    <strong style={{ color: output.engine === 'real' ? 'var(--pass-ink)' : 'var(--text)' }}>
                      {output.engine === 'real' ? t('pages.phase3.sandbox.realWombatEngine') : t('pages.phase3.sandbox.mockRegex')}
                    </strong>
                  </span>
                  {output.controls_loaded != null && (
                    <span>{t('pages.phase3.sandbox.controlsEvaluated')} <strong style={{ color: 'var(--text)' }}>{output.controls_loaded}</strong></span>
                  )}
                  {output.results.length > 0 && (
                    <span>{t('pages.phase3.sandbox.withFindings')} <strong style={{ color: 'var(--text)' }}>{output.results.length}</strong></span>
                  )}
                </div>
              </div>

              {/* Results list — FAIL first, then PASS, skip SKIP */}
              {[...output.results]
                .sort((a, b) => {
                  if (a.status === b.status) return 0
                  if (a.status === 'FAIL') return -1
                  if (b.status === 'FAIL') return 1
                  return 0
                })
                .filter(r => r.status !== 'SKIP')
                .map(r => (
                  <div key={r.control_id} className="card" style={{ padding: '0.75rem', borderLeft: `3px solid ${STATUS_COLOR[r.status] ?? 'var(--skip)'}` }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                      onClick={() => setExpanded(expanded === r.control_id ? null : r.control_id)}
                    >
                      <span style={{
                        padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                        background: `color-mix(in srgb, ${STATUS_COLOR[r.status]} 14%, transparent)`, color: STATUS_COLOR[r.status],
                      }}>{r.status}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', flex: 1 }}>{r.control_title}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--bg-secondary)', borderRadius: '4px', padding: '0.08rem 0.4rem' }}>
                        {r.pillar}
                      </span>
                      <span style={{
                        padding: '0.1rem 0.4rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                        background: severityBg(r.severity), color: severityColor(r.severity),
                      }}>{r.severity}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{expanded === r.control_id ? '▲' : '▼'}</span>
                    </div>

                    {expanded === r.control_id && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {r.check_results.map((chk, i) => (
                          <div key={i} style={{ background: 'var(--bg)', borderRadius: '6px', padding: '0.625rem 0.75rem', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                              <span style={{
                                padding: '0.08rem 0.4rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                                background: `color-mix(in srgb, ${STATUS_COLOR[chk.status]} 14%, transparent)`, color: STATUS_COLOR[chk.status], flexShrink: 0,
                              }}>{chk.status}</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{chk.check_title}</span>
                            </div>
                            {chk.resource && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.2rem', fontFamily: 'monospace' }}>
                                {chk.resource}
                              </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: chk.remediation ? '0.35rem' : 0 }}>{chk.message}</div>
                            {chk.remediation && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--waf-brand-ink)', fontStyle: 'italic' }}>
                                {t('pages.phase3.sandbox.fix')} {chk.remediation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

    </div>
  )
}
