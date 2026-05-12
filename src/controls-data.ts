/** Static WAF++ controls reference data (19 controls, 8 pillars). */

export interface AutomatedCheck {
  id: string
  title: string
  severity: string
  resource_types?: string[]
  remediation?: string
  example?: { compliant: string }
}

export interface RegulatoryMapping {
  framework: string
  controls: string[]
}

export interface Control {
  id: string
  title: string
  pillar: string
  severity: string
  category: string
  description: string
  rationale?: string
  threat?: string[]
  checks_count: number
  automated_checks: AutomatedCheck[]
  regulatory_mapping: RegulatoryMapping[]
}

export const CONTROLS: Control[] = [
  {
    id: 'WAF-SEC-010', title: 'Identity & Access Management Baseline',
    pillar: 'security', severity: 'critical', category: 'iam',
    description: 'All AWS accounts MUST enforce MFA for all IAM users with console access. Root account usage MUST be prohibited for day-to-day operations. IAM password policy MUST meet minimum security requirements.',
    rationale: 'Weak or absent identity controls are the leading cause of cloud security breaches. Enforcing MFA and strong password policies directly reduces the risk of account compromise, limits blast radius from credential theft, and is required for compliance with GDPR, ISO 27001 and financial-sector regulations.',
    threat: ['Credential theft via phishing or brute-force leading to full account takeover', 'Lateral movement across AWS accounts once initial access is gained', 'Unauthorised data access or deletion by compromised IAM principals'],
    checks_count: 2,
    automated_checks: [{
      id: 'waf-sec-010.tf.aws.iam-password-policy-mfa',
      title: 'AWS IAM account password policy must meet minimum security requirements',
      severity: 'critical', resource_types: ['aws_iam_account_password_policy'],
      remediation: 'Define an aws_iam_account_password_policy resource with minimum_password_length >= 14, all require_* flags set to true, password_reuse_prevention >= 5, and max_password_age <= 90.',
      example: { compliant: 'resource "aws_iam_account_password_policy" "strict" {\n  minimum_password_length        = 14\n  require_uppercase_characters   = true\n  require_lowercase_characters   = true\n  require_numbers                = true\n  require_symbols                = true\n  allow_users_to_change_password = true\n  max_password_age               = 90\n  password_reuse_prevention      = 5\n}' },
    }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 32', 'Art. 5(1)(f)'] },
      { framework: 'BSI C5:2020', controls: ['IAM-01', 'IAM-02'] },
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.8.5', 'A.5.17'] },
      { framework: 'EUCS (ENISA)', controls: ['IAM-01', 'IAM-02'] },
    ],
  },
  {
    id: 'WAF-SEC-020', title: 'Data Encryption at Rest & in Transit',
    pillar: 'security', severity: 'critical', category: 'encryption',
    description: 'All data at rest MUST be encrypted using AES-256 or equivalent. All data in transit MUST use TLS 1.2 or higher. S3 buckets, RDS instances, and EBS volumes must have encryption enabled.',
    rationale: 'Encryption is the last line of defence when perimeter controls fail. Unencrypted data stores mean that a single misconfiguration can result in a full data breach.',
    checks_count: 3,
    automated_checks: [
      { id: 'waf-sec-020.tf.aws.s3-encryption', title: 'S3 buckets must have server-side encryption enabled', severity: 'critical', resource_types: ['aws_s3_bucket_server_side_encryption_configuration'], remediation: 'Add an aws_s3_bucket_server_side_encryption_configuration resource with aws:kms or AES256.' },
      { id: 'waf-sec-020.tf.aws.rds-encryption', title: 'RDS instances must have storage encryption enabled', severity: 'critical', resource_types: ['aws_db_instance'], remediation: 'Set storage_encrypted = true on your aws_db_instance resource.' },
    ],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 32'] },
      { framework: 'ISO 27001:2022', controls: ['A.8.24'] },
      { framework: 'BSI C5:2020', controls: ['CRY-01'] },
    ],
  },
  {
    id: 'WAF-SEC-030', title: 'Network Security & Segmentation',
    pillar: 'security', severity: 'high', category: 'network',
    description: 'All VPCs MUST implement network segmentation with private and public subnets. Security groups MUST follow principle of least privilege. No 0.0.0.0/0 ingress on sensitive ports.',
    checks_count: 4,
    automated_checks: [{ id: 'waf-sec-030.tf.aws.no-open-sg', title: 'Security groups must not allow unrestricted inbound access', severity: 'critical', resource_types: ['aws_security_group'], remediation: 'Remove any ingress rules with cidr_blocks = ["0.0.0.0/0"] on sensitive ports.' }],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.20', 'A.8.22'] },
      { framework: 'EUCS (ENISA)', controls: ['NET-01'] },
    ],
  },
  {
    id: 'WAF-SEC-050', title: 'Logging & Monitoring Baseline',
    pillar: 'security', severity: 'high', category: 'logging',
    description: 'CloudTrail MUST be enabled in all regions with log file validation. VPC Flow Logs MUST be enabled for all VPCs. CloudWatch Alarms MUST be configured for critical events.',
    checks_count: 3,
    automated_checks: [{ id: 'waf-sec-050.tf.aws.cloudtrail', title: 'CloudTrail must be enabled with multi-region and log file validation', severity: 'high' }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 30', 'Art. 32'] },
      { framework: 'BSI C5:2020', controls: ['LOG-01', 'LOG-02'] },
      { framework: 'ISO 27001:2022', controls: ['A.8.15', 'A.8.16'] },
    ],
  },
  {
    id: 'WAF-SEC-060', title: 'Secrets Management',
    pillar: 'security', severity: 'critical', category: 'secrets',
    description: 'All secrets, API keys, and credentials MUST be stored in a dedicated secrets manager (AWS Secrets Manager or HashiCorp Vault). No hardcoded credentials in IaC or application code.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-sec-060.tf.aws.no-hardcoded-secrets', title: 'No hardcoded credentials in Terraform configuration', severity: 'critical' }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 32'] },
      { framework: 'ISO 27001:2022', controls: ['A.8.12', 'A.5.17'] },
    ],
  },
  {
    id: 'WAF-COST-010', title: 'Resource Tagging Policy',
    pillar: 'cost', severity: 'medium', category: 'tagging',
    description: 'All billable resources MUST include mandatory cost allocation tags: Environment, Team, CostCenter, and Project.',
    checks_count: 1,
    automated_checks: [{ id: 'waf-cost-010.tf.aws.mandatory-tags', title: 'All AWS resources must have mandatory cost allocation tags', severity: 'medium' }],
    regulatory_mapping: [{ framework: 'EU CSRD (Corporate Sustainability Reporting Directive)', controls: ['ESRS E1'] }],
  },
  {
    id: 'WAF-COST-020', title: 'Right-sizing & Instance Optimization',
    pillar: 'cost', severity: 'medium', category: 'optimization',
    description: 'EC2 instances MUST NOT use previous-generation instance families. Oversized instances must be right-sized or terminated within 30 days.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-cost-020.tf.aws.no-previous-gen', title: 'EC2 instances must not use previous-generation families', severity: 'medium' }],
    regulatory_mapping: [],
  },
  {
    id: 'WAF-COST-040', title: 'Reserved Capacity & Savings Plans',
    pillar: 'cost', severity: 'low', category: 'cost-optimization',
    description: 'Steady-state workloads running 24/7 MUST use Reserved Instances or Savings Plans. Minimum 30% of baseline EC2 spend must be covered by commitments.',
    checks_count: 1,
    automated_checks: [{ id: 'waf-cost-040.tf.aws.reserved-capacity', title: 'Steady-state EC2 workloads must use reserved instances', severity: 'low' }],
    regulatory_mapping: [],
  },
  {
    id: 'WAF-REL-010', title: 'Multi-AZ Deployment',
    pillar: 'reliability', severity: 'high', category: 'availability',
    description: 'All production RDS instances MUST be deployed in Multi-AZ configuration. ELB and ALB MUST span at least 2 availability zones.',
    checks_count: 3,
    automated_checks: [{ id: 'waf-rel-010.tf.aws.rds-multi-az', title: 'RDS instances must be configured for Multi-AZ deployment', severity: 'high' }],
    regulatory_mapping: [{ framework: 'ISO 27001:2022', controls: ['A.8.6', 'A.8.14'] }],
  },
  {
    id: 'WAF-REL-030', title: 'Backup & Recovery Strategy',
    pillar: 'reliability', severity: 'high', category: 'backup',
    description: 'All stateful resources MUST have automated backups enabled with minimum 7-day retention. RDS automated backups must be enabled.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-rel-030.tf.aws.rds-backup', title: 'RDS instances must have automated backups with sufficient retention', severity: 'high' }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 32'] },
      { framework: 'BSI C5:2020', controls: ['BCM-01'] },
    ],
  },
  {
    id: 'WAF-OPS-010', title: 'Infrastructure as Code Standards',
    pillar: 'operations', severity: 'medium', category: 'iac',
    description: 'All infrastructure MUST be defined and managed through IaC. Manual infrastructure changes are prohibited in production.',
    checks_count: 1,
    automated_checks: [{ id: 'waf-ops-010.tf.aws.no-manual-changes', title: 'All infrastructure must be managed via IaC', severity: 'medium' }],
    regulatory_mapping: [{ framework: 'ISO 27001:2022', controls: ['A.8.32'] }],
  },
  {
    id: 'WAF-OPS-020', title: 'Alerting & Incident Response',
    pillar: 'operations', severity: 'medium', category: 'monitoring',
    description: 'All production workloads MUST have CloudWatch alarms configured for CPU, memory, error rates, and latency.',
    rationale: 'Silent failures in production can cause prolonged outages that damage customer trust and revenue.',
    checks_count: 1,
    automated_checks: [{
      id: 'waf-ops-020.tf.aws.cloudwatch-alarms',
      title: 'CloudWatch alarms must be configured for critical metrics', severity: 'medium',
      resource_types: ['aws_cloudwatch_metric_alarm'],
      remediation: 'Define aws_cloudwatch_metric_alarm resources covering CPUUtilization, MemoryUtilization, HTTPCode_Target_5XX_Count for all production load balancers.',
    }],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.16'] },
      { framework: 'BSI C5:2020', controls: ['LOG-02'] },
    ],
  },
  {
    id: 'WAF-OPS-030', title: 'CI/CD Pipeline Security',
    pillar: 'operations', severity: 'high', category: 'pipeline',
    description: 'All CI/CD pipelines MUST include security scanning stages. SAST, DAST, and dependency scanning MUST pass before production deployment.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-ops-030.tf.aws.pipeline-security', title: 'CodePipeline must include security scanning stages', severity: 'high' }],
    regulatory_mapping: [{ framework: 'BSI C5:2020', controls: ['DEV-01', 'DEV-03'] }],
  },
  {
    id: 'WAF-SOV-010', title: 'Data Residency & Geolocation',
    pillar: 'sovereignty', severity: 'critical', category: 'data-residency',
    description: 'All data classified as EU-personal or EU-regulated MUST reside exclusively in EU AWS regions. Cross-region replication to non-EU regions is prohibited.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-sov-010.tf.aws.eu-regions-only', title: 'All resources must be deployed in approved EU regions', severity: 'critical' }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 44', 'Art. 46', 'Art. 49'] },
      { framework: 'EUCS (ENISA)', controls: ['DSP-01', 'DSP-02'] },
      { framework: 'BSI C5:2020', controls: ['LOC-01', 'LOC-02'] },
    ],
  },
  {
    id: 'WAF-SOV-020', title: 'Encryption Key Management',
    pillar: 'sovereignty', severity: 'high', category: 'kms',
    description: 'Customer-managed keys (CMKs) MUST be used for all regulated data. KMS key policies MUST restrict access to specific IAM roles. Key rotation MUST be enabled for all CMKs.',
    checks_count: 3,
    automated_checks: [{ id: 'waf-sov-020.tf.aws.kms-rotation', title: 'KMS customer-managed keys must have automatic rotation enabled', severity: 'high' }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 32'] },
      { framework: 'EUCS (ENISA)', controls: ['CRY-02'] },
      { framework: 'ISO 27001:2022', controls: ['A.8.24'] },
    ],
  },
  {
    id: 'WAF-SUS-010', title: 'Carbon-Aware Resource Scheduling',
    pillar: 'sustainability', severity: 'low', category: 'carbon',
    description: 'Batch and non-critical workloads MUST use carbon-aware scheduling. Resources in high-carbon-intensity regions must have documented justification.',
    checks_count: 1,
    automated_checks: [{ id: 'waf-sus-010.tf.aws.carbon-aware', title: 'Batch workloads must prefer low-carbon regions or schedules', severity: 'low' }],
    regulatory_mapping: [{ framework: 'EU CSRD (Corporate Sustainability Reporting Directive)', controls: ['ESRS E1 – Climate change', 'ESRS E1-6 GHG emissions'] }],
  },
  {
    id: 'WAF-PERF-010', title: 'Auto Scaling Configuration',
    pillar: 'performance', severity: 'medium', category: 'scaling',
    description: 'All EC2-based applications MUST implement Auto Scaling Groups with appropriate min/max/desired capacity.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-perf-010.tf.aws.asg-required', title: 'EC2 workloads must use Auto Scaling Groups', severity: 'medium' }],
    regulatory_mapping: [{ framework: 'ISO 27001:2022', controls: ['A.8.6'] }],
  },
  {
    id: 'WAF-PERF-030', title: 'CDN & Edge Caching',
    pillar: 'performance', severity: 'low', category: 'caching',
    description: 'Static assets and cacheable API responses MUST be served through CloudFront. Cache-Control headers MUST be configured appropriately.',
    checks_count: 2,
    automated_checks: [{ id: 'waf-perf-030.tf.aws.cloudfront-required', title: 'Static content must be distributed via CloudFront', severity: 'low' }],
    regulatory_mapping: [],
  },
  {
    id: 'WAF-GOV-010', title: 'Resource Governance Baseline',
    pillar: 'governance', severity: 'low', category: 'governance',
    description: 'All AWS accounts MUST use Service Control Policies (SCPs) to enforce governance guardrails. Resource creation MUST be restricted to approved regions only.',
    rationale: 'Without guardrails, developers can accidentally create resources in unapproved regions, violating data residency requirements and accumulating untracked cost.',
    checks_count: 1,
    automated_checks: [{
      id: 'waf-gov-010.tf.aws.scp-deny-regions',
      title: 'Service Control Policy must restrict resource creation to approved regions', severity: 'low',
      resource_types: ['aws_organizations_policy'],
      remediation: 'Define an aws_organizations_policy of type SERVICE_CONTROL_POLICY that denies all actions where aws:RequestedRegion is not in your approved regions list.',
    }],
    regulatory_mapping: [
      { framework: 'GDPR', controls: ['Art. 44'] },
      { framework: 'BSI C5:2020', controls: ['GOV-01'] },
    ],
  },
]

