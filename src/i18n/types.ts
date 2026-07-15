/**
 * Translation schema — every key defined here must exist in en.ts.
 * Other locales use DeepPartial<Translations> and fall back to English for missing keys.
 *
 * Adding a new language:
 *   1. Create src/i18n/locales/xx.ts implementing DeepPartial<Translations>
 *   2. Add it to the LOCALES map in src/i18n/index.tsx
 *   3. Done — the switcher picks it up automatically.
 */

export interface Translations {
  meta: {
    code: string     // ISO 639-1: 'en' | 'de' | 'fr' | 'es'
    name: string     // native name: 'English', 'Deutsch', etc.
    flag: string     // emoji flag
  }

  common: {
    save: string
    saving: string
    saved: string
    cancel: string
    close: string
    reset: string
    apply: string
    confirm: string
    delete: string
    edit: string
    search: string
    filter: string
    sortBy: string
    all: string
    none: string
    select: string
    loading: string
    error: string
    noData: string
    yes: string
    no: string
    enabled: string
    disabled: string
    active: string
    inactive: string
    total: string
    of: string
    copy: string
    copied: string
    export: string
    download: string
    more: string       // "3 more…"
    showLess: string
    notMapped: string
    preview: string
    default: string
    custom: string
    optional: string
    view: string       // "View" (as in "View Passports")
    health: string
    needsAttention: string
    improving: string
    project: string    // "Project" (as in table column header)
    projects: string   // "Projects" (plural)
    projects_count: string // "{{count}} project(s)"
  }

  nav: {
    sections: {
      journey: string
      overview: string
      ciso: string
      architect: string
      engineer: string
      runs: string
      admin: string
      system: string
      bestpractices: string
    }
    items: {
      dashboard: string
      globaldashboard: string
      catalogue: string
      findings: string
      compliance: string
      gapanalysis: string
      regions: string
      exploitpath: string
      blastradius: string
      depgraph: string
      remediation: string
      secrets: string
      modules: string
      cost: string
      runs: string
      diff: string
      audit: string
      evidence: string
      settings: string
      runscan: string
      sandbox: string
      waivers: string
      risk: string
      changes: string
      feedback: string
      skipped: string
      access: string
      users: string
      apikeys: string
      sso: string
      groupmappings: string
      controlspacks: string
      passports: string
      badge: string
      leaderboard: string
      journey: string
      userprefs: string
      reference: string
      antipattern: string
      bestpractices: string
      projectgroups: string
      notifications: string
      pipelines: string
      'compliance-readiness': string
    }
  }

  status: {
    pass: string
    fail: string
    skip: string
    waived: string
    unknown: string
    critical: string
    high: string
    medium: string
    low: string
    cleared: string
    boarding: string
    grounded: string
  }

  severity: {
    critical: string
    high: string
    medium: string
    low: string
  }

  maturity: {
    label: string            // "Maturity Level"
    foundational: string
    operational: string
    governed: string
    optimized: string
    excellence: string
    active: string
    controlCoverage: string
    severityThreshold: string
    pillarsActive: string
    intelligenceActive: string
  }

  prefs: {
    title: string
    subtitle: string
    syncIdle: string
    syncSaving: string
    syncSaved: string
    syncError: string
    changesInstant: string
    appearance: string
    theme: string
    themeDark: string
    themeLight: string
    compactSidebar: string
    compactSidebarDesc: string
    hideDisabled: string
    hideDisabledDesc: string
    inlineHelp: string
    inlineHelpDesc: string
    navigation: string
    defaultPage: string
    defaultPageDesc: string
    language: string
    languageDesc: string
    languageSystemDefault: string
    dates: string
    dateFormat: string
    dateRelative: string
    dateAbsolute: string
    dateFull: string
    datePreview: string
    reports: string
    autoPdf: string
    autoPdfDesc: string
    darkModePdf: string
    darkModePdfDesc: string
    resetSection: string
    resetDesc: string
    resetBtn: string
  }

  settings: {
    title: string
    subtitle: string
    defaultLanguage: string
    defaultLanguageDesc: string
    scanConfig: string
    defaultIac: string
    defaultIacDesc: string
    failOn: string
    failOnDesc: string
    minSeverity: string
    minSeverityDesc: string
    pillarCoverage: string
    pillarCoverageDesc: string
    intelligence: string
    intelligenceDesc: string
    regulatoryScope: string
    regulatoryScopeDesc: string
    pdfSections: string
    pdfSectionsDesc: string
    connection: string
    connectionDesc: string
    saveSettings: string
    resetPreset: string
    settingsSaved: string
    activeRegions: string
    frameworksInScope: string
    presets: {
      international: string
      europe: string
      germany: string
      allRegions: string
    }
    failOnOptions: {
      fail: string
      skip: string
      never: string
    }
    severity: {
      all: string
      critical: string
      high: string
      medium: string
    }
  }

  compliance: {
    pillarTab: string
    frameworkTab: string
    searchPlaceholder: string
    sortCountry: string
    sortName: string
    sortCoverageDesc: string
    sortCoverageAsc: string
    allRegionsBtn: string
    notMappedBadge: string
    noMappingDesc: string
    passRate: string
    controlsMapped: string
    noMatch: string
    pillarCol: string
    totalCol: string
    noPillarData: string
    failingFindings: string
    passLabel: string
    failLabel: string
  }

