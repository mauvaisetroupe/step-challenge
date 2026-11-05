import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { levelOf, levelThreshold } from './levels.js'

describe('levels', () => {
  it('follows the curve of the specification', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20].map(levelThreshold),
      [0, 4, 14, 29, 49, 72, 101, 133, 169, 209, 801],
    )
  })

  it('gives the level of a total and the next threshold', () => {
    assert.deepEqual(levelOf(0), {
      level: 1,
      points: 0,
      levelPoints: 0,
      nextLevelPoints: 4,
    })
    assert.equal(levelOf(4).level, 2)
    assert.deepEqual(levelOf(13), {
      level: 2,
      points: 13,
      levelPoints: 4,
      nextLevelPoints: 14,
    })
    assert.equal(levelOf(209).level, 10)
  })
})
