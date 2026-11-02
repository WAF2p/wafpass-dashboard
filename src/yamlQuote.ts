/**
 * Quote a value as a YAML double-quoted scalar.
 *
 * `JSON.stringify` escapes quotes, backslashes, newlines, tabs and other
 * control characters, which is exactly the escape set a YAML 1.2 flow scalar
 * needs.  It is deliberately not a hand-rolled `.replace(/"/g, ...)`, which
 * misses backslashes and control characters (CodeQL: incomplete escaping).
 */
export function yamlQuote(value: unknown): string {
  return JSON.stringify(value === undefined || value === null ? '' : String(value))
}
