const copy: Record<string, string> = {
  // ── Copy button ──
  copied: 'Copied!',
  copy: 'Copy',

  // ── Empty / error states ──
  selectRun: 'Select a run to use the Auto-Fix wizard.',
  noIacPath: 'This run does not have an associated IaC path, so auto-fix cannot be invoked.',
  couldNotContactClassify: 'Could not contact the classify endpoint.',
  localPreviewUnavailable: 'Local preview unavailable: {{message}}',
  localPreviewNoRunId: 'Local preview: no run_id was sent, so source snapshots cannot be used to generate diffs.',
  classifyFailed: 'classify endpoint failed',
  previewFailed: 'Preview failed',
  applyFailed: 'Apply failed',
  rollbackFailed: 'Rollback failed',

  // ── Header and stats ──
  title: 'Auto-Fix Wizard',
  backToDashboard: '← Back to dashboard',
  failingFindings: 'Failing findings',
  selectedScope: 'Selected scope',
  score: 'Score',

  // ── Scope and view controls ──
  allFailures: 'All failures',
  byPillar: 'By pillar',
  byControl: 'By control',
  serverPreviewTitle: 'Call wombat-server /api/auto-fix (the server must have direct filesystem access to the IaC path)',
  localPreviewTitle: 'Build a read-only plan from stored findings and source snapshots (no filesystem access needed)',
  serverPreview: 'Server preview',
  localPreview: 'Local preview',
  previewing: 'Previewing…',
  previewFixes: 'Preview fixes',
  applyFixes: 'Apply fixes',
  rollback: 'Rollback',

  // ── Server error ──
  serverCannotApply: 'Server cannot apply fixes directly',
  serverAccessBefore: 'Server preview requires the wombat-server container to have direct filesystem access to the IaC path. If it does not, switch to',
  serverAccessAfter: 'or run the CLI locally from the repository root:',

  // ── Local preview notice ──
  localPreviewMode: 'Local preview mode',
  localPreviewDescription: 'This builds a read-only remediation plan from the stored scan findings. When the run has a stored source snapshot, unified diffs are generated directly from the database; otherwise only the patch list is shown. No filesystem access is required.',
  snapshotHint: 'To store snapshots with a local CLI scan, run:',

  // ── Rollback ──
  rollbackComplete: 'Rollback complete: restored {{count}} file(s).',
  noBackups: 'No backup files found to restore.',

  // ── Result cards ──
  patches: 'Patches',
  skipped: 'Skipped',
  filesModified: 'Files modified',
  resolved: 'Resolved',
  stillFailing: 'Still failing',
  regressions: 'Regressions',
  warnings: 'Warnings',

  // ── Patches table ──
  diffPreview: 'Diff preview',
  plannedPatches: 'Planned patches',
  clickRowForDiff: '(click a row to view diff)',
  colFile: 'File',
  colResource: 'Resource',
  colAttribute: 'Attribute',
  colKind: 'Kind',
  colNewValue: 'New value',
  colControl: 'Control',

  // ── Patch diff modal ──
  patchDiff: 'Patch diff',
  close: 'Close',
  noDiffForPatch: 'No diff preview available for this patch.',
  noDiffLocal: 'No unified diff is available for this patch. The source files are not stored for this run because it was pushed from a CI/CD pipeline (POST /api/v1/runs). Only runs created via a server-side scan (POST /api/v1/scan) keep a source snapshot. Switch to Server preview or run the CLI locally to see file-level changes.',
  noDiffServer: 'The server did not return a diff for this file. This can happen when the patch target file is outside the scanned path or no textual change could be derived.',

  // ── Apply locally ──
  applyLocally: 'Apply locally',
  localReadOnly: 'The local preview is read-only. To actually modify the source files, run this command where your IaC is checked out:',

  // ── Manual remediation ──
  manualRemediation: 'Manual remediation',
  itemsClickToExpand: '{{count}} item(s) — click to expand',
  noFixes: 'No fixes could be derived for the selected scope.',

  // ── Apply confirmation ──
  applyFixesQuestion: 'Apply fixes?',
  applyConfirmBefore: 'This will write',
  applyConfirmMid: 'patch(es) to',
  applyConfirmAfterFiles: 'file(s). A',
  applyConfirmAfterCode: 'backup is created for each modified file and can be restored with the rollback button.',
  cancel: 'Cancel',
  applying: 'Applying…',
  confirmApply: 'Confirm apply',
}

export default copy
