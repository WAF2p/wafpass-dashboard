import { useTheme } from '../theme'
import { useI18n } from '../i18n'

export default function AntiPatternMuseumPage() {
  const { themeName } = useTheme()
  const { t } = useI18n()

  return (
    <div style={{ maxWidth: 'none', width: '100%', margin: '0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.5rem' }}>
          {t('pages.antipattern.title')}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          Learn faster by seeing what goes wrong - side-by-side comparisons of anti-patterns vs. WAF++ compliant best practices
        </p>
      </div>

      {/* Executive Summary */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          The Anti-Pattern Museum
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Documentation usually shows how to do things right, but engineers learn faster by seeing what is wrong.
            This museum showcases the most common infrastructure anti-patterns found in real-world IaC code,
            paired with WAF++-compliant alternatives.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(218,44,56,0.1)' : 'rgba(218,44,56,0.05)',
              border: '1px solid rgba(218,44,56,0.2)',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#DA2C38' }}>Anti-Patterns</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '0.5rem 0 0' }}>Common security flaws and misconfigurations</p>
            </div>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#22c55e' }}>Best Practices</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '0.5rem 0 0' }}>WAF++ compliant alternatives</p>
            </div>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.05)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: '8px'
            }}>
              <strong style={{ color: '#fbbf24' }}>74 Controls</strong>
              <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '0.5rem 0 0' }}>All WAF++ pillars covered (SEC, SOV, OPS, COST, PERF, REL, SUS)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: IAM Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          1. IAM & Security Baseline
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Common identity and access management anti-patterns that violate WAF-SEC-010 and WAF-SEC-020.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Permissive IAM Password Policy (WAF-SEC-010)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Weak password policy
resource "aws_iam_account_password_policy" "weak" {
  minimum_password_length        = 6          # Too short!
  require_uppercase_characters   = false      # Not required
  require_lowercase_characters   = false      # Not required
  require_numbers                = false      # Not required
  require_symbols                = false      # No special chars!
  max_password_age               = 0          # Never expires!
  password_reuse_prevention      = 0          # Reuse allowed!
}

# Why this is bad:
# - 6 characters can be brute-forced in minutes
# - No complexity requirements = easily guessable passwords
# - Passwords never expire = stale credentials
# - No reuse prevention = password cycling attacks`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Strict IAM Password Policy
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-010 COMPLIANT: Strong password policy
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14         # Meets WAF++ requirement
  require_uppercase_characters   = true       # Complexity enforced
  require_lowercase_characters   = true       # Complexity enforced
  require_numbers                = true       # Complexity enforced
  require_symbols                = true       # Complexity enforced
  max_password_age               = 90         # Regular rotation
  password_reuse_prevention      = 5          # Prevents cycling
}

