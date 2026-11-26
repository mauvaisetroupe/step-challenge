/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildHourlyRequest,
  buildMinuteRequest,
  buildPolymerizeRequest,
  countHoursWithSteps,
  countMinutesWithSteps,
  formatUtcOffset,
  parseHourlySteps,
  parsePolymerizeResponse,
  type PolymerizeRequest,
} from './huaweiRest'

const request = (timeZone: string): PolymerizeRequest => ({
  polymerizeWith: [{ dataTypeName: 'com.huawei.continuous.steps.delta' }],
  startTime: 0,
  endTime: 0,
  groupByTime: { groupPeriod: { timeZone, unit: 'day', value: 1 } },
})

/** A group as returned by Huawei, with made-up step counts. */
const group = (startTime: number, ...steps: number[]) => ({
  startTime,
  endTime: startTime + 86_399_999,
  sampleSet: [
    {
      dataCollectorId: 'derived:steps.total',
      samplePoints: steps.map((value) => ({
        startTime: startTime * 1_000_000,
        dataTypeName: 'com.huawei.continuous.steps.total',
        value: [{ fieldName: 'steps', integerValue: value }],
      })),
    },
  ],
})

// 2026-11-23 00:00 at +01:00
const NOV_23 = Date.UTC(2026, 10, 22, 23)

describe('formatUtcOffset', () => {
  it('formats offsets east and west of UTC', () => {
    assert.equal(formatUtcOffset(60), '+0100')
    assert.equal(formatUtcOffset(0), '+0000')
    assert.equal(formatUtcOffset(-330), '-0530')
    assert.equal(formatUtcOffset(345), '+0545')
  })
})

describe('buildPolymerizeRequest', () => {
  it('starts at the local midnight of the first day', () => {
    const start = new Date(2026, 9, 26, 15, 42)
    const end = new Date(2026, 10, 24, 21, 30)
    const result = buildPolymerizeRequest(start, end)

    assert.equal(result.startTime, new Date(2026, 9, 26).getTime())
    assert.equal(result.endTime, end.getTime())
    assert.equal(
      result.groupByTime.groupPeriod.timeZone,
      formatUtcOffset(-end.getTimezoneOffset()),
    )
    assert.deepEqual(result.polymerizeWith, [
      { dataTypeName: 'com.huawei.continuous.steps.delta' },
    ])
  })
})

describe('parsePolymerizeResponse', () => {
  it('returns one day per group', () => {
    const response = {
      group: [group(NOV_23, 8_412), group(NOV_23 + 86_400_000, 10_250)],
    }

    assert.deepEqual(parsePolymerizeResponse(response, request('+0100')), [
      { date: '2026-11-23', steps: 8_412 },
      { date: '2026-11-24', steps: 10_250 },
    ])
  })

  it('counts a day without sample point as 0 steps', () => {
    const response = { group: [group(NOV_23)] }

    assert.deepEqual(parsePolymerizeResponse(response, request('+0100')), [
      { date: '2026-11-23', steps: 0 },
    ])
  })

  it('adds the sample points of a day', () => {
    const response = { group: [group(NOV_23, 1_000, 234)] }

    assert.deepEqual(parsePolymerizeResponse(response, request('+0100')), [
      { date: '2026-11-23', steps: 1_234 },
    ])
  })

  it('reads the date in the offset of the request', () => {
    // 2026-10-20 00:00 at +01:00 is 2026-10-19 23:00 at UTC
    const response = { group: [group(Date.UTC(2026, 9, 19, 23), 5_000)] }

    assert.deepEqual(parsePolymerizeResponse(response, request('+0100')), [
      { date: '2026-10-20', steps: 5_000 },
    ])
  })

  it('ignores other fields and malformed groups', () => {
    const response = {
      group: [
        {
          startTime: NOV_23,
          sampleSet: [
            {
              samplePoints: [
                {
                  value: [
                    { fieldName: 'duration', integerValue: 3_600 },
                    { fieldName: 'steps', integerValue: 42 },
                  ],
                },
              ],
            },
          ],
        },
        { sampleSet: [] },
      ],
    }

    assert.deepEqual(parsePolymerizeResponse(response, request('+0100')), [
      { date: '2026-11-23', steps: 42 },
    ])
  })

  it('returns nothing for an empty or unexpected response', () => {
    assert.deepEqual(parsePolymerizeResponse({}, request('+0100')), [])
    assert.deepEqual(parsePolymerizeResponse(null, request('+0100')), [])
  })
})

describe('hourly detail', () => {
  it('asks for one-hour groups from local midnight', () => {
    const end = new Date(2026, 10, 24, 10, 30)
    const request = buildHourlyRequest(end)

    assert.equal(request.startTime, new Date(2026, 10, 24).getTime())
    assert.equal(request.endTime, end.getTime())
    assert.deepEqual(request.groupByTime, { duration: 3_600_000 })
  })

  it('asks for one-minute groups from local midnight', () => {
    const end = new Date(2026, 10, 24, 10, 30)
    const request = buildMinuteRequest(end)

    assert.equal(request.startTime, new Date(2026, 10, 24).getTime())
    assert.equal(request.endTime, end.getTime())
    assert.deepEqual(request.groupByTime, { duration: 60_000 })
  })

  it('counts the minutes with steps and the busiest one', () => {
    const minute = (steps: number) => ({
      sampleSet: [
        { samplePoints: [{ value: [{ fieldName: 'steps', integerValue: steps }] }] },
      ],
    })

    assert.deepEqual(
      countMinutesWithSteps({
        group: [minute(0), minute(95), minute(112), { sampleSet: [] }],
      }),
      { withSteps: 2, maxSteps: 112 },
    )
    assert.deepEqual(countMinutesWithSteps(null), {
      withSteps: 0,
      maxSteps: 0,
    })
  })

  it('counts the hours with steps', () => {
    const hour = (steps: number) => ({
      sampleSet: [
        {
          samplePoints: steps
            ? [{ value: [{ fieldName: 'steps', integerValue: steps }] }]
            : [],
        },
      ],
    })

    assert.deepEqual(
      countHoursWithSteps({ group: [hour(0), hour(120), hour(0), hour(35)] }),
      { hours: 4, withSteps: 2 },
    )
    assert.deepEqual(countHoursWithSteps(null), { hours: 0, withSteps: 0 })
  })

  it('gives the steps of each local hour until the end', () => {
    const end = new Date(2026, 10, 24, 3, 30)
    const at = (hour: number, steps: number) => ({
      startTime: new Date(2026, 10, 24, hour).getTime(),
      sampleSet: [
        { samplePoints: [{ value: [{ fieldName: 'steps', integerValue: steps }] }] },
      ],
    })

    assert.deepEqual(
      parseHourlySteps({ group: [at(1, 120), at(3, 35)] }, end),
      [0, 120, 0, 35],
    )
    assert.deepEqual(parseHourlySteps(null, end), [0, 0, 0, 0])
  })
})
