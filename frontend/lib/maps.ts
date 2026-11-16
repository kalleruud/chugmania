export function getGoogleMapsUrl(location: string | null | undefined) {
  const query = location?.trim().replaceAll(/\s+/g, ' ')
  if (!query) return undefined
  return `https://maps.google.com/maps?${new URLSearchParams({ q: query })}`
}