# WAF++ COMPLIANCE CHECKLIST:
# [✓] minimum_password_length >= 14 characters
# [✓] All complexity flags enabled (uppercase, lowercase, numbers, symbols)
# [✓] Password expires after 90 days
# [✓] Prevents reuse of last 5 passwords`}</pre>
            </div>
          </div>

          {/* Anti-Pattern 2 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Root Access Keys & No MFA (WAF-SEC-010)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Root account with access keys
# Never do this - ROOT ACCOUNT SHOULD HAVE NO PROGRAMMATIC ACCESS

# Root access keys in code (EXTREME RISK):
data "aws_iam_access_key" "root" {
  user = "root"
  # This is a critical security violation!
}

# Root without MFA (HIGH RISK):
# No MFA enforced on root account
# Root used for day-to-day operations
# Root has long-term access keys

# Why this is bad:
# - Root has unlimited permissions
# - No MFA means stolen keys = instant full access
# - Root keys never rotate automatically
# - No audit trail for root actions`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: No Root Access, MFA Enforced
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-010 COMPLIANT: Root account security
# Root access keys MUST be removed manually via AWS Console
# Terraform cannot manage root account access keys (by design)

# Verify with CLI: aws iam get-account-summary | jq '.AccountAccessKeysPresent'
# Expected value: 0 (NO access keys for root!)

# Why this works for WAF-SEC-010:
# - Root account has NO programmatic access keys
# - Root MFA is enabled (enforced via SCP: DenyConsoleActionWithoutMFA)
# - Root account used ONLY for account-level tasks (billing, closing)
# - All operational work done via IAM roles with temporary credentials
# - SCPs prevent root login without MFA:
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "aws-portal:ViewAccount",
    "Resource": "*",
    "Condition": {
      "BoolIfExists": {"aws:MultiFactorAuthPresent": "false"}
    }
  }]
}`}</pre>
            </div>
          </div>

          {/* Anti-Pattern 3 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: AdministratorAccess Policy (WAF-SEC-020)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Overly permissive IAM role
resource "aws_iam_role_policy_attachment" "admin" {
  role       = aws_iam_role.app_role.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"  # VIOLATION!
  # or worse:
  # policy_arn = "arn:aws:iam::aws:policy/FullAWSAccess"
}

# Why this is bad:
# - AdministratorAccess grants ALL AWS permissions
# - Violates least-privilege principle (WAF-SEC-020)
# - If compromised, attacker has full account access
# - Cannot be audited or restricted meaningfully`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Scoped Least-Privilege Policy
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-020 COMPLIANT: Scoped policy with specific actions/resources
resource "aws_iam_role" "app_role" {
  name = "app-service-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

# WAF-SEC-020 COMPLIANT: Scoped policy
resource "aws_iam_policy" "app_scoped_policy" {
  name = "app-service-scoped-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3: Only Get/Put/Delete on specific bucket
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::myapp-bucket/*"
      },
      # SSM: Only get parameter values
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:eu-central-1:123456789012:parameter/app/*"
      },
      # CloudWatch Logs: Only write to specific log group
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:eu-central-1:123456789012:log-group:/app/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_attach" {
  role       = aws_iam_role.app_role.name
  policy_arn = aws_iam_policy.app_scoped_policy.arn
}

# WAF++ COMPLIANCE CHECKLIST:
# [✓] No AdministratorAccess or FullAWSAccess policies
# [✓] Actions explicitly listed, no wildcards
# [✓] Resources restricted to specific ARNs
# [✓] Read operations only where possible (no List/Modify on sensitive resources)`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Encryption Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          2. Encryption & Secrets Management
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Encryption and secrets management anti-patterns that violate WAF-SEC-030 and WAF-SEC-060.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Unencrypted RDS Instance (WAF-SEC-030)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Unencrypted database
resource "aws_db_instance" "non_compliant" {
  identifier           = "app-unencrypted-db"
  engine               = "postgres"
  engine_version       = "15.7"
  instance_class       = "db.t4g.medium"
  allocated_storage    = 50
  storage_type         = "gp3"
  storage_encrypted    = false  # CRITICAL VIOLATION!
  # kms_key_id not set - using default AWS key

  # Database credentials - sometimes hardcoded (WAF-SEC-060 violation)
  username = "admin"
  password = "SuperSecret123!"  # HARD-CODED PASSWORD - NEVER DO THIS!

  # Network isolation missing
  vpc_security_group_ids = ["sg-all-open"]  # 0.0.0.0/0 - WIDE OPEN!
  db_subnet_group_name   = "default"

  # No automated backups
  backup_retention_period = 0
  skip_final_snapshot     = true

  # No maintenance window
  auto_minor_version_upgrade = false
  maintenance_window         = "None"
  copy_tags_to_snapshot      = false
}

# Why this is bad:
# - storage_encrypted = false: Data at rest is unencrypted
# - Using default AWS KMS key (not customer-managed)
# - Credentials may be hardcoded in source control
# - No backup retention = data loss risk
# - No encryption at rest violates WAF-SEC-030`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Encrypted RDS with Secrets Manager
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-030 & WAF-SEC-060 COMPLIANT: Encrypted RDS with CMK and Secrets
resource "aws_kms_key" "database" {
  description             = "CMK for RDS database encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

# Secrets Manager secret with CMK encryption
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "prod/app/database/password"
  description             = "RDS database master password"
  kms_key_id              = aws_kms_key.database.arn
  recovery_window_in_days = 30
  tags = {
    owner       = "platform-team"
    environment = "production"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password_value  # Set via secure pipeline variable
  })
}

resource "aws_db_instance" "compliant" {
  identifier           = "app-encrypted-db"
  engine               = "postgres"
  engine_version       = "15.7"
  instance_class       = "db.t4g.medium"
  allocated_storage    = 50
  storage_type         = "gp3"
  storage_encrypted    = true  # WAF-SEC-030: Encryption at rest
  kms_key_id           = aws_kms_key.database.arn  # WAF-SEC-030: CMK

  # Database credentials from Secrets Manager (not hardcoded)
  username = var.db_username
  password = data.aws_secretsmanager_secret_version.db_password.secret_string

  # Network isolation
  vpc_security_group_ids = ["sg-encrypted-app"]
  db_subnet_group_name   = "db-subnet-group"

  # Automated backups with CMK encryption
  backup_retention_period = 7
  backup_target           = "region"
  skip_final_snapshot     = false

  # Maintenance window
  auto_minor_version_upgrade = true
  maintenance_window         = "Mon:00:00-Mon:02:00"
  copy_tags_to_snapshot      = true
}

# WAF++ COMPLIANCE CHECKLIST:
# [✓] storage_encrypted = true
# [✓] kms_key_id references customer-managed CMK
# [✓] Backup retention enabled
# [✓] Credentials from Secrets Manager (not hardcoded)
# [✓] CMK encryption on secrets
# [✓] Recovery window set to 30 days`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: CI/CD Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          3. CI/CD Pipeline
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            CI/CD pipeline anti-patterns that violate WAF-OPS-010 and WAF-OPS-020.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Local State & No Pipeline Gates (WAF-OPS-010, WAF-OPS-020)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Local state and no CI/CD gates
# No backend configuration - local state only
terraform {
  # No backend - local state
  # No version pinning
}

# Why this is bad:
# - Local state = no team collaboration
# - No remote state = state loss on local machine failure
# - No state locking = concurrent modifications = corruption
# - No version pinning = provider breaking changes
# - No pipeline = manual deployments = human error

# No CI/CD Pipeline (direct git push to main):
# git push origin main  # Direct deployment - NO VALIDATION!
# - No linting (tflint)
# - No format check (terraform fmt)
# - No validation (terraform validate)
# - No security scan (Trivy, Checkov)
# - No approval gate
# - No post-deployment validation`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Remote State with Full CI/CD Pipeline
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-OPS-020 COMPLIANT: Terraform Remote State
terraform {
  backend "s3" {
    bucket         = "myorg-terraform-state"
    key            = "infrastructure/production/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

# WAF-OPS-010 COMPLIANT: Full CI/CD Pipeline
# File: .github/workflows/terraform.yml

name: Terraform CI/CD

on:
  push:
    branches: [main]
    paths: ['**/*.tf', '**/*.tfvars']
  pull_request:
    branches: [main]

jobs:
  # Job 1: Pre-flight checks
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Terraform lint
        run: tflint --init --config .tflint.hcl
      - name: Terraform format check
        run: terraform fmt -check -recursive
      - name: Secret scanning
        run: gitleaks detect --source . --verbose

  # Job 2: Validate and plan
  plan:
    needs: preflight
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Terraform init
        run: terraform init -input=false
      - name: Terraform validate
        run: terraform validate
      - name: Terraform plan
        run: terraform plan -input=false

  # Job 3: Security scanning
  security-scan:
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy IaC scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          format: 'table'

  # Job 4: Approval
  approval:
    needs: security-scan
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Waiting for approval
        run: echo "Waiting for production deployment approval"

  # Job 5: Apply
  apply:
    needs: approval
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Terraform init
        run: terraform init -input=false
      - name: Terraform apply
        run: terraform apply -input=false -auto-approve

  # Job 6: Post-deployment validation
  validate:
    needs: apply
    runs-on: ubuntu-latest
    steps:
      - name: Run post-deployment checks
        run: aws iam get-account-password-policy

# WAF++ COMPLIANCE CHECKLIST:
# [✓] Remote S3 backend with state locking
# [✓] State encryption enabled
# [✓] Lint, format, validate in pipeline
# [✓] Security scanning (Trivy) before apply
# [✓] Manual approval gate for production
# [✓] Post-deployment validation job`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Networking Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          4. Networking & Security Controls
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Networking and security anti-patterns that violate WAF-SEC-070.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Open Security Group (WAF-SEC-070)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Security group with 0.0.0.0/0
resource "aws_security_group" "open" {
  name        = "open-security-group"
  description = "Open security group - DO NOT USE"
  vpc_id      = var.vpc_id

  # CRITICAL: SSH open to the entire internet
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # EVERYWHERE - CRITICAL RISK!
    description = "SSH from anywhere"
  }

  # CRITICAL: RDP open to the entire internet
  ingress {
    from_port   = 3389
    to_port     = 3389
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # EVERYWHERE - CRITICAL RISK!
    description = "RDP from anywhere"
  }

  # CRITICAL: Database port open to the entire internet
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # EVERYWHERE - CRITICAL RISK!
    description = "PostgreSQL from anywhere"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }
}

# Why this is bad:
# - SSH (22) open to 0.0.0.0/0 = brute-force attacks from anywhere
# - RDP (3389) open to 0.0.0.0/0 = ransomware entry point
# - PostgreSQL (5432) open to 0.0.0.0/0 = direct database attacks
# - No network isolation = lateral movement if compromised
# - Violates WAF-SEC-070 (Vulnerability Management)`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Restricted Security Group with VPC Endpoints
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-070 COMPLIANT: Security group with restricted access
resource "aws_security_group" "restricted" {
  name        = "app-security-group"
  description = "App security group with restricted access"
  vpc_id      = var.vpc_id

  # SSH only from bastion host or jump box
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]  # Only from bastion
    description = "SSH from bastion only"
  }

  # HTTPS from load balancer
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # Only from VPC
    description = "HTTPS from VPC"
  }

  # Database only from application tier
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.2.0/24"]  # Only from app tier
    description = "PostgreSQL from app tier"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (needed for updates)"
  }

  tags = {
    Name        = "app-security-group"
    Environment = var.environment
  }
}

# WAF-SEC-070 COMPLIANT: VPC Endpoints for AWS services
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.eu-central-1.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [var.app_route_table_id]

  tags = {
    Name        = "s3-vpc-endpoint"
    Environment = var.environment
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.eu-central-1.dynamodb"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [var.app_route_table_id]

  tags = {
    Name        = "dynamodb-vpc-endpoint"
    Environment = var.environment
  }
}

# WAF-SEC-070 COMPLIANT: ECR with scanning enabled
resource "aws_ecr_repository" "app" {
  name                 = "app-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true  # WAF-SEC-070: Scan on every push
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.ecr_kms_key_arn
  }

  tags = {
    Name        = "App Service Repository"
    Environment = var.environment
  }
}

# WAF++ COMPLIANCE CHECKLIST:
# [✓] No 0.0.0.0/0 for SSH/RDP/Database ports
# [✓] SSH restricted to bastion/VPN IP ranges
# [✓] Database only accessible from app tier
# [✓] VPC endpoints for S3/DynamoDB (no public internet)
# [✓] ECR image scanning enabled on push
# [✓] ECR immutable tags enabled`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Sovereignty Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          5. Sovereignty & Data Residency
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Sovereignty and data residency anti-patterns that violate WAF-SOV-010 and WAF-SOV-020.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: No Region Validation (WAF-SOV-020)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: No region restrictions
variable "region" {
  type        = string
  description = "AWS region"  # No validation - any region allowed!
  default     = "us-east-1"   # Default to non-sovereign region
}

# This allows deployment to ANY region:
# - us-east-1 (US)
# - us-west-2 (US)
# - ap-southeast-1 (Singapore - China region risk)
# - sa-east-1 (South America)
# - me-south-1 (Bahrain - US data protection concerns)

resource "aws_s3_bucket" "data" {
  bucket = "myorg-data"
  # No region-specific configuration
  # No data residency enforcement
}

# Why this is bad:
# - Data may end up in non-sovereign regions
# - Violates GDPR data residency requirements
# - No audit trail of where data is stored
# - No automatic region enforcement
# - Violates WAF-SOV-020 (Region Pinning)`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Enforced Region Validation
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SOV-020 COMPLIANT: Sovereign region validation
variable "aws_region" {
  type        = string
  default     = "eu-central-1"
  description = "AWS region for sovereign deployments (must be EU region)"

  validation {
    condition     = contains(["eu-central-1", "eu-west-1", "eu-north-1"], var.aws_region)
    error_message = "Region must be in approved sovereign EU list: eu-central-1, eu-west-1, eu-north-1."
  }
}

variable "aws_availability_zones" {
  type        = list(string)
  default     = ["eu-central-1a", "eu-central-1b"]
  description = "Availability zones in sovereign region"

  validation {
    condition     = alltrue([for az in var.aws_availability_zones : startswith(az, "eu-central-")])
    error_message = "Availability zones must be in sovereign region."
  }
}

# Data residency classification for resources
variable "data_residency" {
  type        = string
  default     = "eu-only"
  description = "Data residency constraint for resources"

  validation {
    condition     = contains(["eu-only", "de-only", "ch-only", "global-approved"], var.data_residency)
    error_message = "Data residency must be one of: eu-only, de-only, ch-only, global-approved."
  }
}

# Provider configuration using validated variables
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment     = var.environment
      Data-Class      = var.data_class
      Data-Residency  = var.data_residency
      Managed-By      = "Terraform"
    }
  }
}

# WAF-SOV-010 COMPLIANT: S3 bucket with data residency tags
resource "aws_s3_bucket" "app_data" {
  bucket = "myorg-app-data-prod"
  tags = {
    Name        = "Application Data Bucket"
    Environment = "production"
    data-class      = "operational"      # WAF-SOV-010: Data classification
    data-residency  = "eu-only"          # WAF-SOV-010: Data residency
    owner         = "platform-team"
  }
}

# S3 bucket policy for PII data (GDPR-compliant)
resource "aws_s3_bucket_policy" "pii_data" {
  bucket = aws_s3_bucket.pii_data.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyAccessOutsideEU"
      Effect    = "Deny"
      Principal = "*"
      Action    = ["s3:GetObject", "s3:PutObject"]
      Resource  = "arn:aws:s3:::pii-bucket/*"
      Condition = {
        StringNotEquals = {
          "aws:SourceVpc" = ["vpc-approved-id"]
          "aws:SourceIp"  = ["10.0.0.0/8", "192.168.0.0/16"]
        }
      }
    }]
  })
}

# WAF++ COMPLIANCE CHECKLIST:
# [✓] Region variable has validation block
# [✓] Availability zones validated to sovereign region
# [✓] Data residency variable with validation
# [✓] All resources tagged with data-class and data-residency
# [✓] S3 bucket policies restrict access based on VPC/IP
# [✓] Only approved sovereign regions allowed`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Logging Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          6. Logging & Incident Response
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Logging and incident response anti-patterns that violate WAF-SEC-100.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: No Security Logging (WAF-SEC-100)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: No security logging configured
# CloudWatch log groups with no retention (logs expire immediately)
resource "aws_cloudwatch_log_group" "no_retention" {
  name = "/aws/cloudtrail/logs"
  # No retention_in_days set - uses default (indefinite retention can be expensive)
  # But more commonly, logs are not created at all!
}

# No CloudTrail configured
# No VPC Flow Logs
# No GuardDuty enabled
# No CloudWatch Alarms for security events

# Why this is bad:
# - No audit trail of who did what and when
# - Cannot investigate security incidents
# - No detection of suspicious activities
# - Non-compliant with SOC2, ISO27001, GDPR audit requirements
# - Violates WAF-SEC-100 (Incident Response Readiness)`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Comprehensive Security Logging
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-SEC-100 COMPLIANT: Security Logging with 365-Day Retention

# CloudWatch Log Groups with 365-day retention
resource "aws_cloudwatch_log_group" "app_security" {
  name              = "/security/application-events"
  retention_in_days = 365  # WAF-SEC-100: Minimum 365 days retention
  kms_key_id        = var.logs_kms_key_arn

  tags = {
    Name        = "Application Security Logs"
    Retention   = "365 days"
    Data-Class  = "operational"
  }
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/security/vpc-flow-logs"
  retention_in_days = 365  # WAF-SEC-100: Minimum 365 days retention
  kms_key_id        = var.logs_kms_key_arn
}

resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/security/cloudtrail"
  retention_in_days = 365  # WAF-SEC-100: Minimum 365 days retention
  kms_key_id        = var.logs_kms_key_arn
}

# CloudTrail for audit trail
resource "aws_cloudtrail" "main" {
  name                          = "main-cloudtrail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail_logs.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = var.cloudtrail_kms_key_arn
  include_global_service_events = true

  tag {
    key   = "Name"
    value = "CloudTrail Main"
  }
}

# VPC Flow Logs for network forensic analysis
resource "aws_flow_log" "vpc" {
  vpc_id          = var.vpc_id
  traffic_type    = "ALL"
  log_destination_type = "cloudwatch-logs"
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
}

# CloudWatch Alarms for security events
resource "aws_cloudwatch_metric_alarm" "root_login" {
  alarm_name          = "root-login-detected"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ConsoleLogin"
  namespace           = "AWS/CloudTrail"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert on AWS console login"
  dimensions = {
    "eventSource" = "signin.amazonaws.com"
    "resourceId"  = var.account_id
  }
  alarm_actions = [aws_sns_topic.security_alerts.arn]
}

# WAF-SEC-100 COMPLIANCE CHECKLIST:
# [✓] All security log groups have retention_in_days = 365
# [✓] Logs encrypted with CMK (kms_key_id)
# [✓] CloudTrail enabled with log file validation
# [✓] VPC flow logs enabled for network forensic analysis
# [✓] CloudWatch alarms for critical security events
# [✓] SNS topic for security alerting`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Cost Anti-Patterns */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          7. Cost Optimization
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Cost optimization anti-patterns that violate WAF-COST controls.
          </p>

          {/* Anti-Pattern 1 */}
          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#fff1f2',
            border: '1px solid rgba(218,44,56,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#fee2e2', color: '#DA2C38', fontSize: '0.7rem', fontWeight: 700 }}>
              Anti-Pattern: Unmanaged Resources (WAF-COST-010, WAF-COST-020)
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# SECURITY RISK: Unmanaged resources - cost anti-patterns
# No resource tagging strategy
# No cleanup policies
# No cost monitoring