export const FRAMEWORKS = [
  // ── International / Global ────────────────────────────────────────────────
  { id: 'AWS Well-Architected Framework',    label: 'AWS Well-Architected Framework',    desc: 'AWS Cloud Best Practices',                                                              country: 'International',  flag: '🌍', region: 'global' },
  { id: 'Azure Well-Architected Framework',  label: 'Azure Well-Architected Framework',  desc: 'Microsoft Azure Best Practices',                                                        country: 'International',  flag: '🌍', region: 'global' },
  { id: 'Google Cloud Architecture Framework', label: 'Google Cloud Architecture Framework', desc: 'Google Cloud Best Practices',                                                         country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO 27001:2022',                    label: 'ISO 27001:2022',                    desc: 'Information Security Management Systems',                                                 country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO 27017',                         label: 'ISO 27017',                         desc: 'Code of Practice for Cloud Service Information Security Controls',                      country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO 27018',                         label: 'ISO 27018',                         desc: 'Protection of Personally Identifiable Information in Public Cloud Computing',           country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO 22301',                         label: 'ISO 22301',                         desc: 'Business Continuity Management Systems',                                                  country: 'International',  flag: '🌍', region: 'global' },
  { id: 'CIS Controls v8',                   label: 'CIS Controls v8',                   desc: 'Center for Internet Security Critical Security Controls',                                 country: 'International',  flag: '🌍', region: 'global' },
  { id: 'CSA STAR',                          label: 'CSA STAR',                          desc: 'Cloud Security Alliance Security, Trust, Assurance and Risk Registry',                  country: 'International',  flag: '🌍', region: 'global' },
  { id: 'PCI DSS v4.0',                      label: 'PCI DSS v4.0',                      desc: 'Payment Card Industry Data Security Standard',                                          country: 'International',  flag: '🌍', region: 'global' },
  { id: 'SOC 2 Type II',                     label: 'SOC 2 Type II',                     desc: 'AICPA Service Organization Controls — Security, Availability, Confidentiality',         country: 'International',  flag: '🌍', region: 'global' },
  { id: 'COBIT 2019',                        label: 'COBIT 2019',                        desc: 'Control Objectives for Information and Related Technologies',                             country: 'International',  flag: '🌍', region: 'global' },
  { id: 'FinOps Foundation',                 label: 'FinOps Foundation',                 desc: 'Cloud financial management best practices',                                             country: 'International',  flag: '🌍', region: 'global' },
  { id: 'Green Software Foundation',         label: 'Green Software Foundation',         desc: 'Software sustainability and carbon awareness',                                            country: 'International',  flag: '🌍', region: 'global' },
  { id: 'GHG Protocol',                      label: 'GHG Protocol',                      desc: 'Greenhouse Gas Protocol for emissions accounting',                                      country: 'International',  flag: '🌍', region: 'global' },
  { id: 'SBTi (Science Based Targets initiative)', label: 'SBTi',                      desc: 'Science Based Targets initiative for climate action',                                   country: 'International',  flag: '🌍', region: 'global' },
  { id: 'GAIA-X',                            label: 'GAIA-X',                            desc: 'European data infrastructure',                                                          country: 'International',  flag: '🌍', region: 'global' },
  { id: 'DevOps Research and Assessment (DORA)', label: 'DORA',                      desc: 'DevOps practices and metrics',                                                          country: 'International',  flag: '🌍', region: 'global' },
  { id: 'CNCF Cloud Native Security',        label: 'CNCF Cloud Native Security',        desc: 'Cloud native security best practices',                                                  country: 'International',  flag: '🌍', region: 'global' },
  { id: 'Google SRE Book',                   label: 'Google SRE Book',                   desc: 'Google Site Reliability Engineering',                                                   country: 'International',  flag: '🌍', region: 'global' },
  { id: 'TOGAF',                             label: 'TOGAF',                             desc: 'The Open Group Architecture Framework',                                                 country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ITIL 4',                            label: 'ITIL 4',                            desc: 'Information Technology Infrastructure Library version 4',                             country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO/IEC 12207',                     label: 'ISO/IEC 12207',                     desc: 'Software life cycle processes',                                                         country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO/IEC 29119',                     label: 'ISO/IEC 29119',                     desc: 'Software testing standards',                                                            country: 'International',  flag: '🌍', region: 'global' },
  { id: 'ISO/IEC 25010',                     label: 'ISO/IEC 25010',                     desc: 'Systems and software quality models',                                                   country: 'International',  flag: '🌍', region: 'global' },
  { id: 'NIST SP 800-161',                   label: 'NIST SP 800-161',                   desc: 'Secure Software Development',                                                           country: 'International',  flag: '🌍', region: 'global' },
  { id: 'SLSA',                              label: 'SLSA',                              desc: 'Supply Chain Levels for Software Artifacts',                                            country: 'International',  flag: '🌍', region: 'global' },
  // ── European Union ────────────────────────────────────────────────────────
  { id: 'GDPR',                              label: 'GDPR',                              desc: 'General Data Protection Regulation (EU) 2016/679',                                      country: 'European Union', flag: '🇪🇺', region: 'eu' },
  { id: 'NIS2',                              label: 'NIS2',                              desc: 'Network and Information Security Directive 2022/2555',                                    country: 'European Union', flag: '🇪🇺', region: 'eu' },
  { id: 'DORA',                              label: 'DORA',                              desc: 'Digital Operational Resilience Act (EU) 2022/2554 — financial sector resilience',         country: 'European Union', flag: '🇪🇺', region: 'eu' },
  { id: 'EUCS (ENISA)',                      label: 'EUCS (ENISA)',                      desc: 'EU Cybersecurity Certification Scheme for Cloud Services',                                country: 'European Union', flag: '🇪🇺', region: 'eu' },
  { id: 'EU CSRD (Corporate Sustainability Reporting Directive)', label: 'CSRD',           desc: 'Corporate Sustainability Reporting Directive (EU) 2022/2464',                            country: 'European Union', flag: '🇪🇺', region: 'eu' },
  { id: 'eIDAS 2.0',                         label: 'eIDAS 2.0',                         desc: 'Electronic Identification, Authentication and Trust Services Regulation',               country: 'European Union', flag: '🇪🇺', region: 'eu' },
  // ── Germany ───────────────────────────────────────────────────────────────
  { id: 'BSI C5:2020',                       label: 'BSI C5:2020',                       desc: 'Cloud Computing Compliance Criteria Catalogue — Federal Office for Information Security', country: 'Germany',        flag: '🇩🇪', region: 'de' },
  { id: 'IT-Grundschutz',                    label: 'IT-Grundschutz',                    desc: 'BSI IT-Grundschutz Compendium — Baseline Protection Methodology',                         country: 'Germany',        flag: '🇩🇪', region: 'de' },
  { id: 'TISAX',                             label: 'TISAX',                             desc: 'Trusted Information Security Assessment Exchange — VDA/ENX Automotive',                 country: 'Germany',        flag: '🇩🇪', region: 'de' },
  // ── France ────────────────────────────────────────────────────────────────
  { id: 'ANSSI SecNumCloud',                 label: 'ANSSI SecNumCloud',                 desc: 'French National Cybersecurity Agency Cloud Service Provider Qualification',             country: 'France',         flag: '🇫🇷', region: 'fr' },
  { id: 'HDS',                               label: 'HDS',                               desc: 'Hébergeur de Données de Santé — French Health Data Hosting Certification',              country: 'France',         flag: '🇫🇷', region: 'fr' },
  // ── Netherlands ───────────────────────────────────────────────────────────
  { id: 'BIO',                               label: 'BIO',                               desc: 'Baseline Informatiebeveiliging Overheid — Dutch Government Baseline Security',          country: 'Netherlands',    flag: '🇳🇱', region: 'nl' },
  // ── Spain ─────────────────────────────────────────────────────────────────
  { id: 'ENS High',                          label: 'ENS High',                          desc: 'Esquema Nacional de Seguridad — Spanish National Security Framework (High Category)',   country: 'Spain',          flag: '🇪🇸', region: 'es' },
  // ── United Kingdom ────────────────────────────────────────────────────────
  { id: 'UK Cyber Essentials',               label: 'Cyber Essentials',                  desc: 'NCSC-backed UK Government scheme for baseline cyber hygiene',                           country: 'United Kingdom', flag: '🇬🇧', region: 'gb' },
  { id: 'UK NCSC CAF',                       label: 'NCSC CAF',                          desc: 'Cyber Assessment Framework for UK critical national infrastructure operators',        country: 'United Kingdom', flag: '🇬🇧', region: 'gb' },
  { id: 'UK GDPR',                           label: 'UK GDPR',                           desc: 'UK General Data Protection Regulation — post-Brexit adaptation of EU GDPR',             country: 'United Kingdom', flag: '🇬🇧', region: 'gb' },
  // ── United States ─────────────────────────────────────────────────────────
  { id: 'NIST SP 800-53',                    label: 'NIST SP 800-53',                    desc: 'Security and Privacy Controls for Information Systems and Organizations',               country: 'United States',  flag: '🇺🇸', region: 'us' },
  { id: 'NIST CSF 2.0',                      label: 'NIST CSF 2.0',                      desc: 'Cybersecurity Framework — Identify, Protect, Detect, Respond, Recover, Govern',        country: 'United States',  flag: '🇺🇸', region: 'us' },
  { id: 'FedRAMP',                           label: 'FedRAMP',                           desc: 'Federal Risk and Authorization Management Program — US Government Cloud Authorisation', country: 'United States',  flag: '🇺🇸', region: 'us' },
  { id: 'HIPAA',                             label: 'HIPAA',                             desc: 'Health Insurance Portability and Accountability Act — US Health Data Security',         country: 'United States',  flag: '🇺🇸', region: 'us' },
  { id: 'CCPA',                              label: 'CCPA',                              desc: 'California Consumer Privacy Act — US State Privacy Law',                                  country: 'United States',  flag: '🇺🇸', region: 'us' },
  { id: 'CMMC 2.0',                          label: 'CMMC 2.0',                          desc: 'Cybersecurity Maturity Model Certification — US Department of Defense',                 country: 'United States',  flag: '🇺🇸', region: 'us' },
  // ── Australia ─────────────────────────────────────────────────────────────
  { id: 'ASD Essential 8',                   label: 'ASD Essential 8',                   desc: 'Australian Signals Directorate — Eight Essential Mitigation Strategies',                country: 'Australia',      flag: '🇦🇺', region: 'au' },
  { id: 'IRAP',                              label: 'IRAP',                              desc: 'Information Security Registered Assessors Program — Australian Government Cloud Assessment', country: 'Australia',   flag: '🇦🇺', region: 'au' },
  // ── Canada ────────────────────────────────────────────────────────────────
  { id: 'PIPEDA',                            label: 'PIPEDA',                            desc: 'Personal Information Protection and Electronic Documents Act',                          country: 'Canada',         flag: '🇨🇦', region: 'ca' },
  { id: 'CCCS PBMM',                        label: 'CCCS PBMM',                         desc: 'Canadian Centre for Cyber Security — Protected B, Medium Integrity, Medium Availability', country: 'Canada',         flag: '🇨🇦', region: 'ca' },
  // ── Singapore ─────────────────────────────────────────────────────────────
  { id: 'MAS TRM',                           label: 'MAS TRM',                           desc: 'Monetary Authority of Singapore Technology Risk Management Guidelines',                 country: 'Singapore',      flag: '🇸🇬', region: 'sg' },
  { id: 'PDPA SG',                           label: 'PDPA (Singapore)',                  desc: 'Personal Data Protection Act 2012 — Singapore',                                           country: 'Singapore',      flag: '🇸🇬', region: 'sg' },
  // ── Brazil ────────────────────────────────────────────────────────────────
  { id: 'LGPD',                              label: 'LGPD',                              desc: 'Lei Geral de Proteção de Dados — Brazilian General Data Protection Law',                country: 'Brazil',         flag: '🇧🇷', region: 'br' },
  // ── India ─────────────────────────────────────────────────────────────────
  { id: 'DPDP Act',                          label: 'DPDP Act',                          desc: 'Digital Personal Data Protection Act 2023 — India',                                       country: 'India',          flag: '🇮🇳', region: 'in' },
  { id: 'MEITY CSMP',                        label: 'MEITY CSMP',                        desc: 'Ministry of Electronics & IT Cloud Service Provider Metering Policy',                   country: 'India',          flag: '🇮🇳', region: 'in' },
  // ── Japan ─────────────────────────────────────────────────────────────────
  { id: 'ISMAP',                             label: 'ISMAP',                             desc: 'Information System Security Management and Assessment Program — Japan Government Cloud', country: 'Japan',          flag: '🇯🇵', region: 'jp' },
  { id: 'FISC',                              label: 'FISC',                              desc: 'Center for Financial Industry Information Systems Security Standards — Japan',          country: 'Japan',          flag: '🇯🇵', region: 'jp' },
  // ── Internal ──────────────────────────────────────────────────────────────
  { id: 'Internal Governance',               label: 'Internal Governance',               desc: 'Internal organizational policies and procedures',                                       country: 'Other',          flag: '🏢', region: 'internal' },
  { id: 'FinOps Foundation',                 label: 'FinOps Foundation',                 desc: 'Cloud financial management best practices',                                             country: 'Other',          flag: '🏢', region: 'internal' },
]

export const PILLAR_COLOR: Record<string, string> = {
  security:       '#DA2C38',
  cost:           '#f97316',
  reliability:    '#0094FF',
  operations:     '#8b5cf6',
  sovereignty:    '#06b6d4',
  sustainability: '#22c55e',
  performance:    '#eab308',
  governance:     '#94a3b8',
}
