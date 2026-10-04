import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatInvitationCode,
  generateInvitationCode,
  hashInvitationCode,
  normalizeInvitationCode,
} from './invitationCode.js'

describe('generateInvitationCode', () => {
  it('generates 8 unambiguous Crockford characters', () => {
    for (let i = 0; i < 200; i++) {
      assert.match(
        generateInvitationCode(),
        /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/,
      )
    }
  })

  it('generates different codes', () => {
    const codes = new Set(
      Array.from({ length: 1000 }, generateInvitationCode),
    )

    assert.equal(codes.size, 1000)
  })
})

describe('formatInvitationCode', () => {
  it('groups the code by four', () => {
    assert.equal(formatInvitationCode('K7F3M9QX'), 'K7F3-M9QX')
  })
})

describe('normalizeInvitationCode', () => {
  it('accepts the formatted and raw forms', () => {
    assert.equal(normalizeInvitationCode('K7F3-M9QX'), 'K7F3M9QX')
    assert.equal(normalizeInvitationCode('K7F3M9QX'), 'K7F3M9QX')
  })

  it('ignores case and spaces', () => {
    assert.equal(normalizeInvitationCode(' k7f3 m9qx '), 'K7F3M9QX')
  })

  it('reads I and L as 1 and O as 0', () => {
    assert.equal(normalizeInvitationCode('ILO0-1234'), '11001234')
  })

  it('rejects invalid codes', () => {
    assert.equal(normalizeInvitationCode('K7F3-M9Q'), null)
    assert.equal(normalizeInvitationCode('K7F3-M9QXY'), null)
    assert.equal(normalizeInvitationCode('K7F3-M9QU'), null)
    assert.equal(normalizeInvitationCode('K7F3-M9Q!'), null)
    assert.equal(normalizeInvitationCode(''), null)
  })
})

describe('hashInvitationCode', () => {
  it('is a SHA-256 digest', () => {
    assert.equal(hashInvitationCode('K7F3M9QX').length, 32)
    assert.deepEqual(
      hashInvitationCode('K7F3M9QX'),
      hashInvitationCode('K7F3M9QX'),
    )
  })
})
