/**
 * Allow only image URLs that cannot become a script/navigation sink.
 *
 * `user.image_url`, mandate logos and passport images come from the API or
 * from user-authored configuration. React escapes attribute text, but a
 * `javascript:`/`data:image/svg+xml` value in an `src` is still an unsafe URL
 * sink for static analysis and older engines. Keep http(s) images and raster
 * data URLs; reject everything else.
 */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i

export function safeImageUrl(
  raw: string | null | undefined,
  { allowSvgData = false }: { allowSvgData?: boolean } = {},
): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null

  if (SAFE_DATA_IMAGE.test(value)) return value
  // Inline SVG is inert when loaded through <img>, but it is only enabled for
  // surfaces that explicitly support SVG uploads (passports, mandate logos).
  if (allowSvgData && /^data:image\/svg\+xml(?:[;,]|$)/i.test(value)) return value
  // Protocol-relative URLs are surprising and easy to smuggle into a value
  // that looks like a path; require an explicit http(s) origin.
  if (value.startsWith('//')) return null

  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    // Not a valid URL — fall through to the monogram / placeholder.
  }
  return null
}
