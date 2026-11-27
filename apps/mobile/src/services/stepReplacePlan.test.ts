import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { planReplacement } from './stepReplacePlan'

describe('planReplacement', () => {
  it('lists the days that would change, oldest first', () => {
    assert.deepEqual(
      planReplacement(
        [
          { date: '2026-11-25', steps: 16380 },
          { date: '2026-11-24', steps: 9000 },
          { date: '2026-11-26', steps: 4200 },
        ],
        [
          { date: '2026-11-26', steps: 3000 },
          { date: '2026-11-25', steps: 50214 },
          { date: '2026-11-24', steps: 9000 },
        ],
      ),
      [
        { date: '2026-11-25', from: 50214, to: 16380 },
        { date: '2026-11-26', from: 3000, to: 4200 },
      ],
    )
  })

  it('leaves out days without steps in the source', () => {
    assert.deepEqual(
      planReplacement(
        [
          { date: '2026-11-24', steps: 0 },
          { date: '2026-11-25', steps: 1200 },
        ],
        [{ date: '2026-11-24', steps: 8000 }],
      ),
      [{ date: '2026-11-25', from: null, to: 1200 }],
    )
  })
})
