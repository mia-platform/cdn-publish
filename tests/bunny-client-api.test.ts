import { mock } from 'node:test'

import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'

import { createCdnContext } from '../src/cdn.js'
import type { PullZoneMeta } from '../src/clients/bunny-api.js'
import { creatBunnyApiClient } from '../src/clients/bunny-api.js'

import { accessKey, bunny } from './server.js'
import { loggerStub } from './utils.js'

const pullzoneMock: PullZoneMeta[] = [
  { Id: 1, Name: 'bar' },
  { Id: 2, Name: 'foo' },
]

describe('bunny cdn client', () => {
  beforeEach(() => {
    mock.restoreAll()
  })

  it('should get a list of pullzones', async () => {
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)

    mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
      expect(url.pathname).to.be.equal('/pullzone')
      expect(url.search).to.be.equal('')
      expect(method).to.be.equal('GET')
      return new Promise((res) =>
        res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
      )
    })

    await expect(client.pullZone.list()).to.eventually.fulfilled
      .and.to.have.length(2)
      .and.deep.equal(pullzoneMock)
  })

  it('should get a list of pullzones with search', async () => {
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)

    mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
      expect(url.pathname).to.be.equal('/pullzone')
      expect(url.search).to.be.equal('?search=bar')
      expect(method).to.be.equal('GET')
      return new Promise((res) =>
        res(new Response(JSON.stringify(pullzoneMock.slice(0, 1)), { headers: bunny.headers200, status: 200 }))
      )
    })

    await expect(client.pullZone.list('bar')).to.eventually.fulfilled
      .and.to.have.length(1)
      .and.deep.equal(pullzoneMock.slice(0, 1))
  })

  it('should purge a specific pullzone', async () => {
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)
    const pullZoneId = 123

    mock.method(global, 'fetch', (url: URL, { method = 'GET' }: RequestInit = {}) => {
      expect(url.pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
      expect(url.search).to.be.equal('')
      expect(method).to.be.equal('POST')
      return new Promise((res) =>
        res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
      )
    })

    await expect(client.pullZone.purgeCache(pullZoneId)).to.eventually.fulfilled
      .and.deep.equal({ id: pullZoneId, status: 204 })
  })
})
