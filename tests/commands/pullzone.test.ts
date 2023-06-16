import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { describe, it } from 'mocha'

import { createCommand } from '../../src/command.js'
import { accessKey } from '../server.js'
import { buildCommandArguments, cliErrorMissingArgument, cliErrorRequiredOption, cliErrorUnknownOption, loggerStub } from '../utils.js'


use(chaiAsPromised)


describe('pullzone list', () => {
  const baseCommand = ['pullzone', 'list']
  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
    })

    it('-u, --base-url <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '--base-urlt', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--base-urlt', '--base-url'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '-u']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-u, --base-url <string>'))
    })

    it('-s, --search <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '--searcht', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--searcht', '--search'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '-s']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-s, --search <string>'))
    })
  })
})

describe('pullzone purge', () => {
  const baseCommand = ['pullzone', 'purge']
  describe('should have those arguments', () => {
    it('-k, --access-key', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand]),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorRequiredOption('-k, --access-key <string>'))
    })

    it('-u, --base-url <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '--base-urlt', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--base-urlt', '--base-url'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '-u']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-u, --base-url <string>'))
    })

    it('-z, --zone <string>', async () => {
      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '--zonet', 'test']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorUnknownOption('--zonet', '--zone'))

      await expect(createCommand(
        buildCommandArguments([...baseCommand, '-k', accessKey, '-z']),
        global,
        loggerStub
      )).to.be.eventually.rejectedWith(cliErrorMissingArgument('-z, --zone <string>'))
    })
  })
})


