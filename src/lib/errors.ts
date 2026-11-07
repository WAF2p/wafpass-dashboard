/** Normalized API failure with enough context for the UI and telemetry. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly requestId?: string
  readonly code?: string

  constructor(status: number, detail: string, requestId?: string, code?: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.requestId = requestId
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
