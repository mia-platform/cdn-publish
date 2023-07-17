
/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs'
import { setTimeout } from 'timers/promises'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { after, before, describe, it } from 'mocha'

import { createCdnContext } from '../../src/cdn.js'
import { createBunnyEdgeStorageClient } from '../../src/clients/bunny-edge-storage.js'
import MysteryBoxError from '../../src/error.js'
import { absoluteResolve } from '../../src/glob.js'
import type { LoadingContext } from '../../src/types.js'

import { storageAccessKey, serverStorageBaseUrl, storageZoneName, indexChecksum, index } from './../server.js'
import { createE2EtestContext, createResources, createTmpDir, loggerStub, sha256 } from './../utils.js'

use(chaiAsPromised)

describe('E2E: bunny edge storage cdn client', () => {
  const cdnCtx = createCdnContext(storageAccessKey, {
    server: serverStorageBaseUrl,
    storageZoneName,
  })
  const client = createBunnyEdgeStorageClient(cdnCtx, loggerStub)
  const sharedFile = 'index.txt'
  const { uuid, createE2EtestPath, clearE2EtestDirectory } = createE2EtestContext()

  before(async () => {
    await clearE2EtestDirectory(cdnCtx)
    const cdnPath = createE2EtestPath('/0.0.0')
    await client.put(
      cdnPath,
      [
        {
          absolutePath: absoluteResolve('./', sharedFile),
          loader: async () => {
            return {
              buffer: Buffer.from(index, 'binary'),
              checksum: indexChecksum,
            }
          },
          pathname: `./${sharedFile}`,
        },
        {
          absolutePath: absoluteResolve('./', 'foo.txt'),
          loader: async () => {
            return {
              buffer: Buffer.from('bar', 'binary'),
              checksum: sha256(Buffer.from('bar', 'binary')),
            }
          },
          pathname: `./foo.txt`,
        },
      ],
      false
    )
  })

  after(async () => {
    await clearE2EtestDirectory(cdnCtx)
  })

  it('should get a list of files', async () => {
    const cdnPath = createE2EtestPath('/0.0.0')
    await expect(client.list(cdnPath))
      .to.eventually.be.fulfilled.and.to.have.length(2)
  })

  it('should fail to get a single file if not exists', async () => {
    const cdnPath = createE2EtestPath('/0.0.0/notExistingFile.json')

    await expect(client.get(cdnPath))
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
    const cdnPath = createE2EtestPath(`/0.0.0/${sharedFile}`)
    await expect(client.get(cdnPath))
      .to.eventually.be.fulfilled.and.be.equal(index)
  })

  it('should revert to directory', async () => {
    const cdnPath = createE2EtestPath('/notExistingFile.json/')
    await expect(client.get(cdnPath))
      .to.eventually.be.fulfilled.and.be.eql([])
  })

  it('should fail to put on a semver dir', async () => {
    const resource = 'index.html'
    const tmpCtx = await createTmpDir(createResources([resource]))
    const cdnPath = createE2EtestPath('/0.0.0/')

    await expect(
      client.put(
        cdnPath,
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

      expect(error.message).to.equal(`Folder ./__test/cdn-publish/${uuid}/0.0.0/ is not empty and scoped with semver versioning`)

      return true
    })

    await tmpCtx.cleanup()
  })

  it('should succed deleting', async () => {
    const cdnPath = createE2EtestPath('/0.0.0/')

    await expect(
      client.delete(cdnPath, `./${sharedFile}`)
    ).to.eventually.be.fulfilled
  })

  it('should succed to put with checksum', async () => {
    const resource = 'index.html'
    const tmpCtx = await createTmpDir(createResources([resource]))
    const cdnPath = createE2EtestPath('/1.0.0/')

    // Sometimes it happens that the cdn doesn't correctly clear the folder, it is a bunnyCdn bug
    await clearE2EtestDirectory(cdnCtx)
    await client.delete(cdnPath, './index.html', true)

    await expect(
      client.put(
        cdnPath,
        [
          {
            absolutePath: absoluteResolve(tmpCtx.name, resource),
            loader: async () => {
              return {
                buffer: Buffer.from(index, 'binary'),
                checksum: indexChecksum,
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
    const cdnPath = createE2EtestPath('/2.0.0/')

    await expect(
      client.put(
        cdnPath,
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
    const cdnPath = createE2EtestPath('/1.0.0/')

    await expect(
      client.delete(cdnPath, './notExistingFile.html')
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
    const cdnPath = createE2EtestPath('/1.0.0/')

    await expect(
      client.delete(cdnPath, './notExistingFile.html', true)
    ).to.eventually.be.fulfilled
  })

  it('should attempt to cleanup the folder on failed upload semver folder', async () => {
    const resources = ['file0.txt', 'file1.txt']
    const tmpCtx = await createTmpDir(createResources(resources))
    const cdnPath = createE2EtestPath('/3.0.0')

    resources.push('NotExistingFile.js')
    await expect(
      client.put(
        cdnPath,
        resources.map((resource) => ({
          absolutePath: absoluteResolve(tmpCtx.name, resource),
          loader(this) {
            return fs.promises.readFile(this.absolutePath)
          },
          pathname: `./${resource}`,
        })) as [LoadingContext, ...LoadingContext[]],
        true,
        1
      )
    ).to.eventually.rejected.and.satisfies((error: unknown) => {
      if (!(error instanceof MysteryBoxError)) {
        return false
      }

      return error.message === './NotExistingFile.js'
    })

    // bunnyCdn bug needs time to remove the file, added the sleep to make test robust
    await setTimeout(1000)
    await expect(client.list(cdnPath))
      .to.eventually.be.fulfilled.and.to.have.length(0)

    await tmpCtx.cleanup()
  })
})
