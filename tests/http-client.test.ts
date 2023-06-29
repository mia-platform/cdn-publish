/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'
import type { SinonSandbox } from 'sinon'
import { createSandbox } from 'sinon'
import sinonChai from 'sinon-chai'


import { createCdnContext } from '../src/cdn.js'
import { createBunnyEdgeStorageClient } from '../src/clients/bunny-edge-storage.js'
import { createHttpClient } from '../src/clients/http-client.js'
import MysteryBoxError from '../src/error.js'
import { absoluteResolve } from '../src/glob.js'
import type { FileContext, LoadingContext } from '../src/types.js'

import { accessKey, serverStorageBaseUrl, storageZoneName } from './server.js'
import { createResources, createTmpDir, loggerStub, noop, sha256 } from './utils.js'

interface Context extends MochaContext {
  currentTest?: MochaContext['currentTest'] & {sandbox?: SinonSandbox}
  test?: MochaContext['test'] & {sandbox?: SinonSandbox}
}

use(chaiAsPromised)
use(sinonChai)

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
  beforeEach(function (this: Context) {
    if (this.currentTest) {
      this.currentTest.sandbox = createSandbox()
    }
  })

  afterEach(function (this: Context) {
    this.currentTest?.sandbox?.restore()
  })


  it('should handle a 400 bad request', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const path = './..%2F../' as const

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.endsWith('..%2F../')
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
      ) {
        return new Response(JSON.stringify(bunny400), { headers: bunny400Headers, status: 400 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    await expect(client.list(path))
      .to.eventually.be.rejectedWith(MysteryBoxError)
  })

  it('should retrieve data on a 200', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const path = './__test/' as const

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.endsWith('__test/')
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
      ) {
        return new Response(JSON.stringify([]), { headers: bunny200JsonHeaders, status: 200 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    await expect(client.list(path))
      .to.eventually.be.fulfilled.and.have.members([])
  })

  it('should fail on loading a non buffer data', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    // Avoid to call a real server
    this.test.sandbox.stub(global, 'fetch').callsFake(async () => new Response())

    await expect(client.put('./__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this) {
          return Promise.resolve({
            buffer: fs.createReadStream(this.absolutePath) as unknown as Buffer,
            checksum: 'undefined',
          })
        },
        pathname: `./${resource}`,
      },
    ])).to.eventually.be.rejectedWith(MysteryBoxError)

    await tmpCtx.cleanup()
  })

  it('should put some files', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.endsWith('__test/package.json')
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
         && (config?.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/octet-stream'
      ) {
        return new Response(JSON.stringify(bunny201), { headers: bunny201Headers, status: 201 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    await client.put('./__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this) {
          return fs.promises.readFile(this.absolutePath)
        },
        pathname: `./${resource}`,
      },
    ])

    await tmpCtx.cleanup()
  })

  it('should put multiple batches of files', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const resources = Array(26).fill(0).map((_, idx) => `file${idx}.js`)
    const tmpCtx = await createTmpDir(createResources(resources))

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.match(/__test\/file\d{1,2}\.js/)
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
         && (config?.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/octet-stream'
      ) {
        return new Response(JSON.stringify(bunny201), { headers: bunny201Headers, status: 201 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    const loaders = resources.map((name) => ({
      absolutePath: absoluteResolve(tmpCtx.name, name),
      loader(this: {absolutePath: string}) {
        return fs.promises.readFile(this.absolutePath)
      },
      pathname: `./${name}`,
    })) as [LoadingContext, ...LoadingContext[]]

    await client.put('./__test', loaders)

    await tmpCtx.cleanup()
  })

  it('should put multiple files but fail on one', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const resources = Array(3).fill(0).map((_, idx) => `file${idx}.js`)
    const tmpCtx = await createTmpDir(createResources(resources))

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.match(/__test\/file\d{1,2}\.js/)
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
         && (config?.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/octet-stream'
      ) {
        if (stringifiedUrl.endsWith('2.js')) {
          return new Response(JSON.stringify(bunny400), { headers: bunny400Headers, status: 400 })
        }

        return new Response(JSON.stringify(bunny201), { headers: bunny201Headers, status: 201 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    const loaders = resources.map((name) => ({
      absolutePath: absoluteResolve(tmpCtx.name, name),
      loader(this: {absolutePath: string}) {
        return fs.promises.readFile(this.absolutePath)
      },
      pathname: `./${name}`,
    })) as [LoadingContext, ...LoadingContext[]]

    await expect(client.put('./__test', loaders))
      .to.eventually.be.rejectedWith(MysteryBoxError)

    await tmpCtx.cleanup()
  })

  it('unauthorized scenario', async function (this: Context) {
    if (this.test?.sandbox === undefined) {
      throw new TypeError('Cannot find sandbox')
    }

    const resource = 'package.json'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    this.test.sandbox.stub(global, 'fetch').callsFake(async (url: URL | RequestInfo, config?: RequestInit) => {
      const stringifiedUrl = url instanceof URL ? url.href : (url instanceof Request ? url.url : url)
      if (
        stringifiedUrl.match('__test/package.json')
         && (config?.headers as Record<string, string> | undefined)?.AccessKey === accessKey
         && (config?.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/octet-stream'
      ) {
        return new Response(JSON.stringify(bunny401), { headers: bunny401Headers, status: 401 })
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })
    })

    await expect(client.put('./__test', [
      {
        absolutePath: absoluteResolve(tmpCtx.name, resource),
        loader(this) {
          return fs.promises.readFile(this.absolutePath)
        },
        pathname: `./${resource}`,
      },
    ])).to.eventually.be.rejected.and.satisfies((error: unknown) => {
      const check = true

      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      if (!(error.cause instanceof MysteryBoxError)) {
        return false
      }

      if (!(error.cause.cause instanceof Response)) {
        return false
      }

      expect(error.cause.cause).to.have.property('ok', false)
      expect(error.cause.cause).to.have.property('status', 401)

      return check
    })

    await tmpCtx.cleanup()
  })
})

describe.skip('e2e DONT USE', () => {
  it('e2e DONT USE', async function (this) {
    this.timeout(100000)

    const resources = Array(100).fill(0).map((_, idx) => `file${idx}.txt`)
    const tmpCtx = await createTmpDir(createResources(resources))

    const e2eAccessKey = process.env.STORAGE_ACCESS_KEY
    if (!e2eAccessKey) {
      throw new TypeError('must set an STORAGE_ACCESS_KEY')
    }
    const cdn = createCdnContext(e2eAccessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createBunnyEdgeStorageClient(cdn, loggerStub)

    const loaders = resources.map((name) => ({
      absolutePath: absoluteResolve(tmpCtx.name, name),
      loader(this): Promise<FileContext> {
        return fs.promises.readFile(this.absolutePath)
          .then((buffer) => ({
            buffer,
            checksum: sha256(buffer),
          }))
      },
      pathname: `./${name}`,
    } as LoadingContext)) as [LoadingContext, ...LoadingContext[]]

    await client.put('./backoffice/__test/files', loaders)

    await tmpCtx.cleanup().then(noop)
  })

  it('e2e DONT USE', async function (this) {
    this.timeout(100000)
    // nock.enableNetConnect()

    const e2eAccessKey = process.env.STORAGE_ACCESS_KEY
    if (!e2eAccessKey) {
      throw new TypeError('must set an STORAGE_ACCESS_KEY')
    }

    const cdn = createCdnContext(e2eAccessKey, {
      server: serverStorageBaseUrl,
      storageZoneName,
    })
    const client = createHttpClient({
      baseURL: cdn.baseURL.href,
      headers: {
        AccessKey: e2eAccessKey,
      },
    })

    await client.delete('./backoffice/__test/files/')
  })
})
