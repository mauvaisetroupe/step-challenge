import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Fastify from 'fastify'

import appLinkRoutes, { ASSET_LINKS } from './appLinks.js'

async function buildApp() {
  const app = Fastify()

  await app.register(appLinkRoutes, { host: 'step.example.test' })

  return app
}

describe('GET /.well-known/assetlinks.json', () => {
  it('declares the production app with its signing certificates', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'GET',
      url: '/.well-known/assetlinks.json',
    })

    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'] as string, /^application\/json/)
    assert.deepEqual(response.json(), ASSET_LINKS)

    const [statement] = response.json()

    assert.deepEqual(statement.relation, [
      'delegate_permission/common.handle_all_urls',
    ])
    assert.equal(statement.target.package_name, 'lu.architech.stepchallenge')

    for (const fingerprint of statement.target.sha256_cert_fingerprints) {
      assert.match(fingerprint, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    }
  })
})

describe('GET /i/:code', () => {
  it('shows the code and links to the app and the store', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/i/k7f3-m9qx' })

    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type'] as string, /^text\/html/)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.match(response.body, /K7F3-M9QX/)
    assert.match(
      response.body,
      /intent:\/\/step\.example\.test\/i\/K7F3-M9QX#Intent;scheme=https;package=lu\.architech\.stepchallenge;/,
    )
    assert.match(response.body, /play\.google\.com\/store\/apps\/details\?id=lu\.architech\.stepchallenge/)
  })

  it('answers 404 for an invalid code', async () => {
    const app = await buildApp()

    const response = await app.inject({ method: 'GET', url: '/i/K7F3-M9QU' })

    assert.equal(response.statusCode, 404)
    assert.match(response.body, /Lien d'invitation invalide/)
  })

  it('never echoes the raw input', async () => {
    const app = await buildApp()

    const response = await app.inject({
      method: 'GET',
      url: `/i/${encodeURIComponent('<script>alert(1)</script>')}`,
    })

    assert.equal(response.statusCode, 404)
    assert.doesNotMatch(response.body, /<script>alert/)
  })
})
