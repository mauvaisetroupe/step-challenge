import { apiFetch } from './client'

/** API of ADR 0004: blocking and reporting users. */

export type BlockedUser = {
  userId: string
  /** Display name when I blocked them: their current name is not shown. */
  name: string
  since: string
}

export type ReportReason =
  | 'offensive_name'
  | 'impersonation'
  | 'harassment'
  | 'other'

/** Reasons offered, in this order (labels: report.reasons.<reason>). */
export const REPORT_REASONS: ReportReason[] = [
  'offensive_name',
  'impersonation',
  'harassment',
  'other',
]

export function listBlocks() {
  return apiFetch<BlockedUser[]>('/api/blocks')
}

/** Blocks a user: ends the friendship and prevents any new one. */
export function blockUser(userId: string) {
  return apiFetch('/api/blocks', { method: 'POST', body: { userId } })
}

export function unblockUser(userId: string) {
  return apiFetch(`/api/blocks/${userId}`, { method: 'DELETE' })
}

/**
 * Reports a friend, or the author of an invitation I received (its code
 * proves I received it).
 */
export function reportUser(report: {
  userId: string
  reason: ReportReason
  comment?: string
  invitationCode?: string
}) {
  return apiFetch('/api/reports', { method: 'POST', body: report })
}
