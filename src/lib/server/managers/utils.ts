export type FailDetails = { status: number; message: string }
export function isFailed(details: unknown): details is FailDetails {
  if (!details) return false
  if (!(details instanceof Object)) return false
  return 'status' in details && 'message' in details
}
