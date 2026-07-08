/** Static WAF++ controls reference data. 73 framework controls + custom controls across 8 pillars.
 * Note: Agentic controls (8th pillar) are coming soon - watch waf2p.dev for updates. */

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
  // ── Agentic pillar ──────────────────────────────────────────────────────────
  {
    id: 'WAF-AGN-010', title: 'Agent Identity, Authentication & Audit Logging',
    pillar: 'agentic', severity: 'high', category: 'identity',
    description: 'Every agent must be identifiable, authenticatable, and traceable. Agents MUST have unique, stable IDs, authenticate via IAM roles or certificates, and log all interactions to an audit trail.',
    rationale: 'Agents are privileged principals. Without stable identity, strong authentication, and audit logging, agent actions cannot be traced to a responsible party and compliance requirements cannot be met.',
    threat: [
      'Unidentified agents making unauthenticated decisions in production',
      'Agent credentials compromised and used to perform unauthorized actions',
      'Agent audit trail gaps preventing forensic investigation of incidents',
    ],
    checks_count: 4,
    automated_checks: [
      { id: 'waf-agn-010.tf.aws.bedrock-agent-id-defined', title: 'AWS Bedrock agents must have a unique identifier and IAM role', severity: 'high', resource_types: ['aws_bedrockagent'], remediation: 'Define an aws_bedrockagent resource with a unique agent_name and agent_resource_role_arn.' },
      { id: 'waf-agn-010.tf.aws.agent-audit-logging', title: 'AWS Bedrock agent interactions must be logged to CloudWatch', severity: 'high', resource_types: ['aws_cloudwatch_log_group'], remediation: 'Create an aws_cloudwatch_log_group for Bedrock agent audit logs (e.g., /aws/bedrock/agent-audit).' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.8.5', 'A.5.17'] },
      { framework: 'SOC 2 Type II', controls: ['CC6.1', 'CC6.2'] },
      { framework: 'NIST SP 800-53', controls: ['AC-2', 'IA-2', 'AU-2'] },
      { framework: 'GDPR', controls: ['Art. 32', 'Art. 5(1)(f)'] },
    ],
  },
  {
    id: 'WAF-AGN-020', title: 'Agent Tool Use Governance',
    pillar: 'agentic', severity: 'high', category: 'tools',
    description: 'Not every agent should be able to use every tool. Tool use must be approved, logged, and limited. Agents MUST have explicit tool definitions with approved lists. Wildcard tools are prohibited.',
    rationale: 'Unrestricted tool access is one of the fastest ways for an agent to exceed its authority. Explicit tool definitions, tool-call logging, and least-privilege IAM reduce blast radius.',
    threat: [
      'Agent invokes unapproved or wildcard tools leading to data exfiltration',
      'Inability to reconstruct agent decisions because tool calls are not logged',
      'Tool-call abuse due to missing rate limits or sandboxing',
    ],
    checks_count: 4,
    automated_checks: [
      { id: 'waf-agn-020.tf.aws.bedrock-agent-tools-approved', title: 'AWS Bedrock agents must have explicit, non-wildcard tool definitions', severity: 'high', resource_types: ['aws_bedrockagent'], remediation: 'Define explicit tools in the aws_bedrockagent tool_schema. Do not use wildcard tool names.' },
      { id: 'waf-agn-020.tf.aws.tool-rate-limits-configured', title: 'Agent IAM policies should limit tool-call permissions', severity: 'medium', resource_types: ['aws_iam_role_policy'], remediation: 'Restrict the agent IAM policy to only the specific actions required by the approved tools.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.8.3', 'A.5.15'] },
      { framework: 'SOC 2 Type II', controls: ['CC6.1', 'CC6.3'] },
      { framework: 'NIST SP 800-53', controls: ['AC-2', 'AC-3', 'AC-6'] },
      { framework: 'GDPR', controls: ['Art. 32', 'Art. 5(1)(f)'] },
    ],
  },
  {
    id: 'WAF-AGN-030', title: 'Agent Reasoning & Decision Traceability',
    pillar: 'agentic', severity: 'medium', category: 'observability',
    description: 'Agent decisions must be traceable, not a black box. Every decision step MUST be logged including chain of thought, reasoning, and decision outcome. Distributed tracing MUST link agent operations end-to-end.',
    rationale: 'Without reasoning logs and distributed tracing, operators cannot debug failures and auditors cannot verify compliance of autonomous decisions.',
    threat: [
      'Agent makes harmful decisions with no auditable reasoning trail',
      'Debugging and incident response blocked by opaque agent behavior',
      'Performance or latency issues cannot be traced to specific agent steps',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-030.tf.aws.bedrock-agent-logging-enabled', title: 'AWS Bedrock agent reasoning must be logged to CloudWatch', severity: 'medium', resource_types: ['aws_cloudwatch_log_group'], remediation: 'Create an aws_cloudwatch_log_group for Bedrock agent inference/reasoning logs.' },
      { id: 'waf-agn-030.tf.aws.tracing-enabled', title: 'Distributed tracing must be enabled for agent operations', severity: 'medium', resource_types: ['aws_lambda_function'], remediation: 'Set AWS_XRAY_TRACING_NAME in the Lambda environment variables.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.1', 'A.8.2'] },
      { framework: 'SOC 2 Type II', controls: ['CC4.1', 'CC7.1'] },
      { framework: 'NIST SP 800-53', controls: ['AU-2', 'AU-3', 'AU-12'] },
      { framework: 'GDPR', controls: ['Art. 32', 'Art. 5(1)(f)'] },
    ],
  },
  {
    id: 'WAF-AGN-040', title: 'Agent Memory & State Management',
    pillar: 'agentic', severity: 'high', category: 'data',
    description: 'Agent memory MUST be versioned and versioned memory stores MUST be used. State persistence MUST be configured to prevent data loss. Memory and state changes MUST be audited.',
    rationale: 'Agent memory and state may contain sensitive data. Versioning, persistence, and audit logging prevent data loss and create an immutable record of context changes.',
    threat: [
      'Agent memory corruption or deletion causing erratic or unsafe behavior',
      'Sensitive agent context lost or exposed due to unversioned storage',
      'Unauthorized memory/state modifications without audit trail',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-040.tf.aws.memory-versioning-enabled', title: 'Agent memory must be versioned or protected with point-in-time recovery', severity: 'high', resource_types: ['aws_dynamodb_table', 'aws_s3_bucket'], remediation: 'Enable point_in_time_recovery on DynamoDB tables or versioning on S3 buckets used for agent memory.' },
      { id: 'waf-agn-040.tf.aws.memory-audit-logging', title: 'Memory and state changes must be audited', severity: 'medium', resource_types: ['aws_dynamodb_table'], remediation: 'Enable stream_enabled with NEW_AND_OLD_IMAGES on DynamoDB tables used for agent memory/state.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.1', 'A.8.2', 'A.8.23'] },
      { framework: 'NIST SP 800-53', controls: ['SC-28', 'SC-39'] },
      { framework: 'GDPR', controls: ['Art. 32', 'Art. 25'] },
    ],
  },
  {
    id: 'WAF-AGN-050', title: 'Agent Guardrails & Action Boundaries',
    pillar: 'agentic', severity: 'high', category: 'guardrails',
    description: 'Content filters MUST be configured. Action boundaries MUST prevent agents from performing unauthorized actions. Human-in-the-loop MUST be configured for sensitive decisions.',
    rationale: 'Without guardrails, agents can generate harmful content, exceed their authority, or make sensitive decisions without human oversight.',
    threat: [
      'Agent generates harmful, biased, or inappropriate content',
      'Agent performs destructive or unauthorized actions due to missing boundaries',
      'High-risk decisions made without human approval',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-050.tf.aws.content-filters-enabled', title: 'AWS Bedrock agents must have a guardrail configured', severity: 'high', resource_types: ['aws_bedrockagent'], remediation: 'Add a guardrail_configuration block with a guardrail_arn to each aws_bedrockagent resource.' },
      { id: 'waf-agn-050.tf.aws.action-boundaries-configured', title: 'Agent IAM policies must be least-privilege', severity: 'high', resource_types: ['aws_iam_role_policy'], remediation: 'Restrict agent IAM policies to the specific actions required by the approved tools.' },
      { id: 'waf-agn-050.tf.aws.human-in-the-loop-configured', title: 'Human-in-the-loop must be configured for sensitive decisions', severity: 'high', resource_types: ['aws_bedrockagent'], remediation: 'Add a human_interaction_configuration block to aws_bedrockagent resources handling sensitive decisions.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.8.3', 'A.13.1.1'] },
      { framework: 'CIS Controls v8', controls: ['CIS 13'] },
      { framework: 'NIST SP 800-53', controls: ['SI-4', 'SI-5'] },
      { framework: 'GDPR', controls: ['Art. 22', 'Art. 32'] },
    ],
  },
  {
    id: 'WAF-AGN-060', title: 'Agent Orchestration & Resilience',
    pillar: 'agentic', severity: 'medium', category: 'orchestration',
    description: 'Agent orchestration MUST use coordinator/manager patterns or mesh architectures. Event-based communication MUST be configured. Failure recovery and health monitoring MUST be in place.',
    rationale: 'Multi-agent systems need decoupled, observable, and resilient communication. Event-based messaging, dead-letter queues, and health alarms provide production resilience.',
    threat: [
      'Tightly coupled agents fail together when one component goes down',
      'Lost or unprocessed agent messages with no recovery mechanism',
      'Silent agent failures due to missing health monitoring',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-060.tf.aws.event-based-communication', title: 'Agent communication must use event-based messaging', severity: 'medium', resource_types: ['aws_sqs_queue'], remediation: 'Configure an aws_sqs_queue with a redrive_policy for resilient agent event messaging.' },
      { id: 'waf-agn-060.tf.aws.failure-recovery-configured', title: 'Multi-agent systems must have failure recovery configured', severity: 'medium', resource_types: ['aws_sqs_queue', 'aws_cloudwatch_metric_alarm'], remediation: 'Configure a dead-letter queue via redrive_policy on agent SQS queues and add CloudWatch metric alarms.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.1', 'A.8.2'] },
      { framework: 'SOC 2 Type II', controls: ['CC4.1', 'CC7.1'] },
      { framework: 'NIST SP 800-53', controls: ['AU-2', 'AU-6'] },
    ],
  },
  {
    id: 'WAF-AGN-070', title: 'Agent Telemetry & Observability',
    pillar: 'agentic', severity: 'medium', category: 'observability',
    description: 'Telemetry MUST be collected for all agents including tokens, latency, and decision metrics. Metrics MUST be ingested into a monitoring system. Distributed tracing MUST link agent operations end-to-end.',
    rationale: 'Token usage, latency, error rates, and distributed traces are needed to detect anomalies, optimize cost, and troubleshoot agent failures.',
    threat: [
      'Runaway token usage or cost overruns go undetected',
      'Agent failures cannot be traced across distributed components',
      'Security incidents involving agents are not visible in monitoring',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-070.tf.aws.metrics-configured', title: 'Agent metrics must be configured in CloudWatch', severity: 'medium', resource_types: ['aws_cloudwatch_metric_alarm'], remediation: 'Create aws_cloudwatch_metric_alarm resources for Bedrock/Lambda agent metrics.' },
      { id: 'waf-agn-070.tf.aws.log-integration-configured', title: 'Agent logs must be integrated with CloudWatch metric filters', severity: 'medium', resource_types: ['aws_cloudwatch_log_metric_filter'], remediation: 'Add aws_cloudwatch_log_metric_filter resources with metric_transformations for agent log groups.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.1', 'A.8.2'] },
      { framework: 'SOC 2 Type II', controls: ['CC4.1', 'CC7.1'] },
      { framework: 'NIST SP 800-53', controls: ['AU-2', 'AU-3', 'SI-4'] },
    ],
  },
  {
    id: 'WAF-AGN-080', title: 'Human-in-the-Loop & Emergency Override',
    pillar: 'agentic', severity: 'high', category: 'governance',
    description: 'Human approval MUST be required for sensitive decisions. Approval workflows must be auditable with timestamps and approver identity. Escape hatches must exist for emergency interventions.',
    rationale: 'Autonomous systems must not make high-risk decisions without oversight. Human-in-the-loop controls, approval logs, and emergency overrides are essential safety guardrails.',
    threat: [
      'Agent makes irreversible high-risk decisions without human approval',
      'Approval records are tampered with or missing',
      'No way to stop an agent during an emergency or attack',
    ],
    checks_count: 3,
    automated_checks: [
      { id: 'waf-agn-080.tf.aws.human-in-the-loop-approved-decisions', title: 'Human-in-the-loop must be configured for sensitive decisions', severity: 'high', resource_types: ['aws_bedrockagent'], remediation: 'Add a human_interaction_configuration block to aws_bedrockagent resources handling sensitive decisions.' },
      { id: 'waf-agn-080.tf.aws.approval-audit-logging', title: 'Human approvals must be audited with full context', severity: 'high', resource_types: ['aws_cloudwatch_log_group'], remediation: 'Create an aws_cloudwatch_log_group for human approval audit logs.' },
      { id: 'waf-agn-080.tf.aws.emergency-escape-hatch', title: 'Emergency escape hatch must exist for agent intervention', severity: 'medium', resource_types: ['aws_sns_topic'], remediation: 'Create an aws_sns_topic for emergency agent alerts.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.8.3', 'A.13.1.1'] },
      { framework: 'GDPR', controls: ['Art. 22', 'Art. 32'] },
      { framework: 'NIST SP 800-53', controls: ['AC-2', 'AC-6', 'AU-2'] },
    ],
  },
  {
    id: 'WAF-AGN-090', title: 'Agent Cost Efficiency & Optimization',
    pillar: 'agentic', severity: 'medium', category: 'cost',
    description: 'Token usage and compute costs MUST be monitored. Budget alerts MUST prevent cost overruns. Model selection MUST be optimized for cost-performance tradeoffs. Caching MUST reduce redundant API calls.',
    rationale: 'Agentic workloads can consume significant token and compute resources. Monitoring, budgets, and caching are core operational requirements.',
    threat: [
      'Runaway token usage leading to unexpected cloud costs',
      'Over-provisioned or expensive models used for simple tasks',
      'Repeated identical agent queries wasting API budget',
    ],
    checks_count: 4,
    automated_checks: [
      { id: 'waf-agn-090.tf.aws.token-monitoring-configured', title: 'Agent token usage must be monitored', severity: 'medium', resource_types: ['aws_cloudwatch_metric_alarm'], remediation: 'Create aws_cloudwatch_metric_alarm resources for Bedrock token metrics.' },
      { id: 'waf-agn-090.tf.aws.budget-alerts-configured', title: 'Budget alerts must be configured for agent costs', severity: 'medium', resource_types: ['aws_budgets_budget'], remediation: 'Create an aws_budgets_budget with notifications for agent-related spending.' },
      { id: 'waf-agn-090.tf.aws.caching-configured', title: 'Caching must be implemented to reduce redundant API calls', severity: 'low', resource_types: ['aws_dynamodb_table'], remediation: 'Configure ttl with enabled = true on DynamoDB tables used as agent response caches.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.2', 'A.12.1'] },
      { framework: 'NIST SP 800-53', controls: ['SC-5', 'SC-39'] },
    ],
  },
  {
    id: 'WAF-AGN-100', title: 'Agent Debt Register',
    pillar: 'agentic', severity: 'low', category: 'governance',
    description: 'Known agent limitations must be documented in an Agent Debt Register: knowledge cutoff, tool availability, accuracy limitations, edge cases, and failure modes. The register must be reviewed quarterly with improvement plans.',
    rationale: 'Without a documented, maintained register, teams forget edge cases, oversell capabilities, and fail to plan mitigations. A Debt Register turns limitations into tracked risk items.',
    threat: [
      'Users rely on agents for tasks beyond their known limitations',
      'Known failure modes are rediscovered repeatedly because they are not documented',
      'Improvement plans are not tracked or assigned to owners',
    ],
    checks_count: 1,
    automated_checks: [
      { id: 'waf-agn-100.tf.agent-debt-register-variable', title: 'Agent Debt Register must be declared as Terraform metadata', severity: 'low', resource_types: ['variable'], remediation: 'Declare a variable "agent_debt_register" with a description that references the maintained Debt Register.' },
    ],
    regulatory_mapping: [
      { framework: 'ISO 27001:2022', controls: ['A.8.1', 'A.8.2'] },
      { framework: 'NIST SP 800-53', controls: ['RA-5', 'SI-4'] },
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
  agentic:        '#ec4899',
}