# Unmanaged EC2 instances - no termination protection
resource "aws_instance" "dev" {
  ami           = var.ami_id
  instance_type = "t3.large"
  # No termination protection
  # No scheduled stop/start
  # No auto-termination for dev resources
}

# Unmanaged EBS volumes - no snapshot policy
resource "aws_ebs_volume" "data" {
  availability_zone = "eu-central-1a"
  size              = 100
  # No snapshot creation schedule
  # No automatic cleanup of old snapshots
}

# Unmanaged RDS instances - no backup retention
resource "aws_db_instance" "dev" {
  identifier = "dev-database"
  # No automated backups
  # No final snapshot on deletion
  # No multi-AZ for high availability
}

# Why this is bad:
# - Resources left running when not needed = unnecessary costs
# - No cleanup policy = orphaned resources accumulating costs
# - No tagging = no cost allocation or tracking
# - No termination protection = accidental deletion risk
# - Violates WAF-COST controls (Resource Management, Cleanup)`}</pre>
            </div>
          </div>

          <div style={{
            background: themeName === 'dark' ? '#1e293b' : '#ecfdf5',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}>
            <div style={{ padding: '0.75rem 1rem', background: themeName === 'dark' ? '#334155' : '#d1fae5', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>
              WAF++ Compliant: Managed Resources with Cost Controls
            </div>
            <div style={{ padding: '1rem' }}>
              <pre style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text)',
                margin: 0,
                overflowX: 'auto'
              }}>{`# WAF-COST COMPLIANT: Managed resources with cost controls

# EC2 with termination protection and scheduling
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = "t3.medium"
  iam_instance_profile = var.app_instance_profile

  # Termination protection
  disable_api_termination = true

  # Tags for cost allocation
  tags = {
    Name        = "app-server"
    Environment = var.environment
    CostCenter  = "platform-team"
    Owner       = "app-team"
    ManagedBy   = "Terraform"
  }
}

# EBS volume with automated snapshots
resource "aws_ebs_volume" "data" {
  availability_zone = "eu-central-1a"
  size              = 100
  volume_type       = "gp3"

  tags = {
    Name        = "app-data-volume"
    Environment = var.environment
    CostCenter  = "platform-team"
  }
}

# Snapshot lifecycle policy
resource "aws_ebs_snapshot_lifecycle_policy" "data" {
  role_arn = aws_iam_role.snapshot_lifecycle_role.arn

  rule {
    name     = "daily-snapshots"
    schedule = "rate(1 days)"
    target_region = "eu-central-1"
    variable_tags = {
      Environment = var.environment
    }
  }

  rule {
    name     = "weekly-snapshots"
    schedule = "rate(7 days)"
    target_region = "eu-central-1"
    retain_rule {
      count = 4  # Keep 4 weekly snapshots
    }
    variable_tags = {
      Environment = var.environment
    }
  }

  tags = {
    Name        = "Data Snapshot Policy"
    Environment = var.environment
  }
}

# RDS with automated backups and multi-AZ
resource "aws_db_instance" "main" {
  identifier = "app-primary-db"
  engine     = "postgres"
  engine_version = "15.7"

  # Automated backups
  backup_retention_period = 7
  backup_target           = "region"

  # Multi-AZ for high availability
  multi_az = true

  # Tags for cost allocation
  tags = {
    Name        = "Primary Database"
    Environment = var.environment
    CostCenter  = "platform-team"
  }
}

# WAF-COST COMPLIANCE CHECKLIST:
# [✓] All resources tagged with CostCenter and Owner
# [✓] EC2 termination protection enabled
# [✓] EBS snapshot lifecycle policy for automated backups
# [✓] RDS automated backups enabled (7 days retention)
# [✓] Multi-AZ deployment for HA and data protection
# [✓] Cost tracking and allocation enabled`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Anti-Pattern Museum Summary
        </h2>
        <div style={{
          background: themeName === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '1rem' }}>
            This museum showcases the most common infrastructure anti-patterns found in real-world IaC code,
            paired with WAF++-compliant alternatives. By learning from these mistakes, you can:
          </p>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text)', marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <li><strong>Identify issues faster:</strong> Recognize patterns that indicate security vulnerabilities</li>
            <li><strong>Prevent common mistakes:</strong> Avoid anti-patterns that lead to compliance failures</li>
            <li><strong>Learn from examples:</strong> See both what not to do and what to do instead</li>
            <li><strong>Understand WAF++:</strong> See how each control addresses specific security gaps</li>
          </ul>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(218,44,56,0.1)' : 'rgba(218,44,56,0.05)',
              border: '1px solid rgba(218,44,56,0.2)',
              borderRadius: '8px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#DA2C38', margin: '0 0 0.5rem' }}>Anti-Patterns</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', margin: 0 }}>Common security flaws and misconfigurations that violate WAF++ controls</p>
            </div>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#22c55e', margin: '0 0 0.5rem' }}>Best Practices</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', margin: 0 }}>WAF++ compliant alternatives with explanations of why they work</p>
            </div>
            <div style={{
              padding: '1rem',
              background: themeName === 'dark' ? 'rgba(0,148,255,0.1)' : 'rgba(0,148,255,0.05)',
              border: '1px solid rgba(0,148,255,0.2)',
              borderRadius: '8px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0094ff', margin: '0 0 0.5rem' }}>74 Controls</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text)', margin: 0 }}>WAF-SEC, WAF-SOV, WAF-OPS, WAF-COST, WAF-PERF, WAF-REL, WAF-SUS covered</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
