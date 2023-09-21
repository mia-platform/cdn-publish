import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { afterEach, beforeEach, describe, it } from 'mocha'
import type { Context as MochaContext } from 'mocha'

import { createCommand } from '../../../src/command.js'
import { storageAccessKey, storageZoneName, createServer } from '../../server.js'
import { buildCommandArguments, cliErrorMissingArgument, cliErrorRequiredOption, cliErrorUnknownOption, loggerStub } from '../../utils.js'

interface Context extends MochaContext {
  cleanup?: () => void | PromiseLike<void> | Promise<void>
}

use(chaiAsPromised)

describe('upload files', () => {
  const baseCommand = ['upload']
  const baseArgs = ['-k', storageAccessKey, '-s', storageZoneName]

  beforeEach(async function (this: Context) {
    this.cleanup = await createServer()
  })

  afterEach(async function (this: Context) {
    await this.cleanup?.()
  })

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

    it('-u, --base-url <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-d', '__test', '--base-urlt', 'test', 'file1.txt']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--base-urlt', '--base-url'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-u']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-u, --base-url <string>'))
    })

    it('-d, --dest <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-d, --dest <string>'))
    })

    it('-b, --batch-size <number>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--dest', '__test', '--batch-sizet', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--batch-sizet', '--batch-size'))
    })

    it('--checksum [string]', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '--dest', '__test', '--checksumm']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--checksumm', '--checksum'))
    })
  })

  describe('without arguments', () => {
    it('should throw error if no files provided', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, '-d', '__test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith('There are no files/matcher in args')
    })

    it('should throw error if no dist provided', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, ...baseArgs, 'foo.js']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-d, --dest <string>'))
    })
  })
})

