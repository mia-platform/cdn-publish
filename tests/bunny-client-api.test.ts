import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'
import type { SinonSandbox } from 'sinon'
import { createSandbox } from 'sinon'
import sinonChai from 'sinon-chai'

import { createCdnContext } from '../src/cdn.js'
import type { PullZoneMeta } from '../src/clients/bunny-api.js'
import { creatBunnyApiClient } from '../src/clients/bunny-api.js'


import { accessKey, bunny } from './server.js'
import { loggerStub } from './utils.js'

interface Context extends MochaContext {
    currentTest?: MochaContext['currentTest'] & {sandbox?: SinonSandbox}
    test?: MochaContext['test'] & {sandbox?: SinonSandbox}
  }


use(chaiAsPromised)
use(sinonChai)

const pullzoneMock: PullZoneMeta[] = [
  { Id: 1, Name: 'bar' },
  { Id: 2, Name: 'foo' },
]

describe('bunny cdn client', () => {
  beforeEach(function (this: Context) {
    if (this.currentTest) {
      this.currentTest.sandbox = createSandbox()
    }
  })

  afterEach(function (this: Context) {
    this.currentTest?.sandbox?.restore()
  })


  it('should get a list of pullzones', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const { method } = config ?? {}
      const { pathname, search } = url as URL

      expect(pathname).to.be.equal('/pullzone')
      expect(search).to.be.equal('')
      expect(method).to.be.equal('GET')
      return new Promise((res) =>
        res(new Response(JSON.stringify(pullzoneMock), { headers: bunny.headers200, status: 200 }))
      )
    })

    await expect(client.pullZone.list()).to.eventually.fulfilled
      .and.to.have.length(2)
      .and.deep.equal(pullzoneMock)
  })

  it('should get a list of pullzones with search', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const { method } = config ?? {}
      const { pathname, search,
      } = url as URL
      expect(pathname).to.be.equal('/pullzone')
      expect(search).to.be.equal('?search=bar')
      expect(method).to.be.equal('GET')
      return new Promise((res) =>
        res(new Response(JSON.stringify(pullzoneMock.slice(0, 1)), { headers: bunny.headers200, status: 200 }))
      )
    })

    await expect(client.pullZone.list('bar')).to.eventually.fulfilled
      .and.to.have.length(1)
      .and.deep.equal(pullzoneMock.slice(0, 1))
  })

  it('should purge a specific pullzone', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }
    const cdn = createCdnContext(accessKey, {
      server: 'https://api.bunny.net/',
      storageZoneName: '',
    })
    const client = creatBunnyApiClient(cdn, loggerStub)
    const pullZoneId = 123

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const { method } = config ?? {}
      const { pathname, search } = url as URL

      expect(pathname).to.be.equal(`/pullzone/${pullZoneId}/purgeCache`)
      expect(search).to.be.equal('')
      expect(method).to.be.equal('POST')
      return new Promise((res) =>
        res(new Response(undefined, { headers: bunny.headers204, status: 204 }))
      )
    })

    await expect(client.pullZone.purgeCache(pullZoneId)).to.eventually.fulfilled
      .and.deep.equal({ id: pullZoneId, status: 204 })
  })
})