  pages: {
    login: {
      title: string          // "Sign in"
      productLabel: string   // "Controls Dashboard"
      username: string
      password: string
      signingIn: string      // "Signing in…"
      signIn: string         // "Sign in" (button)
      or: string
      footerLocal: string    // "Local authentication · Contact your administrator…"
      footerSso: string      // "Local and SSO authentication enabled · Contact your administrator…"
    }

    findings: {
      searchPlaceholder: string   // "Search checks, resources…"
      allStatuses: string         // "All statuses"
      allSeverities: string       // "All severities"
      allPillars: string          // "All pillars"
      noFindings: string          // "No findings match the current filters."
      selected: string            // "{{count}} finding(s) selected"
      uniqueControls: string      // "{{count}} unique control(s)"
      waiveControls: string       // "Waive {{count}} control(s)"
      exportSelection: string     // "↓ Export selection"
      clearSelection: string      // "Clear selection"
      exportVisibleFilters: string // "Export visible filters only"
      exportAllFindings: string   // "All findings"
      colCheck: string
      colResource: string
      colPillar: string
      colSeverity: string
      colStatus: string
      detailResource: string
      detailMessage: string
      detailRemediation: string
      detailExample: string       // "Example Fix"
      detailControlId: string     // "Control ID"
      waiveModalTitle: string     // "Waive {{count}} control(s)"
      waiveModalSubtitle: string  // "Creates or updates a waiver entry…"
      waiveReason: string
      waiveOwner: string
      waiveExpires: string
      wavingSaving: string        // "Saving…"
      wavingDone: string          // "{{count}} waiver(s) saved"
      waiveBtn: string            // "Waive {{count}} control(s)"
      // Comments section
      commentSection: string      // "Collaboration on this finding"
      commentBtn: string          // "Add Comment"
      commentThread: string       // "{{count}} comment(s)"
      noComments: string          // "No comments yet. Be the first to comment!"
      confirmDeleteComment: string // "Delete this comment?"
      deleteComment: string       // "Delete"
    }

    waivers: {
      addBtn: string              // "+ Add Waiver"
      copyYaml: string
      copied: string
      downloadYml: string         // "Download .wafpass-skip.yml"
      noWaivers: string           // "No waivers configured"
      noWaiversHint: string
      previewTitle: string        // ".wafpass-skip.yml Preview"
      previewHint: string
      expired: string             // "EXPIRED"
      expires: string             // "expires {{date}}"
      owner: string               // "Owner: {{owner}}"
      addWaiver: string           // "Add Waiver"
      editWaiver: string          // "Edit Waiver"
      controlLabel: string        // "Control *"
      reasonLabel: string
      ownerLabel: string
      expiresLabel: string
      saveChanges: string         // "Save Changes"
      syncLoading: string         // "Loading…"
      syncSaving: string          // "Saving…"
      syncSynced: string          // "Synced"
      syncOffline: string         // "Offline — cached data"
      syncError: string           // "Sync error"
    }

    risk: {
      addBtn: string              // "+ Record Risk Acceptance"
      searchPlaceholder: string   // "Search by ID, reason, owner…"
      records: string             // "{{count}} record(s)"
      noRecords: string
      noRecordsHint: string
      approver: string            // "Approver:"
      owner: string               // "Owner:"
      rfc: string                 // "RFC:"
      accepted: string            // "Accepted:"
      expires: string             // "Expires:"
      expired: string             // "EXPIRED"
      residual: string            // "residual: {{level}}"
      addTitle: string            // "Record Risk Acceptance"
      editTitle: string           // "Edit Risk Acceptance"
      controlLabel: string
      reasonLabel: string
      approverLabel: string
      ownerLabel: string
      rfcLabel: string
      acceptedAtLabel: string     // "Accepted At"
      expiresLabel: string
      riskLevelLabel: string      // "Risk Level"
      residualRiskLabel: string   // "Residual Risk"
      jiraLabel: string           // "Jira Link"
      otherLinkLabel: string      // "Other Reference Link"
      notesLabel: string
      levelAccepted: string       // "Accepted"
      levelMitigated: string      // "Mitigated"
      residualLow: string
      residualMedium: string
      residualHigh: string
      recordBtn: string           // "Record"
      saveChanges: string
    }

    runs: {
      runs: string                // "runs" (as in "12 runs")
      first: string
      latest: string
      projects: string            // "{{count}} project(s)"
      allBranches: string
      allStages: string
      viewAll: string             // "All runs"
      viewProject: string         // "Project"
      viewTrend: string           // "Trend"
      overallScore: string        // "Overall Score Over Time"
      pillarScores: string        // "Pillar Scores Over Time"
      needTwoScans: string        // "Run at least 2 scans to see a trend."
      singleRun: string           // "single run"
      clickDot: string            // "Click dot to open run"
      colProject: string
      colBranch: string
      colStage: string
      colScore: string
      colFramework: string
      colTriggeredBy: string
      colControls: string
      colDate: string
      avgScore: string            // "avg score"
      noRuns: string
      loadMore: string            // "Load more..."
    }

    diff: {
      needTwoRuns: string         // "At least two runs are needed to compare."
      onlyOneRun: string          // "Only one run exists — record another scan…"
      baseLabel: string           // "Base (older / PR target)"
      headLabel: string           // "Head (newer / PR branch)"
      sameRunWarning: string
      newlyFailed: string         // "Newly Failed"
      fixed: string               // "Fixed"
      stillFailing: string        // "Still Failing"
      noNewFailures: string       // "No new failures"
      nothingFixed: string        // "Nothing fixed"
      noPersistent: string        // "No persistent failures — clean!"
      messageLabel: string        // "Message"
      remediationLabel: string    // "Remediation"
      loadingRuns: string         // "Loading runs…"
      selectTwo: string           // "Select two runs above to see the diff."
      scoreImproved: string       // "Score improved"
      scoreRegressed: string      // "Score regressed"
      noChange: string            // "No change"
    }

    scan: {
      serverPanel: string         // "Run Scan from Server"
      checking: string            // "Checking…"
      ready: string               // "Ready"
      unavailable: string         // "Unavailable"
      iacPathLabel: string        // "Server-side IaC path"
      frameworkLabel: string
      projectLabel: string
      branchLabel: string
      stageLabel: string
      scanning: string            // "Scanning…"
      runScan: string             // "Run Scan"
      scanComplete: string        // "Scan complete — run persisted"
      scoreLabel: string          // "Score:"
      controlsRunLabel: string    // "Controls run:"
      cliBuilder: string          // "CLI Command Builder"
      iacSourceLabel: string      // "IaC Source Path"
      planFileLabel: string       // "Terraform Plan File"
      quickStartTitle: string     // "Quick Start — CLI"
      directApiTitle: string      // "Direct API Push"
      cliFlagsTitle: string       // "CLI Flags Reference"
    }

    audit: {
      totalEvents: string
      waiverEvents: string
      riskEvents: string
      scansReceived: string
      controlsTracked: string
      critHighTracked: string
      oldestFailure: string
      tabEvents: string           // "Event Timeline ({{count}})"
      tabExposure: string         // "Control Exposure ({{count}})"
      clearLog: string
      clearConfirm: string        // "Permanently clear all audit data?"
      clearYes: string            // "Yes, clear"
      searchPlaceholder: string   // "Search events…"
      allCategories: string
      noEvents: string            // "No audit events yet"
      noEventsHint: string
      colControl: string
      colResource: string
      colSeverity: string
      colPillar: string
      colProject: string
      colFirstSeen: string
      colAge: string
      noFirstSeen: string
    }

    leaderboard: {
      title: string               // "Hall of Fame — Global Project Leaderboard"
      subtitle: string
      tiersIn30d: string          // "tiers in 30d"
      daysAtTier5: string         // "days at Tier 5"
      noData: string              // "No data yet — run scans and earn tier achievements to appear here."
      loadFailed: string          // "Failed to load leaderboard: {{error}}"
      topSovereign: string        // "Top Sovereign Projects — Longest Tier 5 Tenure"
      mostImproved: string        // "Most Improved — Biggest Tier Jump in 30 Days"
      colRank: string
      colProject: string
      colTeam: string
      colTier: string
      colScore: string
      colTiersGained: string      // "Tiers Gained"
      colDaysAtTier5: string      // "Days at Tier 5"
    }

    users: {
      colUserId: string
      colAuthProvider: string
      colStatus: string
      colLastLogin: string
      colCreated: string
      never: string
      active: string
      inactive: string
      actionLogin: string
      actionLogout: string
      actionRunPush: string       // "Run pushed"
      actionUserCreate: string    // "User created"
      actionUserUpdate: string    // "User updated"
      actionUserDelete: string    // "User deleted"
      totalUsers: string
      accountsHeader: string
      clickToInspect: string
      newUserBtn: string
      editUserTitle: string
      newUserTitle: string
      usernameLabel: string
      displayNameLabel: string
      imageUrlLabel: string
      roleLabel: string
      passwordLabel: string
      newPasswordLabel: string
      activeLabel: string
      accountActiveLabel: string
      passwordTooShort: string
      saveChangesBtn: string
      createUserBtn: string
      deleteConfirm: string       // "Delete user \"{{username}}\"? This cannot be undone."
      adminRequired: string
      auditTrailLabel: string
      eventSingular: string
      eventPlural: string
      noAuditEvents: string
      colTimestamp: string
      colAction: string
      colDetail: string
      colIp: string
      unnamedProject: string
      createdAction: string
      updatedAction: string
      deletedAction: string
      colUser: string
      colRole: string
      colActions: string
      editBtn: string
      disableBtn: string
      enableBtn: string
      delBtn: string
    }

    sso: {
      oidcTitle: string           // "OpenID Connect (OIDC)"
      oidcSubtitle: string
      oidcSaved: string
      oidcRemoved: string
      oidcRemoveConfirm: string
      saveOidc: string
      saml2Title: string          // "SAML 2.0"
      saml2Subtitle: string
      saml2Saved: string
      saml2Removed: string
      saml2RemoveConfirm: string
      saveSaml2: string
      enabled: string
      disabled: string
      saving: string
      discoveryUrl: string
      discoveryUrlHint: string
      authEndpointLabel: string
      authEndpointHint: string
      clientId: string
      clientSecret: string
      redirectUri: string
      redirectUriHint: string
      frontendUrl: string
      frontendUrlHint: string
      scopes: string
      scopesHint: string
      usernameClaim: string
      usernameClaimHint: string
      displayNameClaim: string
      defaultRole: string
      defaultRoleHint: string
      roleClaim: string
      roleClaimHint: string
      roleMapping: string
      roleMappingHint: string
      autoProvision: string       // "Auto-provision new users"
      autoProvisionHint: string   // "— create a WAF++ account on first SSO login"
      removeBtn: string           // "Remove"
      spMetadataLabel: string     // "SP Metadata:"
      spMetadataHint: string      // "Register this URL in your IdP."
      spSection: string           // "Service Provider (SP)"
      idpSection: string          // "Identity Provider (IdP)"
      attrMappingSection: string  // "Attribute Mapping"
      spEntityId: string
      spEntityIdHint: string
      acsUrl: string
      acsUrlHint: string
      spCertificate: string
      spCertHint: string
      spPrivateKey: string
      spKeyHint: string
      idpEntityId: string
      idpSsoUrl: string
      idpCertificate: string
      idpCertHint: string
      usernameAttribute: string
      usernameAttrHint: string
      displayNameAttr: string
      roleAttribute: string
      roleAttrHint: string
      overviewTitle: string       // "SSO Overview"
      overviewText: string
    }

    groupMappings: {
      addTitle: string            // "New Group → Role Mapping"
      addBtn: string              // "Add Mapping"
      groupNameLabel: string      // "Group Name *"
      providerLabel: string
      roleLabel: string           // "Mapped Role"
      priorityLabel: string
      descriptionLabel: string
      saveBtn: string             // "Save"
      cancelBtn: string
      saveChangesBtn: string      // "Save changes"
      groupRequired: string       // "Group name is required."
      emptyState: string          // "No group mappings yet."
      colGroupName: string        // "Group Name"
      colProvider: string         // "Provider"
      colMapsTo: string           // "Maps To"
      colPriority: string         // "Priority"
      colDescription: string      // "Description"
      editBtn: string             // "Edit"
      deleteBtn: string           // "Delete"
      deleteConfirmText: string   // "Delete mapping {{group}} → {{role}}? This cannot be undone."
      confirmDeleteBtn: string    // "Confirm delete"
      statTotal: string           // "Total mappings"
      statAny: string             // "Any provider (*)"
      statOidc: string            // "OIDC only"
      statSaml2: string           // "SAML2 only"
      fieldId: string             // "ID"
      fieldCreated: string        // "Created"
      fieldCreatedBy: string      // "Created by"
    }

    projectGroups: {
      title: string               // "Project Groups Access Control"
      subtitle: string            // "Define which groups can access which projects for run visibility"
      adminBadge: string          // "Admin"
      accessDenied: string        // "Access Denied"
      adminOnly: string           // "Admin role required to manage project groups."
      projectsHeader: string      // "Projects"
      projectsCount: string       // "projects"
      selectedProject: string     // "Selected Project"
      description: string         // "Configure group-based access to this project..."
      groupsHeader: string        // "Group Access"
      groupCount: string          // "groups"
      loading: string             // "Loading group access configuration..."
      noGroups: string            // "No group access configured for this project..."
      addedOn: string             // "Added on"
      deleteGroup: string         // "Remove group access"
      groupNamePlaceholder: string // "Group name (e.g., team-security...)"
      addBtn: string              // "Add"
      addDesc: string             // "Add a group to this project..."
      usersHeader: string         // "Users in Group"
      noUsers: string             // "No users found"
      addUserPlaceholder: string  // "Select a user to add..."
      addUserHint: string         // "Select a user and click Add to grant them access..."
      infoTitle: string           // "How it works"
      infoText1: string           // "This page allows you to configure group-based access control..."
      infoItem1: string           // "Add one or more groups to a project"
      infoItem2: string           // "When a user logs in via SSO, their groups are fetched..."
      infoItem3: string           // "Users can only see runs for projects they belong to..."
    }

    remediation: {
      quickAdd: string            // "Quick add:"
      top5roi: string             // "Top 5 by ROI"
      clearSprint: string         // "Clear sprint"
      backlog: string             // "Backlog · {{count}} controls"
      noFailing: string           // "No failing controls"
      allPassing: string          // "All controls are passing — nothing to plan."
      sortRoi: string             // "Sort: Best ROI"
      sortPoints: string          // "Sort: Score impact"
      sortSeverity: string        // "Sort: Severity"
      sortEffort: string          // "Sort: Quick wins first"
      sortFrameworks: string      // "Sort: Framework coverage"
      allSev: string              // "All {{sev}}"
      allEffort: string           // "All effort"
      lowEffort: string           // "Low effort"
      mediumEffort: string        // "Medium effort"
      highEffort: string          // "High effort"
      clearFilters: string        // "Clear"
      allInSprint: string         // "All controls are in the sprint."
      noMatch: string             // "No controls match the current filters."
      sprintImpact: string        // "Sprint Impact"
      sprintImpactHint: string    // "Add controls from the backlog to see your projected score improvement and framework coverage."
      sprintImpactProjection: string // "Sprint Impact Projection"
      current: string             // "current"
      projected: string           // "projected"
      metricControls: string      // "Controls"
      metricResources: string     // "Resources"
      metricFrameworks: string    // "Frameworks"
      metricGapsClosed: string    // "Gaps closed"
      metricInSprint: string      // "in sprint"
      metricToFix: string         // "to fix"
      metricAddressed: string     // "addressed"
      metricFullyResolved: string // "fully resolved"
      sprintEffort: string        // "Sprint effort"
      fullyClosing: string        // "Fully closing"
      sprintHeader: string        // "Sprint ({{count}})"
      addToSprint: string         // "Add to sprint"
      removeFromSprint: string    // "Remove from sprint"
      description: string         // "Description"
      remediationSteps: string    // "Remediation steps"
      regulatoryMapping: string   // "Regulatory mapping"
      effortBadge: string         // "{{effort}} effort"
      noFrameworks: string        // "no frameworks"
      exportLabel: string         // "Export"
      exportCsv: string           // "CSV for Excel"
      exportJira: string          // "Jira issues"
      exportSlack: string         // "Slack / MS Teams"
    }

    gapanalysis: {
      resourcesToFix: string      // "{{count}} resource(s) to fix"
      unlocksReqs: string         // "unlocks {{count}} req(s)"
      failingCheck: string        // "Failing check:"
      fixLabel: string            // "Fix:"
      failingChecks: string       // "Failing checks ({{count}})"
      passingChecks: string       // "Passing checks ({{count}})"
      affectedResources: string   // "Affected resources ({{count}})"
      moreItems: string           // "+{{count}} more"
      currentCoverage: string     // "Current coverage"
      afterGapsFixed: string      // "After all gaps fixed"
      controlsToFix: string       // "controls to fix"
      passing: string             // "passing"
      waived: string              // "waived"
      noData: string              // "no data"
      requirementsMet: string     // "{{met}} of {{total}} requirements currently met"
      gapsCount: string           // "{{count}} gaps"
      exportCsv: string           // "↓ Export CSV"
      noControlsMapped: string    // "No controls mapped to {{framework}}"
      noControlsMappedDesc: string // "This run's controls do not include regulatory mappings for {{framework}}."
      tabRoadmap: string          // "Remediation Roadmap"
      tabRequirements: string     // "Requirements Map"
      sortByLabel: string         // "Sort by:"
      sortEfficiency: string      // "Shortest path (effort ÷ requirements)"
      sortSeverity: string        // "Highest severity first"
      sortValue: string           // "Most requirements unlocked first"
      showPassingControls: string // "Show passing controls"
      shortestPathIntro: string   // "Shortest path to {{framework}} compliance: Fix the {{count}} controls below in order."
      shortestPathDetail: string  // "Each item shows how many resources need remediating (effort) and how many framework requirements it unlocks (value). Controls ranked #1 give you the highest requirement coverage per unit of effort."
      allPassingGap: string       // "All {{framework}}-mapped controls are passing — no gaps detected"
      passingControlsHeader: string // "Passing controls ({{count}})"
      reqsMapped: string          // "{{total}} {{framework}} requirements mapped"
      reqsMet: string             // "{{count}} met"
      reqsGaps: string            // "{{count}} gaps"
      afterFix: string            // "{{cumulative}}/{{total}} after fix"
      waivedLabel: string         // "waived · {{owner}}"
      riskAcceptedLabel: string   // "risk accepted · {{approver}}"
    }

    access: {
      rolesHeader: string
      authProvidersHeader: string
      implNotesHeader: string
      bannerTitle: string
      bannerText: string
      bannerAdminText: string
      bannerBadge: string
    }

    apikeys: {
      adminRequired: string
      totalKeys: string
      statRevoked: string
      keyCreatedMsg: string       // '"{{name}}" created — copy the key now, it won\'t be shown again'
      quickStart: string
      createHeader: string
      keyNameLabel: string
      creating: string
      generateBtn: string
      activeKeysHeader: string
      clickToInspect: string
      noActiveKeys: string
      colKey: string
      colPrefix: string
      colCreated: string
      colLastUsed: string
      never: string
      revokeBtn: string
      revokeConfirm: string       // 'Revoke API key "{{name}}"? CI/CD pipelines using this key will stop working immediately.'
      revokedKeysHeader: string   // "Revoked Keys ({{count}})"
      colName: string
      usageRefHeader: string
      usageLogHeader: string
      entrySingular: string
      entryPlural: string
      noUsageYet: string
      colTimestamp: string
      colEndpoint: string
      colProject: string
      colBranch: string
      colScore: string
      colRunId: string
      colIp: string
      dismiss: string
    }

    dashboard: {
      goodPosture: string
      needsAttention: string
      highRisk: string
      infrastructureScan: string
      controlsLoaded: string       // "{{count}} controls loaded"
      viewFindings: string
      newScan: string
      failedControls: string
      critHigh: string
      resourcesAtRisk: string
      activeWaivers: string
      avgCompliance: string
      requiresAttention: string
      critHighDesc: string
      autoFix: string
      allFindings: string          // "All findings →"
      navigateDashboard: string
      navAnalysis: string
      navInfrastructure: string
      navRiskGovernance: string
      navHistoryAudit: string
      pillarHealth: string
      failuresBySeverity: string
      scoreByPillar: string
      regulatoryReadiness: string  // "Regulatory Readiness{{suffix}}"
      fullMatrix: string           // "Full matrix →"
      debtHeatmap: string
      debtHeatmapDesc: string
      legendLow: string
      legendHigh: string
      pillarHeader: string
      checksRun: string
      checkPassRate: string
      resourcesScanned: string
      resourcesFailing: string
      quickWins: string
      quickWinsDesc: string
      cloudFootprint: string
      fullMap: string              // "Full map →"
      regionsSuffix: string        // "regions"
      failing: string              // "{{count}} failing"
      allPassing: string           // "All passing"
      ofChecks: string             // "of {{total}} checks"
      closeBtn: string
      autoFixable: string          // "Auto-fixable ({{count}})"
      manualReview: string         // "Manual review ({{count}})"
      previewStep: string          // "1 · Preview (dry-run)"
      applyStep: string            // "2 · Apply patches"
      autoFixTitle: string
      autoFixScope: string         // "Scope:"
      autoFixCount: string         // "{{auto}} auto-fixable"
      manualCount: string          // "{{count}} manual"
      gapsLabel: string            // "{{count}} gaps"
    }

    antipattern: {
      title: string
      subtitle: string
      bestpractices: string
      failingInfo: string
      viewBestPractices: string
    }

    reference: {
      title: string
      subtitle: string
    }

    settingsPage: {
      sectionMaturity: string
      sectionScan: string
      sectionPillars: string
      sectionIntelligence: string
      sectionLanguage: string
      sectionRegulatory: string
      sectionPdf: string
      sectionConnection: string
      sectionVersion: string
      activeAtLevel: string
      controlCoverage: string
      severityThreshold: string
      pillarsCovered: string
      startingPoint: string
      addedVsLevel: string         // "Added vs L{{level}}"
      intelligenceActive: string
      criticalOnly: string
      highPlus: string
      mediumPlus: string
      allSeverities: string
      activeLabel: string
      offLabel: string
      saveBtn: string
      resetBtn: string             // "Reset to L{{level}} preset"
      savedMsg: string
      testBtn: string
      allRegionsBtn: string
      checking: string
      defaultIacLabel: string
      failOnLabel: string
      minSeverityLabel: string
      debugInfo: string
      versionInfo: string
    }

    badgePage: {
      noScansYet: string
      project: string
      deployMode: string
      liveModeLabel: string
      offlineModeLabel: string
      offlineModeTitle: string
      offlineModeDesc: string
      badgePreview: string
      rendered: string
      inBrowserPreview: string
      liveFromServer: string
      liveFromServerDesc: string
      directLink: string
      openLiveBadge: string
      openLiveBadgeDesc: string
      download: string
      downloadDesc: string
      downloadHint: string
      embedCode: string
      embedCodeDesc: string
      githubActionsTitle: string
      githubActionsDesc: string
      gitlabCiTitle: string
      gitlabCiDesc: string
      staticBadges: string
      staticBadgesDesc: string
      shieldsIo: string
    }

    blastRadius: {
      noFailingResources: string
      allPassing: string
      failingResources: string
      inferredDeps: string
      searchPlaceholder: string
      allSeverities: string
      clear: string
      resourcesOf: string          // "{{count}} of {{total}} resources"
      failingControls: string      // "Failing Controls ({{count}})"
      structuralConnections: string
      dependsOn: string
      usedBy: string
      dependencyMap: string
      clickNode: string
    }

    changes: {
      title: string
      noChanges: string
      searchPlaceholder: string
      allActions: string
      showSecurity: string
      securityChanges: string
      planChangesTitle: string
      complianceDrift: string
      regressed: string
      recovered: string
      noComplianceDrift: string
      noRunsForDiff: string
      computedAtApply: string
      securityAttr: string        // "Security-relevant attribute"
      scoreTrend: string
      pillarDelta: string
      planSummary: string
      driftBaseline: string
      planCaptured: string
      resourceChanges: string     // "{{count}} resource change(s)"
      noMatchFilter: string
      clickForDetail: string
      byResourceType: string
      unchanged: string
      scoreDelta: string
      infraChanges: string
      regressionsLabel: string
      recoveredLabel: string
      tabPlanChanges: string      // "Plan Changes ({{count}})"
      tabRegressed: string        // "Regressions ({{count}})"
      tabRecovered: string        // "Recovered ({{count}})"
      noRegressions: string
      noRecovered: string
      driftSummaryRegressed: string  // "{{count}} control(s) that passed in the baseline are now failing"
      driftSummaryRecovered: string  // "{{count}} control(s) that were failing are now passing"
      allPillars: string
      allSeverities: string
      allProviders: string
      clear: string
      loadingBaseline: string
      noPreviousRun: string
      driftRequires: string
      searchAddressOrType: string
      terraform: string
      oldest: string
      latest: string
      needMoreRuns: string
      noPlanData: string
      noPlanDataDesc: string
      howToIncludePlan: string
      noPlanChanges: string
      noPlanChangesDesc: string
      resourcesUpToDate: string   // "{{count}} resource(s) in state — all up to date"
      tailbreakAlert: string
      createDesc: string
      updateDesc: string
      deleteDesc: string
      replaceDesc: string
      attrToBeCreated: string
      changedAttrs: string
      currentState: string
      colResource: string
      colType: string
      colProvider: string
      colAction: string
      close: string
      runsLabel: string           // "{{count}} run(s)"
      remediation: string
      needAtLeastTwo: string
    }

    controlsCatalogue: {
      title: string
      searchPlaceholder: string
      allPillars: string
      allSeverities: string
      allEngines: string
      allSources: string
      coreTab: string
      customTab: string
      wizardTitle: string
      downloadYaml: string
      downloadCheckov: string
      downloadZip: string
      noControls: string
      noMatch: string
      controlSaved: string
      wizardBack: string
      wizardNext: string
      wizardSave: string
      addCheck: string
      checkLabel: string          // "Check {{n}}"
      validationTitle: string
      exportLabel: string
      cliUsageTitle: string
      savingLabel: string
      saveToServer: string
      fixValidationErrors: string
      moreCharsNeeded: string     // "{{n}} more characters needed"
      charsOk: string             // "{{n}} characters ✓"
      selectAtLeastOne: string
      requirementDesc: string
      reviewYaml: string
    }

    controlsPage: {
      noRun: string
      noControls: string
      noMatch: string
      searchPlaceholder: string
      allPillars: string
      allSeverities: string
      controlsOf: string           // "{{count}} / {{total}}"
      tabOverview: string
      tabWhy: string
      tabRegulatory: string
      tabChecks: string
      tabFix: string
      tabWaiver: string
      waiveLabel: string
      waiverReason: string
      waiverOwner: string
      waiverExpires: string
      waiveSave: string
      waiverSaved: string
      waiverUpdate: string
      waiverRemove: string
      waivedLabel: string
      existingWaiver: string
    }

    costImpact: {
      title: string
      noRun: string
      totalExposure: string
      perMonth: string
      highConfidence: string
      mediumConfidence: string
      estimateOnly: string
      directWaste: string
      savingsOpp: string
      govRisk: string
      searchPlaceholder: string
      clearFilters: string
      noFindings: string
      disclaimer: string
      basis: string
      noFailingCost: string
      allPassing: string
      failingCostControls: string   // "{{count}} failing cost controls — estimated ~{{mid}}/month"
      rangeAcross: string           // "Range: {{range}}/month across {{count}} resources."
      estimateNote: string
      noFailingFindings: string
      allFilter: string             // "All ({{count}})"
      sortedByImpact: string
      findingLabel: string
      fixLabel: string
      govRiskOnly: string
      methodology: string
      methodologyText: string
    }

    dependencyGraph: {
      title: string
      noRun: string
      failingGroup: string
      mixedGroup: string
      passingGroup: string
      skippedGroup: string
      searchPlaceholder: string
      allStatuses: string
      noResources: string
      passCount: string            // "{{count}} pass"
      failCount: string            // "{{count}} fail"
      skipCount: string            // "{{count}} skip"
      failingChecks: string        // "Failing checks ({{count}})"
      connections: string
      dependsOn: string
      usedBy: string
      dependencyMap: string
      clickNode: string
      resourcesLabel: string
      allProviders: string
      clear: string
      resourcesOf: string          // "{{count}} of {{total}} resources"
      passingLabel: string
      failingLabel: string
      skippedLabel: string
      passingSample: string
      moreFailing: string          // "+{{count}} more failing checks"
      groupFailingSummary: string  // "· {{count}} failing control checks across these resources"
      clickResource: string
    }

    driftDetection: {
      title: string
      noRun: string
      complianceDrift: string
      planChanges: string
      regressedTitle: string
      recoveredTitle: string
      noRegressed: string
      noRecovered: string
      securityAttr: string
      searchPlaceholder: string
      allTypes: string
      selectRun: string
      driftDetected: string      // "Configuration drift detected in {{project}}"
      noDrift: string            // "No drift detected — {{project}} is stable"
      comparedAgainst: string    // "Compared against run from {{date}} · branch {{branch}}"
      noPrevRun: string          // no previous run in header
      scoreDeltaLabel: string
      regressionsLabel: string
      recoveredLabel: string
      stateChangesLabel: string
      securityAttrsLabel: string
      driftNonCompliant: string
      tabRegressions: string     // "Regressions ({{count}})"
      tabRecovered: string       // "Recovered ({{count}})"
      tabStateDrift: string      // "State Drift ({{count}})"
      loadingPrev: string
      noPrevRunProject: string   // "No previous run found for project "{{project}}""
      complianceRequires: string
      complianceRequiresDetail: string
      noRegressions: string
      regressionSummary: string  // "{{count}} control{{s}} that passed in the previous run are now failing"
      noRecoveredRun: string
      recoveredSummary: string   // "{{count}} control{{s}} that were failing are now passing"
      noTerraformPlan: string
      noTerraformPlanDesc: string
      noStateChanges: string
      stateDriftSummary: string  // "{{count}} resource{{s}} with infrastructure state changes..."
      allFilter: string
      scoreTrend: string
      oldest: string
      latest: string
      runsLabel: string
      pillarDelta: string
      planSummary: string
      terraform: string
      baselineRun: string
      allPillars: string
      allSeverities: string
      clear: string
    }

    evidencePage: {
      title: string
      noRun: string
      lockerTitle: string
      createTitle: string
      preparedBy: string
      organization: string
      period: string
      notes: string
      includeWaivers: string
      includeRisks: string
      includeAuditLog: string
      includeFailingControls: string
      generateBtn: string
      lockBtn: string
      deleteBtn: string
      noEvidence: string
      locked: string
      unlocked: string
      lockConfirm: string
      deleteConfirm: string
      copyLink: string
      copied: string
      openReport: string
      downloadReport: string
      qrCode: string
    }

    exploitPaths: {
      cloudProvider: string
      criticalPaths: string
      criticalPathsSub: string
      highSeverity: string
      highSeveritySub: string
      entryPoints: string
      entryPointsSub: string       // "exposed perimeter nodes ({{cloud}})"
      dataStoresAtRisk: string
      dataStoresAtRiskSub: string  // "of {{count}} data store nodes with findings"
      failingChecks: string        // "{{count}} failing check{{s}} in active run"
      attackSurfaceHeatLine: string
      heatLineDesc: string         // "Failing checks distributed across attack zones · {{cloud}}"
      totalMappedFindings: string  // "{{count}} total mapped findings"
      heatLineLegend: string
      dashLegend: string
      noData: string
      clear: string
      relatedFindings: string      // "Related Failing Findings ({{count}})"
      attackChains: string         // "Attack Chains — {{cloud}}"
      impact: string
      attackPath: string
      matchingFindings: string
      chainFindings: string        // "{{count}} finding{{s}}"
      details: string
      chainCount: string           // "{{count}} chain{{s}}"
      redDotLegend: string
      selectChain: string
      heatLegendNo: string
      heatLegendLow: string
      heatLegendMed: string
      heatLegendHigh: string
      heatLegendCrit: string
      attackGraph: string
      findingResource: string
      findingMessage: string
      findingRemediation: string
      findingControl: string
    }

    feedbackPage: {
      category: string
      rating: string
      priority: string
      nameLabel: string
      emailLabel: string
      companyLabel: string
      subjectLabel: string
      messageLabel: string
      nameRequired: string
      emailRequired: string
      subjectRequired: string
      contactConsent: string
      sendBtn: string
      emailClientHint: string
      emailClientOpened: string
      teamNote: string
      ratingPoor: string
      ratingFair: string
      ratingGood: string
      ratingVeryGood: string
      ratingExcellent: string
    }

    maturityJourney: {
      hero: string
      yourJourney: string
      heroParagraph: string
      currentAltitude: string
      flightStage: string
      maturityLevel: string
      noScanYet: string
      boardingPass: string
      from: string
      to: string
      legacyLabel: string
      excellenceLabel: string
      cleared: string
      boarding: string
      grounded: string
      hangar: string
      hangarDesc: string
      runFirstScan: string
      flightMap: string
      flightMapDesc: string
      stageStories: string
      stageStoriesDesc: string
      stageTitle: string           // "Stage {{idx}} — {{label}}"
      youAreHere: string
      clearedLabel: string
      theSituation: string
      priorityControls: string
      excellenceStandard: string
      projectPassport: string
      passportDesc: string
      fullMatrix: string
      complianceFrameworks: string
      controlsOf: string           // "{{passing}} / {{total}} controls"
      noFrameworks: string
      infraPillars: string
      noControls: string
      nextWaypoints: string
      nextWaypointsDesc: string
      loadMore: string
      allFindings: string
      noWaypoints: string
      finalApproach: string
      flightManual: string         // "Flight Manual · {{chapter}}"
      bpProject: string
      bpMaturity: string
      bpScore: string
      bpControls: string
      bpWaivers: string
      bpRisk: string
    }

    globaldashboard: {
      operationalCenter: string
      featuredProject: string
      maturityDistribution: string
      topProjects: string
      pillarHealth: string
      pillarScores: string
      score: string
      level: string
      lastScan: string
      avgScore: string
      totalProjects: string
      noFeaturedProjects: string
      topPerformingProject: string
      showingXPillars: string
      noActivity: string
      runScansHint: string
      latestScans: string
      noProjects: string
      globalScore: string
      healthy: string
      needsAttention: string
      improving: string
      scanCompleted: string
      recentActivity: string
      pillarLevel: string
    }

    moduleScore: {
      noFindings: string
      filterPlaceholder: string
      sortScoreAsc: string
      sortFailDesc: string
      sortDragDesc: string
      sortAz: string
      sortLabel: string
      noMatch: string              // "No modules match \"{{search}}\""
      selectModule: string
      noMatchFilter: string
      showAll: string              // "Show all {{count}} findings"
      modulesOf: string            // "{{count}} of {{total}} module(s)"
      modulesLabel: string
      modulesWithFailures: string
      totalFailures: string
      criticalFails: string
      worstModule: string
      scannedPaths: string
      score: string
      resources: string
      failingRes: string
      scoreDrag: string
      pillarScores: string
      topFailingControls: string
      findings: string             // "Findings ({{count}})"
    }

    passportDashboard: {
      title: string
      noPassports: string
      noDescription: string
      noOwner: string
      viewGrid: string
      viewWide: string
      viewList: string
      editBtn: string
      createBtn: string
      deleteBtn: string
      openBtn: string
      cancelBtn: string
      saveBtn: string
      modalTitle: string
      displayNameLabel: string
      ownerLabel: string
      teamLabel: string
      emailLabel: string
      descLabel: string
      criticalityLabel: string
      environmentLabel: string
      cloudLabel: string
      repoLabel: string
      docsLabel: string
      tagsLabel: string
      notesLabel: string
      achievements: string
      maturityLevels: string
      scans: string                // "{{count}} scan(s)"
      badgeDownload: string
    }

    projectOverview: {
      noScans: string
      backBtn: string
      title: string
      latestScore: string
      totalScans: string
      bestScoreLevel: string
      badgesEarned: string
      branches: string             // "{{count}} branch{{es}}"
      maturityCount: string        // "{{count}} maturity"
      achievementsCount: string    // "{{count}} achievements"
      scoreTrend: string
      latestPillarScores: string
      needMoreRuns: string
      noPillarData: string
      maturityLevelBadges: string
      maturityLevelBadgesSub: string
      achievementBadges: string
      achievementBadgesSub: string
      earned: string
      verifiedAchievements: string
      verifiedAchievementsSub: string
      milestonesRecorded: string   // "{{count}} milestone{{s}} recorded"
      verify: string
      copyLink: string
      copied: string
      recentScans: string          // "Recent Scans · {{project}}"
      colScore: string
      colBranch: string
      colStage: string
      colTriggeredBy: string
      colDate: string
      open: string
      noRuns: string
      maxMaturity: string
      allBadgesEarned: string      // "All {{count}} maturity badges earned. Outstanding security posture."
      pointsToNext: string
      bestScore: string            // "Best score: {{score}}"
      requiresScore: string        // "Requires {{score}}+"
      scoreReached: string         // "Score {{score}}+ reached"
      clickToOpen: string
    }

    regions: {
      noRegions: string
      totalRegions: string
      totalAZs: string             // "{{count}} AZs"
      deploymentMap: string
      regionsCount: string         // "{{count}} regions"
      scannedPaths: string
    }

    sandbox: {
      engineLabel: string
      mockEngine: string
      realEngine: string
      checking: string
      realEngineReady: string
      realEngineUnavailable: string
      enableHint: string
      editorTitle: string
      clear: string
      analysing: string
      analyseReal: string          // "Analyse with Real Engine"
      analyseMock: string          // "Analyse with Mock Engine"
      realEngineRunDesc: string    // "Runs all N controls…"
      title: string
      subtitle: string
      runningEngine: string
      evaluatingControls: string
      engineError: string
      engineValue: string          // "Real WAF++ engine" / "Mock (regex)"
      controlsEvaluated: string
      withFindings: string
      pass: string
      fail: string
      skip: string
      fix: string
    }

    secretScan: {
      alarmTitle: string           // "{{count}} HARDCODED SECRET(S) DETECTED IN SOURCE CODE"
      secretsIssue: string         // "SECRETS MANAGEMENT ISSUE(S) DETECTED"
      cleanTitle: string
      scannerHits: string
      critical: string
      high: string
      postureFailures: string
      postureChecks: string
      hardcodedScanTitle: string
      foundCount: string           // "{{count}} found"
      filterPlaceholder: string
      allSeverities: string
      noSecrets: string
      updateCliHint: string
      noMatchFilter: string
      postureTitle: string
      failingLabel: string
      passingLabel: string
      remediationRef: string
      suppress: string
    }

    skippedControls: {
      noRun: string
      title: string
      controlsOf: string           // "{{skipped}} of {{total}} controls"
      colControl: string
      colTitle: string
      colSkipType: string
      colReason: string
      colOwner: string
      colExpiry: string
      noSkipped: string
    }

    controlspacks: {
      activePack: string
      noPack: string
      controlsCount: string
      activated: string
      uploadZip: string
      syncDirectory: string
      uploadZipDesc: string
      zipFile: string
      chooseFile: string
      version: string
      versionPlaceholder: string
      description: string
      descriptionPlaceholder: string
      uploading: string
      uploadActivate: string
      syncing: string
      syncActivate: string
      syncDesc: string
      controlsDir: string
      packHistory: string
      pack: string
      versionCol: string
      descriptionCol: string
      controlsCol: string
      importedCol: string
      activatedCol: string
      activateBtn: string
      activating: string
      noPacks: string
      howItWorks: string
      uploadZipStep: string
      syncStep: string
      immutableSnapshot: string
      rollBack: string
      manageControls: string
      catalogueLink: string
      singlePointTruth: string
      versionLoadError: string
    }

    notifications: {
      title: string
      subtitle: string
      pageDescription: string
      unread: string
      read: string
      noNotifications: string
      noUnread: string
      noRead: string
      markAllRead: string
      marked: string
      create: string
      cancel: string
      test: string
      testTitle: string
      testMessage: string
      titlePlaceholder: string
      messagePlaceholder: string
      message: string
      category: string
      send: string
      filterBy: string
      all: string
      viewAll: string
      settings: {
        test: string
        testDesc: string
        testBtn: string
        testSent: string
      }
    }

    pipelines: {
      title: string
      subtitle: string
      totalScans: string
      allTimeExecutions: string
      passRate: string
      scansNeedingAttention: string
      averageScore: string
      activeProjects: string
      uniqueProjectsScanned: string
      scanFrequency: string
      last30Days: string
      topPerformingProjects: string
      scanDuration: string
      longest: string
      average: string
      shortest: string
      recentRuns: string
      date: string
      branch: string
      score: string
      pillars: string
      status: string
      source: string
      justNow: string
      minutesAgo: string
      hoursAgo: string
      daysAgo: string
      noPipelineData: string
      noPipelineDataHint: string
      noScanDataLast30Days: string
      cicdFlagInfo: string
      cicdFlagDescription: string
      cicdFlagExample: string
      loading: string
      error: string
      tryAgain: string
      passLabel: string
      needsAttentionLabel: string
      highRiskLabel: string
    }
  }
}

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T

export type PartialTranslations = DeepPartial<Translations>

export type TFunction = (key: string, vars?: Record<string, string | number>) => string
