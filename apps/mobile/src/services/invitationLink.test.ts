/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { invitationFromInstallReferrer, toAppPath } from './invitationLink'

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

describe('invitationFromInstallReferrer', () => {
  it('reads the code set by the invitation page', () => {
    assert.equal(invitationFromInstallReferrer('invite=K7F3M9QX'), 'K7F3-M9QX')
    assert.equal(invitationFromInstallReferrer('invite=k7f3-m9qx'), 'K7F3-M9QX')
    assert.equal(
      invitationFromInstallReferrer('utm_source=x&invite=K7F3M9QX&gclid=y'),
      'K7F3-M9QX',
    )
  })

  it('ignores ordinary installs and malformed codes', () => {
    assert.equal(
      invitationFromInstallReferrer('utm_source=google-play&utm_medium=organic'),
      null,
    )
    assert.equal(invitationFromInstallReferrer(''), null)
    assert.equal(invitationFromInstallReferrer('invite='), null)
    assert.equal(invitationFromInstallReferrer('invite=K7F3M9Q'), null)
    assert.equal(invitationFromInstallReferrer('invite=K7F3M9QU'), null)
    assert.equal(invitationFromInstallReferrer('invite=%E0%A4%A'), null)
    assert.equal(invitationFromInstallReferrer('reinvite=K7F3M9QX'), null)
  })
})
