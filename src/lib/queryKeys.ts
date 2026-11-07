/** Centralized query keys. Keep keys by domain so invalidation is obvious. */
export const qk = {
  runs: {
    all: ['runs'] as const,
    detail: (id: string) => ['runs', id] as const,
  },
  findings: (runId: string) => ['findings', runId] as const,
  controls: ['controls'] as const,
  users: ['users'] as const,
  adminLog: ['admin-log'] as const,
  waivers: ['waivers'] as const,
  risks: ['risks'] as const,
  notifications: ['notifications'] as const,
}
