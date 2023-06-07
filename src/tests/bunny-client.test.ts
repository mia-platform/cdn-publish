
/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs'
import { mock } from 'node:test'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import type { Context as MochaContext } from 'mocha'
import { afterEach, beforeEach, describe, it } from 'mocha'

import { createBunnyClient } from '../bunny-client.js'
import { createCdnContext } from '../cdn.js'
import MysteryBoxError from '../error.js'
import { absoluteResolve } from '../glob.js'
import type { LoadingContext } from '../types'

import { accessKey, bunny, createServer, indexHash } from './server.js'
import { createResources, createTmpDir, loggerStub } from './utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

use(chaiAsPromised)

const index = '<!DOCTYPE html><html></html>'

describe('bunny cdn client', () => {
  beforeEach(async function (this: Context) {
    mock.restoreAll()
    this.cleanup = await createServer()
  })

  afterEach(async function (this: Context) {
    return this.cleanup?.()
  })

  it('should get a list of files', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(client.list('./__test/'))
      .to.eventually.be.fulfilled.and.to.have.length(3)
  })

  it('should fail to get a single file', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(client.get('./__test/other.json'))
      .to.eventually.be.rejected.and.satisfies((error: unknown) => {
        if (!(error instanceof MysteryBoxError)) {
          return false
        }

        if (!(error.cause instanceof Response)) {
          return false
        }

        expect(error.cause).to.have.property('ok', false)
        expect(error.cause).to.have.property('status', 404)

        return true
      })
  })

  it('should get a single file', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(client.get('./__test/file0.txt'))
      .to.eventually.be.fulfilled.and.be.equal('file0.txt')
  })

  it('should revert to directory', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(client.get('./__test/other.json/'))
      .to.eventually.be.fulfilled.and.be.eql([])
  })

  it('should fail to put on a semver dir', async () => {
    const resource = 'index.html'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.put(
        `./__test/0.0.0/`,
        [
          {
            absolutePath: absoluteResolve(tmpCtx.name, resource),
            loader(this) {
              return fs.promises.readFile(this.absolutePath)
            },
            pathname: `./${resource}`,
          },
        ],
        true
      )
    ).to.eventually.be.rejected.and.satisfies((error: unknown) => {
      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      expect(error.message).to.equal('Folder ./__test/0.0.0/ is not empty and scoped with semver versioning')

      return true
    })

    await tmpCtx.cleanup()
  })

  it('should succed to put with checksum', async () => {
    const resource = 'index.html'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.put(
        `./__test/1.0.0/`,
        [
          {
            absolutePath: absoluteResolve(tmpCtx.name, resource),
            loader: async () => {
              return {
                buffer: Buffer.from(index, 'binary'),
                checksum: indexHash,
              }
            },
            pathname: `./${resource}`,
          },
        ],
        true
      )
    ).to.eventually.be.fulfilled

    await tmpCtx.cleanup()
  })

  it('should succed to put on an empty semver dir', async () => {
    const resource = 'index.html'
    const tmpCtx = await createTmpDir(createResources([resource]))

    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.put(
        `./__test/2.0.0/`,
        [
          {
            absolutePath: absoluteResolve(tmpCtx.name, resource),
            loader(this) {
              return fs.promises.readFile(this.absolutePath)
            },
            pathname: `./${resource}`,
          },
        ],
        true
      )
    ).to.eventually.be.fulfilled

    await tmpCtx.cleanup()
  })

  it('should fail deleting a not existing file', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.delete('./__test/1.0.0/', './notExistingFile.html')
    ).to.eventually.be.rejected.and.satisfies((error: unknown) => {
      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      if (!(error.cause instanceof Response)) {
        return false
      }

      return true
    })
  })

  it('should not fail deleting a not existing file with flag', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.delete('./__test/1.0.0/', './notExistingFile.html', true)
    ).to.eventually.be.fulfilled
  })

  it('should succed deleting', async () => {
    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.delete('./__test/0.0.0/', './index.html')
    ).to.eventually.be.fulfilled
  })
})

describe('restore check on semver folder put', () => {
  before(() => {
    mock.restoreAll()
  })

  it('should attempt to cleanup the folder on failed upload', async () => {
    const resources = ['file0.txt', 'file1.txt']
    const tmpCtx = await createTmpDir(createResources(resources))

    let count = 0
    mock.method(global, 'fetch', async (url: URL, { method = 'GET' }: RequestInit = {}) => {
      if (method === 'PUT') {
        count += 1
        return url.href.match(/file0.txt$/)
          ? new Response('', { headers: { 'Content-Type': 'text/plain' }, status: 200 })
          : new Response(bunny.response400, { headers: bunny.headers400, status: 400 })
      }
      if (method === 'DELETE') {
        count += 1
        return new Response(JSON.stringify(bunny.responseDelete200), { headers: bunny.headers200, status: 200 })
      }
      if (method === 'GET' && url.href.match(/0\.0\.0\/$/)) {
        count += 1
        return new Response(JSON.stringify([]), { headers: bunny.headers200, status: 200 })
      }

      return new Response(JSON.stringify(bunny.headers404), { headers: bunny.headers404, status: 404 })
    })

    const cdn = createCdnContext(accessKey, {})
    const client = createBunnyClient(cdn, loggerStub)

    await expect(
      client.put(
        `./__test/0.0.0/`,
        resources.map((resource) => ({
          absolutePath: absoluteResolve(tmpCtx.name, resource),
          loader(this) {
            return fs.promises.readFile(this.absolutePath)
          },
          pathname: `./${resource}`,
        })) as [LoadingContext, ...LoadingContext[]]
        ,
        true
      )
    ).to.eventually.rejected.and.satisfies((error: unknown) => {
      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      return error.message === './file1.txt'
    })

    expect(count).to.equal(4)

    await tmpCtx.cleanup()
  })
})
