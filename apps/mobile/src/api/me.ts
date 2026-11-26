import { clearSessionToken } from '../auth/session'
import type { User } from './auth'
import { apiFetch } from './client'

/** A legal document to accept at its version in force (ADR 0017). */
export type PendingConsent = { document: 'terms' | 'privacy'; version: string }

export type Me = User & {
  /** Absent with an older API: nothing to accept. */
  pendingConsents?: PendingConsent[]
}

export async function getMe() {
  return apiFetch<Me>('/api/me')
}

/**
 * Accepts the legal documents at the versions shown. Throws ApiError
 * 409 (legal_version_outdated) when one changed meanwhile.
 */
export async function acceptLegalDocuments(documents: PendingConsent[]) {
  return apiFetch<{ pendingConsents: PendingConsent[] }>('/api/me/consents', {
    method: 'POST',
    body: {
      consents: documents.map(({ document, version }) => ({
        subject: document,
        action: 'granted',
        version,
      })),
    },
  })
}

/** Why the app saw the HUAWEI Health authorization withdrawn. */
export type HuaweiWithdrawalCause = 'app' | 'huawei_app' | 'switch'

/**
 * Journals a HUAWEI Health authorization granted (with its scopes) or
 * withdrawn, as the app saw it (ADR 0017).
 */
export async function recordHuaweiConsent(
  consent:
    | { action: 'granted'; scopes: string[] }
    | { action: 'withdrawn'; cause: HuaweiWithdrawalCause },
) {
  await apiFetch('/api/me/consents', {
    method: 'POST',
    body: {
      consents: [
        {
          subject: 'huawei_health',
          action: consent.action,
          detail:
            consent.action === 'granted'
              ? { scopes: consent.scopes }
              : { cause: consent.cause },
        },
      ],
    },
  })
}

/** All the user's personal data, as kept by the backend (ADR 0017). */
export async function exportMyData() {
  return apiFetch<Record<string, unknown>>('/api/me/export')
}

/**
 * Deletes all the daily totals kept by the backend, whatever their
 * source (ADR 0017, when withdrawing HUAWEI Health).
 */
export async function deleteMySteps() {
  await apiFetch('/api/me/steps', { method: 'DELETE' })
}

export async function updateDisplayName(displayName: string) {
  return apiFetch<User>('/api/me', {
    method: 'PATCH',
    body: { displayName },
  })
}

/**
 * Deletes the account on the backend (sessions, Google link and steps),
 * then forgets the local session.
 */
export async function deleteAccount() {
  await apiFetch('/api/me', { method: 'DELETE' })
  await clearSessionToken()
}
