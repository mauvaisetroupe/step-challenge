/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { addPhoneStepReading, type PhoneStepTally } from './phoneStepTally'

const BOOT = 1_790_000_000_000

const tally = (day: string, steps: number, counter: number): PhoneStepTally => ({
  day,
  steps,
  counter,
  bootTime: BOOT,
})

describe('addPhoneStepReading', () => {
  it('starts at zero on the first reading', () => {
    const result = addPhoneStepReading(
      null,
      { steps: 12_345, bootTime: BOOT },
      '2026-10-22',
    )

    assert.deepEqual(result.tally, tally('2026-10-22', 0, 12_345))
    assert.deepEqual(result.days, [{ date: '2026-10-22', steps: 0 }])
  })

  it('adds the steps since the previous reading on the same day', () => {
    const result = addPhoneStepReading(
      tally('2026-10-22', 1_000, 12_345),
      { steps: 13_345, bootTime: BOOT + 2_000 },
      '2026-10-22',
    )

    assert.equal(result.tally.steps, 2_000)
    assert.equal(result.tally.counter, 13_345)
    assert.deepEqual(result.days, [{ date: '2026-10-22', steps: 2_000 }])
  })

  it('gives the steps since the last reading to the earlier day', () => {
    const result = addPhoneStepReading(
      tally('2026-10-21', 8_000, 20_000),
      { steps: 21_500, bootTime: BOOT },
      '2026-10-22',
    )

    assert.deepEqual(result.tally, tally('2026-10-22', 0, 21_500))
    assert.deepEqual(result.days, [
      { date: '2026-10-21', steps: 9_500 },
      { date: '2026-10-22', steps: 0 },
    ])
  })

  it('counts from zero after a reboot (new boot time)', () => {
    const result = addPhoneStepReading(
      tally('2026-10-22', 3_000, 20_000),
      { steps: 500, bootTime: BOOT + 3_600_000 },
      '2026-10-22',
    )

    assert.equal(result.tally.steps, 3_500)
    assert.equal(result.tally.bootTime, BOOT + 3_600_000)
  })

  it('counts from zero after a reboot (lower counter)', () => {
    const result = addPhoneStepReading(
      tally('2026-10-22', 3_000, 20_000),
      { steps: 19_000, bootTime: BOOT },
      '2026-10-22',
    )

    assert.equal(result.tally.steps, 22_000)
  })
})
