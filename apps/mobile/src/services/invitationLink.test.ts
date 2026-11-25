/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { toAppPath } from './invitationLink'

describe('toAppPath', () => {
  it('maps an invitation link of the site to the app route', () => {
    assert.equal(
      toAppPath('https://sport.architech.lu/step-challenge/i/K7F3-M9QX'),
      '/i/K7F3-M9QX',
    )
    assert.equal(toAppPath('/step-challenge/i/K7F3-M9QX'), '/i/K7F3-M9QX')
    assert.equal(toAppPath('/step-challenge/i/K7F3-M9QX/'), '/i/K7F3-M9QX')
  })

  it('leaves the other paths unchanged', () => {
    assert.equal(toAppPath('/i/K7F3-M9QX'), '/i/K7F3-M9QX')
    assert.equal(toAppPath('stepchallenge-dev://i/K7F3-M9QX'), 'stepchallenge-dev://i/K7F3-M9QX')
    assert.equal(toAppPath('/step-challenge/privacy.html'), '/step-challenge/privacy.html')
    assert.equal(toAppPath('/'), '/')
  })
})
