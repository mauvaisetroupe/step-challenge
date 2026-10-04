import { createHash, randomInt } from 'node:crypto'

/**
 * Invitation codes (ADR 0002): 8 characters of Crockford base32, shown
 * as "K7F3-M9QX". The alphabet has no I, L, O or U, so a code read
 * aloud or typed by hand is not ambiguous. About 40 bits of entropy,
 * enough given the 7-day expiry and rate limiting.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 8

export function generateInvitationCode() {
  let code = ''

  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }

  return code
}

/** "K7F3M9QX" → "K7F3-M9QX" */
export function formatInvitationCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Normalizes a code typed or pasted by a user, following Crockford's
 * decoding rules: case-insensitive, separators ignored, I and L read as
 * 1, O read as 0.
 *
 * Returns null when the input cannot be a valid code.
 */
export function normalizeInvitationCode(input: string) {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')

  if (code.length !== CODE_LENGTH) {
    return null
  }

  for (const char of code) {
    if (!ALPHABET.includes(char)) {
      return null
    }
  }

  return code
}

/** Hash stored in the database: the code itself is never stored. */
export function hashInvitationCode(normalizedCode: string) {
  return createHash('sha256').update(normalizedCode).digest()
}
