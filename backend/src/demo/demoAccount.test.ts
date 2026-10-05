import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isDemoAccessCode, parseDemoAccessCode } from './demoAccount.js'

describe('parseDemoAccessCode', () => {
  it('disables demo access when absent or empty', () => {
    assert.equal(parseDemoAccessCode(undefined), undefined)
    assert.equal(parseDemoAccessCode(''), undefined)
    assert.equal(parseDemoAccessCode('   '), undefined)
  })

  it('refuses a short code', () => {
    assert.throws(() => parseDemoAccessCode('too-short'), /at least 20/)
  })

  it('accepts a long code, without surrounding spaces', () => {
    assert.equal(
      parseDemoAccessCode(' Xq7-long-random-code-2026 '),
      'Xq7-long-random-code-2026',
    )
  })
})

describe('isDemoAccessCode', () => {
  const code = 'Xq7-long-random-code-2026'

  it('accepts the exact code only', () => {
    assert.equal(isDemoAccessCode(code, code), true)
    assert.equal(isDemoAccessCode(code, 'xq7-long-random-code-2026'), false)
    assert.equal(isDemoAccessCode(code, `${code}!`), false)
    assert.equal(isDemoAccessCode(code, 'x'), false)
  })
})
