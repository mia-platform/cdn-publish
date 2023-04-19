import fs from 'fs'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import type { Context as MochaContext } from 'mocha'
import { afterEach, beforeEach, describe, it } from 'mocha'
import nock from 'nock'

import { createCdnContext } from '../cdn.js'
import MysteryBoxError from '../error.js'
import { absoluteResolve } from '../glob.js'
import { HttpError, createClient } from '../http-client.js'
import type { FileContext, LoadingContext } from '../types.js'

import { createResources, createTmpDir, loggerStub, noop } from './utils.js'

use(chaiAsPromised)

nock.disableNetConnect()

// 400
const bunny400 = ''
  + '<html>'
  + '<head><title>400 Bad Request</title></head>'
  + '<body>'
  + '<center><h1>400 Bad Request</h1></center>'
  + '<hr><center>nginx</center>'
  + '</body>'
  + '</html>'
const bunny400Headers = {
  'access-control-allow-origin': '*',
  'content-type': 'text/html',
}

// 200 list
const bunny200JsonHeaders = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 201 put
const bunny201 = {
  HttpCode: 201,
  Message: 'File uploaded.',
}
const bunny201Headers = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

// 401
const bunny401 = {
  HttpCode: 401,
  Message: 'Unauthorized',
}
const bunny401Headers = {
  'access-control-allow-headers': 'AccessKey, Content-Type',
  'access-control-allow-methods': 'GET, DELETE, POST, PUT, DESCRIBE',
  'access-control-allow-origin': '*',
  connection: 'keep-alive',
  'content-type': 'application/json',
  'transfer-encoding': 'chunked',
}

