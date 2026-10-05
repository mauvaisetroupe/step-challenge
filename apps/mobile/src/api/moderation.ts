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

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive_name', label: 'Nom offensant' },
  { value: 'impersonation', label: "Se fait passer pour quelqu'un d'autre" },
  { value: 'harassment', label: 'Harcèlement' },
  { value: 'other', label: 'Autre' },
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
