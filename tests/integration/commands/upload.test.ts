import crypto from 'crypto'
import fs from 'fs'
import { setTimeout } from 'timers/promises'

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'

import type { CDN } from '../../../src/cdn'
import { createCdnContext } from '../../../src/cdn.js'
import { createBunnyEdgeStorageClient } from '../../../src/clients/bunny-edge-storage.js'
import { createCommand } from '../../../src/command.js'
import type { RelPath } from '../../../src/types'
import { storageAccessKey, storageZoneName, serverStorageBaseUrl } from '../../server.js'
import { buildCommandArguments, cliErrorRequiredOption, cliErrorUnknownOption, loggerStub } from '../../utils.js'

use(chaiAsPromised)

describe('E2E: upload files', () => {
  const clearE2EtestDirectory = async (cdnCtx: CDN, folder: RelPath) => {
    const client = createBunnyEdgeStorageClient(cdnCtx, loggerStub)
    return client.delete(folder, undefined, true)
  }
  const cdnCtx = createCdnContext(storageAccessKey, {
    server: serverStorageBaseUrl,
    storageZoneName,
  })
  const client = createBunnyEdgeStorageClient(cdnCtx, loggerStub)
  const baseCommand = ['upload']
  const baseArgs = ['-k', storageAccessKey, '-s', storageZoneName]

  describe('should have those arguments', () => {
    it('-k, --storage-access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --storage-access-key <string>'))
    })

    it('-s, --storage-zone-name <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', storageAccessKey]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-s, --storage-zone-name <string>'))
    })

    it('-d, --dest <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-d, --dest <string>'))
    })

    it('missing files', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--dest', '__test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith('There are no files/matcher in args')
    })

    it('-b, --batch-size <number>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-d', '__test', '--batch-sizet', 'test', 'file1']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--batch-sizet', '--batch-size'))
    })

    it('--checksum [string]', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-d', '__test', '--checksumm', 'file1']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--checksumm', '--checksum'))
    })
  })

  describe('without arguments', () => {
    interface Context extends MochaContext {
      currentTest?: MochaContext['currentTest'] & {folder?: string}
      test?: MochaContext['test'] & {folder?: string}
    }
    beforeEach(async function afterEachFn(this: Context) {
      const folder = `__test/${crypto.randomUUID()}`
      this.currentTest && (this.currentTest.folder = folder)
      return clearE2EtestDirectory(cdnCtx, `./${folder}`)
    })
    afterEach(async function afterEachFn(this: Context) {
      const folder = this.currentTest?.folder
      return clearE2EtestDirectory(cdnCtx, `./${folder}`)
    })
    it('should push a single file', async function itFn(this: Context) {
      const folder = this.test?.folder

      await fs.promises.writeFile('file1.txt', 'hello')

      await clearE2EtestDirectory(cdnCtx, `./${folder}`)

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--dest', `${folder}/`, 'file1.txt']),
        global,
        loggerStub
      )).to.be.eventually.fulfilled

      await setTimeout(3000)
      await expect(client.list(`./${folder}/`))
        .to.eventually.be.fulfilled.and.to.have.length(1)

      await fs.promises.rm('file1.txt')
      await clearE2EtestDirectory(cdnCtx, `./${folder}`)
    })
  })
})

