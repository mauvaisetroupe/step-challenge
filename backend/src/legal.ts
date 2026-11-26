import { randomUUID } from 'node:crypto'

import type { Pool, PoolClient } from 'pg'

/**
 * Versions in force of the legal documents published on the public site
 * (architech-sport, ADR 0014): the date of their last change of
 * substance (ADR 0017). A change of form keeps the version.
 *
 * Changing the substance of a document means changing its version here
 * and releasing the API: every user then accepts it again.
 */
export const LEGAL_VERSIONS = {
  terms: '2026-11-27',
  privacy: '2026-11-27',
} as const

export type LegalDocument = keyof typeof LEGAL_VERSIONS

export const LEGAL_DOCUMENTS = Object.keys(LEGAL_VERSIONS) as LegalDocument[]

export type PendingConsent = { document: LegalDocument; version: string }

/** Documents whose version in force the user has not accepted. */
export async function pendingConsents(
  db: Pool | PoolClient,
  userId: string,
): Promise<PendingConsent[]> {
  const result = await db.query<{ subject: LegalDocument }>(
    `
    SELECT DISTINCT subject
    FROM user_consents
    WHERE user_id = $1
      AND action = 'granted'
      AND (subject, version) IN (SELECT * FROM unnest($2::text[], $3::text[]))
    `,
    [userId, LEGAL_DOCUMENTS, LEGAL_DOCUMENTS.map((d) => LEGAL_VERSIONS[d])],
  )

  const accepted = new Set(result.rows.map((row) => row.subject))

  return LEGAL_DOCUMENTS.filter((document) => !accepted.has(document)).map(
    (document) => ({ document, version: LEGAL_VERSIONS[document] }),
  )
}

/**
 * Records the acceptance of legal documents at the versions given; the
 * caller has checked they are the versions in force.
 */
export async function acceptLegal(
  db: Pool | PoolClient,
  userId: string,
  documents: LegalDocument[],
) {
  for (const document of documents) {
    await db.query(
      `
      INSERT INTO user_consents (id, user_id, subject, action, version)
      VALUES ($1, $2, $3, 'granted', $4)
      `,
      [randomUUID(), userId, document, LEGAL_VERSIONS[document]],
    )
  }
}
