import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BADGES } from './catalogue.js'
import { badgeTexts, localeOf } from './texts.js'

describe('badgeTexts', () => {
  it('has texts for every badge of the catalogue, in both languages', () => {
    for (const locale of ['fr', 'en'] as const) {
      for (const [id, { kind }] of Object.entries(BADGES)) {
        const occurrence = kind === 'period' ? (id.startsWith('month') || id.includes('.month.') ? '2026-11' : '2026-W45') : ''

        assert.ok(badgeTexts(locale, id, occurrence), `${locale} ${id}`)
      }
    }
  })

  it('names the period and the challenge of the month', () => {
    assert.deepEqual(badgeTexts('en', 'month.challenge', '2026-11'), {
      name: 'Challenge of the month',
      period: 'November 2026',
      description: '3 days at 20,000 steps or more in the month.',
    })
    assert.equal(badgeTexts('fr', 'week.70000', '2026-W45')?.period, 'Semaine du 2 novembre')
    assert.equal(badgeTexts('fr', 'month.300000', '2026-11')?.period, 'Novembre 2026')
  })

  it('formats totals in millions', () => {
    assert.equal(badgeTexts('en', 'total.2500000')?.name, '2.5 million steps')
    assert.equal(badgeTexts('fr', 'total.2500000')?.name, '2,5 millions de pas')
    assert.equal(badgeTexts('fr', 'total.1000000')?.name, '1 million de pas')
  })

  it('knows nothing of an unknown badge', () => {
    assert.equal(badgeTexts('en', 'day.unknown'), null)
    assert.equal(badgeTexts('en', 'mystery.badge'), null)
  })
})

describe('localeOf', () => {
  it('picks French for a French first language, English otherwise', () => {
    assert.equal(localeOf('fr-FR,fr;q=0.9,en;q=0.8'), 'fr')
    assert.equal(localeOf('en-US,fr;q=0.5'), 'en')
    assert.equal(localeOf('es'), 'en')
    assert.equal(localeOf(undefined), 'en')
  })
})