describe('http client tests', () => {
  type Context = MochaContext & {
    currentTest?: {cleanup?: () => void | Promise<void>; value?: nock.Scope}
    test?: {cleanup?: () => void | Promise<void>; value?: nock.Scope}
  }

  beforeEach(() => {
    nock.cleanAll()
  })

  afterEach(async function (this: Context) {
    expect(this.currentTest?.value?.isDone()).to.be.true
    return this.currentTest?.cleanup?.()
  })

  it('should handle a 400 bad request', async function (this: Context) {
    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const path = './..%2F../' as const
    const scope = nock(cdn.baseURL.href)
      .get((uri) => uri.endsWith('..%2F../'))
      .matchHeader('AccessKey', accessKey)
      .reply(() => [400, bunny400, bunny400Headers])

    const client = createClient(cdn, loggerStub)

    await expect(client.list(path))
      .to.eventually.be.rejectedWith(HttpError)

    if (this.test) {
      this.test.value = scope
    }
  })

  it('should retrieve data on a 200', async function (this: Context) {
    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const path = './__test/' as const
    const scope = nock(cdn.baseURL.href)
      .get((uri) => uri.endsWith('__test/'))
      .matchHeader('AccessKey', accessKey)
      .reply(() => [200, [], bunny200JsonHeaders])

    const client = createClient(cdn, loggerStub)

    await expect(client.list(path))
      .to.eventually.be.fulfilled.and.have.members([])

    if (this.test) {
      this.test.value = scope
    }
  })

  it('should put some files', async function (this: Context) {
    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const client = createClient(cdn, loggerStub)

    const scope = nock(cdn.baseURL.href)
      .put((uri) => uri.endsWith('__test/package.json'))
      .matchHeader('AccessKey', accessKey)
      .matchHeader('Content-Type', 'application/octet-stream')
      .reply(() => [201, bunny201, bunny201Headers])

    await client.put('./__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this) {
          return Promise.resolve(fs.createReadStream(this.absolutePath))
        },
        pathname: `./${resource}`,
      },
    ])

    if (this.test) {
      this.test.value = scope
      this.test.cleanup = () => tmpCtx.cleanup().then(noop)
    }
  })

  it('should put multiple batches of files', async function (this: Context) {
    const resources = Array(26).fill(0).map((_, idx) => `file${idx}.js`)
    const tmpCtx = await createTmpDir(createResources(resources))

    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const client = createClient(cdn, loggerStub)

    const scope = nock(cdn.baseURL.href)
      .persist()
      .put((uri) => Boolean(uri.match(/__test\/file\d{1,2}\.js/)))
      .matchHeader('AccessKey', accessKey)
      .matchHeader('Content-Type', 'application/octet-stream')
      .reply(() => [201, bunny201, bunny201Headers])

    const loaders = resources.map((name) => ({
      absolutePath: absoluteResolve(tmpCtx.name, name),
      loader(this: {absolutePath: string}) {
        return Promise.resolve(fs.createReadStream(this.absolutePath))
      },
      pathname: `./${name}`,
    })) as [LoadingContext, ...LoadingContext[]]

    await client.put('./__test', loaders)

    if (this.test) {
      this.test.value = scope
      this.test.cleanup = () => tmpCtx.cleanup().then(noop)
    }
  })

  it.only('should put multiple files but fail on one', async function (this: Context) {
    const resources = Array(3).fill(0).map((_, idx) => `file${idx}.js`)
    const tmpCtx = await createTmpDir(createResources(resources))

    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const client = createClient(cdn, loggerStub)

    const scope = nock(cdn.baseURL.href)
      .persist()
      .put((uri) => Boolean(uri.match(/__test\/file\d{1,2}\.js/)))
      .matchHeader('AccessKey', accessKey)
      .matchHeader('Content-Type', 'application/octet-stream')
      .reply((uri) => {
        if (uri.endsWith('2.js')) {
          return [400, bunny400, bunny400Headers]
        }

        return [201, bunny201, bunny201Headers]
      })

    const loaders = resources.map((name) => ({
      absolutePath: absoluteResolve(tmpCtx.name, name),
      loader(this: {absolutePath: string}) {
        return Promise.resolve(fs.createReadStream(this.absolutePath))
      },
      pathname: `./${name}`,
    })) as [LoadingContext, ...LoadingContext[]]

    await expect(client.put('./__test', loaders))
      .to.eventually.be.rejectedWith(MysteryBoxError)

    if (this.test) {
      this.test.value = scope
      this.test.cleanup = () => tmpCtx.cleanup().then(noop)
    }
  })

  it('unauthorized scenario', async function (this: Context) {
    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const accessKey = 'secret'
    const cdn = createCdnContext(accessKey)
    const client = createClient(cdn, loggerStub, 1)

    const scope = nock(cdn.baseURL.href)
      .put((uri) => uri.endsWith('__test/package.json'))
      .matchHeader('AccessKey', accessKey)
      .matchHeader('Content-Type', 'application/octet-stream')
      .reply(() => [401, bunny401, bunny401Headers])

    await expect(client.put('./__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this) {
          return Promise.resolve(fs.createReadStream(this.absolutePath))
        },
        pathname: `./${resource}`,
      },
    ])).to.eventually.be.rejected.and.satisfies((error: unknown) => {
      const check = true

      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      if (!(Array.isArray(error.cause) && error.cause[0].cause instanceof HttpError)) {
        return false
      }

      expect(error.cause[0].cause).to.have.property('response')
      expect((error.cause[0].cause as HttpError).response).to.have.property('status', 401)

      return check
    })

    if (this.test) {
      this.test.value = scope
      this.test.cleanup = () => tmpCtx.cleanup().then(noop)
    }
  })
})

describe('e2e DONT USE', () => {
  it.skip('e2e DONT USE', async function (this) {
    this.timeout(100000)
    nock.enableNetConnect()
    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const accessKey = process.env.ACCESS_KEY as string
    const cdn = createCdnContext(accessKey)
    const client = createClient(cdn, loggerStub, 1)

    await client.put('./backoffice/__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this): Promise<FileContext> {
          return Promise.resolve(fs.createReadStream(this.absolutePath))
        },
        pathname: `./${resource}`,
      },
    ])

    await tmpCtx.cleanup().then(noop)
    nock.disableNetConnect()
  })
})
